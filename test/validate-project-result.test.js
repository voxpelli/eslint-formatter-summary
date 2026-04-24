import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidProjectResult } from '../lib/cli/validate-project-result.js';

// The validator's purpose is to narrow untrusted JSON to a ProjectResult
// shape safe for downstream iteration. Load-bearing guarantees:
// - `project` must be a string — stripControls iterates the slug via for…of
// - `rules` must be a plain object — Object.entries / Object.values downstream
// - each `rules[k]` must be an object with `files: array` — render-project-
//   block.js:40 calls `.slice(...)` on `files` without a defensive coerce
// - `syntheticKeys`, when present, must be an array
//
// Count fields (errorCount, fixable*, per-rule errors/warnings/fixable) are
// intentionally NOT validated — `toCount` coerces them at render time.

test('accepts valid shapes', () => {
  assert.equal(isValidProjectResult({ project: 'a/b', rules: {}, syntheticKeys: [] }), true);
  assert.equal(isValidProjectResult({ project: 'a/b', rules: {} }), true, 'syntheticKeys optional');
  assert.equal(isValidProjectResult({ project: '', rules: {} }), true, 'empty project (prepare default) is valid');
  assert.equal(isValidProjectResult({
    project: 'a/b',
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  }), true, 'bucket with files array is valid');
});

// Parameterised reject cases — each case is individually named & reportable.
/* eslint-disable unicorn/no-null -- intentional null/undefined fixtures in the table below */
for (const [label, input] of /** @type {Array<[string, unknown]>} */ ([
  // Top-level shape
  ['null', null],
  ['undefined', undefined],
  ['array at top level', []],
  ['string primitive', 'string'],
  ['number primitive', 42],
  ['boolean primitive', true],
  // rules field
  ['rules missing', { project: '' }],
  ['rules null', { project: '', rules: null }],
  ['rules array', { project: '', rules: [] }],
  ['rules string', { project: '', rules: 'nope' }],
  ['rules number', { project: '', rules: 42 }],
  // syntheticKeys
  ['syntheticKeys string', { project: '', rules: {}, syntheticKeys: 'nope' }],
  ['syntheticKeys object', { project: '', rules: {}, syntheticKeys: {} }],
  // project field
  ['project missing', { rules: {} }],
  ['project number', { project: 42, rules: {} }],
  ['project null', { project: null, rules: {} }],
  // rule-bucket shape
  ['bucket null', { project: 'a/b', rules: { 'no-undef': null } }],
  ['bucket files non-array', { project: 'a/b', rules: { 'no-undef': { files: 'a.js:1' } } }],
  ['bucket missing files', { project: 'a/b', rules: { 'no-undef': { errors: 1 } } }],
])) {
/* eslint-enable unicorn/no-null */
  test(`rejects: ${label}`, () => {
    assert.equal(isValidProjectResult(input), false);
  });
}
