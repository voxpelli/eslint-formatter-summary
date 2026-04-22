import stripControls from './strip-controls.js';

// Secret patterns scrubbed before rendering untrusted strings into PR comment
// markdown. An attacker-authored ESLint rule could place a token in a lint
// message; defence-in-depth ensures we never echo it verbatim. Patterns are
// conservative — only high-confidence token shapes that would be actively
// harmful if leaked.
const SECRET_PATTERNS = [
  /gh[ps]_[A-Za-z0-9]{36,}/g,
  /ghu_[A-Za-z0-9]{36,}/g,
  /npm_[A-Za-z0-9]{36,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+-----/g,
];

const DEFAULT_MAX_LENGTH = 200;

/**
 * Strip control chars, collapse embedded whitespace (CR/LF/tab → single
 * space — rule ids and file paths are single-line identifiers, and a literal
 * `\n` inside a sanitized value would split a markdown table row and corrupt
 * the `|\n` / `\n</details>\n\n` anchors used by both truncators), scrub
 * secret-shaped substrings, then cap length.
 * Idempotent: `sanitize(sanitize(x)) === sanitize(x)`.
 *
 * Applied to untrusted strings (rule ids, file paths, message details) BEFORE
 * `escapeHtml`, so the `[REDACTED]` replacement gets HTML-escaped normally.
 *
 * @see escape-html.js composes escapeHtml after sanitize — scrubbed output is then HTML-escaped as normal.
 * @see {@link stripControls} removes bidi / zero-width codepoints (composed first inside sanitize).
 * @see {@link https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github|GitHub token formats}
 * @param {string} text
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export default function sanitizeUntrusted (text, { maxLength = DEFAULT_MAX_LENGTH } = {}) {
  let out = stripControls(text).replaceAll(/[\r\n\t]+/g, ' ');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replaceAll(pattern, '[REDACTED]');
  }
  if (out.length > maxLength) out = out.slice(0, maxLength) + '…';
  return out;
}
