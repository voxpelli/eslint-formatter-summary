import path from 'node:path';

import {
  getValueOfKeyWithType,
  isKeyWithType,
  isKeyWithValue,
  typesafeIsArray,
} from '@voxpelli/typed-utils';

import { classifyMessage } from '../classify-message.js';
import { toCount } from './coerce.js';

/** @import { ESLint, Linter } from 'eslint' */

/** @typedef {Omit<ESLint.LintResult, 'fatalErrorCount' | 'suppressedMessages' | 'usedDeprecatedRules'>} LintResultLite */

/**
 * Single file:line entry from a rule's occurrence list.
 * Format: `"path:line"` or `"path:line\tdetail"` where detail is the
 * per-file synthetic rule name (unused-disable / missing-rule).
 *
 * @typedef {string} ProjectResultFileEntry
 */

/**
 * @typedef RuleBucket
 * @property {number} errors                        Count of severity-2 messages.
 * @property {number} warnings                      Count of severity-1 messages.
 * @property {number} fixable                       Count of messages with a non-null fix.
 * @property {ProjectResultFileEntry[]} files      Entries of the form `"path:line"` or `"path:line\tdetail"` when the classifier captured a per-file rule name (unused-disable / missing-rule).
 */

/**
 * Serialized output of `eslint-summary prepare`. Compact shape aggregated from
 * one project's raw ESLint JSON, suitable for multi-project fleet aggregation
 * by `eslint-summary aggregate`.
 *
 * @typedef ProjectResult
 * @property {string} project                       The owner/repo slug or project name (empty string if not supplied).
 * @property {number} errorCount                    Sum of ESLint's per-file errorCount.
 * @property {number} warningCount                  Sum of ESLint's per-file warningCount.
 * @property {number} fixableErrorCount             Sum of ESLint's per-file fixableErrorCount.
 * @property {number} fixableWarningCount           Sum of ESLint's per-file fixableWarningCount.
 * @property {string[]} syntheticKeys               Parenthesized synthetic bucket IDs present in this run.
 * @property {Record<string, RuleBucket>} rules     Per-rule (and per-synthetic-key) aggregation.
 */

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
 * @param {{ project?: string, baseDir: string }} options
 * @returns {ProjectResult | undefined}
 */
export function prepareProjectResult (raw, { baseDir, project = '' }) {
  if (!typesafeIsArray(raw)) return;

  // Null-prototype map so a tampered rule id of `__proto__` (permitted by
  // classify-message's RULE_ID_SHAPE — `\w` matches `_`) cannot reach the
  // legacy prototype accessor and pollute Object.prototype process-wide.
  /** @type {Record<string, RuleBucket>} */
  const rules = Object.create(null);

  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;

  for (const rawFile of raw) {
    if (
      !isKeyWithType(rawFile, 'filePath', 'string') ||
      !isKeyWithType(rawFile, 'errorCount', 'number') ||
      !isKeyWithType(rawFile, 'warningCount', 'number') ||
      !isKeyWithType(rawFile, 'fixableErrorCount', 'number') ||
      !isKeyWithType(rawFile, 'fixableWarningCount', 'number')
    ) {
      continue;
    }

    const file = /** @satisfies {Omit<LintResultLite, 'messages'>} */ (rawFile);

    const cleanPath = path.relative(baseDir, file.filePath).replaceAll('\\', '/');
    const messages = getValueOfKeyWithType(rawFile, 'messages', 'array');

    errorCount += toCount(file.errorCount);
    warningCount += toCount(file.warningCount);
    fixableErrorCount += toCount(file.fixableErrorCount);
    fixableWarningCount += toCount(file.fixableWarningCount);

    for (const rawMsg of messages || []) {
      const result = prepareLintMessage(rawMsg);

      if (!result) continue;

      const { key, ...rest } = result;

      const ruleBucket = rules[key] = rules[key] || { errors: 0, warnings: 0, fixable: 0, files: [] };

      ruleBucket.errors += rest.errors;
      ruleBucket.warnings += rest.warnings;
      ruleBucket.fixable += rest.fixable;
      ruleBucket.files.push(cleanPath + ':' + rest.file);
    }
  }

  return errorCount === 0 && warningCount === 0
    ? undefined
    : {
        project,
        errorCount,
        warningCount,
        fixableErrorCount,
        fixableWarningCount,
        syntheticKeys: Object.keys(rules).filter(key => key.startsWith('(')),
        rules,
      };
}

/**
 * @param {unknown} rawMsg
 * @returns {({ key: string, file: string } & Omit<RuleBucket, 'files'>) | undefined}
 */
function prepareLintMessage (rawMsg) {
  if (
    !isKeyWithType(rawMsg, 'ruleId', ['string', 'null']) ||
    !isKeyWithType(rawMsg, 'message', 'string') ||
    !isKeyWithType(rawMsg, 'column', 'number') ||
    !isKeyWithType(rawMsg, 'line', 'number')
  ) {
    return;
  }

  if (
    !isKeyWithValue(rawMsg, 'severity', /** @type {const} */ (1)) &&
    !isKeyWithValue(rawMsg, 'severity', /** @type {const} */ (2))
  ) {
    return;
  }

  const msg = /** @satisfies {Linter.LintMessage} */ ({
    ...rawMsg,
    fatal: getValueOfKeyWithType(rawMsg, 'fatal', 'boolean') || undefined,
  });

  const { id: key, ...classified } = classifyMessage({
    fatal: msg.fatal,
    // eslint-disable-next-line unicorn/no-null -- ESLint types ruleId as string | null
    ruleId: msg.ruleId ?? null,
    message: msg.message ?? '',
  });

  const file = (
    // cleanPath + ':' +
    msg.line +
    (classified.kind === 'synthetic' && classified.detail ? '\t' + classified.detail : '')
  );

  return {
    key,
    file,
    fixable: isKeyWithType(msg, 'fix', 'object') ? 1 : 0,
    errors: msg.severity === 2 ? 1 : 0,
    warnings: msg.severity === 1 ? 1 : 0,
  };
}
