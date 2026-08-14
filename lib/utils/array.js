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
 * Stable multi-key sort with per-prop direction flip for string vs numeric
 * properties. Both `sum` and `lengthOfLongest` have been inlined at their
 * single call sites — `sortBy` earns its keep for the multi-key + string-vs-
 * number semantics that don't compose from built-ins.
 *
 * @template {Record<string, any>} T
 * @param {string[]} props
 * @param {T[]} array
 * @param {boolean} sortReverse
 * @returns {T[]}
 */
export function sortBy (props, array, sortReverse) {
  return array.toSorted((a, b) => checkProp(a, b, props, sortReverse));
}
