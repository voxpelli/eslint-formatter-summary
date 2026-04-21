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

test('format() csv: malformed rule ids are bucketed into (invalid rule id)', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const quoted = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: 'weird"rule', severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(quoted, { cwd: '/p', output: 'csv' });
  assert.match(out, /"\(invalid rule id\)"/);
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

test('format() markdown: shape-failing rule ids never reach the rendered row', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const injected = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: 'my-plugin/<script>', severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(injected, { cwd: '/p', output: 'markdown' });
  assert.ok(!out.includes('<script>'), 'raw <script> leaked into markdown output');
  assert.ok(!out.includes('&lt;script&gt;'), 'escaped injection text should not appear — id is rejected by the shape guard');
  assert.match(out, /\(invalid rule id\)/);
});

test('format() markdown keeps https URLs (positive control for allowlist)', () => {
  const out = format(fixture, {
    cwd: '/proj',
    output: 'markdown',
    rulesMeta: { semi: { docs: { url: 'https://example.test/semi' } } },
  });
  assert.match(out, /\[semi\]\(https:\/\/example\.test\/semi\)/);
});

test('format() markdown: parser errors surface as (parser error) row with footnote', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const fatal = /** @type {any} */ ([{
    filePath: '/p/broken.js',
    messages: [{ ruleId: null, severity: 2, fatal: true, line: 1, column: 1, message: 'Parsing error: Unexpected token' }],
  }]);
  const out = format(fatal, { cwd: '/p', output: 'markdown' });
  assert.match(out, /\(parser error\)/);
  assert.match(out, /> \*\*Note:\*\*/);
  assert.match(out, /> - `\(parser error\)`/);
});

test('format() markdown: unused-disable classified with detail rendered per file', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const unused = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: null, severity: 1, line: 1, column: 1, message: "Unused eslint-disable directive (no problems were reported from 'no-console')." }],
  }]);
  const out = format(unused, { cwd: '/p', output: 'markdown' });
  assert.match(out, /\(unused disable\)/);
  assert.ok(out.includes('<code>no-console</code>'), `detail should appear per-file; got:\n${out}`);
});

test('format() markdown: missing-rule classified and detail captured', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const missing = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: 'no-undef-plugin/missing', severity: 2, line: 1, column: 1, message: "Definition for rule 'no-undef-plugin/missing' was not found." }],
  }]);
  const out = format(missing, { cwd: '/p', output: 'markdown' });
  assert.match(out, /\(missing rule\)/);
  assert.ok(out.includes('<code>no-undef-plugin/missing</code>'));
  assert.ok(!out.includes('<summary>no-undef-plugin/missing'), 'missing-rule should not render as a fake rule row');
});

test('format() markdown: footnote is omitted when there are no synthetic rows', () => {
  const out = format(fixture, { cwd: '/proj', output: 'markdown' });
  assert.ok(!out.includes('**Note:**'), 'footnote should not appear on a run with only real rules');
});

test('format() csv: synthetic keys render with quotes (structurally safe for CSV)', () => {
  /** @type {import('eslint').ESLint.LintResult[]} */
  const fatal = /** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{ ruleId: null, severity: 2, fatal: true, line: 1, column: 1, message: 'Parsing error' }],
  }]);
  const out = format(fatal, { cwd: '/p', output: 'csv' });
  assert.match(out, /1,0,0,"\(parser error\)"/);
});

test('format() sortReverse inverts order', () => {
  const forward = format(fixture, { cwd: '/proj', output: 'csv' });
  const reversed = format(fixture, { cwd: '/proj', output: 'csv', sortReverse: true });
  const forwardRows = forward.split('\n').slice(1);
  const reversedRows = reversed.split('\n').slice(1);
  assert.deepEqual([...forwardRows].reverse(), reversedRows);
});

test('format() markdown: scrubs secret-shaped tokens in rule ids and file paths', () => {
  const token = 'ghp_' + 'A'.repeat(40);
  const fileToken = 'npm_' + 'B'.repeat(40);
  /** @type {import('eslint').ESLint.LintResult[]} */
  const fx = /** @type {any} */ ([{
    filePath: `/proj/src/${fileToken}.js`,
    messages: [{ ruleId: `rule-${token}`, severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(fx, { cwd: '/proj', output: 'markdown' });
  assert.ok(!out.includes(token), 'GitHub PAT must not survive into formatter markdown');
  assert.ok(!out.includes(fileToken), 'npm token in file path must not survive');
  assert.match(out, /\[REDACTED\]/);
});

test('format() csv: secret-shaped rule ids pass through untouched (machine-consumed)', () => {
  const token = 'ghp_' + 'A'.repeat(40);
  /** @type {import('eslint').ESLint.LintResult[]} */
  const fx = /** @type {any} */ ([{
    filePath: '/proj/src/a.js',
    messages: [{ ruleId: `rule-${token}`, severity: 2, line: 1, column: 1, message: 'x' }],
  }]);
  const out = format(fx, { cwd: '/proj', output: 'csv' });
  assert.ok(out.includes(token), 'CSV branch intentionally does not sanitize — machine output');
});
