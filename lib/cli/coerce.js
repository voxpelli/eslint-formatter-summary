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
 * Non-finite, non-integer, or non-positive input writes an error to stderr
 * and exits with code 2 — all three downstream consumers (`--size-cap`,
 * `--file-cap`, `--project-count`) treat zero/negative/fractional values as
 * user error.
 *
 * peowly v1.3.3 does not ship a `type: 'number'` flag — planned as a
 * Meow-extension (see UPSTREAM-peowly.md). Delete this helper when peowly
 * grows native number support.
 *
 * @param {string} raw
 * @param {string} flagName
 * @param {string} caller  e.g. `'eslint-summary aggregate'`
 * @returns {number | undefined}
 */
export const parseNumericFlag = (raw, flagName, caller) => {
  if (raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    process.stderr.write(`${caller}: ${flagName} must be a positive integer (got "${raw}")\n`);
    process.exit(2);
  }
  return n;
};
