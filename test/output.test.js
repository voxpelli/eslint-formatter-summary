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
  /** @type {Array<{ file: string, data: string, encoding: string | null | undefined }>} */
  const calls = [];

  await writeOutput('hello\n', { out: 'out.txt' }, {
    writeToFile: async (...args) => {
      const [file, data, options] = args;
      calls.push({
        file: String(file),
        data: String(data),
        encoding: typeof options === 'string' ? options : options?.encoding,
      });
    },
  });

  assert.deepEqual(calls, [{ file: 'out.txt', data: 'hello\n', encoding: 'utf8' }]);
});
