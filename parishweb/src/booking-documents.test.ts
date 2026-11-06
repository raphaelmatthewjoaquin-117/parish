import { describe, expect, it } from 'vitest'
import { validateBookingDocumentUploads } from '../server-rules.js'

const definitions = [
  { FieldKey: 'birthCertificate', Label: 'Birth certificate', FieldType: 'file', IsRequired: true, IsActive: true },
  { FieldKey: 'baptismRecord', Label: 'Certificate of no record of baptism', FieldType: 'file', IsRequired: false, IsActive: true },
  { FieldKey: 'hiddenDocument', Label: 'Hidden document', FieldType: 'file', IsRequired: true, IsActive: false },
]

const pdf = (originalname = 'birth-certificate.pdf') => ({
  originalname,
  mimetype: 'application/pdf',
  size: 5,
  buffer: Buffer.from('%PDF-'),
})

describe('validateBookingDocumentUploads', () => {
  it('requires every visible required document', () => {
    expect(validateBookingDocumentUploads(definitions, [], [])).toEqual({
      error: 'Please upload "Birth certificate".',
    })
  })

  it('accepts a required document and allows optional and hidden documents to be omitted', () => {
    const result = validateBookingDocumentUploads(definitions, ['birthCertificate'], [pdf()])

    expect(result.error).toBeUndefined()
    expect(result.documents).toEqual([
      expect.objectContaining({ key: 'birthCertificate', label: 'Birth certificate' }),
    ])
  })

  it('rejects uploads for unknown fields and files with invalid signatures', () => {
    expect(validateBookingDocumentUploads(definitions, ['unknown'], [pdf()]).error).toMatch(/not available/)
    expect(validateBookingDocumentUploads(definitions, ['birthCertificate'], [{
      ...pdf(),
      buffer: Buffer.from('not a PDF'),
    }]).error).toMatch(/valid PDF or image/)
  })
})
