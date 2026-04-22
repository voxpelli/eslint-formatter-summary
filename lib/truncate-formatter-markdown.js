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
 * @param {string} md
 * @param {number} totalRows  Total rule rows in the untruncated markdown.
 * @param {{ sizeCap?: number }} [options]
 * @returns {string}
 */
export default function truncateFormatterMarkdown (md, totalRows, { sizeCap = DEFAULT_SIZE_CAP } = {}) {
  if (Buffer.byteLength(md, 'utf8') <= sizeCap) return md;

  // Byte-safe slice: md.slice(N) caps UTF-16 code units, which can re-encode
  // to ~3× more UTF-8 bytes for multi-byte content and blow the byte cap.
  const buf = Buffer.from(md, 'utf8');
  // Clamp to [0, buf.length] — a sizeCap below HEADROOM would otherwise make
  // (sizeCap - HEADROOM) negative, which Buffer.subarray interprets as
  // (buf.length + end) and silently yields a wrong slice.
  let byteEnd = Math.max(0, Math.min(sizeCap - HEADROOM, buf.length));
  while (byteEnd > 0 && ((buf[byteEnd] ?? 0) & 0xC0) === 0x80) byteEnd--;
  const slice = buf.subarray(0, byteEnd).toString('utf8');

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
  return keptMd + trailer;
}
