import assert from 'node:assert/strict';
import test from 'node:test';

import truncateComment from '../lib/cli/truncate-comment.js';

/** @import { ProjectResult } from '../lib/cli/prepare-project-result.js' */

/**
 * @param {number} i
 * @returns {ProjectResult}
 */
const makeProject = (i) => ({
  project: `owner/proj-${i}`,
  errorCount: 1,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  syntheticKeys: [],
  rules: {},
});

/**
 * @param {number} i
 * @returns {string}
 */
const renderBlock = (i) =>
  `<details>\n<summary>owner/proj-${i}</summary>\n\n` +
  'padding '.repeat(500) +   // ~4 KB per block
  '\n</details>\n\n';

test('truncateComment returns input unchanged when under size cap', () => {
  const results = [makeProject(0), makeProject(1)];
  const md = renderBlock(0) + renderBlock(1);
  assert.equal(truncateComment(md, results, { sizeCap: 100_000 }), md);
});

test('truncateComment rewinds to the last </details> anchor', () => {
  const results = Array.from({ length: 6 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => renderBlock(i)).join('');
  // With ~4KB per block and sizeCap=10000, we'd slice at 10000-15000=negative,
  // so use a larger cap that still forces truncation.
  const out = truncateComment(md, results, { sizeCap: 20_000 });
  assert.ok(out.length < md.length, 'should have truncated');
  // kept content must end in </details>\n\n (no mid-tag truncation)
  const keptPortion = out.split('<details><summary>Tail projects')[0];
  assert.match(keptPortion ?? '', /\n<\/details>\n\n$/);
});

test('truncateComment appends a compact tail-summary table for dropped projects', () => {
  const results = Array.from({ length: 6 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => renderBlock(i)).join('');
  const out = truncateComment(md, results, { sizeCap: 20_000 });
  assert.match(out, /<summary>Tail projects \(\d+ truncated/);
  assert.match(out, /\| Project \| Errors \| Warnings \| Fixable \|/);
  // Each truncated project's slug appears in the tail table
  assert.ok(out.includes('owner/proj-5'), 'last project should be in tail');
});

test('truncateComment appends the step-summary trailer', () => {
  const results = Array.from({ length: 6 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => renderBlock(i)).join('');
  const out = truncateComment(md, results, { sizeCap: 20_000 });
  assert.match(out, /file:line detail truncated for tail projects/);
});

test('truncateComment keeps <details> tags balanced when first block exceeds slice window', () => {
  // Regression: the lastClose === -1 branch previously set keptMd = slice,
  // leaving an unclosed `<details>` that the tail summary's own `</details>`
  // would absorb — visually nesting the tail table inside proj-0.
  const fatBlock = '<details>\n<summary>owner/proj-0</summary>\n\n' +
    'x'.repeat(20_000) + '\n</details>\n\n';
  const results = [makeProject(0)];
  const out = truncateComment(fatBlock, results, { sizeCap: 18_000 });
  const opens = (out.match(/<details[\s>]/g) ?? []).length;
  const closes = (out.match(/<\/details>/g) ?? []).length;
  assert.equal(opens, closes, 'every <details> must have a matching </details>');
});

test('truncateComment handles case where the first block exceeds the slice window', () => {
  // Build a fixture that is larger than sizeCap so truncation actually runs,
  // and where the first block alone is larger than `sizeCap - HEADROOM` so
  // the initial slice contains no closing </details> anchor. Exercises the
  // lastClose === -1 fallback branch in truncate-comment.
  const fatBlock = '<details>\n<summary>owner/proj-0</summary>\n\n' +
    'x'.repeat(20_000) + '\n</details>\n\n';
  const results = [makeProject(0)];
  assert.ok(Buffer.byteLength(fatBlock, 'utf8') > 18_000, 'fixture must exceed cap');
  const out = truncateComment(fatBlock, results, { sizeCap: 18_000 });
  assert.notEqual(out, fatBlock, 'must have been truncated');
  assert.ok(out.includes('owner/proj-0'), 'dropped project should appear in tail');
  assert.match(out, /<summary>Tail projects \(1 truncated/);
});

test('truncateComment clamps gracefully when sizeCap is below HEADROOM', () => {
  // sizeCap (5000) < HEADROOM (15000) → (sizeCap - HEADROOM) is negative.
  // Without the Math.max(0, …) clamp, Buffer.subarray would interpret the
  // negative end as (buf.length + end), silently yielding a wrong slice.
  const results = Array.from({ length: 3 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => renderBlock(i)).join('');
  const out = truncateComment(md, results, { sizeCap: 5_000 });
  assert.ok(Buffer.byteLength(out, 'utf8') <= 20_000, 'output must not balloon');
  assert.match(out, /<summary>Tail projects \(3 truncated/);
});

test('truncateComment falls back to a short note when tail summary itself exceeds sizeCap', () => {
  // 400 truncated projects × ~60 bytes/row far exceeds HEADROOM (15 000),
  // pushing the assembled output past sizeCap. The final byte-check must
  // swap the tail table for a short fallback line so the output still fits.
  const results = Array.from({ length: 400 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => renderBlock(i)).join('');
  const out = truncateComment(md, results, { sizeCap: 20_000 });
  assert.ok(
    Buffer.byteLength(out, 'utf8') <= 20_000,
    'output must fit within sizeCap even with a pathological tail length'
  );
  assert.match(out, /tail projects omitted/);
  // The full per-project table must NOT have been emitted
  assert.ok(!out.includes('<summary>Tail projects'));
});

/**
 * @param {number} i
 * @returns {string}
 */
const cjkBlock = (i) =>
  `<details>\n<summary>owner/proj-${i}</summary>\n\n` +
  '中'.repeat(1500) + '\n</details>\n\n';

test('truncateComment output stays within the byte cap even with multi-byte content', () => {
  // Each '中' is 3 UTF-8 bytes. A code-unit slice at N chars would re-encode
  // to up to ~3N bytes, blowing the cap. Byte-safe slice must hold the line.
  const results = Array.from({ length: 6 }, (_, i) => makeProject(i));
  const md = results.map((_, i) => cjkBlock(i)).join('');
  const out = truncateComment(md, results, { sizeCap: 20_000 });
  assert.ok(Buffer.byteLength(out, 'utf8') <= 20_000, 'output must fit in byte cap');
  assert.ok(out.length < md.length, 'must have been truncated');
});
