import { sanitizeUntrusted } from '../sanitize-untrusted.js';
import { escapeHtml } from '../utils/text.js';
import { renderFileSpan, renderProjectLabel } from './build-file-anchor.js';
import { toCount } from './coerce.js';

/** @import { ProjectResult, RuleBucket } from './prepare-project-result.js' */

const DEFAULT_FILE_CAP = 50;

/**
 * Render one project as a `<details>`-wrapped block: a summary line with
 * headline counts and a GFM pipe-table of per-rule rows. Each rule row nests
 * another `<details>` inside the Rule cell containing a `<br>`-joined list of
 * clickable file:line spans (clickable when the project slug validates).
 *
 * Per-rule file lists are capped at `fileCap` entries (default 50) with an
 * `… and N more` trailer, matching the canary tool's convention.
 *
 * @param {ProjectResult} result
 * @param {{ fileCap?: number }} [options]
 * @returns {string}
 */
export function renderProjectBlock (result, { fileCap = DEFAULT_FILE_CAP } = {}) {
  const slug = result.project;
  const label = renderProjectLabel(slug);
  // Coerce count fields defensively via toCount — ProjectResult enters this
  // function via JSON.parse of an untrusted artifact; a tampered blob could
  // land non-numbers that would otherwise render raw in HTML.
  const errorCount = toCount(result.errorCount);
  const warningCount = toCount(result.warningCount);
  const fixable = toCount(result.fixableErrorCount) + toCount(result.fixableWarningCount);
  const fixStr = fixable > 0 ? ` (${fixable} fixable 🔧)` : '';

  /** @type {Array<RuleBucket & { id: string }>} */
  const ruleEntries = Object.entries(result.rules)
    .map(([id, bucket]) => ({ id, ...bucket }))
    .toSorted((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.id.localeCompare(b.id));

  const rows = ruleEntries.map((rule) => {
    const shown = rule.files.slice(0, fileCap);
    const overflow = rule.files.length - shown.length;
    const fileBlock = shown.map((f) => renderFileSpan(f, slug)).join('<br>') +
      (overflow > 0 ? `<br><em>… and ${overflow} more</em>` : '');
    const ruleErrors = toCount(rule.errors);
    const ruleWarnings = toCount(rule.warnings);
    const ruleFixable = toCount(rule.fixable);
    const fixCol = ruleFixable > 0 ? `${ruleFixable} 🔧` : '-';
    return `| ${ruleErrors} | ${ruleWarnings} | ${fixCol} | <details><summary><code>${escapeHtml(sanitizeUntrusted(rule.id))}</code></summary>${fileBlock}</details> |`;
  }).join('\n');

  return `<details>\n<summary>${label} — ${errorCount} errors, ${warningCount} warnings${fixStr}</summary>\n\n` +
    '| Errors | Warnings | Fixable | Rule |\n' +
    '|-------:|---------:|--------:|------|\n' +
    rows + '\n' +
    '\n</details>\n\n';
}
