/**
 * @template {string} T
 * @param {T} prop
 * @param {Array<Record<T, number|string>>} input
 * @returns {number}
 */
export default function lengthOfLongest (prop, input) {
  let length = 0;

  for (const obj of input) {
    if (obj[prop] !== undefined) {
      length = Math.max(length, obj[prop].toString().length);
    }
  }

  return length;
}
