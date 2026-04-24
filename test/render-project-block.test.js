import assert from 'node:assert/strict';
import test from 'node:test';

import { renderProjectBlock } from '../lib/cli/render-project-block.js';
import { makeProjectResult as make } from './_helpers.js';

test('renderProjectBlock wraps in <details> with a summary line', () => {
  const out = renderProjectBlock(make({
    errorCount: 2,
    warningCount: 1,
    rules: { 'no-undef': { errors: 2, warnings: 1, fixable: 0, files: ['a.js:1'] } },
  }));
  assert.match(out, /^<details>\n<summary>/);
  assert.ok(out.includes('2 errors, 1 warnings'));
  assert.ok(out.endsWith('\n</details>\n\n'));
});

test('renderProjectBlock shows fixable count in summary when >0', () => {
  const out = renderProjectBlock(make({
    errorCount: 1,
    fixableErrorCount: 1,
    rules: { semi: { errors: 1, warnings: 0, fixable: 1, files: ['a.js:1'] } },
  }));
  assert.ok(out.includes('1 errors, 0 warnings (1 fixable 🔧)'));
});

test('renderProjectBlock emits pipe-table header', () => {
  const out = renderProjectBlock(make({
    errorCount: 1,
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  }));
  assert.match(out, /\| Errors \| Warnings \| Fixable \| Rule \|/);
  assert.match(out, /\|-------:\|---------:\|--------:\|------\|/);
});

test('renderProjectBlock sorts rules by errors desc, then warnings desc, then id asc', () => {
  const out = renderProjectBlock(make({
    errorCount: 4,
    warningCount: 1,
    rules: {
      'b-rule': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] },
      'a-rule': { errors: 2, warnings: 0, fixable: 0, files: ['a.js:1'] },
      'c-rule': { errors: 1, warnings: 1, fixable: 0, files: ['a.js:1'] },
    },
  }));
  const aIdx = out.indexOf('<code>a-rule</code>');
  const bIdx = out.indexOf('<code>b-rule</code>');
  const cIdx = out.indexOf('<code>c-rule</code>');
  assert.ok(aIdx < cIdx && cIdx < bIdx, 'a(2err) before c(1err,1warn) before b(1err,0warn)');
});

test('renderProjectBlock truncates per-rule file list at fileCap with overflow trailer', () => {
  const files = Array.from({ length: 7 }, (_, i) => `a.js:${i + 1}`);
  const out = renderProjectBlock(make({
    errorCount: 7,
    rules: { 'no-undef': { errors: 7, warnings: 0, fixable: 0, files } },
  }), { fileCap: 3 });
  assert.ok(out.includes('… and 4 more'));
  assert.ok(out.includes('a.js:1'));
  assert.ok(out.includes('a.js:3'));
  assert.ok(!out.includes('a.js:4'), 'fourth file should be hidden by cap');
});

test('renderProjectBlock renders fixable column as dash when zero', () => {
  const out = renderProjectBlock(make({
    errorCount: 1,
    rules: { 'no-undef': { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  }));
  assert.match(out, /\| 1 \| 0 \| - \|/);
});

test('renderProjectBlock sort is stable when bucket counts are tampered (non-finite / non-numeric)', () => {
  // A tampered artifact that reaches render without toCount in the sort
  // comparator would produce NaN-dominated ordering (Infinity - Infinity, or
  // 'xx' - 0). Coercing inside the comparator makes the order deterministic:
  // `a` has 3 real errors, `b` has 0 (tampered Infinity collapses to 0 via
  // toCount in the render interpolation AND in the sort).
  const out = renderProjectBlock(make({
    errorCount: 3,
    rules: {
      'b-tampered': { errors: /** @type {any} */ ('Infinity'), warnings: 0, fixable: 0, files: ['b.js:1'] },
      'a-real': { errors: 3, warnings: 0, fixable: 0, files: ['a.js:1'] },
    },
  }));
  // The row for `a-real` must appear before `b-tampered`.
  const aIdx = out.indexOf('a-real');
  const bIdx = out.indexOf('b-tampered');
  assert.ok(aIdx > 0 && bIdx > 0 && aIdx < bIdx,
    `a-real should precede b-tampered in sorted output (got a@${aIdx}, b@${bIdx})`);
  assert.doesNotMatch(out, /Infinity/, 'no Infinity leaks into rendered counts');
});
