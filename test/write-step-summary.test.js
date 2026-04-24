import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  mkdtemp, readFile, rm, writeFile,
} from 'node:fs/promises';

import { writeStepSummary } from '../lib/write-step-summary.js';

/**
 * @returns {Promise<{ dir: string, cleanup: () => Promise<void> }>}
 */
const makeTmp = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wss-test-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

test('writeStepSummary appends content + newline to a writable path', async () => {
  const { cleanup, dir } = await makeTmp();
  try {
    const file = path.join(dir, 'step-summary.md');
    await writeStepSummary(file, '## hello');
    assert.equal(await readFile(file, 'utf8'), '## hello\n');
  } finally {
    await cleanup();
  }
});

test('writeStepSummary preserves existing content (append semantics)', async () => {
  const { cleanup, dir } = await makeTmp();
  try {
    const file = path.join(dir, 'step-summary.md');
    await writeFile(file, 'pre-existing\n', 'utf8');
    await writeStepSummary(file, 'appended');
    assert.equal(await readFile(file, 'utf8'), 'pre-existing\nappended\n');
  } finally {
    await cleanup();
  }
});

test('writeStepSummary soft-fails on unwritable path, writes warning to stderr', async (t) => {
  const { cleanup, dir } = await makeTmp();
  try {
    // Point at a path inside a non-existent subdir — appendFile will ENOENT.
    const badPath = path.join(dir, 'does', 'not', 'exist', 'file.md');
    /** @type {string[]} */
    const stderrChunks = [];
    // Register restore BEFORE installing the hook — if the hook-assignment
    // expression throws, the restore still runs and the next test sees a
    // clean stderr.
    const origWrite = process.stderr.write.bind(process.stderr);
    t.after(() => { process.stderr.write = origWrite; });
    /** @type {(chunk: unknown) => boolean} */
    const hook = (chunk) => { stderrChunks.push(String(chunk)); return true; };
    process.stderr.write = /** @type {any} */ (hook);

    await writeStepSummary(badPath, '## hello');

    const combined = stderrChunks.join('');
    assert.match(combined, /failed to append to \$GITHUB_STEP_SUMMARY/);
    assert.ok(combined.includes(badPath), 'warning should name the failing path');
  } finally {
    await cleanup();
  }
});

test('writeStepSummary uses the caller name prefix in the warning', async (t) => {
  const { cleanup, dir } = await makeTmp();
  try {
    const badPath = path.join(dir, 'nope', 'x.md');
    /** @type {string[]} */
    const chunks = [];
    const orig = process.stderr.write.bind(process.stderr);
    t.after(() => { process.stderr.write = orig; });
    /** @type {(chunk: unknown) => boolean} */
    const hook = (chunk) => { chunks.push(String(chunk)); return true; };
    process.stderr.write = /** @type {any} */ (hook);

    await writeStepSummary(badPath, 'x', 'my-custom-tool');

    assert.match(chunks.join(''), /^my-custom-tool: /);
  } finally {
    await cleanup();
  }
});

test('writeStepSummary creates the file if it does not exist', async () => {
  const { cleanup, dir } = await makeTmp();
  try {
    const file = path.join(dir, 'fresh.md');
    // Don't pre-create file — appendFile should.
    await writeStepSummary(file, 'first-content');
    assert.equal(await readFile(file, 'utf8'), 'first-content\n');
  } finally {
    await cleanup();
  }
});
