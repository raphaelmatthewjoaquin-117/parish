import { createHash, randomBytes } from 'node:crypto'

export function createPasswordResetToken() {
  return randomBytes(32).toString('hex')
}

export function hashPasswordResetToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function isValidPasswordResetToken(token) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token)
}

export function isValidResetPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128
}
