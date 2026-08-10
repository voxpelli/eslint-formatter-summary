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
// - Count fields are required non-negative finite integers — `toCount`
//   coerces at render time but the validator rejects tampered shapes early.

test('accepts valid shapes', () => {
  assert.equal(isValidProjectResult({ project: 'a/b', errorCount: 0, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 1, rules: { 'no-undef': { errors: 0, warnings: 0, fixable: 1, files: ['a.js:1'] } }, syntheticKeys: [] }), true);
  assert.equal(isValidProjectResult({ project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } } }), true, 'syntheticKeys optional');
  assert.equal(isValidProjectResult({ project: '', errorCount: 0, warningCount: 1, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { warnings: 1, files: ['a.js:1'] } } }), true, 'empty project (prepare default) is valid');
  assert.equal(isValidProjectResult({
    project: 'a/b',
    errorCount: 2,
    warningCount: 0,
    fixableErrorCount: 1,
    fixableWarningCount: 0,
    eslintVersion: '9.22',
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  }), true, 'eslintVersion optional string is valid');
  assert.equal(isValidProjectResult({
    project: 'a/b',
    errorCount: 2,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
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
  // eslintVersion field
  ['eslintVersion number', { project: 'a/b', eslintVersion: 42, errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  // count fields (required non-negative finite integers)
  ['errorCount string', { project: 'a/b', errorCount: 'garbage', warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['warningCount boolean', { project: 'a/b', errorCount: 1, warningCount: true, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['errorCount missing', { project: 'a/b', warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['errorCount negative', { project: 'a/b', errorCount: -1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['errorCount float', { project: 'a/b', errorCount: 1.5, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['fixableErrorCount NaN', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: Number.NaN, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } } }],
  ['zero counts with empty rules', { project: 'a/b', errorCount: 0, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: {} }],
  ['bucket errors string', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 'x', files: ['a.js:1'] } } }],
  ['bucket fixable boolean', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { fixable: true, files: ['a.js:1'] } } }],
  // rule-bucket shape
  ['bucket null', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': null } }],
  ['bucket files non-array', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { files: 'a.js:1' } } }],
  ['bucket missing files', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1 } } }],
  ['bucket files non-string member', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { files: [123] } } }],
  ['syntheticKeys non-string member', { project: 'a/b', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: { 'no-undef': { errors: 1, files: ['a.js:1'] } }, syntheticKeys: [42] }],
])) {
/* eslint-enable unicorn/no-null */
  test(`rejects: ${label}`, () => {
    assert.equal(isValidProjectResult(input), false);
  });
}
