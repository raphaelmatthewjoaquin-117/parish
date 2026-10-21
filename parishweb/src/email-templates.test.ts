import { describe, expect, it } from 'vitest'
import {
  certificateRequestEmail,
  passwordResetEmail,
  serviceBookingEmail,
} from '../email-templates.js'

describe('parish email templates', () => {
  it('creates a certificate request receipt with escaped request details', () => {
    const email = certificateRequestEmail({
      firstName: '<Maria>',
      certificateType: 'Baptism & Confirmation',
      referenceCode: 'CERT-123',
      preferredDate: 'October 21, 2026',
      preferredTime: '10:00 AM',
    })

    expect(email.subject).toBe('We received your certificate request')
    expect(email.html).toContain('Dear &lt;Maria&gt;')
    expect(email.html).toContain('Baptism &amp; Confirmation')
    expect(email.html).toContain('CERT-123')
  })

  it('creates a service booking email with the verification action', () => {
    const email = serviceBookingEmail({
      firstName: 'Juan',
      requestId: 42,
      scheduledDate: 'October 21, 2026',
      scheduledTime: '10:00 AM',
      notes: '<script>bad</script>',
      verificationLink: 'https://example.test/verify?token=abc',
    })

    expect(email.subject).toBe('Please confirm your service booking')
    expect(email.html).toContain('href="https://example.test/verify?token=abc"')
    expect(email.html).toContain('&lt;script&gt;bad&lt;/script&gt;')
    expect(email.html).not.toContain('<script>bad</script>')
  })

  it('creates a time-limited password reset email', () => {
    const email = passwordResetEmail({
      userName: 'Admin',
      resetLink: 'https://example.test/admin/reset-password?token=secret',
    })

    expect(email.subject).toBe('Reset your parish admin password')
    expect(email.html).toContain('href="https://example.test/admin/reset-password?token=secret"')
    expect(email.html).toContain('expires in 30 minutes')
    expect(email.html).toContain('If you did not request this reset')
  })
})
