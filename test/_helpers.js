/* eslint-disable n/no-process-env */
/* eslint-disable security/detect-non-literal-fs-filename */

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mkdir, mkdtemp, rm, writeFile,
} from 'node:fs/promises';

/** @import { ProjectResult } from '../lib/cli/prepare-project-result.js' */

const binPath = fileURLToPath(new URL('../bin/eslint-summary.js', import.meta.url));

/**
 * Spawn the installed `eslint-summary` bin with the given argv. When `input`
 * is provided it is written to stdin and stdin is closed; otherwise stdin is
 * ignored.
 *
 * @param {string[]} argv
 * @param {{ cwd?: string, input?: string, env?: Record<string, string> }} [options]
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export const runCli = (argv, { cwd, env, input } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [binPath, ...argv], {
    cwd,
    env: { ...process.env, ...env },
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  if (child.stdout) {
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  }
  child.on('error', reject);
  child.on('close', (code) => { resolve({ stdout, stderr, code: code ?? 0 }); });
  if (input !== undefined && child.stdin) {
    child.stdin.write(input);
    child.stdin.end();
  }
});

/**
 * Write a ProjectResult fixture to `<dir>/<slug-with-slashes-as-dashes>/eslint-result.json`,
 * mirroring the layout that `eslint-summary aggregate` expects.
 *
 * @param {string} dir
 * @param {ProjectResult} p
 */
export const writeResultArtifact = async (dir, p) => {
  const sub = path.join(dir, p.project.replaceAll('/', '-'));
  await mkdir(sub, { recursive: true });
  await writeFile(path.join(sub, 'eslint-result.json'), JSON.stringify(p), 'utf8');
};

/**
 * Create an isolated tmp directory for a single test, plus a matching
 * `cleanup()` that recursively removes it. Use in a `try`/`finally` pair.
 *
 * New tests should prefer {@link tmpDir} instead — it auto-cleans via
 * node:test's `t.after` and removes the ceremonial `try`/`finally` block.
 *
 * @returns {Promise<{ dir: string, cleanup: () => Promise<void> }>}
 */
export const makeTmpDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

/**
 * Allocate an auto-cleaned temp directory using `t.after`. Replaces the
 * `try { … } finally { await cleanup(); }` idiom with a single `await` line.
 *
 * @param {import('node:test').TestContext} t
 * @returns {Promise<string>} Absolute path to the new tmp dir.
 */
export const tmpDir = async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'efs-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};

/**
 * Hook `process.stderr.write` for the lifetime of the test. Returns a reader
 * that yields the joined captured output so far. The restore is registered
 * BEFORE the hook is installed so a hook-assignment throw still restores.
 *
 * @param {import('node:test').TestContext} t
 * @returns {() => string}
 */
export const captureStderr = (t) => {
  /** @type {string[]} */
  const chunks = [];
  const orig = process.stderr.write.bind(process.stderr);
  t.after(() => { process.stderr.write = orig; });
  /** @type {(chunk: unknown) => boolean} */
  const hook = (chunk) => { chunks.push(String(chunk)); return true; };
  process.stderr.write = /** @type {any} */ (hook);
  return () => chunks.join('');
};

/**
 * Override env vars for the lifetime of the test. Pass `undefined` as a value
 * to delete the key for the duration. Restore runs via `t.after`.
 *
 * @param {import('node:test').TestContext} t
 * @param {Record<string, string | undefined>} overrides
 */
export const withEnv = (t, overrides) => {
  /** @type {Record<string, string | undefined>} */
  const prev = {};
  for (const [k, v] of Object.entries(overrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
};

/**
 * Build a {@link ProjectResult} fixture. All fields default to an empty-but-
 * valid shape (zero counts, empty rules); override only what the test cares
 * about. Keeps test fixtures focused on the axis under test.
 *
 * @param {Partial<ProjectResult>} [overrides]
 * @returns {ProjectResult}
 */
export const makeProjectResult = (overrides = {}) => ({
  project: 'owner/demo',
  errorCount: 0,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  syntheticKeys: [],
  rules: {},
  ...overrides,
});

/**
 * Write a single artifact to `dir` using {@link makeProjectResult} defaults
 * so tests only state the fields that matter to the assertion.
 *
 * @param {string} dir
 * @param {Partial<ProjectResult>} overrides
 */
export const writeOneProjectArtifact = (dir, overrides) =>
  writeResultArtifact(dir, makeProjectResult(overrides));
