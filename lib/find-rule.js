/**
 * @param {import('./process-message.js').MessageSummary[]} summary
 * @param {string} ruleId
 * @returns {import('./process-message.js').MessageSummary|undefined}
 */
const findRule = (summary, ruleId) =>
  summary.find((rule) => ruleId === rule.ruleId);

export default findRule;
