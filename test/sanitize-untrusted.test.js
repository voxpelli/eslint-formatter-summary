import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeUntrusted } from '../lib/sanitize-untrusted.js';

test('passes plain text through unchanged', () => {
  assert.equal(sanitizeUntrusted('no-unused-vars'), 'no-unused-vars');
  assert.equal(sanitizeUntrusted('src/a.js:10'), 'src/a.js:10');
});

test('scrubs GitHub PATs', () => {
  const token = 'ghp_' + 'A'.repeat(40);
  assert.equal(sanitizeUntrusted(`leak: ${token} here`), 'leak: [REDACTED] here');
  const secret = 'ghs_' + 'B'.repeat(36);
  assert.equal(sanitizeUntrusted(secret), '[REDACTED]');
});

test('scrubs GitHub user tokens', () => {
  const token = 'ghu_' + 'X'.repeat(40);
  assert.equal(sanitizeUntrusted(token), '[REDACTED]');
});

test('scrubs npm tokens', () => {
  const token = 'npm_' + 'z'.repeat(40);
  assert.equal(sanitizeUntrusted(`NPM_TOKEN=${token}`), 'NPM_TOKEN=[REDACTED]');
});

test('scrubs AWS access key IDs', () => {
  assert.equal(sanitizeUntrusted('AKIAIOSFODNN7EXAMPLE'), '[REDACTED]');
});

test('scrubs PEM block headers', () => {
  assert.equal(
    sanitizeUntrusted('leaked: -----BEGIN RSA PRIVATE KEY-----'),
    'leaked: [REDACTED]'
  );
});

test('strips control characters (bidi / zero-width)', () => {
  // eslint-disable-next-line security/detect-bidi-characters -- testing that bidi chars are stripped
  assert.equal(sanitizeUntrusted('a‮b'), 'ab');
});

test('caps length and appends ellipsis', () => {
  const long = 'x'.repeat(300);
  const result = sanitizeUntrusted(long, { maxLength: 50 });
  assert.equal(result.length, 51);
  assert.ok(result.endsWith('…'));
});

test('is idempotent', () => {
  const input = 'foo ghp_' + 'A'.repeat(40) + ' bar';
  assert.equal(sanitizeUntrusted(sanitizeUntrusted(input)), sanitizeUntrusted(input));
});

test('default length cap is 200', () => {
  const long = 'y'.repeat(250);
  const result = sanitizeUntrusted(long);
  assert.equal(result.length, 201);
});

test('collapses embedded newline to a single space', () => {
  assert.equal(sanitizeUntrusted('rule\nid'), 'rule id');
});

test('collapses embedded tab to a single space', () => {
  assert.equal(sanitizeUntrusted('rule\tid'), 'rule id');
});

test('collapses CR-LF sequence to a single space', () => {
  assert.equal(sanitizeUntrusted('a\r\nb'), 'a b');
});

test('collapses mixed consecutive whitespace to a single space', () => {
  assert.equal(sanitizeUntrusted('a\n\n\tb'), 'a b');
});

test('is idempotent after whitespace collapse', () => {
  const input = 'foo\nbar\tbaz\r\nqux';
  assert.equal(sanitizeUntrusted(sanitizeUntrusted(input)), sanitizeUntrusted(input));
});
