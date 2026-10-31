import { timingSafeEqual } from 'node:crypto'

const loopbackAddresses = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

function matchesSecret(value, expected) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer)
}

export function isLocalAdminLoginAllowed({
  nodeEnv,
  remoteAddress,
  login,
  password,
  configuredUsername,
  configuredPassword,
  tokenSecret,
}) {
  if (nodeEnv !== 'development' || !loopbackAddresses.has(remoteAddress)) return false
  if (
    typeof login !== 'string' || !login || login.length > 128 ||
    typeof password !== 'string' || !password || password.length > 128 ||
    typeof configuredUsername !== 'string' || !configuredUsername || configuredUsername.length > 128 ||
    typeof configuredPassword !== 'string' || configuredPassword.length < 16 || configuredPassword.length > 128 ||
    typeof tokenSecret !== 'string' || tokenSecret.length < 32
  ) return false

  return login.toLowerCase() === configuredUsername.toLowerCase() &&
    matchesSecret(password, configuredPassword)
}

export function isLocalAdminPreviewRequestAllowed({ nodeEnv, remoteAddress, requestPath }) {
  return nodeEnv === 'development' &&
    loopbackAddresses.has(remoteAddress) &&
    requestPath === '/api/admin/verify'
}
