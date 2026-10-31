import { describe, expect, it } from 'vitest'
import { isLocalAdminLoginAllowed, isLocalAdminPreviewRequestAllowed } from './local-admin-auth.js'

const localCredentials = {
  nodeEnv: 'development',
  remoteAddress: '::1',
  login: 'localadmin',
  password: 'a-strong-local-password',
  configuredUsername: 'localadmin',
  configuredPassword: 'a-strong-local-password',
  tokenSecret: 'a-random-local-token-secret-that-is-long-enough',
}

describe('isLocalAdminLoginAllowed', () => {
  it('accepts configured credentials from a loopback request in development', () => {
    expect(isLocalAdminLoginAllowed(localCredentials)).toBe(true)
  })

  it('rejects local credentials outside development', () => {
    expect(isLocalAdminLoginAllowed({ ...localCredentials, nodeEnv: 'production' })).toBe(false)
  })

  it('rejects local credentials from non-loopback requests', () => {
    expect(isLocalAdminLoginAllowed({ ...localCredentials, remoteAddress: '192.168.1.25' })).toBe(false)
  })

  it('rejects incorrect credentials and weak or missing configuration', () => {
    expect(isLocalAdminLoginAllowed({ ...localCredentials, password: 'wrong-password' })).toBe(false)
    expect(isLocalAdminLoginAllowed({ ...localCredentials, configuredPassword: 'short' })).toBe(false)
    expect(isLocalAdminLoginAllowed({ ...localCredentials, configuredUsername: '' })).toBe(false)
    expect(isLocalAdminLoginAllowed({ ...localCredentials, tokenSecret: 'short' })).toBe(false)
  })
})

describe('isLocalAdminPreviewRequestAllowed', () => {
  it('only allows the verify request from loopback in development', () => {
    expect(isLocalAdminPreviewRequestAllowed({
      nodeEnv: 'development',
      remoteAddress: '::ffff:127.0.0.1',
      requestPath: '/api/admin/verify',
    })).toBe(true)
    expect(isLocalAdminPreviewRequestAllowed({
      nodeEnv: 'development',
      remoteAddress: '::1',
      requestPath: '/api/admin/users',
    })).toBe(false)
    expect(isLocalAdminPreviewRequestAllowed({
      nodeEnv: 'production',
      remoteAddress: '::1',
      requestPath: '/api/admin/verify',
    })).toBe(false)
  })
})
