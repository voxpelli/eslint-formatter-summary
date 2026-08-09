import { stripControls } from './utils/text.js';

// Secret patterns scrubbed before rendering untrusted strings into PR comment
// markdown. An attacker-authored ESLint rule could place a token in a lint
// message; defence-in-depth ensures we never echo it verbatim. Patterns are
// conservative — only high-confidence token shapes that would be actively
// harmful if leaked.
const SECRET_PATTERNS = [
  // Stateless GitHub App installation tokens: ghs_<app ID>_<base64url JWT>
  // (three dot-separated segments). The second underscore and the dots break
  // the legacy `gh[oprs]_[A-Za-z0-9]{36,}` shape, so this must come first.
  // Truncated tokens (fewer than three segments, e.g. a JWT missing its
  // signature) are intentionally not matched — without the signature they
  // are not usable credentials, and a looser pattern would over-match.
  /ghs_\d+_[\w-]+\.[\w-]+\.[\w-]+/g,
  // ghp_ (classic PATs), gho_ (OAuth), ghs_ (server-to-server), ghr_ (refresh)
  /gh[oprs]_[A-Za-z0-9]{36,}/g,
  /ghu_[A-Za-z0-9]{36,}/g,
  // Fine-grained PATs: github_pat_ + 22 alphanumerics + _ + 59 alphanumerics
  /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g,
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
 * @see utils/text.js escapeHtml composes with sanitize at every render sink — scrubbed output is then HTML-escaped as normal.
 * @see {@link stripControls} removes bidi / zero-width codepoints (composed first inside sanitize).
 * @see {@link https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github|GitHub token formats}
 * @param {string} text
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function sanitizeUntrusted (text, { maxLength = DEFAULT_MAX_LENGTH } = {}) {
  let out = '';
  for (const ch of stripControls(text)) {
    const code = ch.codePointAt(0);
    // C0 controls (except CR/LF/tab, collapsed below), DEL, and C1 controls
    // are stripped — terminal-control and log-injection defense. The bidi /
    // zero-width set was already removed by stripControls.
    const isControl = code !== undefined && (code < 0x20 || (code >= 0x7F && code <= 0x9F));
    const isCollapsible = ch === '\n' || ch === '\r' || ch === '\t';
    if (!isControl || isCollapsible) out += ch;
  }
  out = out.replaceAll(/[\r\n\t]+/g, ' ');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replaceAll(pattern, '[REDACTED]');
  }
  // Code-unit length is intentional here — `maxLength` is a cosmetic cell
  // cap (rule ids, file paths, message detail), not a byte budget. The
  // byte-safe truncation that guards the ~65 KB sticky-PR-comment ceiling
  // lives in `truncate-comment.js` / `truncate-formatter-markdown.js`.
  if (out.length > maxLength) out = out.slice(0, maxLength) + '…';
  return out;
}
