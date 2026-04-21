import path from 'node:path';

import classifyMessage from '../classify-message.js';
import { toCount } from './coerce.js';

/**
 * Serialized output of `eslint-summary prepare`. Compact shape aggregated from
 * one project's raw ESLint JSON, suitable for multi-project fleet aggregation
 * by `eslint-summary aggregate`.
 *
 * @typedef {object} ProjectResult
 * @property {string} project                       The owner/repo slug or project name (empty string if not supplied).
 * @property {number} errorCount                    Sum of ESLint's per-file errorCount.
 * @property {number} warningCount                  Sum of ESLint's per-file warningCount.
 * @property {number} fixableErrorCount             Sum of ESLint's per-file fixableErrorCount.
 * @property {number} fixableWarningCount           Sum of ESLint's per-file fixableWarningCount.
 * @property {string[]} syntheticKeys               Parenthesized synthetic bucket IDs present in this run.
 * @property {Record<string, RuleBucket>} rules     Per-rule (and per-synthetic-key) aggregation.
 */

/**
 * @typedef {object} RuleBucket
 * @property {number} errors                        Count of severity-2 messages.
 * @property {number} warnings                      Count of severity-1 messages.
 * @property {number} fixable                       Count of messages with a non-null fix.
 * @property {string[]} files                       Entries of the form `"path:line"` or `"path:line\tdetail"` when the classifier captured a per-file rule name (unused-disable / missing-rule).
 */

/** @typedef {import('eslint').Linter.LintMessage} LintMessage */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Aggregate one project's raw `eslint --format json` output into a compact
 * {@link ProjectResult}. Returns `undefined` when the run reported zero errors
 * and zero warnings — matching the sibling tool's "skip empty artifact"
 * convention so downstream aggregation can rely on presence-means-findings.
 *
 * Path handling: ESLint emits absolute paths (resolved via `path.resolve`, not
 * symlink-canonicalized). We use `path.relative(baseDir, filePath)` to strip
 * the project root, then normalize backslashes to forward slashes so Windows
 * relative paths produce valid GitHub `blob/HEAD/...` URLs downstream. The
 * caller is expected to pass a canonicalized `baseDir` (e.g. via
 * `realpathSync.native`) to handle macOS `/tmp` → `/private/tmp`. Paths that
 * escape `baseDir` keep their `../` prefix and trigger a single warning for
 * debuggability.
 *
 * @param {unknown} raw         Parsed JSON output of `eslint --format json`.
 * @param {{ project?: string, baseDir: string, warn?: (msg: string) => void }} options
 * @returns {ProjectResult | undefined}
 */
export default function prepareProjectResult (raw, { baseDir, project = '', warn }) {
  if (!Array.isArray(raw)) return;

  let warnedEscape = false;

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
    const { messages } = file;
    if (!Array.isArray(messages)) continue;

    const filePath = typeof file['filePath'] === 'string' ? file['filePath'] : '';
    /** @type {string} */
    let cleanPath;
    if (filePath === '') {
      cleanPath = '<unexpected path>';
    } else {
      const rel = path.relative(baseDir, filePath).replaceAll('\\', '/');
      if (rel === '') {
        cleanPath = path.basename(filePath);
      } else if (path.isAbsolute(rel) || rel.startsWith('..')) {
        if (!warnedEscape && warn) {
          warn(`filePath outside --cwd (${baseDir}): ${filePath}`);
          warnedEscape = true;
        }
        cleanPath = rel;
      } else {
        cleanPath = rel;
      }
    }

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
