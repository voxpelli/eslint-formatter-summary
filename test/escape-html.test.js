import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml } from '../lib/utils/text.js';

test('escapeHtml escapes & before other entities (no double-escape)', () => {
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeHtml escapes double and single quotes', () => {
  assert.equal(escapeHtml('"it\'s"'), '&quot;it&#39;s&quot;');
});

test('escapeHtml breaks up </details> so it cannot close an outer details tag', () => {
  const out = escapeHtml('foo</details>bar');
  assert.ok(!out.includes('</details>'));
  assert.ok(out.includes('&lt;/details&gt;'));
});

test('escapeHtml strips bidi controls before escaping', () => {
  const payload = 'a' + String.fromCodePoint(0x202E) + '<b>';
  assert.equal(escapeHtml(payload), 'a&lt;b&gt;');
});

test('escapeHtml on empty string returns empty string', () => {
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml encodes `|` so a table-cell delimiter cannot be injected', () => {
  // GFM tokenizes `|` before inline HTML parses, so a literal pipe inside
  // `<code>` inside a pipe-table cell would still split the row. Encoding
  // to `&#124;` renders visually as `|` without breaking table structure.
  assert.equal(escapeHtml('evil|rule'), 'evil&#124;rule');
});
