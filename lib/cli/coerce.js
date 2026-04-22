import { InputError } from './errors.js';

/**
 * Coerce an untrusted numeric field to a safe integer. Used for count fields
 * read from deserialized `ProjectResult` JSON that may have been tampered
 * with — `NaN`, `Infinity`, `null`, and non-numeric values all collapse to 0.
 *
 * @param {unknown} value
 * @returns {number}
 */
export const toCount = (value) => Math.trunc(Number(value)) || 0;

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
