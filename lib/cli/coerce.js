import { InputError } from './errors.js';

/**
 * Coerce an untrusted numeric field to a safe integer. Used for count fields
 * read from deserialized `ProjectResult` JSON that may have been tampered
 * with — only `number` and numeric `string` inputs are accepted; booleans
 * (`Number(true) === 1`), arrays (`Number([5]) === 5`), `NaN`, `Infinity`,
 * `null`, and other non-numeric values all collapse to 0.
 *
 * Count fields are safe-integer-clamped: finite values outside the safe
 * integer range (e.g. `1e308`, `Number.MAX_VALUE`) collapse to 0 to
 * prevent scientific-notation rendering in the PR headline. Infinity, NaN,
 * booleans, arrays, and non-numeric types are all rejected.
 *
 * @param {unknown} value
 * @returns {number}
 */
export const toCount = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const n = Math.trunc(Number(value));
  // `Math.trunc(Infinity) === Infinity` and `Infinity || 0 === Infinity`, so
  // the old one-liner would leak `Infinity errors` into the PR headline for
  // a tampered `"errorCount": "Infinity"`. Gate on finite AND safe-integer
  // (rejects 1e308 etc.), clamp negatives.
  return Number.isFinite(n) && Number.isSafeInteger(n) ? Math.max(0, n) : 0;
};

/**
 * Parse a positive-integer CLI flag declared as `type: 'string'`. Empty input
 * returns undefined so callers can distinguish "flag unset" from "flag set".
 * Non-finite, non-integer, or non-positive input throws an {@link InputError}
 * — all three downstream consumers (`--size-cap`, `--file-cap`,
 * `--project-count`) treat zero/negative/fractional values as user error.
 *
 * peowly v1.3.3 does not ship a `type: 'number'` flag — planned as a
 * Meow-extension (see UPSTREAM-peowly.md). Delete this helper when peowly
 * grows native number support.
 *
 * @param {string} raw
 * @param {string} flagName
 * @returns {number | undefined}
 */
export const parseNumericFlag = (raw, flagName) => {
  if (raw === '') return;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new InputError(`${flagName} must be a positive integer (got "${raw}")`);
  }
  return n;
};
