import {
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
 * `fixable`) are intentionally NOT validated — `toCount` coerces them at
 * render time so non-numeric values never reach HTML output.
 *
 * @param {unknown} value
 * @returns {value is ProjectResult}
 */
export default function isValidProjectResult (value) {
  if (!isObject(value)) return false;
  if (!isObjectWithKey(value, 'rules')) return false;
  if (!isObject(value['rules'])) return false;
  if (!isOptionalKeyWithType(value, 'syntheticKeys', 'array')) return false;
  return true;
}
