import { describe, expect, it } from 'vitest'
import { assertProductionStorageConfiguration, createDatabaseConfig } from './config.js'
import { checkDatabaseReadiness } from './readiness.js'

describe('createDatabaseConfig', () => {
  it('validates SQL certificates in production by default', () => {
    const config = createDatabaseConfig({
      NODE_ENV: 'production',
      DB_AUTH: 'sql',
      DB_SERVER: 'sql.example.com',
      DB_NAME: 'ParishDB',
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_PORT: '1444',
    })

    expect(config.options.trustServerCertificate).toBe(false)
    expect(config.port).toBe(1444)
    expect(config.server).toBe('sql.example.com')
    expect(config.user).toBe('app')
  })

  it('requires explicit production SQL credentials', () => {
    expect(() => createDatabaseConfig({
      NODE_ENV: 'production',
      DB_AUTH: 'sql',
    })).toThrow('DB_SERVER must be configured in production.')
  })

  it('rejects disabling SQL certificate validation in production', () => {
    expect(() => createDatabaseConfig({
      NODE_ENV: 'production',
      DB_TRUST_SERVER_CERTIFICATE: 'true',
    })).toThrow('DB_TRUST_SERVER_CERTIFICATE cannot be true in production.')
  })

  it('allows the development certificate setting to be overridden', () => {
    const config = createDatabaseConfig({
      NODE_ENV: 'development',
      DB_TRUST_SERVER_CERTIFICATE: 'false',
    })

    expect(config.options.trustServerCertificate).toBe(false)
  })

  it('rejects an invalid certificate setting', () => {
    expect(() => createDatabaseConfig({
      DB_TRUST_SERVER_CERTIFICATE: 'yes',
    })).toThrow('DB_TRUST_SERVER_CERTIFICATE must be true or false.')
  })

  it('requires Azure Blob Storage in production', () => {
    expect(() => assertProductionStorageConfiguration(
      { NODE_ENV: 'production' },
      false,
    )).toThrow('Azure Blob Storage must be configured in production.')
  })

  it('allows local filesystem uploads outside production', () => {
    expect(() => assertProductionStorageConfiguration(
      { NODE_ENV: 'development' },
      false,
    )).not.toThrow()
  })
})

describe('checkDatabaseReadiness', () => {
  it('succeeds only after a database query succeeds', async () => {
    const pool = {
      request: () => ({
        query: async (query: string) => ({ query }),
      }),
    }

    await expect(checkDatabaseReadiness(pool)).resolves.toBeUndefined()
  })

  it('propagates a database query failure for the route to report as not ready', async () => {
    const pool = {
      request: () => ({
        query: async () => {
          throw new Error('Database unavailable')
        },
      }),
    }

    await expect(checkDatabaseReadiness(pool)).rejects.toThrow('Database unavailable')
  })
})
