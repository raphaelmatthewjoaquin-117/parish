import { describe, expect, it, vi } from 'vitest'
import { createCorsOptions } from './cors-config.js'

describe('createCorsOptions', () => {
  it('allows PATCH requests needed by admin screens', () => {
    expect(createCorsOptions('https://parish.example').methods).toContain('PATCH')
  })

  it('allows only configured browser origins', () => {
    const options = createCorsOptions('https://parish.example')
    const allowed = vi.fn()

    options.origin('https://parish.example', allowed)
    options.origin('https://untrusted.example', allowed)

    expect(allowed).toHaveBeenNthCalledWith(1, null, true)
    expect(allowed.mock.calls[1][0]).toBeInstanceOf(Error)
  })

  it('requires a public HTTPS frontend origin in production', () => {
    expect(() => createCorsOptions(undefined, true))
      .toThrow('FRONTEND_URL must be configured in production.')
    expect(() => createCorsOptions('http://parish.example', true))
      .toThrow('FRONTEND_URL must be a public HTTPS origin in production.')
  })

  it('does not allow the local development origin in production', () => {
    const options = createCorsOptions('https://parish.example', true)
    const allowed = vi.fn()

    options.origin('http://localhost:5173', allowed)

    expect(allowed.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})
