import { createHmac, timingSafeEqual } from 'node:crypto';

const staffTokenLifetimeSeconds = 8 * 60 * 60;
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'PARISH' })).toString('base64url');

function isSigningSecret(secret) {
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32;
}

export function createStaffToken(userId, secret, now = Date.now()) {
  if (!isSigningSecret(secret)) {
    throw new Error('ADMIN_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
  }
  if (!Number.isSafeInteger(userId) || userId < 0 || !Number.isFinite(now)) {
    throw new Error('Staff token claims are invalid.');
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    userId,
    iat: issuedAt,
    exp: issuedAt + staffTokenLifetimeSeconds,
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function parseStaffToken(token, secret, now = Date.now()) {
  if (!isSigningSecret(secret) || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== header) return null;

  const signingInput = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  let actual;
  try {
    actual = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    if (
      claims?.v !== 1 ||
      !Number.isSafeInteger(claims.userId) ||
      claims.userId < 0 ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.iat > nowSeconds ||
      claims.exp <= nowSeconds ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > staffTokenLifetimeSeconds
    ) return null;

    return {
      userId: claims.userId,
      role: claims.userId === 0 ? 'Admin' : null,
      email: null,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
}
