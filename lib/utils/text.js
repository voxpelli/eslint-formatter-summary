// Bidi and zero-width codepoints that can be used for trojan-source style
// attacks or to spoof rendered text. Keep the set explicit so the regex stays
// readable and doesn't trip the linter's obscure-range / invisible-character
// rules.
const CONTROLS = new Set([
  0x200B, 0x200C, 0x200D, 0x200E, 0x200F,
  0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2065,
  0x2066, 0x2067, 0x2068, 0x2069,
  0xFEFF,
]);

/**
 * @param {string} text
 * @returns {string}
 */
function stripControls (text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && !CONTROLS.has(cp)) out += ch;
  }
  return out;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml (text) {
  return stripControls(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

export { escapeHtml, stripControls };
