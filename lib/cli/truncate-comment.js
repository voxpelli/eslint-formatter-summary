import { renderProjectLabel } from './build-file-anchor.js';
import { toCount } from './coerce.js';

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
export default function truncateComment (md, results, { sizeCap = DEFAULT_SIZE_CAP } = {}) {
  if (Buffer.byteLength(md, 'utf8') <= sizeCap) return md;

  // Byte-safe slice: md.slice(N) caps UTF-16 code units, which can re-encode
  // to ~3× more UTF-8 bytes for multi-byte content and blow the byte cap.
  // Rewind past any UTF-8 continuation bytes (0x80–0xBF) so the slice ends
  // on a complete code point.
  const buf = Buffer.from(md, 'utf8');
  // Clamp to [0, buf.length]: a caller-supplied sizeCap below HEADROOM would
  // otherwise make (sizeCap - HEADROOM) negative, and Buffer.subarray treats
  // a negative end as (buf.length + end) — silently yielding a wrong slice.
  let byteEnd = Math.max(0, Math.min(sizeCap - HEADROOM, buf.length));
  while (byteEnd > 0 && ((buf[byteEnd] ?? 0) & 0xC0) === 0x80) byteEnd--;
  const slice = buf.subarray(0, byteEnd).toString('utf8');
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
