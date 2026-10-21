import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import sql from 'mssql';
import { hashAspNetPassword } from '../password-hash.js';

dotenv.config({ quiet: true });

function validateBootstrapInput({ userName, email, password, confirmation }) {
  const normalizedUserName = typeof userName === 'string' ? userName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedUserName || normalizedUserName.length > 256) {
    throw new Error('Enter a username of 1 to 256 characters.');
  }
  if (normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address of at most 255 characters.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('The password must be 12 to 128 characters.');
  }
  if (password !== confirmation) throw new Error('The passwords do not match.');
  return { userName: normalizedUserName, email: normalizedEmail, password };
}

function databaseConfig() {
  const { DB_AUTH, DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, DB_DOMAIN, DB_PORT } = process.env;
  if (!DB_SERVER || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error('Set DB_SERVER, DB_NAME, DB_USER, and DB_PASSWORD in the local parishweb .env first.');
  }
  const base = {
    server: DB_SERVER,
    database: DB_NAME,
    port: Number(DB_PORT || 1433),
    options: { encrypt: true, trustServerCertificate: true },
  };
  if ((DB_AUTH || '').toLowerCase() === 'sql') {
    return { ...base, user: DB_USER, password: DB_PASSWORD };
  }
  if ((DB_AUTH || '').toLowerCase() === 'ntlm') {
    return {
      ...base,
      authentication: {
        type: 'ntlm',
        options: { domain: DB_DOMAIN || '', userName: DB_USER, password: DB_PASSWORD },
      },
    };
  }
  throw new Error('Set DB_AUTH to sql or ntlm in the local parishweb .env.');
}

function ask(prompt) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => readline.question(prompt, answer => {
    readline.close();
    resolve(answer);
  }));
}

function askHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so passwords are not displayed.'));
  }
  return new Promise((resolve, reject) => {
    let password = '';
    const decoder = new StringDecoder('utf8');
    const finish = error => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    };
    const onData = chunk => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Password entry cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          if (password.length) {
            password = [...password].slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
        } else if (character >= ' ') {
          password += character;
          process.stdout.write('*');
        }
      }
    };
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function bootstrapAdmin() {
  const config = databaseConfig();
  const userName = await ask('First Admin username: ');
  const email = await ask('First Admin email: ');
  const password = await askHidden('New password (12+ characters; shown as *): ');
  const confirmation = await askHidden('Confirm password: ');
  const account = validateBootstrapInput({ userName, email, password, confirmation });
  const operator = (await ask('Setup performed by (name): ')).trim();
  if (!operator || operator.length > 256) throw new Error('Enter a name of at most 256 characters for the audit record.');

  const confirmationText = `CREATE FIRST ADMIN IN ${config.database}`;
  const typedConfirmation = await ask(`This will create the first Admin in database "${config.database}". Type "${confirmationText}" to continue: `);
  if (typedConfirmation !== confirmationText) throw new Error('Confirmation did not match; no account was created.');

  const pool = new sql.ConnectionPool(config);
  let transaction;
  let transactionStarted = false;
  try {
    await pool.connect();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const existingUsers = await transaction.request()
      .query('SELECT COUNT_BIG(*) AS UserCount FROM dbo.AspNetUsers WITH (TABLOCKX, HOLDLOCK)');
    if (Number(existingUsers.recordset[0].UserCount) !== 0) {
      throw new Error('Staff accounts already exist. Bootstrap is only allowed on an empty staff account table.');
    }

    let role = await transaction.request()
      .input('name', sql.NVarChar(255), 'Admin')
      .query('SELECT RoleId FROM dbo.AspNetRoles WITH (UPDLOCK, HOLDLOCK) WHERE Name = @name');
    if (!role.recordset[0]) {
      role = await transaction.request()
        .input('name', sql.NVarChar(255), 'Admin')
        .input('normalizedName', sql.NVarChar(450), 'ADMIN')
        .query('INSERT INTO dbo.AspNetRoles (Name, NormalizedName) OUTPUT INSERTED.RoleId VALUES (@name, @normalizedName)');
    }

    const insertedUser = await transaction.request()
      .input('userName', sql.NVarChar(256), account.userName)
      .input('email', sql.NVarChar(255), account.email)
      .input('passwordHash', sql.NVarChar(512), hashAspNetPassword(account.password))
      .query(`
        INSERT INTO dbo.AspNetUsers (UserName, EmailAddress, EmailConfirmed, PasswordHash, CreatedAt, MustChangePassword)
        OUTPUT INSERTED.UserId
        VALUES (@userName, @email, 1, @passwordHash, SYSUTCDATETIME(), 1)
      `);
    const userId = insertedUser.recordset[0].UserId;
    await transaction.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, role.recordset[0].RoleId)
      .query('INSERT INTO dbo.AspNetUserRoles (UserId, RoleId) VALUES (@userId, @roleId)');
    await transaction.request()
      .input('action', sql.VarChar(40), 'BootstrapAdmin')
      .input('userId', sql.Int, userId)
      .input('userName', sql.NVarChar(256), account.userName)
      .input('operator', sql.NVarChar(256), operator)
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ email: account.email }))
      .query(`
        INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
        VALUES (@action, @userId, @userName, @operator, @details)
      `);

    await transaction.commit();
    transactionStarted = false;
    console.log(`First Admin account created for ${account.email}. Sign in and change the password when prompted.`);
  } catch (error) {
    if (transactionStarted) await transaction.rollback();
    throw error;
  } finally {
    await pool.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bootstrapAdmin().catch(error => {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { bootstrapAdmin, validateBootstrapInput };
