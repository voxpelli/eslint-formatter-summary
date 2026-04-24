import assert from 'node:assert/strict';
import test from 'node:test';

import { sliceUtf8Bytes } from '../lib/utils/byte-safe-slice.js';

test('sliceUtf8Bytes returns full string when budget exceeds byte length', () => {
  assert.equal(sliceUtf8Bytes('hello', 100), 'hello');
});

test('sliceUtf8Bytes caps at ASCII boundary', () => {
  assert.equal(sliceUtf8Bytes('hello world', 5), 'hello');
});

test('sliceUtf8Bytes rewinds past UTF-8 continuation bytes on CJK', () => {
  // Each '中' is 3 UTF-8 bytes. Budget 7 would land mid-codepoint; must rewind
  // to the end of the 2nd character (byte 6) for a complete code-point slice.
  const str = '中中中';
  const out = sliceUtf8Bytes(str, 7);
  assert.equal(out, '中中');
  assert.ok(Buffer.byteLength(out, 'utf8') <= 7);
});

test('sliceUtf8Bytes rewinds past UTF-8 continuation bytes on emoji (4-byte codepoints)', () => {
  // '🌍' is 4 bytes. Budget 5 would land inside the second emoji.
  const str = '🌍🌍';
  const out = sliceUtf8Bytes(str, 5);
  assert.equal(out, '🌍');
  assert.ok(Buffer.byteLength(out, 'utf8') <= 5);
});

test('sliceUtf8Bytes clamps negative budgets to 0', () => {
  // Caller math like `sizeCap - HEADROOM` can go negative; Buffer.subarray
  // would otherwise interpret a negative `end` as `(len + end)` and silently
  // return the wrong slice.
  assert.equal(sliceUtf8Bytes('hello', -5), '');
});

test('sliceUtf8Bytes handles zero budget', () => {
  assert.equal(sliceUtf8Bytes('hello', 0), '');
});
