import escapeHtml from '../escape-html.js';
import sanitize from '../sanitize-untrusted.js';

const SLUG_SHAPE = /^[\w.-]+\/[\w.-]+$/;
const PATH_AND_LINE = /^(.+):(\d+)$/;
const PATH_MAX = 500;

/**
 * @param {string} slug
 * @returns {boolean}
 */
export const isValidSlug = (slug) => SLUG_SHAPE.test(slug);

/**
 * @param {string} filePath Plain slash-delimited project-relative path.
 * @returns {string}
 */
const encodePath = (filePath) =>
  filePath.split('/').map((seg) => encodeURIComponent(seg)).join('/');

/**
 * Render a `ProjectResult.project` slug as markdown. Validated slugs become a
 * clickable `<a href>` to the repo root; anything unrecognized is treated as
 * untrusted text and HTML-escaped into a plain span.
 *
 * @param {string} slug
 * @returns {string}
 */
export const renderProjectLabel = (slug) => {
  // Validate shape on the raw slug, but render the sanitized value — scrubs
  // secret-shaped tokens and control chars from any invalid-branch fallback.
  const safeSlug = sanitize(slug);
  return isValidSlug(slug)
    ? `<a href="https://github.com/${safeSlug}"><code>${escapeHtml(safeSlug)}</code></a>`
    : escapeHtml(safeSlug);
};

/**
 * Render a single file entry from a `ProjectResult.rules[id].files` array.
 * Entries are `"path:line"` or `"path:line\tdetail"` where detail is the
 * synthetic-key per-file rule name. When the slug is valid we emit a GitHub
 * `blob/HEAD/<path>#L<line>` anchor; otherwise we fall back to a plain
 * `<code>` span. The detail (when present) is rendered in a trailing
 * `<sub>` tag.
 *
 * @see lib/format-results.js `renderFileEntry` — formatter twin; path-only (no line anchor), wrapped in `<li>`.
 * @see {@link sanitize} — applied to path and detail before HTML escape.
 * @param {string} entry
 * @param {string} slug
 * @returns {string}
 */
export function renderFileSpan (entry, slug) {
  const tab = entry.indexOf('\t');
  const rawPathAndLine = tab === -1 ? entry : entry.slice(0, tab);
  const rawDetail = tab === -1 ? '' : entry.slice(tab + 1);
  const pathAndLine = sanitize(rawPathAndLine, { maxLength: PATH_MAX });
  const detail = rawDetail ? sanitize(rawDetail) : '';
  const detailSuffix = detail ? ` <sub>${escapeHtml(detail)}</sub>` : '';

  const match = PATH_AND_LINE.exec(pathAndLine);
  if (match && isValidSlug(slug)) {
    const [, filePath, line] = match;
    const encoded = encodePath(filePath ?? '');
    // Mirror renderProjectLabel: sanitize slug before URL interpolation to
    // scrub any secret-shaped substrings that slipped past the shape regex
    // (SLUG_SHAPE allows `[\w.-]` which matches `ghp_`-style tokens).
    const safeSlug = sanitize(slug);
    return `<a href="https://github.com/${safeSlug}/blob/HEAD/${encoded}#L${line}"><code>${escapeHtml(pathAndLine)}</code></a>${detailSuffix}`;
  }
  return `<code>${escapeHtml(pathAndLine)}</code>${detailSuffix}`;
}
