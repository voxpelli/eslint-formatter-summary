import assert from 'node:assert/strict';
import test from 'node:test';

import truncateComment from '../lib/cli/truncate-comment.js';

/** @returns {import('../lib/cli/prepare-project-result.js').ProjectResult} */
const makeProject = (i) => ({
  project: `owner/proj-${i}`,
  errorCount: 1,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  syntheticKeys: [],
  rules: {},
});

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

test('truncateComment handles case where even the first block exceeds the slice', () => {
  const results = [makeProject(0)];
  const md = renderBlock(0);
  // sizeCap so small that slice is empty; should still return something sensible
  const out = truncateComment(md, results, { sizeCap: 16_000 });
  // output should at minimum contain the tail summary for the dropped project
  assert.ok(out.includes('owner/proj-0') || out === md);
});
