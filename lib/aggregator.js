import extractMessages from './extract-messages.js';
import processMessage from './process-message.js';

/** @import { ESLint } from 'eslint' */
/** @import { MessageSummary } from './process-message.js' */

/**
 * @param {ESLint.LintResult[]} results  ESLint results
 * @param {{ cwd: string }} options
 * @returns {MessageSummary[]}
 */
const aggregate = (results, { cwd }) => {
  const messages = extractMessages(results, { cwd });

  /** @type {MessageSummary[]} */
  let summary = [];

  for (const message of messages) {
    summary = processMessage(summary, message);
  }

  return summary;
};

export default aggregate;
