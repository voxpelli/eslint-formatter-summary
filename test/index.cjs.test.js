import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** @type {(results: import('eslint').ESLint.LintResult[], ctx: import('eslint').ESLint.LintResultData) => Promise<string>} */
const formatter = require('../index.cjs');

/** @type {import('eslint').ESLint.LintResult[]} */
const fixture = /** @type {any} */ ([{
  filePath: '/proj/src/a.js',
  errorCount: 1,
  warningCount: 1,
  messages: [
    { ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' },
    { ruleId: 'semi', severity: 1, fix: { range: [0, 0], text: ';' }, line: 2, column: 1, message: 'z' },
  ],
}]);

/** @type {import('eslint').ESLint.LintResult[]} */
const cleanFixture = /** @type {any} */ ([{
  filePath: '/proj/src/clean.js',
  errorCount: 0,
  warningCount: 0,
  messages: [],
}]);

/** @type {import('eslint').ESLint.LintResultData} */
const context = { cwd: '/proj', rulesMeta: {} };

test('index.cjs returns CLI-formatted string by default', async () => {
  const out = await formatter(fixture, context);
  assert.ok(out.includes('no-undef'));
  assert.ok(out.includes('problems in total'));
});

test('index.cjs honors EFS_OUTPUT=csv', async () => {
  const prev = process.env['EFS_OUTPUT'];
  process.env['EFS_OUTPUT'] = 'csv';
  try {
    const out = await formatter(fixture, context);
    assert.match(out, /^errors,warnings,fixable,rule\n/);
  } finally {
    if (prev === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prev;
  }
});

test('index.cjs appends markdown to $GITHUB_STEP_SUMMARY when set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'efs-'));
  const summaryPath = join(dir, 'step.md');
  const prev = process.env['GITHUB_STEP_SUMMARY'];
  process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
  try {
    await formatter(fixture, context);
    const body = readFileSync(summaryPath, 'utf8');
    assert.match(body, /\| Errors +\| Warnings +\| Fixable +\| Rule +\|/);
    assert.match(body, /no-undef/);
  } finally {
    if (prev === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
    else process.env['GITHUB_STEP_SUMMARY'] = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('index.cjs appends (not overwrites) on repeated invocations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'efs-'));
  const summaryPath = join(dir, 'step.md');
  const prev = process.env['GITHUB_STEP_SUMMARY'];
  process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
  try {
    await formatter(fixture, context);
    await formatter(fixture, context);
    const body = readFileSync(summaryPath, 'utf8');
    const occurrences = body.match(/\| Errors /g)?.length ?? 0;
    assert.equal(occurrences, 2);
  } finally {
    if (prev === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
    else process.env['GITHUB_STEP_SUMMARY'] = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('index.cjs does not write $GITHUB_STEP_SUMMARY on a clean run', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'efs-'));
  const summaryPath = join(dir, 'step.md');
  const prev = process.env['GITHUB_STEP_SUMMARY'];
  process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
  try {
    await formatter(cleanFixture, context);
    assert.equal(existsSync(summaryPath), false);
  } finally {
    if (prev === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
    else process.env['GITHUB_STEP_SUMMARY'] = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const optOutValue of ['false', '0']) {
  test(`index.cjs skips write when EFS_GITHUB_STEP_SUMMARY=${optOutValue}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'efs-'));
    const summaryPath = join(dir, 'step.md');
    const prevSummary = process.env['GITHUB_STEP_SUMMARY'];
    const prevOptOut = process.env['EFS_GITHUB_STEP_SUMMARY'];
    process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
    process.env['EFS_GITHUB_STEP_SUMMARY'] = optOutValue;
    try {
      await formatter(fixture, context);
      assert.equal(existsSync(summaryPath), false);
    } finally {
      if (prevSummary === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
      else process.env['GITHUB_STEP_SUMMARY'] = prevSummary;
      if (prevOptOut === undefined) delete process.env['EFS_GITHUB_STEP_SUMMARY'];
      else process.env['EFS_GITHUB_STEP_SUMMARY'] = prevOptOut;
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('index.cjs still returns output when $GITHUB_STEP_SUMMARY write fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'efs-'));
  const blocker = join(dir, 'blocker');
  writeFileSync(blocker, 'x', 'utf8');
  // Append to a path that treats `blocker` as a directory — ENOTDIR.
  const summaryPath = join(blocker, 'step.md');
  const prev = process.env['GITHUB_STEP_SUMMARY'];
  process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
  try {
    const out = await formatter(fixture, context);
    assert.ok(out.includes('no-undef'));
    assert.equal(existsSync(summaryPath), false);
  } finally {
    if (prev === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
    else process.env['GITHUB_STEP_SUMMARY'] = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});
