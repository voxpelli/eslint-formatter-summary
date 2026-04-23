import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import readStdin from '../lib/utils/read-stdin.js';

test('readStdin concatenates all chunks from a readable stream', async () => {
  const input = Readable.from(['{"hello":', '"world"}']);

  assert.equal(await readStdin(input), '{"hello":"world"}');
});

test('readStdin returns an empty string for an empty readable stream', async () => {
  const input = Readable.from([]);

  assert.equal(await readStdin(input), '');
});
