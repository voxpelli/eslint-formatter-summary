import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
export const runCli = (argv, { cwd, input, env } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [binPath, ...argv], {
    cwd,
    env: { ...process.env, ...env },
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
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
  const sub = path.join(dir, p.project.replace(/\//g, '-'));
  await mkdir(sub, { recursive: true });
  await writeFile(path.join(sub, 'eslint-result.json'), JSON.stringify(p), 'utf8');
};

/**
 * Create an isolated tmp directory for a single test, plus a matching
 * `cleanup()` that recursively removes it. Use in a `try`/`finally` pair.
 *
 * @returns {Promise<{ dir: string, cleanup: () => Promise<void> }>}
 */
export const makeTmpDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'efs-cli-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
};
