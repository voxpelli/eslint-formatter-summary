/** @import { SyntheticKey } from './classify-message.js' */

/**
 * Canonical descriptions for synthetic message buckets. Shared between the
 * formatter markdown path and the CLI aggregate footnote so the user-visible
 * prose does not drift. Each consumer wraps the text in its own surrounding
 * markup.
 *
 * @see {@link SyntheticKey} — how these buckets are classified.
 * @see {@link ./format-results.js|constructFootnote (formatter markdown)}
 * @see {@link ./cli/render-footnote.js|renderFootnote (CLI, filters `(invalid rule id)`)}
 * @type {Record<SyntheticKey, string>}
 */
export const SYNTHETIC_FOOTNOTE_TEXT = {
  '(parser error)': 'file could not be parsed; usually a syntax error or misconfigured parser.',
  '(unused disable)': '`eslint-disable` directive covers no reported problems; the suppressed rule name is shown per file.',
  '(missing rule)': 'ESLint could not find a rule definition; usually a missing or misnamed plugin. The unresolved rule name is shown per file.',
  '(invalid rule id)': 'rule ID failed shape validation (`/^[@\\w/-]+$/`); the source plugin is emitting malformed IDs.',
  '(no rule id)': 'non-rule message not matching any other classifier; catch-all that absorbs future ESLint message rewordings.',
};
