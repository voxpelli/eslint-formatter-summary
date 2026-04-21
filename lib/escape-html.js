import stripControls from './strip-controls.js';

/**
 * @param {string} text
 * @returns {string}
 */
export default function escapeHtml (text) {
  return stripControls(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}
