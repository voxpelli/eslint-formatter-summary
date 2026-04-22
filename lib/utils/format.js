/**
 * @param {number} num
 * @param {number} len
 * @returns {string}
 */
function pad (num, len) {
  return num.toString().padStart(len);
}

export { pad };
