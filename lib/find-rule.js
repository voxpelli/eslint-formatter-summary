/** @typedef {import('./process-message.js').MessageSummary} MessageSummary */

/**
 * @param {MessageSummary[]} summary
 * @param {string} id
 * @returns {MessageSummary|undefined}
 */
const findRule = (summary, id) =>
  summary.find((rule) => id === rule.id);

export default findRule;
