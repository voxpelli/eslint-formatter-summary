import assert from 'node:assert/strict';
import test from 'node:test';

import { cmdAggregate } from '../lib/cli/cmd-aggregate.js';
import { cmdPrepare } from '../lib/cli/cmd-prepare.js';
import { parseNumericFlag } from '../lib/cli/coerce.js';
import { InputError, isErrorWithCode } from '../lib/cli/errors.js';

const parentName = 'eslint-summary';
const meta = /** @type {import('peowly-commands').CliMeta} */ ({ name: parentName });

/**
 * @param {unknown} err
 * @param {RegExp} pattern
 * @returns {boolean}
 */
const isInputErrorMatching = (err, pattern) =>
  err instanceof InputError && pattern.test(err.message);

test('InputError: captures body and cause', () => {
  const cause = new Error('underlying');
  const err = new InputError('bad flag', { body: 'hint: try --help', cause });
  assert.equal(err.name, 'InputError');
  assert.equal(err.message, 'bad flag');
  assert.equal(err.body, 'hint: try --help');
  assert.equal(err.cause, cause);
});

test('isErrorWithCode: true for Error with code', () => {
  const err = Object.assign(new Error('x'), { code: 'ENOENT' });
  assert.equal(isErrorWithCode(err), true);
});

test('isErrorWithCode: false for plain Error', () => {
  assert.equal(isErrorWithCode(new Error('x')), false);
});

test('isErrorWithCode: false for non-Error', () => {
  assert.equal(isErrorWithCode({ code: 'ENOENT' }), false);
  assert.equal(isErrorWithCode('nope'), false);
  // eslint-disable-next-line unicorn/no-null -- testing the null branch
  assert.equal(isErrorWithCode(null), false);
});

test('parseNumericFlag: returns undefined for empty input', () => {
  assert.equal(parseNumericFlag('', '--size-cap'), undefined);
});

test('parseNumericFlag: parses valid positive integer', () => {
  assert.equal(parseNumericFlag('42', '--size-cap'), 42);
});

test('parseNumericFlag: throws InputError for non-numeric', () => {
  assert.throws(
    () => parseNumericFlag('abc', '--size-cap'),
    (err) => err instanceof InputError && /--size-cap must be a positive integer/.test(err.message)
  );
});

test('parseNumericFlag: throws InputError for zero', () => {
  assert.throws(
    () => parseNumericFlag('0', '--size-cap'),
    InputError
  );
});

test('parseNumericFlag: throws InputError for negative', () => {
  assert.throws(
    () => parseNumericFlag('-5', '--size-cap'),
    InputError
  );
});

test('parseNumericFlag: throws InputError for fractional', () => {
  assert.throws(
    () => parseNumericFlag('1.5', '--file-cap'),
    InputError
  );
});

test('cmd-aggregate run: rejects with InputError when no positional given', async () => {
  await assert.rejects(
    async () => { await cmdAggregate.run([], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /expected at least one <results-dir>/)
  );
});

test('cmd-aggregate run: rejects with InputError when given multiple positionals', async () => {
  await assert.rejects(
    async () => { await cmdAggregate.run(['a.json', 'b.json'], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /no more than one <results-dir>/)
  );
});

test('cmd-aggregate run: rejects with InputError on invalid --sort-by', async () => {
  await assert.rejects(
    async () => { await cmdAggregate.run(['--sort-by', 'bogus', '/tmp/nope'], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /--sort-by must be "project" or "severity"/)
  );
});

test('cmd-aggregate run: rejects with InputError when results dir is missing', async () => {
  await assert.rejects(
    async () => { await cmdAggregate.run(['/definitely/does/not/exist/anywhere'], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /results directory not found/)
  );
});

test('cmd-prepare run: rejects with InputError when given multiple positionals', async () => {
  await assert.rejects(
    async () => { await cmdPrepare.run(['a.json', 'b.json'], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /expected stdin or a single/)
  );
});

test('cmd-prepare run: rejects with InputError when input file cannot be read', async () => {
  await assert.rejects(
    async () => { await cmdPrepare.run(['/definitely/does/not/exist.json'], meta, { parentName }); },
    (err) => isInputErrorMatching(err, /could not read/)
  );
});
