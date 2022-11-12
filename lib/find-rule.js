/** @typedef {import('./process-message.js').MessageSummary} MessageSummary */

/**
 * @param {MessageSummary[]} summary
 * @param {string} ruleId
 * @returns {MessageSummary|undefined}
 */
const findRule = (summary, ruleId) =>
  summary.find((rule) => ruleId === rule.ruleId);

export default findRule;
