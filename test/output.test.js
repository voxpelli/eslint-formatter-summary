import assert from 'node:assert/strict';
import test from 'node:test';

import { outputFlags, writeOutput } from '../lib/cli/output.js';

test('outputFlags defines the shared --out flag', () => {
  assert.deepEqual(outputFlags, {
    out: {
      type: 'string',
      'short': 'o',
      'default': '-',
      description: 'Output file path, or "-" for stdout',
    },
  });
});

test('writeOutput writes to stdout when out is "-"', async () => {
  /** @type {string[]} */
  const chunks = [];

  await writeOutput('hello\n', { out: '-' }, {
    stdout: {
      write (chunk) {
        chunks.push(String(chunk));
        return true;
      },
    },
  });

  assert.deepEqual(chunks, ['hello\n']);
});

test('writeOutput writes to stdout when out is empty', async () => {
  /** @type {string[]} */
  const chunks = [];

  await writeOutput('hello\n', { out: '' }, {
    stdout: {
      write (chunk) {
        chunks.push(String(chunk));
        return true;
      },
    },
  });

  assert.deepEqual(chunks, ['hello\n']);
});

test('writeOutput writes to file when out is a file path', async () => {
  /** @type {Array<[string, string, string]>} */
  const calls = [];

  await writeOutput('hello\n', { out: 'out.txt' }, {
    writeToFile: async (...args) => {
      calls.push(args);
    },
  });

  assert.deepEqual(calls, [['out.txt', 'hello\n', 'utf8']]);
});
