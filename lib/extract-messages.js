import path from 'node:path';

/** @typedef {import('eslint').Linter.LintMessage & { filePathRelative: string }} ExtractedMessage */

/**
 * @param {Pick<import('eslint').ESLint.LintResult,'messages'|'filePath'>[]} results ESLint results
 * @param {{ cwd: string }} options
 * @returns {ExtractedMessage[]}
 */
export default function extractMessagesFrom (results, { cwd }) {
  /** @type {ExtractedMessage[]} */
  const messages = [];
  for (const result of results) {
    const filePathRelative = path.relative(cwd, result.filePath);

    for (const message of result.messages) {
      messages.push({
        ...message,
        filePathRelative,
      });
    }
  }
  return messages;
}
