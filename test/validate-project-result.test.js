import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidProjectResult } from '../lib/cli/validate-project-result.js';

test('accepts a minimal valid shape', () => {
  assert.equal(isValidProjectResult({ project: 'a/b', rules: {}, syntheticKeys: [] }), true);
});

test('accepts when syntheticKeys is absent', () => {
  assert.equal(isValidProjectResult({ project: 'a/b', rules: {} }), true);
});

test('accepts when project is empty string (prepare default)', () => {
  assert.equal(isValidProjectResult({ project: '', rules: {} }), true);
});

test('accepts rules bucket with files array', () => {
  assert.equal(isValidProjectResult({
    project: 'a/b',
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  }), true);
});

test('rejects null', () => {
  // eslint-disable-next-line unicorn/no-null -- testing the null branch
  assert.equal(isValidProjectResult(null), false);
});

test('rejects undefined', () => {
  // @ts-expect-error -- exercising the omitted-argument runtime fallback branch
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
  assert.equal(isValidProjectResult({ project: '' }), false);
});

test('rejects when rules is null', () => {
  // eslint-disable-next-line unicorn/no-null -- a tampered artifact could carry a literal null here
  assert.equal(isValidProjectResult({ project: '', rules: null }), false);
});

test('rejects when rules is an array', () => {
  assert.equal(isValidProjectResult({ project: '', rules: [] }), false);
});

test('rejects when rules is a non-object primitive', () => {
  assert.equal(isValidProjectResult({ project: '', rules: 'nope' }), false);
  assert.equal(isValidProjectResult({ project: '', rules: 42 }), false);
});

test('rejects when syntheticKeys is present but not an array', () => {
  assert.equal(isValidProjectResult({ project: '', rules: {}, syntheticKeys: 'nope' }), false);
  assert.equal(isValidProjectResult({ project: '', rules: {}, syntheticKeys: {} }), false);
});

test('rejects when project is missing', () => {
  // stripControls iterates the slug with for...of and throws on non-strings —
  // reject at the validator so the aggregate run does not abort on one artifact.
  assert.equal(isValidProjectResult({ rules: {} }), false);
});

test('rejects when project is not a string', () => {
  assert.equal(isValidProjectResult({ project: 42, rules: {} }), false);
  // eslint-disable-next-line unicorn/no-null -- tampered artifact shape
  assert.equal(isValidProjectResult({ project: null, rules: {} }), false);
});

test('rejects when a rule bucket is null', () => {
  // render-project-block destructures bucket then calls `files.slice(...)` —
  // a null bucket would throw TypeError on the spread-fallback path.
  assert.equal(isValidProjectResult({
    // eslint-disable-next-line unicorn/no-null -- tampered artifact shape
    project: 'a/b', rules: { 'no-undef': null },
  }), false);
});

test('rejects when a rule bucket has non-array files', () => {
  assert.equal(isValidProjectResult({
    project: 'a/b',
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: 'a.js:1' } },
  }), false);
});

test('rejects when a rule bucket is missing files', () => {
  assert.equal(isValidProjectResult({
    project: 'a/b',
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0 } },
  }), false);
});
