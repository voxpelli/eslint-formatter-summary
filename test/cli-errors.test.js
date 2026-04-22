import assert from 'node:assert/strict';
import test from 'node:test';

import cmdAggregate from '../lib/cli/cmd-aggregate.js';
import cmdPrepare from '../lib/cli/cmd-prepare.js';
import { parseNumericFlag } from '../lib/cli/coerce.js';
import { InputError, isErrorWithCode } from '../lib/cli/errors.js';

const parentName = 'eslint-summary';

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
    (err) => err instanceof InputError && /--size-cap must be a positive integer/.test(err.message),
  );
});

test('parseNumericFlag: throws InputError for zero', () => {
  assert.throws(
    () => parseNumericFlag('0', '--size-cap'),
    InputError,
  );
});

test('parseNumericFlag: throws InputError for negative', () => {
  assert.throws(
    () => parseNumericFlag('-5', '--size-cap'),
    InputError,
  );
});

test('parseNumericFlag: throws InputError for fractional', () => {
  assert.throws(
    () => parseNumericFlag('1.5', '--file-cap'),
    InputError,
  );
});

test('cmd-aggregate run: rejects with InputError when no positional given', async () => {
  await assert.rejects(
    cmdAggregate.run([], import.meta, { parentName }),
    (err) => err instanceof InputError && /expected exactly one <results-dir>/.test(err.message),
  );
});

test('cmd-aggregate run: rejects with InputError on invalid --sort-by', async () => {
  await assert.rejects(
    cmdAggregate.run(['--sort-by', 'bogus', '/tmp/nope'], import.meta, { parentName }),
    (err) => err instanceof InputError && /--sort-by must be "project" or "severity"/.test(err.message),
  );
});

test('cmd-aggregate run: rejects with InputError when results dir is missing', async () => {
  await assert.rejects(
    cmdAggregate.run(['/definitely/does/not/exist/anywhere'], import.meta, { parentName }),
    (err) => err instanceof InputError && /results directory not found/.test(err.message),
  );
});

test('cmd-prepare run: rejects with InputError when given multiple positionals', async () => {
  await assert.rejects(
    cmdPrepare.run(['a.json', 'b.json'], import.meta, { parentName }),
    (err) => err instanceof InputError && /expected stdin or a single/.test(err.message),
  );
});

test('cmd-prepare run: rejects with InputError when input file cannot be read', async () => {
  await assert.rejects(
    cmdPrepare.run(['/definitely/does/not/exist.json'], import.meta, { parentName }),
    (err) => err instanceof InputError && /could not read/.test(err.message),
  );
});
