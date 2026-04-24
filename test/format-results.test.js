import assert from 'node:assert/strict';
import test from 'node:test';

import { format } from '../lib/format-results.js';

/** @import { ESLint } from 'eslint' */

/**
 * Typed cast for inline LintResult fixtures — removes the nested double-cast
 * `@type {ESLint.LintResult[]}` / `@type {any}` noise from every call site.
 *
 * @param {any[]} arr
 * @returns {ESLint.LintResult[]}
 */
const results = (arr) => arr;

/**
 * Default call shape: markdown render on `/proj`, sorted by errors. Override
 * only the axis the test cares about.
 *
 * @param {ESLint.LintResult[]} input
 * @param {Partial<Parameters<typeof format>[1]>} [overrides]
 * @returns {string}
 */
const runFormat = (input, overrides) =>
  format(input, { cwd: '/proj', output: 'markdown', sortByProp: 'errors', ...overrides });

const fixture = results([
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

const semiDocsRules = { semi: { docs: { url: 'https://example.test/semi' } } };

test('format() csv has header and one row per rule', () => {
  const out = runFormat(fixture, { output: 'csv' });
  const lines = out.split('\n');
  assert.equal(lines[0], 'errors,warnings,fixable,rule');
  assert.equal(lines.length, 4);
  assert.ok(lines.includes('2,0,0,"no-unused-vars"'), `missing no-unused-vars row; got:\n${out}`);
  assert.ok(lines.includes('2,0,0,"no-undef"'));
  assert.ok(lines.includes('0,2,2,"semi"'));
});

test('format() csv: malformed rule ids are bucketed into (invalid rule id)', () => {
  const out = runFormat(results([
    { filePath: '/p/a.js', messages: [{ ruleId: 'weird"rule', severity: 2, line: 1, column: 1, message: 'x' }] },
  ]), { cwd: '/p', output: 'csv' });
  assert.match(out, /"\(invalid rule id\)"/);
});

// Parameterised csv sort order — errors-sort pins all three rows as the
// strongest assertion; warnings-sort only needs its leader row.
test('format() csv sort-by-errors pins the full row order (errors desc, then rule id asc)', () => {
  const rows = runFormat(fixture, { output: 'csv' }).split('\n').slice(1);
  assert.equal(rows[0], '2,0,0,"no-undef"', 'no-undef before no-unused-vars on id-asc tiebreak');
  assert.equal(rows[1], '2,0,0,"no-unused-vars"');
  assert.equal(rows[2], '0,2,2,"semi"');
});

test('format() csv sort-by-warnings puts the only warning rule first', () => {
  const rows = runFormat(fixture, { output: 'csv', sortByProp: 'warnings' }).split('\n').slice(1);
  assert.equal(rows[0], '0,2,2,"semi"');
});

test('format() markdown produces a table with expected columns', () => {
  const out = runFormat(fixture);
  assert.match(out, /\| Errors +\| Warnings +\| Fixable +\| Rule +\|/);
  assert.match(out, /no-unused-vars/);
  assert.match(out, /<details><summary>/);
});

test('format() markdown renders rule docs links for https URLs (allowlist positive)', () => {
  // Merged: previously split across "renders links" + "keeps https URLs" — same
  // setup, same assertion. One test covers both.
  const out = runFormat(fixture, { rulesMeta: semiDocsRules });
  assert.match(out, /\[semi\]\(https:\/\/example\.test\/semi\)/);
});

test('format() default CLI output contains header, rule rows, and totals', () => {
  const out = runFormat(fixture, { output: undefined });
  assert.ok(out.includes('Summary of failing ESLint rules'));
  assert.ok(out.includes('no-unused-vars'));
  // Pin the specific totals from the fixture (4 errors, 2 warnings, 2 fixable)
  // so a regression that dropped or swapped any count axis fails here.
  assert.match(out, /6 problems in total \(4 errors, 2 warnings, 2 fixable\)/);
});

test('format() markdown escapes </details> inside file paths so nesting cannot break', () => {
  const out = runFormat(results([
    { filePath: '/proj/src/weird</details><script>alert(1)</script>.js', messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }] },
  ]));
  assert.ok(!out.includes('</details><script>'), 'raw </details> leaked into markdown output');
  assert.ok(out.includes('&lt;/details&gt;'), 'expected HTML-escaped </details> in path');
});

test('format() markdown drops non-http docs URLs (javascript: scheme is stripped)', () => {
  const out = runFormat(fixture, {
    rulesMeta: { semi: { docs: { url: /** @type {any} */ ('javascript:alert(1)') } } },
  });
  assert.ok(!out.includes('javascript:'), 'javascript: URL leaked into markdown link');
  assert.ok(out.includes('semi'), 'rule id should still render as plain text');
  assert.ok(!/\[semi\]\(/.test(out), 'no markdown link should be emitted for unsafe URL');
});

test('format() markdown: shape-failing rule ids never reach the rendered row', () => {
  const out = runFormat(results([
    { filePath: '/p/a.js', messages: [{ ruleId: 'my-plugin/<script>', severity: 2, line: 1, column: 1, message: 'x' }] },
  ]), { cwd: '/p' });
  assert.ok(!out.includes('<script>'), 'raw <script> leaked into markdown output');
  assert.ok(!out.includes('&lt;script&gt;'), 'escaped injection text should not appear — id is rejected by the shape guard');
  assert.match(out, /\(invalid rule id\)/);
});

test('format() markdown: parser errors surface as (parser error) row with footnote', () => {
  const out = runFormat(results([
    { filePath: '/p/broken.js', messages: [{ ruleId: undefined, severity: 2, fatal: true, line: 1, column: 1, message: 'Parsing error: Unexpected token' }] },
  ]), { cwd: '/p' });
  assert.match(out, /\(parser error\)/);
  assert.match(out, /> \*\*Note:\*\*/);
  assert.match(out, /> - `\(parser error\)`/);
});

test('format() markdown: unused-disable classified with detail rendered per file', () => {
  const out = runFormat(results([
    { filePath: '/p/a.js', messages: [{ ruleId: undefined, severity: 1, line: 1, column: 1, message: "Unused eslint-disable directive (no problems were reported from 'no-console')." }] },
  ]), { cwd: '/p' });
  assert.match(out, /\(unused disable\)/);
  assert.ok(out.includes('<code>no-console</code>'), `detail should appear per-file; got:\n${out}`);
});

test('format() markdown: missing-rule classified and detail captured', () => {
  const out = runFormat(results([
    { filePath: '/p/a.js', messages: [{ ruleId: 'no-undef-plugin/missing', severity: 2, line: 1, column: 1, message: "Definition for rule 'no-undef-plugin/missing' was not found." }] },
  ]), { cwd: '/p' });
  assert.match(out, /\(missing rule\)/);
  assert.ok(out.includes('<code>no-undef-plugin/missing</code>'));
  assert.ok(!out.includes('<summary>no-undef-plugin/missing'), 'missing-rule should not render as a fake rule row');
});

test('format() markdown: footnote is omitted when there are no synthetic rows', () => {
  const out = runFormat(fixture);
  assert.ok(!out.includes('**Note:**'), 'footnote should not appear on a run with only real rules');
});

test('format() csv: synthetic keys render with quotes (structurally safe for CSV)', () => {
  const out = runFormat(results([
    { filePath: '/p/a.js', messages: [{ ruleId: undefined, severity: 2, fatal: true, line: 1, column: 1, message: 'Parsing error' }] },
  ]), { cwd: '/p', output: 'csv' });
  assert.match(out, /1,0,0,"\(parser error\)"/);
});

test('format() sortReverse inverts order', () => {
  const forward = runFormat(fixture, { output: 'csv' });
  const reversed = runFormat(fixture, { output: 'csv', sortReverse: true });
  assert.deepEqual(forward.split('\n').slice(1).toReversed(), reversed.split('\n').slice(1));
});

test('format() markdown: scrubs secret-shaped tokens in rule ids and file paths', () => {
  const token = 'ghp_' + 'A'.repeat(40);
  const fileToken = 'npm_' + 'B'.repeat(40);
  const out = runFormat(results([
    { filePath: `/proj/src/${fileToken}.js`, messages: [{ ruleId: `rule-${token}`, severity: 2, line: 1, column: 1, message: 'x' }] },
  ]));
  assert.ok(!out.includes(token), 'GitHub PAT must not survive into formatter markdown');
  assert.ok(!out.includes(fileToken), 'npm token in file path must not survive');
  assert.match(out, /\[REDACTED\]/);
});

test('format() markdown: cap.fileCap caps per-rule file list with overflow trailer', () => {
  const many = results(Array.from({ length: 20 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  })));
  const out = runFormat(many, { cap: { fileCap: 5 } });
  assert.match(out, /… and 15 more/);
  // Pin both sides of the cap: the 5th entry (f4) must be present, the 6th
  // (f5) must be hidden. A regression that renders 0 files while still
  // emitting the overflow trailer would pass a lone "f19 hidden" check.
  assert.ok(out.includes('f4.js'), 'last shown file (f4) should be rendered');
  assert.ok(!out.includes('f5.js'), 'first hidden file (f5) should be omitted');
  assert.ok(!out.includes('f19.js'), 'files past fileCap should be hidden');
});

test('format() markdown: cap.sizeCap truncates output and appends trailer', () => {
  const many = results(Array.from({ length: 60 }, (_, i) => ({
    filePath: `/proj/src/${'padding-path-'.repeat(10)}${i}.js`,
    messages: [{ ruleId: `rule-${i}`, severity: 2, line: 1, column: 1, message: 'x' }],
  })));
  const full = runFormat(many);
  const capped = runFormat(many, { cap: { sizeCap: 5_000 } });
  assert.ok(capped.length < full.length, 'capped must be shorter');
  assert.ok(Buffer.byteLength(capped, 'utf8') <= 5_000, 'capped must honor byte limit');
  assert.match(capped, /rule rows truncated/);
});

test('format() csv: cap is ignored (machine output never truncated)', () => {
  const many = results(Array.from({ length: 100 }, (_, i) => ({
    filePath: `/p/f${i}.js`,
    messages: [{ ruleId: `r${i}`, severity: 2, line: 1, column: 1, message: 'x' }],
  })));
  const out = runFormat(many, { cwd: '/p', output: 'csv', cap: { sizeCap: 500, fileCap: 1 } });
  assert.equal(out.split('\n').length, 101, 'every rule row should survive (header + 100 rules)');
});

test('format() csv: secret-shaped rule ids pass through untouched (machine-consumed)', () => {
  const token = 'ghp_' + 'A'.repeat(40);
  const out = runFormat(results([
    { filePath: '/proj/src/a.js', messages: [{ ruleId: `rule-${token}`, severity: 2, line: 1, column: 1, message: 'x' }] },
  ]), { output: 'csv' });
  assert.ok(out.includes(token), 'CSV branch intentionally does not sanitize — machine output');
});
