import classifyMessage from './classify-message.js';
import findRule from './find-rule.js';

/** @import { SyntheticKey } from './classify-message.js' */
/** @import { ExtractedMessage } from './extract-messages.js' */

/**
 * @typedef {object} RuleSummary
 * @property {'rule'} kind
 * @property {string} id
 * @property {number} errors
 * @property {number} warnings
 * @property {number} fixable
 * @property {Set<string>} relativeFilePaths
 */
/**
 * @typedef {object} SyntheticSummary
 * @property {'synthetic'} kind
 * @property {SyntheticKey} id
 * @property {number} errors
 * @property {number} warnings
 * @property {number} fixable
 * @property {Set<string>} relativeFilePaths
 */
/** @typedef {RuleSummary | SyntheticSummary} MessageSummary */

/**
 * @param   {MessageSummary[]} summary
 * @param   {ExtractedMessage} message
 * @returns {MessageSummary[]}
 */
const processMessage = (summary, message) => {
  const classified = classifyMessage(message);
  const { filePathRelative, severity } = message;

  const errors = severity === 2 ? 1 : 0;
  const warnings = severity === 1 ? 1 : 0;
  const fixable = message.fix !== undefined ? 1 : 0;

  const pathEntry = classified.kind === 'synthetic' && classified.detail
    ? `${filePathRelative}\t${classified.detail}`
    : filePathRelative;

  const existing = findRule(summary, classified.id);

  if (!existing) {
    summary.push(/** @type {MessageSummary} */ ({
      kind: classified.kind,
      id: classified.id,
      errors,
      warnings,
      fixable,
      relativeFilePaths: new Set([pathEntry]),
    }));
  } else {
    existing.errors += errors;
    existing.warnings += warnings;
    existing.fixable += fixable;
    existing.relativeFilePaths.add(pathEntry);
  }
  return summary;
};

export default processMessage;
