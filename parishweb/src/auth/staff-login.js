import { findStaffForLogin } from './postgres-identity.js';

const staffRolePriority = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];

export async function authenticatePostgresStaff(pool, login, password, verifyPassword) {
  const account = await findStaffForLogin(pool, login);
  if (!account) return null;

  const role = staffRolePriority.find(candidate => account.roles.includes(candidate));
  if (!role || !verifyPassword(password, account.passwordHash)) return null;

  return {
    userId: account.userId,
    email: account.email,
    role,
    mustChangePassword: Boolean(account.mustChangePassword),
  };
}
