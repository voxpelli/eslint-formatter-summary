import assert from 'node:assert/strict';
import test from 'node:test';

import renderFootnote from '../lib/cli/render-footnote.js';
import { SYNTHETIC_FOOTNOTE_TEXT } from '../lib/synthetic-footnote-text.js';

/** @import { ProjectResult } from '../lib/cli/prepare-project-result.js' */

/** @type {ProjectResult} */
const base = {
  project: 'owner/repo',
  errorCount: 0,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  syntheticKeys: [],
  rules: {},
};

test('renderFootnote returns empty string when no synthetic keys present', () => {
  assert.equal(renderFootnote([{ ...base, syntheticKeys: [] }]), '');
});

test('renderFootnote wraps explainable keys in <sub><em>', () => {
  const out = renderFootnote([{ ...base, syntheticKeys: ['(parser error)'] }]);
  assert.match(out, /^<sub><em>/);
  assert.match(out, /<\/em><\/sub>\n\n$/);
  assert.ok(out.includes('<code>(parser error)</code>'));
});

test('renderFootnote deduplicates across multiple projects', () => {
  const out = renderFootnote([
    { ...base, syntheticKeys: ['(parser error)'] },
    { ...base, syntheticKeys: ['(parser error)', '(unused disable)'] },
  ]);
  const parserMatches = out.match(/\(parser error\)/g) ?? [];
  assert.equal(parserMatches.length, 1);
  assert.ok(out.includes('(unused disable)'));
});

test('renderFootnote sorts keys alphabetically', () => {
  const out = renderFootnote([{ ...base, syntheticKeys: ['(unused disable)', '(parser error)'] }]);
  const missingIdx = out.indexOf('(parser error)');
  const unusedIdx = out.indexOf('(unused disable)');
  assert.ok(missingIdx < unusedIdx, 'alphabetical order: parser before unused');
});

test('renderFootnote excludes (invalid rule id) intentionally', () => {
  const out = renderFootnote([{ ...base, syntheticKeys: ['(invalid rule id)'] }]);
  assert.equal(out, '');
});

test('renderFootnote uses the shared synthetic-footnote-text module', () => {
  const out = renderFootnote([{ ...base, syntheticKeys: ['(parser error)'] }]);
  assert.ok(
    out.includes(SYNTHETIC_FOOTNOTE_TEXT['(parser error)']),
    'CLI footnote must render the canonical shared prose for (parser error)'
  );
});
