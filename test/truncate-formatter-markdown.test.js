import assert from 'node:assert/strict';
import test from 'node:test';

import { truncateFormatterMarkdown } from '../lib/truncate-formatter-markdown.js';

const header = '| Errors | Warnings | Fixable | Rule |\n| ------ | -------- | ------- | ---- |\n';

/**
 * @param {number} i
 * @param {string} payload
 * @returns {string}
 */
const makeRow = (i, payload) => `| ${i} | 0 | 0 | ${payload} |\n`;

test('truncateFormatterMarkdown returns input unchanged when under cap', () => {
  const md = header + makeRow(1, 'x'.repeat(100));
  assert.equal(truncateFormatterMarkdown(md, 1, { sizeCap: 100_000 }), md);
});

test('truncateFormatterMarkdown cuts at the last complete row and appends a trailer', () => {
  const rows = Array.from({ length: 6 }, (_, i) => makeRow(i, 'padding '.repeat(500))).join('');
  const md = header + rows;
  const out = truncateFormatterMarkdown(md, 6, { sizeCap: 10_000 });
  assert.ok(out.length < md.length, 'must be truncated');
  // Everything before the trailer must end in `|\n` (i.e. no mid-row cut)
  const body = out.split('\n_(')[0];
  assert.match(body ?? '', /\|\n$/);
  assert.match(out, /rule rows truncated/);
});

test('truncateFormatterMarkdown stays within the byte cap for multi-byte content', () => {
  // 中 = 3 UTF-8 bytes each
  const rows = Array.from({ length: 6 }, (_, i) => makeRow(i, '中'.repeat(1500))).join('');
  const md = header + rows;
  const out = truncateFormatterMarkdown(md, 6, { sizeCap: 15_000 });
  assert.ok(Buffer.byteLength(out, 'utf8') <= 15_000, 'must fit in byte cap');
  assert.ok(out.length < md.length, 'must be truncated');
});

test('truncateFormatterMarkdown clamps gracefully when sizeCap is below HEADROOM', () => {
  // sizeCap (300) < HEADROOM (500). Without Math.max(0, …) clamp, the slice
  // would wrap to the end of the buffer and yield the wrong output.
  const rows = Array.from({ length: 3 }, (_, i) => makeRow(i, 'padding '.repeat(500))).join('');
  const md = header + rows;
  const out = truncateFormatterMarkdown(md, 3, { sizeCap: 300 });
  assert.ok(Buffer.byteLength(out, 'utf8') <= 2_000, 'output must not balloon');
  assert.match(out, /rule rows truncated/);
});

test('truncateFormatterMarkdown reports total dropped-row count accurately', () => {
  const rows = Array.from({ length: 10 }, (_, i) => makeRow(i, 'x'.repeat(500))).join('');
  const md = header + rows;
  const out = truncateFormatterMarkdown(md, 10, { sizeCap: 2_500 });
  const m = out.match(/_\((\d+) rule rows truncated/);
  assert.ok(m, 'trailer should include dropped count');
  const dropped = Number(m?.[1]);
  assert.ok(dropped > 0 && dropped < 10, `dropped count should be between 1 and 9 (got ${dropped})`);
});
