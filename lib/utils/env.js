/**
 * Parse a truthy-ish env-var value.
 *
 * @param {string | undefined} raw
 * @returns {boolean}
 */
export const envTruthy = (raw) => raw === 'true' || raw === '1' || raw === 'yes';

/**
 * Parse a positive-integer env-var value. Invalid values fall back to the
 * default and log a single warning to stderr — we never want a bad env var
 * to crash an ESLint run.
 *
 * @param {string | undefined} raw
 * @param {string} name
 * @returns {number | undefined}
 */
export const envPositiveInt = (raw, name) => {
  if (raw === undefined || raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    process.stderr.write(`eslint-formatter-summary: ${name} must be a positive integer (got "${raw}"); using default\n`);
    return;
  }
  return n;
};
