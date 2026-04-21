import renderFootnote from './render-footnote.js';
import renderProjectBlock from './render-project-block.js';

/** @typedef {import('./prepare-project-result.js').ProjectResult} ProjectResult */

/**
 * Render the "all N external projects pass" body used on clean runs.
 *
 * @param {number|undefined} projectCount
 * @returns {string}
 */
export const renderAllPass = (projectCount) => {
  const n = typeof projectCount === 'number' && projectCount > 0
    ? String(projectCount)
    : '?';
  return `## External project test results\n\n:white_check_mark: All ${n} external projects pass\n`;
};

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
export default function renderComment (results, { fileCap } = {}) {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const r of results) {
    errors += Math.trunc(Number(r.errorCount));
    warnings += Math.trunc(Number(r.warningCount));
    fixableErrors += Math.trunc(Number(r.fixableErrorCount));
    fixableWarnings += Math.trunc(Number(r.fixableWarningCount));
  }

  let md = '## External project test results\n\n';
  md += `**${results.length} project(s) reported issues**`;
  if (errors > 0) md += ` &mdash; ${errors} errors (${fixableErrors} fixable)`;
  if (warnings > 0) md += `, ${warnings} warnings (${fixableWarnings} fixable)`;
  md += '\n\n';

  md += renderFootnote(results);

  const options = fileCap === undefined ? undefined : { fileCap };
  for (const r of results) {
    md += renderProjectBlock(r, options);
  }
  return md;
}
