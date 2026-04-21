import path from 'node:path';

import classifyMessage from '../classify-message.js';

/** @typedef {import('./json-result.js').ProjectResult} ProjectResult */
/** @typedef {import('./json-result.js').RuleBucket} RuleBucket */
/** @typedef {import('eslint').ESLint.LintResult} LintResult */
/** @typedef {import('eslint').Linter.LintMessage} LintMessage */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {number}
 */
const toCount = (value) => Math.trunc(Number(value)) || 0;

/**
 * Aggregate one project's raw `eslint --format json` output into a compact
 * {@link ProjectResult}. Returns `undefined` when the run reported zero errors
 * and zero warnings — matching the sibling tool's "skip empty artifact"
 * convention so downstream aggregation can rely on presence-means-findings.
 *
 * Path handling: file paths in the raw output are absolute; we strip `cwd`
 * to produce project-relative entries. Paths that do not start with `cwd`
 * fall through as `<unexpected path>` (matches sibling behavior).
 *
 * @param {unknown} raw         Parsed JSON output of `eslint --format json`.
 * @param {{ project?: string, cwd: string }} options
 * @returns {ProjectResult | undefined}
 */
export default function prepareProjectResult (raw, { cwd, project = '' }) {
  if (!Array.isArray(raw)) return;

  const prefix = cwd.endsWith(path.sep) ? cwd : cwd + path.sep;

  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;
  /** @type {Record<string, RuleBucket>} */
  const rules = {};
  /** @type {string[]} */
  const syntheticKeys = [];

  for (const file of /** @type {unknown[]} */ (raw)) {
    if (!isPlainObject(file)) continue;
    errorCount += toCount(file['errorCount']);
    warningCount += toCount(file['warningCount']);
    fixableErrorCount += toCount(file['fixableErrorCount']);
    fixableWarningCount += toCount(file['fixableWarningCount']);
    const messages = file['messages'];
    if (!Array.isArray(messages)) continue;

    const filePath = typeof file['filePath'] === 'string' ? file['filePath'] : '';
    const cleanPath = filePath.startsWith(prefix)
      ? filePath.slice(prefix.length)
      : '<unexpected path>';

    for (const rawMsg of /** @type {unknown[]} */ (messages)) {
      if (!isPlainObject(rawMsg)) continue;
      const msg = /** @type {Partial<LintMessage>} */ (rawMsg);

      const classified = classifyMessage({
        fatal: msg.fatal,
        ruleId: msg.ruleId ?? null, // eslint-disable-line unicorn/no-null -- ESLint types ruleId as string | null
        message: msg.message ?? '',
      });
      const key = classified.id;

      if (key.startsWith('(') && !syntheticKeys.includes(key)) {
        syntheticKeys.push(key);
      }

      let bucket = rules[key];
      if (!bucket) {
        bucket = { errors: 0, warnings: 0, fixable: 0, files: [] };
        rules[key] = bucket;
      }
      if (msg.severity === 2) bucket.errors++;
      else bucket.warnings++;
      if (msg.fix) bucket.fixable++;

      const detail = classified.kind === 'synthetic' && classified.detail
        ? '\t' + classified.detail
        : '';
      const line = typeof msg.line === 'number' ? String(msg.line) : '?';
      bucket.files.push(cleanPath + ':' + line + detail);
    }
  }

  if (errorCount === 0 && warningCount === 0) return;

  return {
    project,
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
    syntheticKeys,
    rules,
  };
}
