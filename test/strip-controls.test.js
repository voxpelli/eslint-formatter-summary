import assert from 'node:assert/strict';
import test from 'node:test';

import { stripControls } from '../lib/utils/text.js';

test('stripControls removes zero-width space (U+200B)', () => {
  assert.equal(stripControls('a​b'), 'ab');
});

test('stripControls removes bidi overrides (U+202A–U+202E)', () => {
  for (const cp of [0x202A, 0x202B, 0x202C, 0x202D, 0x202E]) {
    assert.equal(stripControls('a' + String.fromCodePoint(cp) + 'b'), 'ab', `failed for U+${cp.toString(16)}`);
  }
});

test('stripControls removes word-joiner / invisible-operator range (U+2060–U+2069)', () => {
  for (let cp = 0x2060; cp <= 0x2069; cp++) {
    assert.equal(stripControls('x' + String.fromCodePoint(cp) + 'y'), 'xy', `failed for U+${cp.toString(16)}`);
  }
});

test('stripControls removes BOM (U+FEFF)', () => {
  assert.equal(stripControls('﻿hello'), 'hello');
});

test('stripControls preserves ordinary whitespace and unicode', () => {
  assert.equal(stripControls('hello world  \n\tend — café'), 'hello world  \n\tend — café');
});

test('stripControls on empty string returns empty string', () => {
  assert.equal(stripControls(''), '');
});

test('stripControls trojan-source style identifier is flattened', () => {
  const payload = 'admin' + String.fromCodePoint(0x202E) + 'dmin';
  assert.equal(stripControls(payload), 'admindmin');
});
