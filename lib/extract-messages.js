import path from 'node:path';

/** @import { ESLint, Linter } from 'eslint' */

/** @typedef {Linter.LintMessage & { filePathRelative: string }} ExtractedMessage */

/**
 * @param {Pick<ESLint.LintResult,'messages'|'filePath'>[]} results ESLint results
 * @param {{ cwd: string }} options
 * @returns {ExtractedMessage[]}
 */
export function extractMessagesFrom (results, { cwd }) {
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
