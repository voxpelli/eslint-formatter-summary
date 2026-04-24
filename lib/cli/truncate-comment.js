import { sliceUtf8Bytes } from '../utils/byte-safe-slice.js';
import { renderProjectLabel } from './build-file-anchor.js';
import { toCount } from './coerce.js';

/** @import { ProjectResult } from './prepare-project-result.js' */

const DEFAULT_SIZE_CAP = 60_000;
const HEADROOM = 15_000;

/**
 * Render the compact tail-summary block appended after a truncated comment.
 * One row per overflowing project with just the headline counts, inside a
 * `<details>` wrapper labelled with the truncation count.
 *
 * @param {ProjectResult[]} tail
 * @returns {string}
 */
const renderTailSummary = (tail) => {
  if (tail.length === 0) return '';
  const rows = tail.map((r) => {
    // Coerce count fields defensively via toCount — ProjectResult enters this
    // function via JSON.parse of an untrusted artifact; a tampered blob could
    // land non-numbers that would otherwise render raw in HTML.
    const errors = toCount(r.errorCount);
    const warnings = toCount(r.warningCount);
    const fixable = toCount(r.fixableErrorCount) + toCount(r.fixableWarningCount);
    const fixStr = fixable > 0 ? `${fixable} 🔧` : '-';
    return `| ${renderProjectLabel(r.project)} | ${errors} | ${warnings} | ${fixStr} |`;
  }).join('\n');
  return `<details><summary>Tail projects (${tail.length} truncated — detail omitted)</summary>\n\n` +
    '| Project | Errors | Warnings | Fixable |\n' +
    '|---------|-------:|---------:|--------:|\n' +
    rows + '\n' +
    '\n</details>\n\n';
};

/**
 * Truncate an over-sized fleet comment to fit under a GitHub sticky-PR-comment
 * byte cap (default 60 000 bytes).
 *
 * Algorithm:
 *   1. Slice at `sizeCap - HEADROOM` UTF-8 bytes (not code units — multi-byte
 *      content like CJK or emoji would overshoot a code-unit slice). Walk
 *      back past any UTF-8 continuation bytes so the slice ends on a valid
 *      code-point boundary.
 *   2. Rewind to the last `\n</details>\n\n` anchor so no `<details>` is
 *      left unclosed mid-render. Project blocks end with this exact sequence;
 *      inline rule-row `<details>` are single-line and do not match. The
 *      anchor is pure ASCII so byte-offset and code-unit-offset coincide.
 *   3. Count kept project blocks by counting the anchor in the kept slice.
 *   4. Everything past the kept count becomes the `tail` — rendered as a
 *      compact `Project | Errors | Warnings | Fixable` table.
 *   5. Append a trailer pointing at the step summary for detail.
 *
 * When the full markdown already fits, it is returned unchanged.
 *
 * @param {string} md      Full, uncapped fleet comment markdown.
 * @param {ProjectResult[]} results  Projects in the same order they appear in `md`.
 * @param {{ sizeCap?: number }} [options]
 * @returns {string}
 */
export function truncateComment (md, results, { sizeCap = DEFAULT_SIZE_CAP } = {}) {
  if (Buffer.byteLength(md, 'utf8') <= sizeCap) return md;

  const slice = sliceUtf8Bytes(md, sizeCap - HEADROOM);
  const closeAnchor = '\n</details>\n\n';
  const lastClose = slice.lastIndexOf(closeAnchor);
  // When the slice contains no close anchor (first project block alone
  // exceeds the `sizeCap - HEADROOM` window), emit an empty kept section
  // and roll every project into the tail summary. Falling back to `slice`
  // would leave an unclosed `<details>` whose implicit close would be
  // absorbed by the tail summary's `</details>`, visually nesting the tail
  // inside the partial first-project block.
  const keptMd = lastClose === -1 ? '' : slice.slice(0, lastClose + closeAnchor.length);
  const keptCount = (keptMd.match(/\n<\/details>\n\n/g) ?? []).length;
  const tail = results.slice(keptCount);

  const tailMd = renderTailSummary(tail);
  const trailer = '_(file:line detail truncated for tail projects — full report in the workflow step summary)_\n';
  const assembled = keptMd + tailMd + trailer;
  if (Buffer.byteLength(assembled, 'utf8') <= sizeCap) return assembled;
  // Pathological fleet size: the tail-summary table itself exceeded the
  // HEADROOM budget and pushed the final output past sizeCap. keptMd alone
  // fits under (sizeCap - HEADROOM) so keptMd + a short fallback is safe.
  const fallback = `_(${tail.length} tail projects omitted — too many truncated to summarize; full report in the workflow step summary)_\n`;
  return keptMd + fallback;
}
