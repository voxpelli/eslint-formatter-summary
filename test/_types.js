/**
 * Type-only re-exports for tests. Import from here instead of reaching into
 * `lib/` internals so that tests track a single canonical import path even
 * if the source-of-truth module moves within `lib/`.
 *
 * @typedef {import('../lib/cli/prepare-project-result.js').ProjectResult} ProjectResult
 * @typedef {import('../lib/cli/prepare-project-result.js').RuleBucket} RuleBucket
 */

// Sentinel value export so this module satisfies ESLint's "no empty module"
// rule and TypeScript's `--isolatedModules` — tests importing from here only
// care about the typedefs above, but need something concrete to import.
export const TYPES_ONLY = true;
