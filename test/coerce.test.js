import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNumericFlag, toCount } from '../lib/cli/coerce.js';
import { InputError } from '../lib/cli/errors.js';

test('toCount passes integers through', () => {
  assert.equal(toCount(5), 5);
  assert.equal(toCount(0), 0);
});

test('toCount coerces numeric strings', () => {
  assert.equal(toCount('7'), 7);
  assert.equal(toCount('42'), 42);
});

test('toCount truncates fractional numbers', () => {
  assert.equal(toCount(3.9), 3);
  assert.equal(toCount('-0.5'), 0);
});

test('toCount collapses NaN / non-numeric / object / null to 0', () => {
  assert.equal(toCount(Number.NaN), 0);
  assert.equal(toCount('not-a-number'), 0);
  assert.equal(toCount({}), 0);
  // eslint-disable-next-line unicorn/no-null -- exercising the null branch of untrusted input
  assert.equal(toCount(null), 0);
});

test('toCount collapses Infinity to 0 (regression: tampered artifact used to render "Infinity errors")', () => {
  assert.equal(toCount(Number.POSITIVE_INFINITY), 0);
  assert.equal(toCount(Number.NEGATIVE_INFINITY), 0);
  assert.equal(toCount('Infinity'), 0);
  assert.equal(toCount(1e308), 1e308);        // finite large number passes through
  assert.equal(toCount(Number.MAX_VALUE), Number.MAX_VALUE);
});

test('toCount clamps negative values to 0', () => {
  assert.equal(toCount(-3), 0);
  assert.equal(toCount('-100'), 0);
});

test('parseNumericFlag returns undefined on empty input', () => {
  assert.equal(parseNumericFlag('', '--x'), undefined);
});

test('parseNumericFlag throws on whitespace-only input', () => {
  // `Number(' ')` is 0 — not empty-string, so the early-return doesn't fire;
  // falls through to the `<= 0` branch. Pin this contract.
  assert.throws(() => parseNumericFlag(' ', '--x'), InputError);
});

test('parseNumericFlag parses positive integers', () => {
  assert.equal(parseNumericFlag('10', '--x'), 10);
  assert.equal(parseNumericFlag('1', '--x'), 1);
});

// Pinning the fractional-input error message separately because the asserted
// pattern is the only case with a message-shape assertion worth preserving.
test('parseNumericFlag throws InputError on fractional input (error message pins the raw value)', () => {
  assert.throws(
    () => parseNumericFlag('1.5', '--size-cap'),
    (err) => err instanceof InputError && /must be a positive integer.*1\.5/.test(err.message),
  );
});

// Parameterised throw cases — each case is individually named & reportable.
for (const raw of ['0', '-3', 'nope', 'Infinity']) {
  test(`parseNumericFlag throws InputError on "${raw}"`, () => {
    assert.throws(() => parseNumericFlag(raw, '--x'), InputError);
  });
}
