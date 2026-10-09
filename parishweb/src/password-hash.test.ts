import { describe, expect, it } from 'vitest';
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { hashAspNetPassword } from '../password-hash.js';

describe('hashAspNetPassword', () => {
  it('creates a hash accepted by the staff login verifier', () => {
    const password = 'example password';
    const hash = Buffer.from(hashAspNetPassword(password), 'base64');

    expect(hash).toHaveLength(49);
    expect(hash[0]).toBe(0x01);

    const salt = hash.subarray(1, 17);
    const storedSubkey = hash.subarray(17, 49);
    const computedSubkey = pbkdf2Sync(password, salt, 10000, 32, 'sha256');
    expect(timingSafeEqual(storedSubkey, computedSubkey)).toBe(true);
  });

  it('uses a fresh salt for each password hash', () => {
    expect(hashAspNetPassword('same password')).not.toBe(hashAspNetPassword('same password'));
  });
});
