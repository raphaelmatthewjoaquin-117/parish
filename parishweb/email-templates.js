const parishName = 'Santo Domingo Parish'
const parishDescription = 'National Shrine of La Naval de Manila'

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character])
}

function emailLayout(title, content) {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; background-color: #f9f6f0; margin: 0; padding: 24px 12px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-top: 4px solid #8b1a1a;">
        <div style="background-color: #8b1a1a; padding: 32px 40px 28px; text-align: center;">
          <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #f0c96e;">${parishName}</p>
          <p style="margin: 0 0 14px; font-family: Arial, sans-serif; font-size: 12px; color: #f3dfb0;">${parishDescription}</p>
          <h1 style="margin: 0; font-size: 24px; font-weight: normal; color: #ffffff;">${title}</h1>
        </div>
        <div style="padding: 32px 40px; color: #333333; font-size: 15px; line-height: 1.7;">
          ${content}
        </div>
        <div style="background-color: #f2ede4; border-top: 1px solid #e0d8cc; padding: 20px 32px; text-align: center; font-family: Arial, sans-serif; font-size: 12px; color: #777777; line-height: 1.6;">
          ${parishName} · ${parishDescription}<br>
          This is an automated message. Please do not reply directly to this email.
        </div>
      </div>
    </div>
  `
}

function detailsCard(rows) {
  return `<div style="background-color: #faf8f4; border-left: 3px solid #8b1a1a; padding: 20px 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${rows.map(([label, value]) => `<tr><td style="padding: 8px 16px 8px 0; color: #777777; vertical-align: top;">${label}</td><td style="padding: 8px 0; color: #222222;">${value}</td></tr>`).join('')}
    </table>
  </div>`
}

export function certificateRequestEmail({ firstName, certificateType, referenceCode, preferredDate, preferredTime }) {
  const html = emailLayout('Certificate Request Received', `
    <p>Dear ${escapeHtml(firstName)},</p>
    <p>We have received your request for a <strong>${escapeHtml(certificateType)}</strong> certificate. Our parish office will review it and contact you to confirm your appointment.</p>
    ${detailsCard([
      ['Reference code', `<strong style="color: #8b1a1a;">${escapeHtml(referenceCode)}</strong>`],
      ['Preferred date', escapeHtml(preferredDate)],
      ['Preferred time', escapeHtml(preferredTime)],
    ])}
    <p>Please keep your reference code to check the status of your request on the Services page.</p>
    <p style="font-size: 13px; color: #777777;">If you did not submit this request, you can ignore this email or contact the parish office.</p>
  `)
  return { subject: 'We received your certificate request', html }
}

export function serviceBookingEmail({ firstName, requestId, scheduledDate, scheduledTime, notes, verificationLink }) {
  const noteRow = notes ? [['Notes', escapeHtml(notes)]] : []
  const html = emailLayout('Confirm Your Service Booking', `
    <p>Dear ${escapeHtml(firstName)},</p>
    <p>We received your service booking. It is pending verification; please review the details and confirm it using the button below.</p>
    ${detailsCard([
      ['Booking ID', escapeHtml(requestId)],
      ['Date', escapeHtml(scheduledDate)],
      ['Time', escapeHtml(scheduledTime)],
      ...noteRow,
    ])}
    <p style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(verificationLink)}" style="display: inline-block; background-color: #8b1a1a; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; padding: 14px 30px; border-radius: 3px;">Confirm My Booking</a>
    </p>
    <p>Your booking will not be finalized until it is verified. If you did not make this booking, you can ignore this email.</p>
  `)
  return { subject: 'Please confirm your service booking', html }
}

export function passwordResetEmail({ userName, resetLink }) {
  const html = emailLayout('Reset Your Admin Password', `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>We received a request to reset the password for your parish staff account. Use the button below to choose a new password.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #8b1a1a; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; padding: 14px 30px; border-radius: 3px;">Reset My Password</a>
    </p>
    <p>This link expires in 30 minutes and can only be used once. If you did not request this reset, ignore this email; your password will not change.</p>
    <p style="font-size: 13px; color: #777777;">For your security, do not forward this email or share the reset link.</p>
  `)
  return { subject: 'Reset your parish admin password', html }
}
