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
 * @param {string[]} props
 * @param {Array<Record<string, any>>} array
 * @param {boolean} sortReverse
 * @returns {void}
 */
const sortBy = (props, array, sortReverse) => {
  array.sort((a, b) => checkProp(a, b, props, sortReverse));
};

export default sortBy;
