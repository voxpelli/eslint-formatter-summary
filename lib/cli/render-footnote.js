import escapeHtml from '../escape-html.js';

/** @type {Record<string, string>} */
const FOOTNOTE_TEXT = {
  '(parser error)': 'ESLint reported a fatal parse/syntax error without a rule id.',
  '(no rule id)': 'ESLint reported a non-fatal issue without attributing it to a named rule.',
  '(unused disable)': 'An <code>eslint-disable</code> directive reported no matching problems — the named rule is shown next to each file.',
  '(missing rule)': 'An <code>eslint-disable</code> / config references a rule ESLint could not load (plugin uninstalled or rule removed) — the name is shown next to each file.',
};

const FOOTNOTE_KEYS = new Set(Object.keys(FOOTNOTE_TEXT));

/**
 * Render the `<sub><em>…</em></sub>` synthetic-key legend that explains any
 * parenthesized buckets present in the fleet. The `(invalid rule id)` key is
 * intentionally absent from the footnote — it indicates a plugin is emitting
 * malformed rule IDs, which is a config bug best surfaced in-row rather than
 * given a "ESLint reported…" gloss.
 *
 * @param {import('./prepare-project-result.js').ProjectResult[]} results
 * @returns {string} Empty string when no explainable synthetic keys are present.
 */
export default function renderFootnote (results) {
  const present = new Set();
  for (const r of results) {
    if (!Array.isArray(r.syntheticKeys)) continue;
    for (const key of r.syntheticKeys) {
      if (FOOTNOTE_KEYS.has(key)) present.add(key);
    }
  }
  if (present.size === 0) return '';

  const lines = [...present]
    .toSorted()
    .map((k) => `<code>${escapeHtml(k)}</code> — ${FOOTNOTE_TEXT[k]}`);
  return `<sub><em>${lines.join('<br>')}</em></sub>\n\n`;
}
