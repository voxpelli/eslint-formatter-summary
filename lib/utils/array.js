/**
 * @template {string} T
 * @param {T} prop
 * @param {Array<Record<T, number>>} array
 * @returns {number}
 */
function sum (prop, array) {
  return array.reduce((count, obj) => count + obj[prop], 0);
}

/**
 * @template {string} T
 * @param {T} prop
 * @param {Array<Record<T, number|string>>} input
 * @returns {number}
 */
function lengthOfLongest (prop, input) {
  let length = 0;

  for (const obj of input) {
    if (obj[prop] !== undefined) {
      length = Math.max(length, obj[prop].toString().length);
    }
  }

  return length;
}

/**
 * @template {Record<string, any>} T
 * @param {T} a
 * @param {T} b
 * @param {string[]} props
 * @param {boolean} sortReverse
 * @returns {1|-1|0}
 */
const checkProp = (a, b, [prop, ...props], sortReverse) => {
  if (!prop) return 0;

  // Default sorting for strings should be opposite that of numbers
  if (typeof a[prop] !== 'number') {
    sortReverse = !sortReverse;
  }

  if (a[prop] < b[prop]) {
    return sortReverse ? -1 : 1;
  }
  if (a[prop] > b[prop]) {
    return sortReverse ? 1 : -1;
  }

  return checkProp(a, b, props, sortReverse);
};

/**
 * @template {Record<string, any>} T
 * @param {string[]} props
 * @param {T[]} array
 * @param {boolean} sortReverse
 * @returns {T[]}
 */
function sortBy (props, array, sortReverse) {
  return array.toSorted((a, b) => checkProp(a, b, props, sortReverse));
}

export { lengthOfLongest, sortBy, sum };
