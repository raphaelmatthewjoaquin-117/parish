export function escapeHtml(value: unknown): string

export function certificateRequestEmail(input: {
  firstName: string
  certificateType: string
  referenceCode: string
  preferredDate: string
  preferredTime: string
}): { subject: string; html: string }

export function serviceBookingEmail(input: {
  firstName: string
  requestId: number | string
  scheduledDate: string
  scheduledTime: string
  notes?: string | null
  verificationLink: string
}): { subject: string; html: string }

export function passwordResetEmail(input: {
  userName: string
  resetLink: string
}): { subject: string; html: string }
