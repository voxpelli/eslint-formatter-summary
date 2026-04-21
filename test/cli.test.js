import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const binPath = fileURLToPath(new URL('../bin/eslint-summary.js', import.meta.url));

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, input?: string, env?: Record<string, string> }} [options]
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
const runCli = (argv, { cwd, env } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [binPath, ...argv], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => { resolve({ stdout, stderr, code: code ?? 0 }); });
});

/** @param {import('../lib/cli/prepare-project-result.js').ProjectResult} p */
const writeResultArtifact = async (dir, p) => {
  const sub = path.join(dir, p.project.replace(/\//g, '-'));
  await mkdir(sub, { recursive: true });
  await writeFile(path.join(sub, 'eslint-result.json'), JSON.stringify(p), 'utf8');
};

const rawFixture = [
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
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify(rawFixture), 'utf8');
    const { stdout, stderr, code } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/proj', inputFile],
    );
    assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.project, 'acme/demo');
    assert.equal(parsed.errorCount, 2);
    assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('prepare: reads project slug from EFS_PROJECT_NAME when flag absent', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify(rawFixture), 'utf8');
    const { stdout, code } = await runCli(
      ['prepare', '--cwd', '/proj', inputFile],
      { env: { EFS_PROJECT_NAME: 'from/env' } },
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.project, 'from/env');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('prepare: writes to --out file and emits nothing to stdout', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'raw.json');
    const outFile = path.join(tmp, 'out.json');
    await writeFile(inputFile, JSON.stringify(rawFixture), 'utf8');
    const { stdout, code } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/proj', '--out', outFile, inputFile],
    );
    assert.equal(code, 0);
    assert.equal(stdout, '');
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(outFile, 'utf8');
    const parsed = JSON.parse(written);
    assert.equal(parsed.project, 'acme/demo');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('prepare: exits 0 with no output when the run has zero findings', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'raw.json');
    await writeFile(inputFile, JSON.stringify([{ filePath: '/proj/a.js', errorCount: 0, warningCount: 0, messages: [] }]), 'utf8');
    const { stdout, code } = await runCli(['prepare', inputFile]);
    assert.equal(code, 0);
    assert.equal(stdout, '');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('prepare: exits 2 when no positional argument is given', async () => {
  const { code, stderr } = await runCli(['prepare']);
  assert.equal(code, 2);
  assert.match(stderr, /expected exactly one <input-file>/);
});

test('prepare: exits 1 when the input file cannot be read', async () => {
  const { code, stderr } = await runCli(['prepare', '/definitely/does/not/exist.json']);
  assert.equal(code, 1);
  assert.match(stderr, /could not read/);
});

test('prepare: exits 1 on invalid JSON input', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'bad.json');
    await writeFile(inputFile, 'not-json', 'utf8');
    const { code, stderr } = await runCli(['prepare', inputFile]);
    assert.equal(code, 1);
    assert.match(stderr, /invalid JSON/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: emits "all N pass" on empty results directory', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { stdout, code } = await runCli(['aggregate', '--project-count', '5', results]);
    assert.equal(code, 0);
    assert.match(stdout, /All 5 external projects pass/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: renders fleet sticky-PR-comment from per-project artifacts', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/demo',
      errorCount: 2, warningCount: 1, fixableErrorCount: 0, fixableWarningCount: 1,
      syntheticKeys: [],
      rules: { 'no-unused-vars': { errors: 2, warnings: 0, fixable: 0, files: ['src/a.js:10', 'src/a.js:22'] } },
    });
    const { stdout, code } = await runCli(['aggregate', results]);
    assert.equal(code, 0);
    assert.match(stdout, /## External project test results/);
    assert.match(stdout, /acme\/demo/);
    assert.match(stdout, /no-unused-vars/);
    assert.match(stdout, /blob\/HEAD\/src\/a\.js#L10/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: --sort-by severity orders projects by error count desc', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/alpha',
      errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0,
      syntheticKeys: [],
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
    });
    await writeResultArtifact(results, {
      project: 'acme/zeta',
      errorCount: 5, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0,
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
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: --sort-by with invalid value exits 2', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--sort-by', 'bogus', results]);
    assert.equal(code, 2);
    assert.match(stderr, /--sort-by must be "project" or "severity"/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: exits 2 when no positional argument is given', async () => {
  const { code, stderr } = await runCli(['aggregate']);
  assert.equal(code, 2);
  assert.match(stderr, /expected exactly one <results-dir>/);
});

test('aggregate: exits 1 when results directory is missing (no silent all-pass)', async () => {
  const { code, stderr } = await runCli(['aggregate', '/definitely/does/not/exist']);
  assert.equal(code, 1);
  assert.match(stderr, /results directory not found/);
});

test('aggregate: exits 2 on non-numeric --size-cap', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', '--size-cap', 'abc', results]);
    assert.equal(code, 2);
    assert.match(stderr, /--size-cap must be numeric/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: --size-cap triggers truncation end-to-end with tail-summary block', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    // Five projects; cap is small enough that some will overflow to tail.
    for (let i = 0; i < 5; i++) {
      await writeResultArtifact(results, {
        project: `acme/proj-${i}`,
        errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0,
        syntheticKeys: [],
        // Pad each rule's files list to make blocks large
        rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: 200 }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
      });
    }
    const { stdout, code } = await runCli(['aggregate', '--size-cap', '20000', '--file-cap', '200', results]);
    assert.equal(code, 0);
    assert.match(stdout, /<summary>Tail projects \(\d+ truncated/, 'tail-summary block should appear when truncation fires');
    assert.match(stdout, /file:line detail truncated for tail projects/, 'trailer sentence should appear');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('aggregate: writes uncapped report to $GITHUB_STEP_SUMMARY before truncating stdout', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const results = path.join(tmp, 'results');
    await writeResultArtifact(results, {
      project: 'acme/demo',
      errorCount: 2, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0,
      syntheticKeys: [],
      rules: { foo: { errors: 2, warnings: 0, fixable: 0, files: ['a.js:1', 'a.js:2'] } },
    });
    const stepSummary = path.join(tmp, 'step-summary.md');
    const { stdout, code } = await runCli(['aggregate', results], {
      env: { GITHUB_STEP_SUMMARY: stepSummary },
    });
    assert.equal(code, 0);
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(stepSummary, 'utf8');
    // The step summary should contain the same project block the stdout has
    assert.match(written, /acme\/demo/);
    assert.match(stdout, /acme\/demo/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('prepare: stderr warns when filePaths escape --cwd', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  try {
    const inputFile = path.join(tmp, 'raw.json');
    // filePath is under /elsewhere/... but cwd is /repo; path.relative produces ../
    await writeFile(inputFile, JSON.stringify([{
      filePath: '/elsewhere/src/a.js',
      errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0,
      messages: [{ ruleId: 'no-undef', severity: 2, line: 1, message: 'x' }],
    }]), 'utf8');
    const { code, stderr } = await runCli(
      ['prepare', '--project', 'acme/demo', '--cwd', '/repo', inputFile],
    );
    assert.equal(code, 0);
    assert.match(stderr, /filePath outside --cwd/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
