/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-non-literal-regexp */

import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { runCli, tmpDir, writeOneProjectArtifact } from './_helpers.js';

/** @import { LintResultLite } from '../lib/cli/prepare-project-result.js' */

const rawFixture = () => /** @satisfies {LintResultLite[]} */ ([
  {
    filePath: '/proj/src/a.js',
    errorCount: 2,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 1,
    messages: [
      { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 10, message: 'x' },
      { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 22, message: 'x' },
      { ruleId: 'semi', severity: 1, column: 1, line: 3, fix: { range: [0, 0], text: ';' }, message: 'z' },
    ],
  },
]);

test('prepare: reads a raw ESLint JSON file and emits ProjectResult to stdout', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stderr, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj', inputFile],
  );
  assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
  assert.equal(stderr, '');
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'acme/demo');
  assert.equal(parsed.errorCount, 2);
  assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
});

test('prepare: reads project slug from EFS_PROJECT_NAME when flag absent', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--cwd', '/proj', inputFile],
    { env: { EFS_PROJECT_NAME: 'from/env' } },
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'from/env');
});

test('prepare: writes to --out file and emits nothing to stdout', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  const outFile = path.join(tmp, 'out.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj', '--out', outFile, inputFile],
  );
  assert.equal(code, 0);
  assert.equal(stdout, '');
  const parsed = JSON.parse(await readFile(outFile, 'utf8'));
  assert.equal(parsed.project, 'acme/demo');
});

test('prepare: exits 0 with no output when the run has zero findings', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify([{ filePath: '/proj/a.js', errorCount: 0, warningCount: 0, messages: [] }]), 'utf8');
  const { code, stdout } = await runCli(['prepare', inputFile]);
  assert.equal(code, 0);
  assert.equal(stdout, '');
});

test('prepare: exits 1 with "empty stdin" when no positional and stdin is empty', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: '' });
  assert.equal(code, 1);
  assert.match(stderr, /empty stdin/);
});

test('prepare: reads raw ESLint JSON from stdin when no positional given', async () => {
  const { code, stderr, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj'],
    { input: JSON.stringify(rawFixture()) },
  );
  assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'acme/demo');
  assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
});

test('prepare: exits 1 on invalid JSON from stdin (reports source as stdin)', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: 'not-json' });
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON in stdin/);
});

test('prepare: exits 1 when the input file cannot be read', async () => {
  const { code, stderr } = await runCli(['prepare', '/definitely/does/not/exist.json']);
  assert.equal(code, 1);
  assert.match(stderr, /could not read/);
});

test('prepare: exits 1 on invalid JSON input', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'bad.json');
  await writeFile(inputFile, 'not-json', 'utf8');
  const { code, stderr } = await runCli(['prepare', inputFile]);
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON/);
});

test('aggregate: emits "all N pass" on empty results directory', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stdout } = await runCli(['aggregate', '--project-count', '5', results]);
  assert.equal(code, 0);
  assert.match(stdout, /All 5 external projects pass/);
});

test('aggregate: renders fleet sticky-PR-comment from per-project artifacts', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 2,
    warningCount: 1,
    fixableWarningCount: 1,
    rules: { 'no-unused-vars': { errors: 2, warnings: 0, fixable: 0, files: ['src/a.js:10', 'src/a.js:22'] } },
  });
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /## External project test results/);
  assert.match(stdout, /acme\/demo/);
  assert.match(stdout, /no-unused-vars/);
  assert.match(stdout, /blob\/HEAD\/src\/a\.js#L10/);
  // Pin the numeric headline — a regression that dropped or swapped counts
  // would still match all the existing assertions above.
  assert.match(stdout, /2 errors \(0 fixable\), 1 warnings \(1 fixable\)/);
});

test('aggregate: --sort-by severity orders projects by error count desc', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/alpha',
    errorCount: 1,
    rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  await writeOneProjectArtifact(results, {
    project: 'acme/zeta',
    errorCount: 5,
    rules: { foo: { errors: 5, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  const { stdout: alphabetical } = await runCli(['aggregate', results]);
  const { stdout: severity } = await runCli(['aggregate', '--sort-by', 'severity', results]);
  assert.ok(alphabetical.indexOf('acme/alpha') < alphabetical.indexOf('acme/zeta'), 'alphabetical: alpha before zeta');
  assert.ok(severity.indexOf('acme/zeta') < severity.indexOf('acme/alpha'), 'severity: zeta (5 errors) before alpha (1 error)');
});

test('aggregate: --sort-by with invalid value exits 1 via InputError', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stderr } = await runCli(['aggregate', '--sort-by', 'bogus', results]);
  assert.equal(code, 1);
  assert.match(stderr, /--sort-by must be "project" or "severity"/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: exits 1 via InputError when no positional argument is given', async () => {
  const { code, stderr } = await runCli(['aggregate']);
  assert.equal(code, 1);
  assert.match(stderr, /expected at least one <results-dir>/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: exits 1 via InputError when given multiple positional arguments', async () => {
  const { code, stderr } = await runCli(['aggregate', 'a.json', 'b.json']);
  assert.equal(code, 1);
  assert.match(stderr, /no more than one <results-dir>/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: warns on stderr when every candidate artifact is skipped', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // One subdir with a malformed JSON artifact — passes the stat check but
  // fails JSON.parse, so readResultsDirectory returns zero valid results.
  const subdir = path.join(results, 'proj-a');
  await mkdir(subdir, { recursive: true });
  await writeFile(path.join(subdir, 'eslint-result.json'), 'not-json', 'utf8');
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /All \? external projects pass/);
  assert.match(stderr, /all 1 candidate artifact\(s\) in .+ were skipped/);
});

test('aggregate: exits 1 when results directory is missing (no silent all-pass)', async () => {
  const { code, stderr } = await runCli(['aggregate', '/definitely/does/not/exist']);
  assert.equal(code, 1);
  assert.match(stderr, /results directory not found/);
});

// Table-driven numeric-flag validation — each case stays individually named
// and reportable via the interpolated title.
for (const [label, argv, rx] of /** @type {Array<[string, string[], RegExp]>} */ ([
  ['non-numeric --size-cap', ['--size-cap', 'abc'], /--size-cap must be a positive integer/],
  ['negative --size-cap', ['--size-cap=-5'], /--size-cap must be a positive integer/],
  ['zero --size-cap', ['--size-cap', '0'], /--size-cap must be a positive integer/],
  ['fractional --file-cap', ['--file-cap', '1.5'], /--file-cap must be a positive integer/],
])) {
  test(`aggregate: exits 1 via InputError on ${label}`, async (t) => {
    const tmp = await tmpDir(t);
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', ...argv, results]);
    assert.equal(code, 1);
    assert.match(stderr, rx);
  });
}

test('aggregate: --size-cap triggers truncation end-to-end with tail-summary block', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // Three projects × 30 files is enough to exceed a tight sizeCap once
  // HEADROOM is subtracted. sizeCap < HEADROOM(15000) guarantees truncation.
  for (let i = 0; i < 3; i++) {
    await writeOneProjectArtifact(results, {
      project: `acme/proj-${i}`,
      errorCount: 1,
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: 30 }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
    });
  }
  const { code, stdout } = await runCli(['aggregate', '--size-cap', '3000', results]);
  assert.equal(code, 0);
  assert.match(stdout, /<summary>Tail projects \(\d+ truncated/, 'tail-summary block should appear when truncation fires');
  assert.match(stdout, /file:line detail truncated for tail projects/, 'trailer sentence should appear');
});

test('aggregate: $GITHUB_STEP_SUMMARY env var has no effect (callers redirect --full explicitly)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 2,
    rules: { foo: { errors: 2, warnings: 0, fixable: 0, files: ['a.js:1', 'a.js:2'] } },
  });
  const stepSummary = path.join(tmp, 'step-summary.md');
  const { code, stdout } = await runCli(['aggregate', results], {
    env: { GITHUB_STEP_SUMMARY: stepSummary },
  });
  assert.equal(code, 0);
  assert.match(stdout, /acme\/demo/);
  // Assert the step-summary file never got written. `stat` rejects with ENOENT
  // on missing paths — that's the signal we want.
  await assert.rejects(() => stat(stepSummary), /ENOENT/, 'aggregate must not auto-write to $GITHUB_STEP_SUMMARY');
});

test('aggregate: --full emits uncapped markdown (no tail-summary trailer)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // 80 files × 5 projects — enough to defeat the default fileCap=50 and
  // exercise the `--full` bypass. Probe set [0, 49, 50, 79] keeps the
  // boundary-at-50 assertion; halves the fixture from the previous 200.
  const FILES_PER_RULE = 80;
  for (let i = 0; i < 5; i++) {
    await writeOneProjectArtifact(results, {
      project: `acme/proj-${i}`,
      errorCount: 1,
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: FILES_PER_RULE }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
    });
  }
  // Do NOT pass --file-cap — if --full does not bypass the default cap=50
  // the `… and 30 more` overflow trailer appears and ~30 entries per rule
  // are silently dropped.
  const { code, stdout } = await runCli(['aggregate', '--full', '--size-cap', '20000', results]);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, /<summary>Tail projects/);
  assert.doesNotMatch(stdout, /file:line detail truncated/);
  assert.doesNotMatch(stdout, /… and \d+ more/, '--full must not emit the per-rule file-cap overflow trailer');
  for (let i = 0; i < 5; i++) assert.match(stdout, new RegExp(`acme/proj-${i}`));
  for (const j of [0, 49, 50, 79]) {
    assert.match(stdout, new RegExp(`src/a-${j}\\.js:${j + 1}`), `file index ${j} must appear under --full`);
  }
});

test('aggregate: scrubs secret-shaped strings in rule ids and file paths', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  const ghToken = 'ghp_' + 'A'.repeat(40);
  const npmToken = 'npm_' + 'B'.repeat(40);
  const awsKey = 'AKIAIOSFODNN7EXAMPLE';
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 3,
    rules: {
      [`rule-${ghToken}`]: { errors: 1, warnings: 0, fixable: 0, files: [`src/${npmToken}.js:1`] },
      [`rule-${awsKey}`]: { errors: 2, warnings: 0, fixable: 0, files: ['src/b.js:1'] },
    },
  });
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, new RegExp(ghToken));
  assert.doesNotMatch(stdout, new RegExp(npmToken));
  assert.doesNotMatch(stdout, new RegExp(awsKey));
  assert.match(stdout, /\[REDACTED\]/);
});
