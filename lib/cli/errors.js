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

// Inline copy of @voxpelli/typed-utils `isErrorWithCode` — matches the
// peowly-commands example's local copy. Avoids a runtime dep for three
// lines of logic.
//
// Note: the top-level catch relies on Node's `parseArgs` emitting
// `ERR_PARSE_ARGS_UNKNOWN_OPTION` / `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`
// synchronously. That only happens in parseArgs strict mode, which peowly
// uses unless `returnRemainderArgs: true` is passed. Our commands do not
// pass that flag — if a future command does, it must route unknown-option
// errors some other way (see peowly docs on `remainderArgs`).
/**
 * @param {unknown} value
 * @returns {value is Error & { code: string }}
 */
export const isErrorWithCode = (value) =>
  value instanceof Error && 'code' in value;
