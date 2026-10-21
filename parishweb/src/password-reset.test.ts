import { describe, expect, it } from 'vitest'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidPasswordResetToken,
  isValidResetPassword,
} from '../password-reset.js'

describe('password reset tokens and passwords', () => {
  it('generates random URL-safe tokens and stores only a one-way digest', () => {
    const token = createPasswordResetToken()

    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(hashPasswordResetToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashPasswordResetToken(token)).not.toBe(token)
    expect(createPasswordResetToken()).not.toBe(token)
  })

  it('accepts only correctly shaped tokens', () => {
    expect(isValidPasswordResetToken('a'.repeat(64))).toBe(true)
    expect(isValidPasswordResetToken('a'.repeat(63))).toBe(false)
    expect(isValidPasswordResetToken('g'.repeat(64))).toBe(false)
    expect(isValidPasswordResetToken('')).toBe(false)
  })

  it('enforces the existing staff password length policy', () => {
    expect(isValidResetPassword('12345678')).toBe(true)
    expect(isValidResetPassword('a'.repeat(128))).toBe(true)
    expect(isValidResetPassword('short')).toBe(false)
    expect(isValidResetPassword('a'.repeat(129))).toBe(false)
    expect(isValidResetPassword(12345678)).toBe(false)
  })
})
