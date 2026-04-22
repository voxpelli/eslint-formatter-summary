#!/usr/bin/env node

import chalk from 'chalk';
import { PeowlyCommandMissingError, peowlyCommands } from 'peowly-commands';
import { messageWithCauses, stackWithCauses } from 'pony-cause';

import cmdAggregate from '../lib/cli/cmd-aggregate.js';
import cmdPrepare from '../lib/cli/cmd-prepare.js';
import { InputError, isErrorWithCode } from '../lib/cli/errors.js';

/** @type {import('peowly-commands').CliCommands} */
const commands = {
  prepare: cmdPrepare,
  aggregate: cmdAggregate,
};

try {
  await peowlyCommands(commands, {
    argv: process.argv.slice(2),
    name: 'eslint-summary',
    importMeta: import.meta,
  });
} catch (err) {
  if (err instanceof PeowlyCommandMissingError) {
    // showHelp calls process.exit internally — the rest of this catch
    // is skipped via the else branch so control flow doesn't silently
    // fall through to the "unexpected error" path if upstream behavior
    // ever changes.
    err.showHelp(1);
  } else {
    /** @type {string | undefined} */
    let errorTitle;
    /** @type {string} */
    let errorMessage = '';
    /** @type {string | undefined} */
    let errorBody;

    if (err instanceof InputError) {
      errorTitle = 'Invalid input';
      errorMessage = messageWithCauses(err);
      errorBody = err.body;
    } else if (
      isErrorWithCode(err) &&
      (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ||
        err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE')
    ) {
      errorTitle = 'Invalid input';
      errorMessage = err.message;
    } else if (err instanceof Error) {
      // pony-cause walks the full `err.cause` chain (Error.prototype.stack
      // and .message don't). Circular-safe via its internal visited-set.
      errorTitle = 'Unexpected error';
      errorMessage = messageWithCauses(err);
      errorBody = stackWithCauses(err);
    } else {
      errorTitle = 'Unexpected error with no details';
    }

    console.error(`${chalk.white.bgRed(errorTitle + ':')} ${errorMessage}`);
    if (errorBody) {
      console.error('\n' + errorBody);
    }

    process.exit(1);
  }
}
