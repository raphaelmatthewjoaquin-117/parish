import { describe, expect, it } from 'vitest';
import { createStaffToken, parseStaffToken } from './staff-token.js';

const signingSecret = 'a'.repeat(32);

describe('staff token', () => {
  it('signs an expiring token without embedding the signing secret', () => {
    const token = createStaffToken(42, signingSecret, 1_000_000);

    expect(token).not.toContain(signingSecret);
    expect(parseStaffToken(token, signingSecret, 1_000_001)).toEqual({
      userId: 42,
      role: null,
      email: null,
      expiresAt: 1_000_000 + 8 * 60 * 60 * 1000,
    });
  });

  it('rejects a token signed with another secret', () => {
    const token = createStaffToken(42, signingSecret, 1_000_000);

    expect(parseStaffToken(token, 'b'.repeat(32), 1_000_001)).toBeNull();
  });

  it('rejects tampered payloads and signatures', () => {
    const token = createStaffToken(42, signingSecret, 1_000_000);
    const [header, payload, signature] = token.split('.');

    expect(parseStaffToken(`${header}.${payload.slice(0, -1)}A.${signature}`, signingSecret, 1_000_001))
      .toBeNull();
    expect(parseStaffToken(`${header}.${payload}.${'A'.repeat(signature.length)}`, signingSecret, 1_000_001))
      .toBeNull();
  });

  it('rejects expired, malformed, and overlong tokens', () => {
    const token = createStaffToken(42, signingSecret, 1_000_000);

    expect(parseStaffToken(token, signingSecret, 1_000_000 + 8 * 60 * 60 * 1000)).toBeNull();
    expect(parseStaffToken('not-a-token', signingSecret, 1_000_001)).toBeNull();

    const payload = Buffer.from(JSON.stringify({
      v: 1,
      userId: 42,
      iat: 1,
      exp: 1 + 8 * 60 * 60 + 1,
    })).toString('base64url');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'PARISH' })).toString('base64url');
    expect(parseStaffToken(`${header}.${payload}.invalid`, signingSecret, 1_001)).toBeNull();
  });

  it('requires a strong signing secret', () => {
    expect(() => createStaffToken(42, 'short', 1_000_000))
      .toThrow('ADMIN_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
    expect(parseStaffToken('malformed', 'short', 1_000_001)).toBeNull();
  });
});
