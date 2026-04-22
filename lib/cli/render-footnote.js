import escapeHtml from '../escape-html.js';
import { SYNTHETIC_FOOTNOTE_TEXT } from '../synthetic-footnote-text.js';

/** @import { SyntheticKey } from '../classify-message.js' */
/** @import { ProjectResult } from './prepare-project-result.js' */

// `(invalid rule id)` is intentionally absent from the CLI footnote — it
// indicates a plugin emitting malformed IDs, better surfaced in-row than
// glossed in a "ESLint reported…" legend.
const FOOTNOTE_KEYS = new Set(
  /** @type {SyntheticKey[]} */
  (['(parser error)', '(no rule id)', '(unused disable)', '(missing rule)'])
);

/**
 * Render the `<sub><em>…</em></sub>` synthetic-key legend that explains any
 * parenthesized buckets present in the fleet. The `(invalid rule id)` key is
 * intentionally absent from the footnote — it indicates a plugin is emitting
 * malformed rule IDs, which is a config bug best surfaced in-row rather than
 * given a "ESLint reported…" gloss.
 *
 * @param {ProjectResult[]} results
 * @returns {string} Empty string when no explainable synthetic keys are present.
 */
export default function renderFootnote (results) {
  /** @type {Set<SyntheticKey>} */
  const present = new Set();
  for (const r of results) {
    if (!Array.isArray(r.syntheticKeys)) continue;
    for (const key of r.syntheticKeys) {
      if (FOOTNOTE_KEYS.has(/** @type {SyntheticKey} */ (key))) {
        present.add(/** @type {SyntheticKey} */ (key));
      }
    }
  }
  if (present.size === 0) return '';

  const lines = [...present]
    .toSorted()
    .map((k) => `<code>${escapeHtml(k)}</code> — ${SYNTHETIC_FOOTNOTE_TEXT[k]}`);
  return `<sub><em>${lines.join('<br>')}</em></sub>\n\n`;
}
