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
 * `fixable`) are optional-but-number-when-present: a tampered non-numeric
 * count (e.g. `"garbage"`) is rejected and surfaced as a warned skip instead
 * of silently rendering 0 via `toCount`; an absent count still renders 0.
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
    if (!isOptionalKeyWithType(value, key, 'number')) return false;
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

  return Object.values(value['rules']).every(
    (bucket) => isObject(bucket) &&
      isKeyWithType(bucket, 'files', 'array') &&
      bucket['files'].every((f) => typeof f === 'string') &&
      isOptionalKeyWithType(bucket, 'errors', 'number') &&
      isOptionalKeyWithType(bucket, 'warnings', 'number') &&
      isOptionalKeyWithType(bucket, 'fixable', 'number')
  );
}
