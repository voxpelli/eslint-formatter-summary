import findRule from './find-rule.js';

/**
 * @typedef MessageSummary
 * @property {string} ruleId
 * @property {number} errors
 * @property {number} warnings
 * @property {Set<string>} relativeFilePaths
 */

/**
 * @param   {MessageSummary[]} summary
 * @param   {import('./extract-messages.js').ExtractedMessage} message
 * @returns {MessageSummary[]}
 */
const processMessage = (summary, message) => {
  if (typeof message.ruleId === 'undefined') return summary;

  const {
    filePathRelative,
    severity,
  } = message;

  const ruleId = message.ruleId !== null ? message.ruleId : 'syntax error';
  const errors = severity === 2 ? 1 : 0;
  const warnings = severity === 1 ? 1 : 0;
  const rule = findRule(summary, ruleId);

  if (!rule) {
    summary.push({
      ruleId,
      errors,
      warnings,
      relativeFilePaths: new Set([filePathRelative]),
    });
  } else {
    rule.errors += errors;
    rule.warnings += warnings;
    rule.relativeFilePaths.add(filePathRelative);
  }
  return summary;
};

export default processMessage;
