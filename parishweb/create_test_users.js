/**
 * Create Test Users for Each Staff Role
 *
 * This script creates test accounts for all 5 staff roles using the same
 * PBKDF2 HMACSHA256 password hashing as the main application.
 *
 * Usage: node create_test_users.js
 *
 * Requires: Database connection configured via environment variables
 * (same as server.js: DB_SERVER, DB_NAME, DB_AUTH, DB_USER, DB_PASSWORD, etc.)
 */

import sql from 'mssql';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================
// ASP.NET Identity PBKDF2 Password Hashing (HMACSHA256, 10000 iterations)
// Format: 0x01 | 16-byte salt | 32-byte subkey (base64 encoded)
// Copied from server.js to ensure identical hashing
// ============================================================
function hashAspNetPassword(password) {
  const salt = crypto.randomBytes(16);
  const subkey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  const buffer = Buffer.alloc(49);
  buffer[0] = 0x01;
  salt.copy(buffer, 1);
  subkey.copy(buffer, 17);
  return buffer.toString('base64');
}

function verifyAspNetPasswordHash(password, storedHash) {
  try {
    const buffer = Buffer.from(storedHash, 'base64');
    if (buffer.length !== 49 || buffer[0] !== 0x01) return false;
    const salt = buffer.subarray(1, 17);
    const storedSubkey = buffer.subarray(17, 49);
    const computedSubkey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
    return crypto.timingSafeEqual(storedSubkey, computedSubkey);
  } catch {
    return false;
  }
}

// ============================================================
// Database Configuration (mirrors server.js)
// ============================================================
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

console.log('Database config:', {
  server: config.server,
  database: config.database,
  authMode: dbAuth || 'integrated',
  user: config.user || '(integrated auth)'
});

// ============================================================
// Test Account Definitions
// ============================================================
const TEST_USERS = [
  { role: 'Admin', email: 'admin@test.local', username: 'admin_test', password: 'Test@123' },
  { role: 'ParishPriest', email: 'priest@test.local', username: 'priest_test', password: 'Test@123' },
  { role: 'Secretary', email: 'secretary@test.local', username: 'secretary_test', password: 'Test@123' },
  { role: 'Bookkeeper', email: 'bookkeeper@test.local', username: 'bookkeeper_test', password: 'Test@123' },
  { role: 'Staff', email: 'staff@test.local', username: 'staff_test', password: 'Test@123' },
];

// Valid roles (matches server.js rolePermissions)
const VALID_ROLES = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];

// ============================================================
// Main Execution
// ============================================================
async function createTestUsers() {
  let pool;

  try {
    // Connect to database
    pool = new sql.ConnectionPool(config);
    pool.on('error', (err) => {
      console.error('Pool error:', err);
    });
    await pool.connect();
    console.log('✓ Connected to database');

    // Ensure all roles exist in AspNetRoles
    console.log('\n--- Ensuring roles exist ---');
    for (const roleName of VALID_ROLES) {
      const roleCheck = await pool.request()
        .input('roleName', sql.VarChar(256), roleName)
        .query(`SELECT RoleId FROM dbo.AspNetRoles WHERE Name = @roleName`);

      if (roleCheck.recordset.length === 0) {
        await pool.request()
          .input('roleName', sql.VarChar(256), roleName)
          .input('normalizedName', sql.VarChar(256), roleName.toUpperCase())
          .query(`
            INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
            VALUES (@roleName, @normalizedName)
          `);
        console.log(`  ✓ Created role: ${roleName}`);
      } else {
        console.log(`  ✓ Role exists: ${roleName}`);
      }
    }

    // Create test users
    console.log('\n--- Creating test users ---');
    let createdCount = 0;
    let skippedCount = 0;

    for (const user of TEST_USERS) {
      // Check if user already exists
      const existingUser = await pool.request()
        .input('email', sql.VarChar(256), user.email)
        .query(`
          SELECT UserId, EmailAddress, PasswordHash
          FROM dbo.AspNetUsers
          WHERE EmailAddress = @email
        `);

      if (existingUser.recordset.length > 0) {
        const existing = existingUser.recordset[0];
        console.log(`  ⊘ Skipped ${user.role} (${user.email}) - already exists as UserId ${existing.UserId}`);
        skippedCount++;

        // Verify password works
        const passwordValid = verifyAspNetPasswordHash(user.password, existing.PasswordHash);
        console.log(`    Password verification: ${passwordValid ? '✓ VALID' : '✗ INVALID (hash mismatch)'}`);

        // Ensure role assignment exists
        await ensureUserRole(pool, existing.UserId, user.role);
        continue;
      }

      // Create new user
      const passwordHash = hashAspNetPassword(user.password);

      const userResult = await pool.request()
        .input('emailAddress', sql.VarChar(256), user.email)
        .input('emailConfirmed', sql.Bit, 1)
        .input('passwordHash', sql.VarChar(512), passwordHash)
        .input('createdAt', sql.DateTime2, new Date())
        .query(`
          INSERT INTO dbo.AspNetUsers (
            EmailAddress, EmailConfirmed, PasswordHash, CreatedAt
          )
          VALUES (
            @emailAddress, @emailConfirmed, @passwordHash, @createdAt
          );
          SELECT SCOPE_IDENTITY() AS UserId;
        `);

      const userId = userResult.recordset[0].UserId;
      console.log(`  ✓ Created ${user.role}: ${user.email} (UserId: ${userId})`);

      // Assign role
      await ensureUserRole(pool, userId, user.role);
      createdCount++;
    }

    // Verify all test users
    console.log('\n--- Verification ---');
    const verifyResult = await pool.request().query(`
      SELECT u.EmailAddress, r.Name as Role
      FROM dbo.AspNetUsers u
      JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.UserId
      JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
      WHERE u.EmailAddress LIKE '%@test.local'
      ORDER BY r.Name
    `);

    console.log('\nTest accounts in database:');
    console.table(verifyResult.recordset.map(r => ({
      Email: r.EmailAddress,
      Role: r.Role
    })));

    console.log(`\nSummary: ${createdCount} created, ${skippedCount} skipped`);
    console.log('\nAll test users use password: Test@123');
    console.log('Login at: http://localhost:5173/admin/events');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

async function ensureUserRole(pool, userId, roleName) {
  // Get role ID
  const roleResult = await pool.request()
    .input('roleName', sql.VarChar(256), roleName)
    .query(`SELECT RoleId FROM dbo.AspNetRoles WHERE Name = @roleName`);

  if (roleResult.recordset.length === 0) {
    console.log(`    ✗ Role "${roleName}" not found in AspNetRoles`);
    return;
  }

  const roleId = roleResult.recordset[0].RoleId;

  // Check if user-role already exists
  const existingRole = await pool.request()
    .input('userId', sql.Int, userId)
    .input('roleId', sql.Int, roleId)
    .query(`SELECT 1 FROM dbo.AspNetUserRoles WHERE UserId = @userId AND RoleId = @roleId`);

  if (existingRole.recordset.length === 0) {
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleId)
      .query(`INSERT INTO dbo.AspNetUserRoles (UserId, RoleId) VALUES (@userId, @roleId)`);
    console.log(`    ✓ Assigned role: ${roleName}`);
  } else {
    console.log(`    ✓ Role already assigned: ${roleName}`);
  }
}

// Run the script
createTestUsers();