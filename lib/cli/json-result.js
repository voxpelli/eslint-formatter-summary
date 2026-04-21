/**
 * Serialized output of the `eslint-summary prepare` subcommand. Compact shape
 * aggregated from one project's raw ESLint JSON, suitable for multi-project
 * fleet aggregation by `eslint-summary aggregate`.
 *
 * @typedef {object} ProjectResult
 * @property {string} project                         The owner/repo slug or project name (empty string if not supplied).
 * @property {number} errorCount                      Sum of ESLint's per-file errorCount.
 * @property {number} warningCount                    Sum of ESLint's per-file warningCount.
 * @property {number} fixableErrorCount               Sum of ESLint's per-file fixableErrorCount.
 * @property {number} fixableWarningCount             Sum of ESLint's per-file fixableWarningCount.
 * @property {string[]} syntheticKeys                 Parenthesized synthetic bucket IDs that appeared in this run (subset of classify-message's SyntheticKey union).
 * @property {Record<string, RuleBucket>} rules       Per-rule (and per-synthetic-key) aggregation.
 */

/**
 * @typedef {object} RuleBucket
 * @property {number} errors                          Count of severity-2 messages.
 * @property {number} warnings                        Count of severity-1 messages.
 * @property {number} fixable                         Count of messages with a non-null fix.
 * @property {string[]} files                         Entries of the form `"path:line"` or `"path:line\tdetail"` when the classifier captured a per-file rule name (unused-disable / missing-rule).
 */

export {};
