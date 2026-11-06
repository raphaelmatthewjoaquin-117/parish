import { describe, expect, it } from 'vitest'
import { isValidServicePageContent } from './service-page-content.js'

describe('isValidServicePageContent', () => {
  it('accepts service descriptions with optional uploaded background images', () => {
    expect(isValidServicePageContent({
      '1': { description: 'Baptism details', backgroundImage: '/uploads/baptism.jpg' },
      certificate: { description: 'Certificate details' },
    })).toBe(true)
  })

  it('rejects invalid service keys, descriptions, and image URLs', () => {
    expect(isValidServicePageContent({ '../1': { description: 'Baptism' } })).toBe(false)
    expect(isValidServicePageContent({ '1': { description: 12 } })).toBe(false)
    expect(isValidServicePageContent({ '1': { description: 'Baptism', backgroundImage: 'javascript:alert(1)' } })).toBe(false)
  })
})
