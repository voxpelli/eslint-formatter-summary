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
const sortBy = (props, array, sortReverse) =>
  array.toSorted((a, b) => checkProp(a, b, props, sortReverse));

export default sortBy;
