import { sliceUtf8Bytes } from './utils/byte-safe-slice.js';

const DEFAULT_SIZE_CAP = 60_000;
const HEADROOM = 500;

/**
 * Truncate formatter markdown at a complete table-row boundary so the output
 * fits under a sticky-PR-comment byte cap (GitHub's limit is ~65 000 bytes).
 *
 * The formatter's markdown is a single GFM pipe table: a two-line header, then
 * one `| … | … | … | <details>…</details> |` row per rule, optionally followed
 * by a `> **Note:**` synthetic-key footnote. Rows are inline (no literal
 * newlines inside a cell), so the pattern `|\n` appears *only* at row ends —
 * a reliable anchor for mid-stream cuts.
 *
 * Differs from the CLI aggregate truncator (`lib/cli/truncate-comment.js`):
 * that one rewinds to `\n</details>\n\n` project-block boundaries — a shape
 * that only exists in the CLI aggregate output.
 *
 * The returned output never exceeds `sizeCap` bytes. When the trailer itself
 * cannot fit (pathological caps below the trailer length), a minimal
 * `_(truncated)_` marker is emitted; when even that cannot fit, the output is
 * empty. The formatter path must not throw on a bad `EFS_SIZE_CAP` — a
 * misconfigured env var degrades to a short/empty output instead of crashing
 * the lint run.
 *
 * @param {string} md
 * @param {number} totalRows  Total rule rows in the untruncated markdown.
 * @param {{ sizeCap?: number }} [options]
 * @returns {string}
 */
export function truncateFormatterMarkdown (md, totalRows, { sizeCap = DEFAULT_SIZE_CAP } = {}) {
  if (Buffer.byteLength(md, 'utf8') <= sizeCap) return md;

  const slice = sliceUtf8Bytes(md, sizeCap - HEADROOM);

  // `|\n` is pure ASCII so byte-offset and code-unit-offset coincide. Cut to
  // include the closing `|\n` so the last kept row is structurally complete.
  const rowAnchor = '|\n';
  const lastRowEnd = slice.lastIndexOf(rowAnchor);
  const keptMd = lastRowEnd === -1 ? slice : slice.slice(0, lastRowEnd + rowAnchor.length);

  // Count body rows (row lines start with `| ` and aren't the `| --- |` divider).
  const allRowStarts = (keptMd.match(/^\| /gm) ?? []).length;
  // First two are the header row and the `| --- |` divider; rest are rules.
  const keptRows = Math.max(0, allRowStarts - 2);
  const droppedRows = Math.max(0, totalRows - keptRows);

  const trailer = `\n_(${droppedRows} rule rows truncated — payload exceeded ${sizeCap} bytes)_\n`;
  const assembled = keptMd + trailer;
  if (Buffer.byteLength(assembled, 'utf8') <= sizeCap) return assembled;

  // Trailer alone doesn't fit — emit the shortest marker that fits, else
  // nothing. Both branches keep the output within `sizeCap`.
  const minimal = '\n_(truncated)_\n';
  if (Buffer.byteLength(keptMd + minimal, 'utf8') <= sizeCap) return keptMd + minimal;
  return '';
}
