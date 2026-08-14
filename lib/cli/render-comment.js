import { sanitizeUntrusted } from '../sanitize-untrusted.js';
import { escapeHtml } from '../utils/text.js';
import { toCount } from './coerce.js';
import { renderFootnote } from './render-footnote.js';
import { renderProjectBlock } from './render-project-block.js';

/** @import { ProjectResult } from './prepare-project-result.js' */

/**
 * Render the "all N external projects pass" body used on clean runs. When
 * `eslintVersions` is provided (from `aggregate --eslint-versions`), the
 * message names the ESLint versions the fleet was tested against — the
 * peer-floor leg of a matrix run would otherwise be invisible in the comment.
 *
 * @param {number|undefined} projectCount
 * @param {string[]} [eslintVersions]
 * @returns {string}
 */
export function renderSuccess (projectCount, eslintVersions) {
  const n = typeof projectCount === 'number' && projectCount > 0
    ? String(projectCount)
    : '?';

  const versionClause = eslintVersions && eslintVersions.length > 0
    ? ` on eslint ${eslintVersions.map((v) => escapeHtml(sanitizeUntrusted(v))).join(' and ')}`
    : '';

  return `## External project test results\n\n✅ All ${n} external projects pass${versionClause}\n`;
}

/**
 * Render the full (uncapped) fleet-summary markdown: header + headline counts,
 * optional synthetic-key footnote, and one `<details>` block per project in
 * the provided order.
 *
 * Callers that need the truncated sticky-PR-comment variant should pipe the
 * result through `truncate-comment.js` separately.
 *
 * @param {ProjectResult[]} results      Projects sorted into the desired render order.
 * @param {{ fileCap?: number }} [options]
 * @returns {string}
 */
export function renderComment (results, { fileCap } = {}) {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;

  for (const r of results) {
    errors += toCount(r.errorCount);
    warnings += toCount(r.warningCount);
    fixableErrors += toCount(r.fixableErrorCount);
    fixableWarnings += toCount(r.fixableWarningCount);
  }

  // Filter zero-count clauses then join with a comma; the em-dash separator
  // only appears when there is at least one clause. Protects against a
  // dangling comma on warnings-only fleets.
  const clauses = [];
  if (errors > 0) clauses.push(`${errors} errors (${fixableErrors} fixable)`);
  if (warnings > 0) clauses.push(`${warnings} warnings (${fixableWarnings} fixable)`);
  const headline = `**${results.length} project(s) reported issues**` +
    (clauses.length > 0 ? ` — ${clauses.join(', ')}` : '');

  let md = `## External project test results\n\n${headline}\n\n`;

  md += renderFootnote(results);

  const projectBlockOptions = fileCap ? { fileCap } : undefined;

  for (const r of results) {
    md += renderProjectBlock(r, projectBlockOptions);
  }

  return md;
}
