/** @import { MessageSummary } from './process-message.js' */

/**
 * @param {MessageSummary[]} summary
 * @param {string} id
 * @returns {MessageSummary|undefined}
 */
export function findRule (summary, id) {
  return summary.find((rule) => id === rule.id);
}
