import extractMessages from './extract-messages.js';
import processMessage from './process-message.js';

/**
 * @param {import('eslint').ESLint.LintResult[]} results  ESLint results
 * @param {{ cwd: string }} options
 * @returns {import('./process-message').MessageSummary[]}
 */
const aggregate = (results, { cwd }) => {
  const messages = extractMessages(results, { cwd });

  /** @type {import('./process-message').MessageSummary[]} */
  let summary = [];

  for (const message of messages) {
    summary = processMessage(summary, message);
  }

  return summary;
};

export default aggregate;
