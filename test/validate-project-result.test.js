import assert from 'node:assert/strict';
import test from 'node:test';

import isValidProjectResult from '../lib/cli/validate-project-result.js';

test('accepts a minimal valid shape', () => {
  assert.equal(isValidProjectResult({ rules: {}, syntheticKeys: [] }), true);
});

test('accepts when syntheticKeys is absent', () => {
  assert.equal(isValidProjectResult({ rules: {} }), true);
});

test('rejects null', () => {
  // eslint-disable-next-line unicorn/no-null -- testing the null branch
  assert.equal(isValidProjectResult(null), false);
});

test('rejects undefined', () => {
  assert.equal(isValidProjectResult(), false);
});

test('rejects array at top level', () => {
  assert.equal(isValidProjectResult([]), false);
});

test('rejects primitives', () => {
  assert.equal(isValidProjectResult('string'), false);
  assert.equal(isValidProjectResult(42), false);
  assert.equal(isValidProjectResult(true), false);
});

test('rejects when rules is missing', () => {
  assert.equal(isValidProjectResult({}), false);
});

test('rejects when rules is null', () => {
  // eslint-disable-next-line unicorn/no-null -- a tampered artifact could carry a literal null here
  assert.equal(isValidProjectResult({ rules: null }), false);
});

test('rejects when rules is an array', () => {
  assert.equal(isValidProjectResult({ rules: [] }), false);
});

test('rejects when rules is a non-object primitive', () => {
  assert.equal(isValidProjectResult({ rules: 'nope' }), false);
  assert.equal(isValidProjectResult({ rules: 42 }), false);
});

test('rejects when syntheticKeys is present but not an array', () => {
  assert.equal(isValidProjectResult({ rules: {}, syntheticKeys: 'nope' }), false);
  assert.equal(isValidProjectResult({ rules: {}, syntheticKeys: {} }), false);
});
