import assert from 'node:assert/strict';
import test from 'node:test';

import { format } from '../lib/format-results.js';

/** @type {import('eslint').ESLint.LintResult[]} */
const fixture = /** @type {any} */ ([
  {
    filePath: '/proj/src/a.js',
    messages: [
      { ruleId: 'no-unused-vars', severity: 2, line: 1, column: 1, message: 'x' },
      { ruleId: 'no-unused-vars', severity: 2, line: 2, column: 1, message: 'x' },
      { ruleId: 'no-undef', severity: 2, line: 3, column: 1, message: 'y' },
      { ruleId: 'semi', severity: 1, fix: { range: [0, 0], text: ';' }, line: 4, column: 1, message: 'z' },
    ],
  },
  {
    filePath: '/proj/src/b.js',
    messages: [
      { ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'y' },
      { ruleId: 'semi', severity: 1, fix: { range: [0, 0], text: ';' }, line: 2, column: 1, message: 'z' },
    ],
  },
]);

test('format() csv has header and one row per rule', () => {
  const out = format(fixture, { cwd: '/proj', output: 'csv' });
  const lines = out.split('\n');
  assert.equal(lines[0], 'errors,warnings,fixable,rule');
  assert.equal(lines.length, 4);
  assert.ok(lines.some(l => l === '2,0,0,"no-unused-vars"'), `missing no-unused-vars row; got:\n${out}`);
  assert.ok(lines.some(l => l === '2,0,0,"no-undef"'));
  assert.ok(lines.some(l => l === '0,2,2,"semi"'));
});

test('format() csv escapes quotes in rule ids', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const quoted = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: 'weird"rule', severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(quoted, { cwd: '/p', output: 'csv' });
  assert.match(out, /"weird""rule"/);
});

test('format() csv sorts by errors desc by default, then by rule id', () => {
  const out = format(fixture, { cwd: '/proj', output: 'csv' });
  const rows = out.split('\n').slice(1);
  // both no-unused-vars and no-undef have 2 errors; tiebreak by ruleId asc
  assert.equal(rows[0], '2,0,0,"no-undef"');
  assert.equal(rows[1], '2,0,0,"no-unused-vars"');
  assert.equal(rows[2], '0,2,2,"semi"');
});

test('format() csv sorts by warnings when sortByProp=warnings', () => {
  const out = format(fixture, { cwd: '/proj', output: 'csv', sortByProp: 'warnings' });
  const rows = out.split('\n').slice(1);
  assert.equal(rows[0], '0,2,2,"semi"');
});

test('format() markdown produces a table with expected columns', () => {
  const out = format(fixture, { cwd: '/proj', output: 'markdown' });
  assert.match(out, /\| Errors +\| Warnings +\| Fixable +\| Rule +\|/);
  assert.match(out, /no-unused-vars/);
  assert.match(out, /<details><summary>/);
});

test('format() markdown renders rule docs links when rulesMeta provides url', () => {
  const out = format(fixture, {
    cwd: '/proj',
    output: 'markdown',
    rulesMeta: {
      semi: { docs: { url: 'https://example.test/semi' } },
    },
  });
  assert.match(out, /\[semi\]\(https:\/\/example\.test\/semi\)/);
});

test('format() default CLI output contains header, rule rows, and totals', () => {
  const out = format(fixture, { cwd: '/proj' });
  assert.ok(out.includes('Summary of failing ESLint rules'));
  assert.ok(out.includes('no-unused-vars'));
  assert.ok(out.includes('problems in total'));
  assert.ok(out.includes('fixable'));
});

test('format() markdown escapes </details> inside file paths so nesting cannot break', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const injected = /** @type {any} */ ([{
    filePath: '/proj/src/weird</details><script>alert(1)</script>.js',
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(injected, { cwd: '/proj', output: 'markdown' });
  assert.ok(!out.includes('</details><script>'), 'raw </details> leaked into markdown output');
  assert.ok(out.includes('&lt;/details&gt;'), 'expected HTML-escaped </details> in path');
});

test('format() markdown drops non-http docs URLs (javascript: scheme is stripped)', () => {
  const out = format(fixture, {
    cwd: '/proj',
    output: 'markdown',
    rulesMeta: {
      semi: { docs: { url: /** @type {any} */ ('javascript:alert(1)') } },
    },
  });
  assert.ok(!out.includes('javascript:'), 'javascript: URL leaked into markdown link');
  assert.ok(out.includes('semi'), 'rule id should still render as plain text');
  assert.ok(!/\[semi\]\(/.test(out), 'no markdown link should be emitted for unsafe URL');
});

test('format() markdown escapes HTML-special chars in rule ids', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const injected = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: 'my-plugin/<script>', severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(injected, { cwd: '/p', output: 'markdown' });
  assert.ok(!out.includes('<script>'), 'raw <script> leaked into markdown summary');
  assert.ok(out.includes('&lt;script&gt;'));
});

test('format() markdown keeps https URLs (positive control for allowlist)', () => {
  const out = format(fixture, {
    cwd: '/proj',
    output: 'markdown',
    rulesMeta: { semi: { docs: { url: 'https://example.test/semi' } } },
  });
  assert.match(out, /\[semi\]\(https:\/\/example\.test\/semi\)/);
});

test('format() sortReverse inverts order', () => {
  const forward = format(fixture, { cwd: '/proj', output: 'csv' });
  const reversed = format(fixture, { cwd: '/proj', output: 'csv', sortReverse: true });
  const forwardRows = forward.split('\n').slice(1);
  const reversedRows = reversed.split('\n').slice(1);
  assert.deepEqual([...forwardRows].reverse(), reversedRows);
});
