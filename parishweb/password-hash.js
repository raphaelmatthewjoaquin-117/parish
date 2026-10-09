import { pbkdf2Sync, randomBytes } from 'node:crypto';

export function hashAspNetPassword(password) {
  const salt = randomBytes(16);
  const subkey = pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  return Buffer.concat([Buffer.from([0x01]), salt, subkey]).toString('base64');
}
