import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBootstrapInput } from './bootstrap-admin.js';

test('normalizes the first admin account details', () => {
  assert.deepEqual(validateBootstrapInput({
    userName: '  Parish Admin  ',
    email: '  Admin@Parish.org ',
    password: 'a-unique-strong-password',
    confirmation: 'a-unique-strong-password',
  }), {
    userName: 'Parish Admin',
    email: 'admin@parish.org',
    password: 'a-unique-strong-password',
  });
});

test('rejects invalid email addresses', () => {
  assert.throws(() => validateBootstrapInput({
    userName: 'Parish Admin',
    email: 'not-an-email',
    password: 'a-unique-strong-password',
    confirmation: 'a-unique-strong-password',
  }), /valid email/i);
});

test('requires a long password and matching confirmation', () => {
  const input = {
    userName: 'Parish Admin',
    email: 'admin@parish.org',
    password: 'short',
    confirmation: 'short',
  };
  assert.throws(() => validateBootstrapInput(input), /12 to 128 characters/i);
  assert.throws(() => validateBootstrapInput({
    ...input,
    password: 'a-unique-strong-password',
    confirmation: 'a-different-password',
  }), /do not match/i);
});
