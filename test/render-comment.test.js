import assert from 'node:assert/strict';
import test from 'node:test';

import { renderComment, renderSuccess } from '../lib/cli/render-comment.js';

/** @import { ProjectResult } from '../lib/cli/prepare-project-result.js' */

/**
 * @param {Record<string, unknown>} overrides
 * @returns {ProjectResult}
 */
const make = (overrides = {}) => ({
  project: 'owner/repo',
  errorCount: 0,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  syntheticKeys: [],
  rules: {},
  ...overrides,
});

test('renderAllPass renders the "all N pass" body with the given count', () => {
  const out = renderSuccess(7);
  assert.match(out, /^## External project test results\n\n/);
  assert.match(out, /✅ All 7 external projects pass\n$/);
});

test('renderAllPass falls back to "?" when count is undefined', () => {
  // @ts-expect-error -- exercising the omitted-argument runtime fallback branch
  assert.match(renderSuccess(), /All \? external projects pass/);
});

test('renderAllPass falls back to "?" when count is zero or negative', () => {
  assert.match(renderSuccess(0), /All \? external projects pass/);
  assert.match(renderSuccess(-3), /All \? external projects pass/);
});

test('renderComment sums errors, warnings, and fixable across projects', () => {
  // Distinct totals per axis so a mixed-up error/warning assertion cannot
  // coincidentally pass: errors=5, warnings=11, fixableErrors=1, fixableWarnings=3.
  const out = renderComment([
    make({
      project: 'owner/a',
      errorCount: 2,
      warningCount: 4,
      fixableErrorCount: 1,
      fixableWarningCount: 0,
      rules: { r1: { errors: 2, warnings: 4, fixable: 1, files: ['a.js:1'] } },
    }),
    make({
      project: 'owner/b',
      errorCount: 3,
      warningCount: 7,
      fixableErrorCount: 0,
      fixableWarningCount: 3,
      rules: { r2: { errors: 3, warnings: 7, fixable: 3, files: ['b.js:1'] } },
    }),
  ]);
  assert.match(out, /\*\*2 project\(s\) reported issues\*\* — 5 errors \(1 fixable\), 11 warnings \(3 fixable\)/);
});

test('renderComment omits error/warning clauses when counts are zero', () => {
  const out = renderComment([
    make({
      project: 'owner/a',
      warningCount: 2,
      fixableWarningCount: 1,
      rules: { r1: { errors: 0, warnings: 2, fixable: 1, files: ['a.js:1'] } },
    }),
  ]);
  assert.doesNotMatch(out, /errors \(\d+ fixable\)/);
  assert.match(out, /2 warnings \(1 fixable\)/);
  // Warnings-only fleets must introduce the clause with ` — `, not a bare
  // `, ` that would dangle off the bold header tag.
  assert.match(out, / — 2 warnings \(1 fixable\)/);
  assert.doesNotMatch(out, /\*\*, /);
});

test('renderComment preserves the caller-supplied project order', () => {
  const out = renderComment([
    make({ project: 'owner/zeta', errorCount: 1, rules: { r: { errors: 1, warnings: 0, fixable: 0, files: ['z.js:1'] } } }),
    make({ project: 'owner/alpha', errorCount: 1, rules: { r: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } } }),
  ]);
  assert.ok(out.indexOf('owner/zeta') < out.indexOf('owner/alpha'));
});

test('renderComment emits one <details> block per project', () => {
  const out = renderComment([
    make({ project: 'owner/a', errorCount: 1, rules: { r: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } } }),
    make({ project: 'owner/b', errorCount: 1, rules: { r: { errors: 1, warnings: 0, fixable: 0, files: ['b.js:1'] } } }),
  ]);
  const openings = out.match(/<details>\n<summary>/g) ?? [];
  assert.equal(openings.length, 2);
});

test('renderComment renders the synthetic-key footnote when keys are present', () => {
  const out = renderComment([
    make({
      project: 'owner/a',
      errorCount: 1,
      syntheticKeys: ['(parser error)'],
      rules: { '(parser error)': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
    }),
  ]);
  assert.match(out, /<sub><em><code>\(parser error\)<\/code>/);
});

test('renderComment omits the footnote when no explainable synthetic keys are present', () => {
  const out = renderComment([
    make({ project: 'owner/a', errorCount: 1, rules: { r: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } } }),
  ]);
  assert.doesNotMatch(out, /<sub><em>/);
});

test('renderComment forwards fileCap to project blocks', () => {
  const files = Array.from({ length: 10 }, (_, i) => `a.js:${i + 1}`);
  const out = renderComment([
    make({ project: 'owner/a', errorCount: 10, rules: { r: { errors: 10, warnings: 0, fixable: 0, files } } }),
  ], { fileCap: 3 });
  assert.match(out, /… and 7 more/);
});
