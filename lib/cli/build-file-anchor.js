import sanitize from '../sanitize-untrusted.js';
import { escapeHtml } from '../utils/text.js';

/** @import { ProjectResult, ProjectResultFileEntry } from './prepare-project-result.js' */

const SLUG_SHAPE = /^[\w.-]+\/[\w.-]+$/;
const PATH_AND_LINE = /^(.+):(\d+)$/;
const PATH_MAX = 500;

/**
 * @param {string} slug
 * @returns {boolean}
 */
export const isValidSlug = (slug) => SLUG_SHAPE.test(slug);

/**
 * Validate and sanitize a slug for HTML and URL interpolation.
 * Validation runs on the raw value; sanitization scrubs secret-shaped tokens
 * and control chars before the result is embedded in markup or URLs.
 *
 * @param {ProjectResult['project']} slug
 * @returns {{ safeSlug: string, valid: boolean }}
 */
const resolveSlug = (slug) => ({
  safeSlug: sanitize(slug),
  valid: isValidSlug(slug),
});

/**
 * @param {string} path Plain slash-delimited path.
 * @returns {string}
 */
const encodePath = (path) =>
  path.split('/').map((seg) => encodeURIComponent(seg)).join('/');

/**
 * Sanitize a `path` or `path:line` string while preserving a trailing line
 * suffix across PATH_MAX truncation.
 *
 * @param {string} rawPathAndLine
 * @returns {string}
 */
const sanitizePathAndLine = (rawPathAndLine) => {
  const rawMatch = PATH_AND_LINE.exec(rawPathAndLine);
  if (!rawMatch) {
    return sanitize(rawPathAndLine, { maxLength: PATH_MAX });
  }

  const [, rawPath = '', rawLine = ''] = rawMatch;
  const lineSuffix = `:${rawLine}`;

  return sanitize(rawPath, {
    maxLength: Math.max(1, PATH_MAX - lineSuffix.length),
  }) + lineSuffix;
};

/**
 * Render a `ProjectResult.project` slug as markdown. Validated slugs become a
 * clickable `<a href>` to the repo root; anything unrecognized is treated as
 * untrusted text and HTML-escaped into a plain span.
 *
 * @param {ProjectResult['project']} slug
 * @returns {string}
 */
export const renderProjectLabel = (slug) => {
  const { safeSlug, valid } = resolveSlug(slug);
  const linkText = `<code>${escapeHtml(safeSlug)}</code>`;
  return valid
    ? `<a href="https://github.com/${safeSlug}">${linkText}</a>`
    : linkText;
};

/**
 * Render a single file entry from a `ProjectResult.rules[id].files` array.
 * Entries are `"path:line"` or `"path:line\tdetail"` where detail is the
 * synthetic-key per-file rule name. When the slug is valid we emit a GitHub
 * `blob/HEAD/<path>#L<line>` anchor; otherwise we fall back to a plain
 * `<code>` span. The detail (when present) is rendered in a trailing
 * `<sub>` tag.
 *
 * @see format-results.js renderFileEntry — formatter twin; path-only (no line anchor), wrapped in `<li>`.
 * @see {@link sanitize} — applied to path and detail before HTML escape.
 * @param {ProjectResultFileEntry} entry
 * @param {ProjectResult['project']} slug
 * @returns {string}
 */
export function renderFileSpan (entry, slug) {
  const tab = entry.indexOf('\t');
  const rawPathAndLine = tab === -1 ? entry : entry.slice(0, tab);
  const rawDetail = tab === -1 ? '' : entry.slice(tab + 1);

  const pathAndLine = sanitizePathAndLine(rawPathAndLine);

  const detail = rawDetail ? sanitize(rawDetail) : '';
  const detailSuffix = detail ? ` <sub>${escapeHtml(detail)}</sub>` : '';

  const { safeSlug, valid } = resolveSlug(slug);
  const [, filePath, line] = (valid && PATH_AND_LINE.exec(pathAndLine)) || [];
  const linkText = `<code>${escapeHtml(pathAndLine)}</code>`;

  return (
    filePath !== undefined && line !== undefined
      ? `<a href="https://github.com/${safeSlug}/blob/HEAD/${
          encodePath(filePath ?? '')
        }#L${line}">${linkText}</a>`
      : linkText
  ) + detailSuffix;
}
