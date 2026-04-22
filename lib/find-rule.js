/** @import { MessageSummary } from './process-message.js' */

/**
 * @param {MessageSummary[]} summary
 * @param {string} id
 * @returns {MessageSummary|undefined}
 */
const findRule = (summary, id) =>
  summary.find((rule) => id === rule.id);

export default findRule;
