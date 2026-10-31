import { describe, expect, it } from 'vitest'
import { hasValidArchiveSignature } from '../server-rules.js'

describe('hasValidArchiveSignature', () => {
  it.each([
    ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ['image/jpeg', [0xff, 0xd8, 0xff]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/tiff', [0x49, 0x49, 0x2a, 0x00]],
    ['image/tiff', [0x4d, 0x4d, 0x00, 0x2a]],
  ])('accepts a valid %s signature', (mimeType, bytes) => {
    expect(hasValidArchiveSignature(mimeType, Uint8Array.from(bytes))).toBe(true)
  })

  it('rejects mismatched, truncated, and unsupported file contents', () => {
    expect(hasValidArchiveSignature('application/pdf', Uint8Array.from([0x00]))).toBe(false)
    expect(hasValidArchiveSignature('image/png', Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(false)
    expect(hasValidArchiveSignature('image/webp', Uint8Array.from([0x52, 0x49, 0x46, 0x46]))).toBe(false)
    expect(hasValidArchiveSignature('application/pdf', 'not bytes')).toBe(false)
  })
})
