import assert from 'node:assert/strict';
import test from 'node:test';

import { processMessage } from '../lib/process-message.js';

/** @import { MessageSummary } from '../lib/process-message.js' */
/** @import { ExtractedMessage } from '../lib/extract-messages.js' */

/**
 * @param {Partial<ExtractedMessage> & { ruleId?: string | null, severity?: 1 | 2, fatal?: boolean, filePathRelative?: string, message?: string }} overrides
 * @returns {ExtractedMessage}
 */
const msg = (overrides) => /** @type {any} */ ({
  ruleId: 'no-undef',
  severity: 2,
  line: 1,
  column: 1,
  message: 'x',
  filePathRelative: 'src/a.js',
  ...overrides,
});

test('processMessage creates a rule bucket for a new ruleId', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  processMessage(summary, msg({ ruleId: 'no-undef', severity: 2 }));
  assert.equal(summary.length, 1);
  assert.deepEqual(
    { kind: summary[0]?.kind, id: summary[0]?.id, errors: summary[0]?.errors, warnings: summary[0]?.warnings, fixable: summary[0]?.fixable },
    { kind: 'rule', id: 'no-undef', errors: 1, warnings: 0, fixable: 0 }
  );
});

test('processMessage increments warnings for severity=1', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  processMessage(summary, msg({ ruleId: 'semi', severity: 1 }));
  assert.equal(summary[0]?.errors, 0);
  assert.equal(summary[0]?.warnings, 1);
});

test('processMessage increments fixable when fix is present', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  processMessage(summary, msg({ ruleId: 'semi', severity: 1, fix: /** @type {any} */ ({ range: [0, 0], text: ';' }) }));
  assert.equal(summary[0]?.fixable, 1);
});

test('processMessage does NOT count suggestion-only messages as fixable', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  processMessage(summary, msg({ ruleId: 'prefer-const', severity: 1, suggestions: /** @type {any} */ ([{ desc: 'try const' }]) }));
  assert.equal(summary[0]?.fixable, 0);
});

test('processMessage buckets missing ruleId under (no rule id)', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  // eslint-disable-next-line unicorn/no-null -- ESLint types ruleId as string | null
  processMessage(summary, msg({ ruleId: null, severity: 2, message: 'unknown' }));
  assert.equal(summary[0]?.kind, 'synthetic');
  assert.equal(summary[0]?.id, '(no rule id)');
});

test('processMessage routes fatal=true into (parser error)', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  // eslint-disable-next-line unicorn/no-null -- parser errors have null ruleId
  processMessage(summary, msg({ ruleId: null, severity: 2, fatal: true, message: 'Parsing error' }));
  assert.equal(summary[0]?.id, '(parser error)');
});

test('processMessage merges repeated calls for the same rule into one bucket', () => {
  /** @type {MessageSummary[]} */
  const summary = [];
  processMessage(summary, msg({ ruleId: 'no-undef', severity: 2, filePathRelative: 'src/a.js' }));
  processMessage(summary, msg({ ruleId: 'no-undef', severity: 2, filePathRelative: 'src/b.js' }));
  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.errors, 2);
  assert.equal(summary[0]?.relativeFilePaths.size, 2);
});

test('processMessage merges repeated null-ruleId messages into one synthetic bucket', () => {
  // A regression where synthetic-bucket key lookup fails would produce two
  // `(no rule id)` entries instead of one — unit-level guard against that.
  /** @type {MessageSummary[]} */
  const summary = [];
  // eslint-disable-next-line unicorn/no-null -- ESLint types ruleId as string | null
  processMessage(summary, msg({ ruleId: null, severity: 2, filePathRelative: 'src/a.js', message: 'unknown' }));
  // eslint-disable-next-line unicorn/no-null
  processMessage(summary, msg({ ruleId: null, severity: 2, filePathRelative: 'src/b.js', message: 'unknown' }));
  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.kind, 'synthetic');
  assert.equal(summary[0]?.id, '(no rule id)');
  assert.equal(summary[0]?.errors, 2);
  assert.equal(summary[0]?.relativeFilePaths.size, 2);
});

test('processMessage appends \\tdetail to path entries for synthetic buckets with detail', () => {
  /** @type {MessageSummary[]} */
  const summary = [];

  processMessage(summary, msg({
    // eslint-disable-next-line unicorn/no-null -- ESLint types ruleId as string | null
    ruleId: null,
    severity: 1,
    message: "eslint-disable-next-line (no problems were reported from 'no-undef')",
    filePathRelative: 'src/a.js',
  }));
  const paths = [...summary[0]?.relativeFilePaths ?? []];
  assert.deepEqual(paths, ['src/a.js\tno-undef']);
});
