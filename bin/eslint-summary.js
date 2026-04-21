#!/usr/bin/env node

import { PeowlyCommandMissingError, peowlyCommands } from 'peowly-commands';

import cmdAggregate from '../lib/cli/cmd-aggregate.js';
import cmdPrepare from '../lib/cli/cmd-prepare.js';

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
    err.showHelp(1);
  } else {
    throw err;
  }
}
