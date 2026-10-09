import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import sql from 'mssql';
import { hashAspNetPassword } from '../password-hash.js';

dotenv.config();

const dbAuth = (process.env.DB_AUTH || '').toLowerCase();
const baseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishDB',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  port: Number(process.env.DB_PORT || 1433),
};

let config = { ...baseConfig };
if (dbAuth === 'sql') {
  config = {
    ...baseConfig,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
} else if (dbAuth === 'ntlm') {
  config = {
    ...baseConfig,
    authentication: {
      type: 'ntlm',
      options: {
        domain: process.env.DB_DOMAIN || '',
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
    },
  };
}

async function ask(prompt) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => readline.question(prompt, resolve));
  } finally {
    readline.close();
  }
}

function askHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so the password can be entered without echo.'));
  }

  return new Promise((resolve, reject) => {
    let password = '';
    const decoder = new StringDecoder('utf8');
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    };
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003' || character === '\u0004') {
          finish(new Error('Password entry cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (password.length > 0) {
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

async function resetAdminPassword() {
  const email = (await ask('Admin account email: ')).trim().toLowerCase();
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid account email.');
  }

  const operator = (await ask('Your name or email for the audit record: ')).trim();
  if (!operator || operator.length > 256) {
    throw new Error('A name or email of at most 256 characters is required for the audit record.');
  }

  let password = '';
  for (let attempt = 1; ; attempt++) {
    password = await askHidden('New password (8+ characters; shown as *): ');
    const confirmation = await askHidden('Confirm new password: ');
    if (password.length >= 8 && password === confirmation) break;
    const reason = password.length < 8 ? 'must be at least 8 characters' : 'do not match';
    if (attempt >= 3) {
      throw new Error(`The passwords ${reason}. No password was changed.`);
    }
    console.log(`The passwords ${reason}. Try again (${attempt}/3).`);
  }

  const expectedConfirmation = `RESET ${email}`;
  const typedConfirmation = await ask(`This changes only ${email} in ${baseConfig.database}. Type "${expectedConfirmation}" to continue: `);
  if (typedConfirmation !== expectedConfirmation) {
    throw new Error('Confirmation did not match; no password was changed.');
  }

  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const accountResult = await new sql.Request(transaction)
        .input('email', sql.NVarChar(510), email)
        .query(`
          SELECT TOP (2) u.UserId, u.EmailAddress
          FROM dbo.AspNetUsers u WITH (UPDLOCK, HOLDLOCK)
          WHERE LOWER(u.EmailAddress) = @email
            AND EXISTS (
              SELECT 1
              FROM dbo.AspNetUserRoles ur
              INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
              WHERE ur.UserId = u.UserId AND r.Name = 'Admin'
            )
        `);

      if (accountResult.recordset.length !== 1) {
        throw new Error('Exactly one existing Admin account must match that email. No password was changed.');
      }

      const account = accountResult.recordset[0];
      const updateResult = await new sql.Request(transaction)
        .input('userId', sql.Int, account.UserId)
        .input('passwordHash', sql.NVarChar(1024), hashAspNetPassword(password))
        .query('UPDATE dbo.AspNetUsers SET PasswordHash = @passwordHash WHERE UserId = @userId');

      if (updateResult.rowsAffected[0] !== 1) {
        throw new Error('The account was not updated exactly once. No password was changed.');
      }

      await new sql.Request(transaction)
        .input('action', sql.VarChar(40), 'ResetPassword')
        .input('userId', sql.Int, account.UserId)
        .input('targetName', sql.NVarChar(512), account.EmailAddress)
        .input('operator', sql.NVarChar(512), operator)
        .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ method: 'local-admin-password-reset' }))
        .query(`
          INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
          VALUES (@action, @userId, @targetName, @operator, @details)
        `);

      await transaction.commit();
      console.log(`Password reset completed for ${account.EmailAddress}. The change was recorded in UserManagementAudit.`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } finally {
    await pool.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  resetAdminPassword().catch((error) => {
    console.error(`Admin password reset failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { askHidden, resetAdminPassword };
