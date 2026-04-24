import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMessagesFrom } from '../lib/extract-messages.js';

/** @import { ESLint } from 'eslint' */

test('extractMessagesFrom returns empty array for empty results', () => {
  assert.deepEqual(extractMessagesFrom([], { cwd: '/proj' }), []);
});

test('extractMessagesFrom flattens messages across files, tagging filePathRelative', () => {
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([
    {
      filePath: '/proj/src/a.js',
      messages: [
        { ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' },
        { ruleId: 'no-unused-vars', severity: 2, line: 2, column: 1, message: 'y' },
      ],
    },
    {
      filePath: '/proj/src/b.js',
      messages: [{ ruleId: 'semi', severity: 1, line: 3, column: 1, message: 'z' }],
    },
  ]));

  const out = extractMessagesFrom(results, { cwd: '/proj' });

  assert.equal(out.length, 3);
  assert.equal(out[0]?.filePathRelative, 'src/a.js');
  assert.equal(out[1]?.filePathRelative, 'src/a.js');
  assert.equal(out[2]?.filePathRelative, 'src/b.js');
  assert.equal(out[0]?.ruleId, 'no-undef');
});

test('extractMessagesFrom preserves message order per file and file order in results', () => {
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([
    { filePath: '/p/z.js', messages: [{ ruleId: 'r1', severity: 2, line: 1, column: 1, message: 'a' }] },
    { filePath: '/p/a.js', messages: [{ ruleId: 'r2', severity: 2, line: 1, column: 1, message: 'b' }] },
  ]));

  const out = extractMessagesFrom(results, { cwd: '/p' });
  assert.deepEqual(out.map(m => m.filePathRelative), ['z.js', 'a.js']);
});

test('extractMessagesFrom copies every LintMessage field through (including null ruleId)', () => {
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([{
    filePath: '/p/a.js',
    messages: [{
      // eslint-disable-next-line unicorn/no-null
      ruleId: null,
      severity: 2,
      line: 1,
      column: 1,
      message: 'parse error',
      fatal: true,
    }],
  }]));

  const out = extractMessagesFrom(results, { cwd: '/p' });
  assert.equal(out.length, 1);
  // eslint-disable-next-line unicorn/no-null
  assert.equal(out[0]?.ruleId, null);
  assert.equal(out[0]?.fatal, true);
  assert.equal(out[0]?.message, 'parse error');
});

test('extractMessagesFrom handles a result with zero messages without dropping subsequent files', () => {
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([
    { filePath: '/p/clean.js', messages: [] },
    { filePath: '/p/dirty.js', messages: [{ ruleId: 'r', severity: 2, line: 1, column: 1, message: 'm' }] },
  ]));
  const out = extractMessagesFrom(results, { cwd: '/p' });
  assert.equal(out.length, 1);
  assert.equal(out[0]?.filePathRelative, 'dirty.js');
});

test('extractMessagesFrom produces the exact relative path on POSIX', () => {
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([
    { filePath: '/proj/deep/nested/path/file.js', messages: [{ ruleId: 'r', severity: 2, line: 1, column: 1, message: 'm' }] },
  ]));
  const out = extractMessagesFrom(results, { cwd: '/proj' });
  // Exact equality on POSIX (the target platform per engines). A regression
  // that returns the absolute path or doubles a cwd segment would contain
  // 'file.js' + 'deep' substrings too — only exact match catches it.
  assert.equal(out[0]?.filePathRelative, 'deep/nested/path/file.js');
});

test('extractMessagesFrom throws a TypeError when messages is undefined', () => {
  // Defensive check: `result.messages` is typed `LintMessage[]` but a
  // partially constructed mock could pass `undefined`. The extractor does
  // not guard against this — document the failure mode so a future maintainer
  // knows it's expected to fail loud rather than silently drop the file.
  const results = /** @type {ESLint.LintResult[]} */ (/** @type {any} */ ([
    { filePath: '/p/a.js', messages: undefined },
  ]));
  assert.throws(
    () => extractMessagesFrom(results, { cwd: '/p' }),
    TypeError,
  );
});
