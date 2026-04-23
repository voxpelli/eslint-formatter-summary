/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-non-literal-regexp */

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { makeTmpDir, runCli, writeResultArtifact } from './_helpers.js';

const rawFixture = () => [
  {
    filePath: '/proj/src/a.js',
    errorCount: 2,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 1,
    messages: [
      { ruleId: 'no-unused-vars', severity: 2, line: 10, message: 'x' },
      { ruleId: 'no-unused-vars', severity: 2, line: 22, message: 'x' },
      { ruleId: 'semi', severity: 1, line: 3, fix: { range: [0, 0], text: ';' }, message: 'z' },
    ],
  },
];

test('prepare: reads a raw ESLint JSON file and emits ProjectResult to stdout', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
    const { code, stderr, stdout } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/proj', inputFile]
    );
    assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.project, 'acme/demo');
    assert.equal(parsed.errorCount, 2);
    assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
  } finally {
    await cleanup();
  }
});

test('prepare: reads project slug from EFS_PROJECT_NAME when flag absent', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
    const { code, stdout } = await runCli(
      ['prepare', '--cwd', '/proj', inputFile],
      { env: { EFS_PROJECT_NAME: 'from/env' } }
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.project, 'from/env');
  } finally {
    await cleanup();
  }
});

test('prepare: writes to --out file and emits nothing to stdout', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'raw.json');
    const outFile = path.join(tmp, 'out.json');
    await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
    const { code, stdout } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/proj', '--out', outFile, inputFile]
    );
    assert.equal(code, 0);
    assert.equal(stdout, '');
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(outFile, 'utf8');
    const parsed = JSON.parse(written);
    assert.equal(parsed.project, 'acme/demo');
  } finally {
    await cleanup();
  }
});

test('prepare: exits 0 with no output when the run has zero findings', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify([{ filePath: '/proj/a.js', errorCount: 0, warningCount: 0, messages: [] }]), 'utf8');
    const { code, stdout } = await runCli(['prepare', inputFile]);
    assert.equal(code, 0);
    assert.equal(stdout, '');
  } finally {
    await cleanup();
  }
});

test('prepare: exits 1 with "empty stdin" when no positional and stdin is empty', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: '' });
  assert.equal(code, 1);
  assert.match(stderr, /empty stdin/);
});

test('prepare: reads raw ESLint JSON from stdin when no positional given', async () => {
  const { code, stderr, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj'],
    { input: JSON.stringify(rawFixture()) }
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

test('prepare: exits 1 on invalid JSON input', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'bad.json');
    await writeFile(inputFile, 'not-json', 'utf8');
    const { code, stderr } = await runCli(['prepare', inputFile]);
    assert.equal(code, 1);
    assert.match(stderr, /invalid JSON/);
  } finally {
    await cleanup();
  }
});

test('aggregate: emits "all N pass" on empty results directory', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stdout } = await runCli(['aggregate', '--project-count', '5', results]);
    assert.equal(code, 0);
    assert.match(stdout, /All 5 external projects pass/);
  } finally {
    await cleanup();
  }
});

test('aggregate: renders fleet sticky-PR-comment from per-project artifacts', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/demo',
      errorCount: 2,
      warningCount: 1,
      fixableErrorCount: 0,
      fixableWarningCount: 1,
      syntheticKeys: [],
      rules: { 'no-unused-vars': { errors: 2, warnings: 0, fixable: 0, files: ['src/a.js:10', 'src/a.js:22'] } },
    });
    const { code, stdout } = await runCli(['aggregate', results]);
    assert.equal(code, 0);
    assert.match(stdout, /## External project test results/);
    assert.match(stdout, /acme\/demo/);
    assert.match(stdout, /no-unused-vars/);
    assert.match(stdout, /blob\/HEAD\/src\/a\.js#L10/);
  } finally {
    await cleanup();
  }
});

test('aggregate: --sort-by severity orders projects by error count desc', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/alpha',
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      syntheticKeys: [],
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
    });
    await writeResultArtifact(results, {
      project: 'acme/zeta',
      errorCount: 5,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      syntheticKeys: [],
      rules: { foo: { errors: 5, warnings: 0, fixable: 0, files: ['a.js:1'] } },
    });
    const { stdout: alphabetical } = await runCli(['aggregate', results]);
    const { stdout: severity } = await runCli(['aggregate', '--sort-by', 'severity', results]);
    const alphaFirst = alphabetical.indexOf('acme/alpha');
    const alphaZeta = alphabetical.indexOf('acme/zeta');
    assert.ok(alphaFirst < alphaZeta, 'alphabetical: alpha before zeta');
    const sevAlpha = severity.indexOf('acme/alpha');
    const sevZeta = severity.indexOf('acme/zeta');
    assert.ok(sevZeta < sevAlpha, 'severity: zeta (5 errors) before alpha (1 error)');
  } finally {
    await cleanup();
  }
});

test('aggregate: --sort-by with invalid value exits 1 via InputError', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--sort-by', 'bogus', results]);
    assert.equal(code, 1);
    assert.match(stderr, /--sort-by must be "project" or "severity"/);
    assert.match(stderr, /Invalid input:/);
  } finally {
    await cleanup();
  }
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

test('aggregate: warns on stderr when every candidate artifact is skipped', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
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
  } finally {
    await cleanup();
  }
});

test('aggregate: exits 1 when results directory is missing (no silent all-pass)', async () => {
  const { code, stderr } = await runCli(['aggregate', '/definitely/does/not/exist']);
  assert.equal(code, 1);
  assert.match(stderr, /results directory not found/);
});

test('aggregate: exits 1 via InputError on non-numeric --size-cap', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--size-cap', 'abc', results]);
    assert.equal(code, 1);
    assert.match(stderr, /--size-cap must be a positive integer/);
  } finally {
    await cleanup();
  }
});

test('aggregate: exits 1 via InputError on negative --size-cap', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--size-cap=-5', results]);
    assert.equal(code, 1);
    assert.match(stderr, /--size-cap must be a positive integer/);
  } finally {
    await cleanup();
  }
});

test('aggregate: exits 1 via InputError on zero --size-cap', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--size-cap', '0', results]);
    assert.equal(code, 1);
    assert.match(stderr, /--size-cap must be a positive integer/);
  } finally {
    await cleanup();
  }
});

test('aggregate: exits 1 via InputError on fractional --file-cap', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--file-cap', '1.5', results]);
    assert.equal(code, 1);
    assert.match(stderr, /--file-cap must be a positive integer/);
  } finally {
    await cleanup();
  }
});

test('aggregate: --size-cap triggers truncation end-to-end with tail-summary block', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    // Five projects; cap is small enough that some will overflow to tail.
    for (let i = 0; i < 5; i++) {
      await writeResultArtifact(results, {
        project: `acme/proj-${i}`,
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        syntheticKeys: [],
        // Pad each rule's files list to make blocks large
        rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: 200 }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
      });
    }
    const { code, stdout } = await runCli(['aggregate', '--size-cap', '20000', '--file-cap', '200', results]);
    assert.equal(code, 0);
    assert.match(stdout, /<summary>Tail projects \(\d+ truncated/, 'tail-summary block should appear when truncation fires');
    assert.match(stdout, /file:line detail truncated for tail projects/, 'trailer sentence should appear');
  } finally {
    await cleanup();
  }
});

test('aggregate: $GITHUB_STEP_SUMMARY env var has no effect (callers redirect --full explicitly)', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/demo',
      errorCount: 2,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      syntheticKeys: [],
      rules: { foo: { errors: 2, warnings: 0, fixable: 0, files: ['a.js:1', 'a.js:2'] } },
    });
    const stepSummary = path.join(tmp, 'step-summary.md');
    const { code, stdout } = await runCli(['aggregate', results], {
      env: { GITHUB_STEP_SUMMARY: stepSummary },
    });
    assert.equal(code, 0);
    assert.match(stdout, /acme\/demo/);
    const { stat } = await import('node:fs/promises');
    let exists = false;
    try { await stat(stepSummary); exists = true; } catch { /* expected */ }
    assert.equal(exists, false, 'aggregate must not auto-write to $GITHUB_STEP_SUMMARY');
  } finally {
    await cleanup();
  }
});

test('aggregate: --full emits uncapped markdown (no tail-summary trailer)', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    for (let i = 0; i < 5; i++) {
      await writeResultArtifact(results, {
        project: `acme/proj-${i}`,
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        syntheticKeys: [],
        rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: 200 }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
      });
    }
    const { code, stdout } = await runCli(['aggregate', '--full', '--size-cap', '20000', '--file-cap', '200', results]);
    assert.equal(code, 0);
    assert.doesNotMatch(stdout, /<summary>Tail projects/);
    assert.doesNotMatch(stdout, /file:line detail truncated/);
    // All five projects should appear in full
    for (let i = 0; i < 5; i++) assert.match(stdout, new RegExp(`acme/proj-${i}`));
  } finally {
    await cleanup();
  }
});

test('aggregate: scrubs secret-shaped strings in rule ids and file paths', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const results = path.join(tmp, 'results');
    const ghToken = 'ghp_' + 'A'.repeat(40);
    const npmToken = 'npm_' + 'B'.repeat(40);
    const awsKey = 'AKIAIOSFODNN7EXAMPLE';
    await writeResultArtifact(results, {
      project: 'acme/demo',
      errorCount: 3,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      syntheticKeys: [],
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
  } finally {
    await cleanup();
  }
});

test('prepare: stderr warns when filePaths escape --cwd', async () => {
  const { cleanup, dir: tmp } = await makeTmpDir();
  try {
    const inputFile = path.join(tmp, 'raw.json');
    // filePath is under /elsewhere/... but cwd is /repo; path.relative produces ../
    await writeFile(inputFile, JSON.stringify([{
      filePath: '/elsewhere/src/a.js',
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [{ ruleId: 'no-undef', severity: 2, line: 1, message: 'x' }],
    }]), 'utf8');
    const { code, stderr } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/repo', inputFile]
    );
    assert.equal(code, 0);
    assert.match(stderr, /filePath outside --cwd/);
  } finally {
    await cleanup();
  }
});
