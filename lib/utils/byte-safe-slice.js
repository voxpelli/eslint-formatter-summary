/**
 * Byte-safe UTF-8 slice that rewinds past continuation bytes.
 *
 * `str.slice(N)` caps UTF-16 code units, which can re-encode to ~3× UTF-8
 * bytes for multi-byte content (CJK, emoji) and blow any byte budget the
 * caller is trying to respect. `Buffer.subarray` treats a negative `end` as
 * `(buf.length + end)` and would silently yield a wrong slice when the
 * caller's budget is smaller than any fixed headroom — clamp to [0, len].
 *
 * @param {string} str
 * @param {number} maxBytes
 * @returns {string}
 */
export function sliceUtf8Bytes (str, maxBytes) {
  const buf = Buffer.from(str, 'utf8');
  let end = Math.max(0, Math.min(maxBytes, buf.length));
  while (end > 0 && ((buf[end] ?? 0) & 0xC0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8');
}
