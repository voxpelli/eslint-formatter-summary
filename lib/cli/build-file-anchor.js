import escapeHtml from '../escape-html.js';

const SLUG_SHAPE = /^[\w.-]+\/[\w.-]+$/;
const PATH_AND_LINE = /^(.+):(\d+)$/;

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
export const renderProjectLabel = (slug) =>
  isValidSlug(slug)
    ? `<a href="https://github.com/${slug}"><code>${escapeHtml(slug)}</code></a>`
    : escapeHtml(slug);

/**
 * Render a single file entry from a `ProjectResult.rules[id].files` array.
 * Entries are `"path:line"` or `"path:line\tdetail"` where detail is the
 * synthetic-key per-file rule name. When the slug is valid we emit a GitHub
 * `blob/HEAD/<path>#L<line>` anchor; otherwise we fall back to a plain
 * `<code>` span. The detail (when present) is rendered in a trailing
 * `<sub>` tag.
 *
 * @param {string} entry
 * @param {string} slug
 * @returns {string}
 */
export function renderFileSpan (entry, slug) {
  const tab = entry.indexOf('\t');
  const pathAndLine = tab === -1 ? entry : entry.slice(0, tab);
  const detail = tab === -1 ? '' : entry.slice(tab + 1);
  const detailSuffix = detail ? ` <sub>${escapeHtml(detail)}</sub>` : '';

  const match = PATH_AND_LINE.exec(pathAndLine);
  if (match && isValidSlug(slug)) {
    const [, filePath, line] = match;
    const encoded = encodePath(filePath ?? '');
    return `<a href="https://github.com/${slug}/blob/HEAD/${encoded}#L${line}"><code>${escapeHtml(pathAndLine)}</code></a>${detailSuffix}`;
  }
  return `<code>${escapeHtml(pathAndLine)}</code>${detailSuffix}`;
}
