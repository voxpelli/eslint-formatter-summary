import { renderProjectLabel } from './build-file-anchor.js';

/** @typedef {import('./prepare-project-result.js').ProjectResult} ProjectResult */

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
    // Coerce the count fields to integers defensively — ProjectResult enters
    // this function via JSON.parse of an untrusted artifact, so even though
    // the typedef says `number`, a tampered artifact could land strings here
    // and land them raw in HTML. renderComment already does this coercion
    // for the header counts; mirror the pattern to close the tail-summary gap.
    const errors = Math.trunc(Number(r.errorCount));
    const warnings = Math.trunc(Number(r.warningCount));
    const fixable = Math.trunc(Number(r.fixableErrorCount)) + Math.trunc(Number(r.fixableWarningCount));
    const fixStr = fixable > 0 ? `${fixable} :wrench:` : '-';
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
 *   1. Slice at `sizeCap - HEADROOM` (headroom for tail-summary + trailer).
 *   2. Rewind to the last `\n</details>\n\n` anchor so no `<details>` is
 *      left unclosed mid-render. Project blocks end with this exact sequence;
 *      inline rule-row `<details>` are single-line and do not match.
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
export default function truncateComment (md, results, { sizeCap = DEFAULT_SIZE_CAP } = {}) {
  if (Buffer.byteLength(md, 'utf8') <= sizeCap) return md;

  const slice = md.slice(0, sizeCap - HEADROOM);
  const closeAnchor = '\n</details>\n\n';
  const lastClose = slice.lastIndexOf(closeAnchor);
  const safeEnd = lastClose === -1 ? slice.length : lastClose + closeAnchor.length;
  const keptMd = slice.slice(0, safeEnd);
  const keptCount = (keptMd.match(/\n<\/details>\n\n/g) ?? []).length;
  const tail = results.slice(keptCount);

  const tailMd = renderTailSummary(tail);
  const trailer = '_(file:line detail truncated for tail projects — full report in the workflow step summary)_\n';
  return keptMd + tailMd + trailer;
}
