import {
  isKeyWithType,
  isObject,
  isObjectWithKey,
  isOptionalKeyWithType,
} from '@voxpelli/typed-utils';

/** @import { ProjectResult } from './prepare-project-result.js' */

/**
 * Narrow an arbitrary JSON value to a {@link ProjectResult} shape suitable for
 * aggregation. Called before downstream code that does
 * `Object.entries(result.rules)` (throws on null/non-object) and treats
 * `syntheticKeys` as an array.
 *
 * Count fields (`errorCount`, `fixable*`, per-rule `errors`/`warnings`/
 * `fixable`) are required non-negative finite integers: a tampered non-numeric
 * or negative count (e.g. `"garbage"` or `-1`) is rejected and surfaced as a
 * warned skip instead of silently rendering 0 via `toCount`.
 *
 * An artifact with all-zero counts and an empty `rules` object is rejected —
 * `prepareProjectResult` returns `undefined` (no artifact) on zero findings,
 * so a zero-count artifact with no rules is either tampered or from a
 * third-party tool that doesn't follow the presence-means-findings contract.
 *
 * Rule buckets are checked for the fields that reach unguarded downstream
 * access: `rules[k].files` is iterated with `.slice(...).map(...)` in
 * `render-project-block.js` (no defensive coerce at the call site), and
 * `result.project` is fed into `stripControls`' `for...of` loop via
 * `renderProjectLabel`.
 *
 * @param {unknown} value
 * @returns {value is ProjectResult}
 */
export function isValidProjectResult (value) {
  if (!isObject(value)) return false;
  if (!isKeyWithType(value, 'project', 'string')) return false;
  if (!isOptionalKeyWithType(value, 'eslintVersion', 'string')) return false;
  for (const key of ['errorCount', 'warningCount', 'fixableErrorCount', 'fixableWarningCount']) {
    if (!isKeyWithType(value, key, 'number')) return false;
    const n = /** @type {number} */ (value[key]);
    // Non-negative finite integer — rejects NaN, Infinity, negatives, floats.
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return false;
  }
  if (!isObjectWithKey(value, 'rules')) return false;
  if (!isObject(value['rules'])) return false;
  if (!isOptionalKeyWithType(value, 'syntheticKeys', 'array')) return false;
  // Members must be strings — a non-string `files` entry would crash
  // renderFileSpan (`entry.indexOf` on a number), and a non-string
  // `syntheticKeys` member would be silently dropped by the footnote's
  // `hasOwn`/Set lookups instead of surfacing as a shape error.
  if (value['syntheticKeys'] !== undefined && !value['syntheticKeys'].every((k) => typeof k === 'string')) {
    return false;
  }

  // Reject zero-count artifacts with no rule findings — prepareProjectResult
  // returns undefined on zero findings, so this shape is either tampered or
  // from a non-conforming third-party tool.
  const v = /** @type {Record<string, unknown>} */ (value);
  if (v['errorCount'] === 0 && v['warningCount'] === 0 && Object.keys(value['rules']).length === 0) {
    return false;
  }

  return Object.values(value['rules']).every(
    (bucket) => isObject(bucket) &&
      isKeyWithType(bucket, 'files', 'array') &&
      bucket['files'].every((f) => typeof f === 'string') &&
      isOptionalKeyWithType(bucket, 'errors', 'number') &&
      isOptionalKeyWithType(bucket, 'warnings', 'number') &&
      isOptionalKeyWithType(bucket, 'fixable', 'number')
  );
}
