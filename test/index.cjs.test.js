import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

/** @import { ESLint } from 'eslint' */

const require = createRequire(import.meta.url);
/** @type {(results: ESLint.LintResult[], ctx: ESLint.LintResultData) => Promise<string>} */
const formatter = require('../index.cjs');

/** @type {ESLint.LintResult[]} */
const fixture = /** @type {any} */ ([{
  filePath: '/proj/src/a.js',
  errorCount: 1,
  warningCount: 1,
  messages: [
    { ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' },
    { ruleId: 'semi', severity: 1, fix: { range: [0, 0], text: ';' }, line: 2, column: 1, message: 'z' },
  ],
}]);

/** @type {ESLint.LintResult[]} */
const cleanFixture = /** @type {any} */ ([{
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

for (const optInValue of ['true', '1', 'yes']) {
  test(`index.cjs skips write when EFS_SKIP_GH_SUMMARY=${optInValue}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'efs-'));
    const summaryPath = join(dir, 'step.md');
    const prevSummary = process.env['GITHUB_STEP_SUMMARY'];
    const prevSkip = process.env['EFS_SKIP_GH_SUMMARY'];
    process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
    process.env['EFS_SKIP_GH_SUMMARY'] = optInValue;
    try {
      await formatter(fixture, context);
      assert.equal(existsSync(summaryPath), false);
    } finally {
      if (prevSummary === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
      else process.env['GITHUB_STEP_SUMMARY'] = prevSummary;
      if (prevSkip === undefined) delete process.env['EFS_SKIP_GH_SUMMARY'];
      else process.env['EFS_SKIP_GH_SUMMARY'] = prevSkip;
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('index.cjs: EFS_CAP unset leaves markdown uncapped (file list intact)', async () => {
  const files = Array.from({ length: 120 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    errorCount: 1, warningCount: 0,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }));
  const prev = process.env['EFS_OUTPUT'];
  process.env['EFS_OUTPUT'] = 'markdown';
  try {
    const out = await formatter(/** @type {any} */ (files), context);
    assert.ok(out.includes('f119.js'), 'without cap, every file should render');
    assert.ok(!out.includes('… and '), 'no overflow trailer when uncapped');
  } finally {
    if (prev === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prev;
  }
});

test('index.cjs: EFS_CAP=true applies default file cap (50)', async () => {
  const files = Array.from({ length: 120 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    errorCount: 1, warningCount: 0,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }));
  const prevOutput = process.env['EFS_OUTPUT'];
  const prevCap = process.env['EFS_CAP'];
  process.env['EFS_OUTPUT'] = 'markdown';
  process.env['EFS_CAP'] = 'true';
  try {
    const out = await formatter(/** @type {any} */ (files), context);
    assert.match(out, /… and 70 more/, 'overflow trailer should show 120-50=70');
    assert.ok(!out.includes('f119.js'), 'files past the cap should not render');
  } finally {
    if (prevOutput === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prevOutput;
    if (prevCap === undefined) delete process.env['EFS_CAP'];
    else process.env['EFS_CAP'] = prevCap;
  }
});

test('index.cjs: EFS_FILE_CAP overrides the default when caps are on', async () => {
  const files = Array.from({ length: 20 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    errorCount: 1, warningCount: 0,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }));
  const prevOutput = process.env['EFS_OUTPUT'];
  const prevCap = process.env['EFS_CAP'];
  const prevFile = process.env['EFS_FILE_CAP'];
  process.env['EFS_OUTPUT'] = 'markdown';
  process.env['EFS_CAP'] = '1';
  process.env['EFS_FILE_CAP'] = '5';
  try {
    const out = await formatter(/** @type {any} */ (files), context);
    assert.match(out, /… and 15 more/);
    assert.ok(!out.includes('f19.js'));
  } finally {
    if (prevOutput === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prevOutput;
    if (prevCap === undefined) delete process.env['EFS_CAP'];
    else process.env['EFS_CAP'] = prevCap;
    if (prevFile === undefined) delete process.env['EFS_FILE_CAP'];
    else process.env['EFS_FILE_CAP'] = prevFile;
  }
});

test('index.cjs: $GITHUB_STEP_SUMMARY receives uncapped markdown even when caps cap the return value', async () => {
  const files = Array.from({ length: 120 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    errorCount: 1, warningCount: 0,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }));
  const dir = mkdtempSync(join(tmpdir(), 'efs-'));
  const summaryPath = join(dir, 'step.md');
  const prevOutput = process.env['EFS_OUTPUT'];
  const prevCap = process.env['EFS_CAP'];
  const prevSummary = process.env['GITHUB_STEP_SUMMARY'];
  process.env['EFS_OUTPUT'] = 'markdown';
  process.env['EFS_CAP'] = 'true';
  process.env['GITHUB_STEP_SUMMARY'] = summaryPath;
  try {
    const out = await formatter(/** @type {any} */ (files), context);
    const body = readFileSync(summaryPath, 'utf8');
    assert.ok(!out.includes('f119.js'), 'returned output should be capped');
    assert.ok(body.includes('f119.js'), 'step summary should be uncapped');
    assert.ok(!body.includes('… and '), 'step summary has no overflow trailer');
  } finally {
    if (prevOutput === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prevOutput;
    if (prevCap === undefined) delete process.env['EFS_CAP'];
    else process.env['EFS_CAP'] = prevCap;
    if (prevSummary === undefined) delete process.env['GITHUB_STEP_SUMMARY'];
    else process.env['GITHUB_STEP_SUMMARY'] = prevSummary;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('index.cjs: invalid EFS_FILE_CAP falls back to default and warns', async () => {
  const files = Array.from({ length: 60 }, (_, i) => ({
    filePath: `/proj/src/f${i}.js`,
    errorCount: 1, warningCount: 0,
    messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }],
  }));
  const prevOutput = process.env['EFS_OUTPUT'];
  const prevCap = process.env['EFS_CAP'];
  const prevFile = process.env['EFS_FILE_CAP'];
  process.env['EFS_OUTPUT'] = 'markdown';
  process.env['EFS_CAP'] = 'true';
  process.env['EFS_FILE_CAP'] = 'not-a-number';
  const origStderr = process.stderr.write.bind(process.stderr);
  /** @type {string[]} */
  const captured = [];
  // @ts-expect-error -- monkey-patch for the duration of this test
  process.stderr.write = (chunk) => { captured.push(String(chunk)); return true; };
  try {
    const out = await formatter(/** @type {any} */ (files), context);
    assert.match(out, /… and 10 more/, 'falls back to default 50');
    assert.ok(captured.some((c) => c.includes('EFS_FILE_CAP must be a positive integer')), 'warning emitted');
  } finally {
    process.stderr.write = origStderr;
    if (prevOutput === undefined) delete process.env['EFS_OUTPUT'];
    else process.env['EFS_OUTPUT'] = prevOutput;
    if (prevCap === undefined) delete process.env['EFS_CAP'];
    else process.env['EFS_CAP'] = prevCap;
    if (prevFile === undefined) delete process.env['EFS_FILE_CAP'];
    else process.env['EFS_FILE_CAP'] = prevFile;
  }
});

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
