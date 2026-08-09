// Re-export @voxpelli/typed-utils `isErrorWithCode` so callers can keep one
// local CLI import path for input-related helpers.
export { isErrorWithCode } from '@voxpelli/typed-utils';

/**
 * Thrown by command handlers to signal invalid user input (bad flags,
 * missing positionals, unreadable files, malformed JSON). The top-level
 * catch in `bin/eslint-summary.js` renders these as
 * `Invalid input: <message>` (with optional `body` as a secondary line)
 * and exits 1.
 */
export class InputError extends Error {
  /** @override */
  name = 'InputError';

  /**
   * @param {string} message
   * @param {{ body?: string, cause?: unknown }} [options]
   */
  constructor (message, options) {
    super(message, options);
    /** @type {string | undefined} */
    this.body = options?.body;
  }
}

/**
 * Thrown by `readResultsDirectory` when a non-empty candidate set yields
 * zero valid results — a 100% skip rate signals a misconfigured CI
 * invocation (wrong artifact layout, truncated JSON, oversize blobs), not a
 * clean run. `cmdAggregate` converts it to an {@link InputError} so the CLI
 * exits non-zero without emitting the "all N pass" banner.
 */
export class AllSkippedError extends Error {
  /** @override */
  name = 'AllSkippedError';
}
