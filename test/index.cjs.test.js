/* eslint-disable n/no-process-env */
/* eslint-disable n/no-sync */
/* eslint-disable security/detect-non-literal-fs-filename */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

import { captureStderr, tmpDir, withEnv } from './_helpers.js';

/** @import { ESLint } from 'eslint' */

const require = createRequire(import.meta.url);
/** @type {(results: ESLint.LintResult[], ctx: ESLint.LintResultData) => Promise<string>} */
const formatter = require('../index.cjs');

/**
 * Typed cast for inline LintResult fixtures.
 *
 * @param {any[]} arr
 * @returns {ESLint.LintResult[]}
 */
const results = (arr) => arr;

/**
 * Build a synthetic lint-result fixture with `n` files, each emitting a
 * single error — the canonical shape for exercising file-cap behaviour.
 *
 * @param {number} n
 * @returns {ESLint.LintResult[]}
 */
const lintFixture = (n) => results(Array.from({ length: n }, (_, i) => ({
  filePath: `/proj/src/f${i}.js`,
  errorCount: 1,
  warningCount: 0,
  messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
})));

const fixture = results([{
  filePath: '/proj/src/a.js',
  errorCount: 1,
  warningCount: 1,
  messages: [
    { ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' },
    { ruleId: 'semi', severity: 1, fix: { range: [0, 0], text: ';' }, line: 2, column: 1, message: 'z' },
  ],
}]);

const cleanFixture = results([{
  filePath: '/proj/src/clean.js',
  errorCount: 0,
  warningCount: 0,
  messages: [],
}]);

/** @type {ESLint.LintResultData} */
const context = { cwd: '/proj', rulesMeta: {} };

test('index.cjs returns CLI-formatted string by default', async () => {
  const out = await formatter(fixture, context);
  assert.ok(out.includes('no-undef'));
  assert.ok(out.includes('problems in total'));
});

test('index.cjs honors EFS_OUTPUT=csv', async (t) => {
  withEnv(t, { EFS_OUTPUT: 'csv' });
  const out = await formatter(fixture, context);
  assert.match(out, /^errors,warnings,fixable,rule\n/);
});

test('index.cjs appends markdown to $GITHUB_STEP_SUMMARY when set', async (t) => {
  const dir = await tmpDir(t);
  const summaryPath = path.join(dir, 'step.md');
  withEnv(t, { GITHUB_STEP_SUMMARY: summaryPath });
  await formatter(fixture, context);
  const body = readFileSync(summaryPath, 'utf8');
  assert.match(body, /\| Errors +\| Warnings +\| Fixable +\| Rule +\|/);
  assert.match(body, /no-undef/);
});

test('index.cjs appends (not overwrites) on repeated invocations', async (t) => {
  const dir = await tmpDir(t);
  const summaryPath = path.join(dir, 'step.md');
  withEnv(t, { GITHUB_STEP_SUMMARY: summaryPath });
  await formatter(fixture, context);
  await formatter(fixture, context);
  const body = readFileSync(summaryPath, 'utf8');
  assert.equal(body.match(/\| Errors /g)?.length ?? 0, 2);
});

test('index.cjs does not write $GITHUB_STEP_SUMMARY on a clean run', async (t) => {
  const dir = await tmpDir(t);
  const summaryPath = path.join(dir, 'step.md');
  withEnv(t, { GITHUB_STEP_SUMMARY: summaryPath });
  await formatter(cleanFixture, context);
  assert.equal(existsSync(summaryPath), false);
});

for (const optInValue of ['true', '1', 'yes']) {
  test(`index.cjs skips write when EFS_SKIP_GH_SUMMARY=${optInValue}`, async (t) => {
    const dir = await tmpDir(t);
    const summaryPath = path.join(dir, 'step.md');
    withEnv(t, { GITHUB_STEP_SUMMARY: summaryPath, EFS_SKIP_GH_SUMMARY: optInValue });
    await formatter(fixture, context);
    assert.equal(existsSync(summaryPath), false);
  });
}

test('index.cjs: EFS_CAP unset leaves markdown uncapped (file list intact)', async (t) => {
  withEnv(t, { EFS_OUTPUT: 'markdown' });
  const out = await formatter(lintFixture(120), context);
  assert.ok(out.includes('f119.js'), 'without cap, every file should render');
  assert.ok(!out.includes('… and '), 'no overflow trailer when uncapped');
});

test('index.cjs: EFS_CAP=true applies default file cap (50)', async (t) => {
  withEnv(t, { EFS_OUTPUT: 'markdown', EFS_CAP: 'true' });
  const out = await formatter(lintFixture(120), context);
  assert.match(out, /… and 70 more/, 'overflow trailer should show 120-50=70');
  assert.ok(!out.includes('f119.js'), 'files past the cap should not render');
});

test('index.cjs: EFS_FILE_CAP overrides the default when caps are on', async (t) => {
  withEnv(t, { EFS_OUTPUT: 'markdown', EFS_CAP: '1', EFS_FILE_CAP: '5' });
  const out = await formatter(lintFixture(20), context);
  assert.match(out, /… and 15 more/);
  assert.ok(!out.includes('f19.js'));
});

test('index.cjs: $GITHUB_STEP_SUMMARY receives uncapped markdown even when caps cap the return value', async (t) => {
  const dir = await tmpDir(t);
  const summaryPath = path.join(dir, 'step.md');
  withEnv(t, {
    EFS_OUTPUT: 'markdown',
    EFS_CAP: 'true',
    GITHUB_STEP_SUMMARY: summaryPath,
  });
  const out = await formatter(lintFixture(120), context);
  const body = readFileSync(summaryPath, 'utf8');
  assert.ok(!out.includes('f119.js'), 'returned output should be capped');
  assert.ok(body.includes('f119.js'), 'step summary should be uncapped');
  assert.ok(!body.includes('… and '), 'step summary has no overflow trailer');
});

test('index.cjs: invalid EFS_FILE_CAP falls back to default and warns', async (t) => {
  withEnv(t, { EFS_OUTPUT: 'markdown', EFS_CAP: 'true', EFS_FILE_CAP: 'not-a-number' });
  const getStderr = captureStderr(t);
  const out = await formatter(lintFixture(60), context);
  assert.match(out, /… and 10 more/, 'falls back to default 50');
  assert.match(getStderr(), /EFS_FILE_CAP must be a positive integer/, 'warning emitted');
});

test('index.cjs still returns output when $GITHUB_STEP_SUMMARY write fails', async (t) => {
  const dir = await tmpDir(t);
  // Create a regular file and then try to append to a path that treats it
  // as a directory (ENOTDIR).
  const blocker = path.join(dir, 'blocker');
  writeFileSync(blocker, 'x', 'utf8');
  const summaryPath = path.join(blocker, 'step.md');
  withEnv(t, { GITHUB_STEP_SUMMARY: summaryPath });
  const out = await formatter(fixture, context);
  assert.ok(out.includes('no-undef'));
  assert.equal(existsSync(summaryPath), false);
});
