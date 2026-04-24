import { InputError } from './errors.js';

/**
 * Coerce an untrusted numeric field to a safe integer. Used for count fields
 * read from deserialized `ProjectResult` JSON that may have been tampered
 * with — `NaN`, `Infinity`, `null`, and non-numeric values all collapse to 0.
 *
 * Residual gap: legitimate finite numbers pass through verbatim, so a tampered
 * `"errorCount": 1e308` renders in scientific notation in the PR headline
 * ("1.79e+308 errors"). Accepted as a cosmetic edge case — the security/
 * correctness concerns are `Infinity` and `NaN`, which are both killed here.
 *
 * @param {unknown} value
 * @returns {number}
 */
export const toCount = (value) => {
  const n = Math.trunc(Number(value));
  // `Math.trunc(Infinity) === Infinity` and `Infinity || 0 === Infinity`, so
  // the old one-liner would leak `Infinity errors` into the PR headline for
  // a tampered `"errorCount": "Infinity"`. Gate on finite, clamp negatives.
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new InputError(`${flagName} must be a positive integer (got "${raw}")`);
  }
  return n;
};
