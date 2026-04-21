import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidSlug, renderFileSpan, renderProjectLabel } from '../lib/cli/build-file-anchor.js';

test('isValidSlug accepts owner/repo shapes', () => {
  assert.equal(isValidSlug('voxpelli/ref-calc'), true);
  assert.equal(isValidSlug('foo_bar/baz.quux'), true);
  assert.equal(isValidSlug('a/b'), true);
});

test('isValidSlug rejects anything with a space, <, or missing slash', () => {
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug('nofoo'), false);
  assert.equal(isValidSlug('has space/foo'), false);
  assert.equal(isValidSlug('foo/<script>'), false);
  assert.equal(isValidSlug('a/b/c'), false);
});

test('renderProjectLabel wraps valid slug in an anchor + code', () => {
  const out = renderProjectLabel('voxpelli/ref-calc');
  assert.match(out, /^<a href="https:\/\/github\.com\/voxpelli\/ref-calc"><code>voxpelli\/ref-calc<\/code><\/a>$/);
});

test('renderProjectLabel HTML-escapes an invalid slug', () => {
  const out = renderProjectLabel('not<script>a/slug');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
  assert.ok(!out.includes('<a href='));
});

test('renderProjectLabel scrubs secret-shaped tokens from the slug', () => {
  const token = 'npm_' + 'A'.repeat(40);
  const out = renderProjectLabel(`owner/${token}`);
  assert.ok(!out.includes(token), 'raw token must not survive into rendered slug');
  assert.ok(out.includes('[REDACTED]'));
});

test('renderFileSpan produces a blob/HEAD anchor for valid slug + path:line', () => {
  const out = renderFileSpan('src/foo.js:42', 'owner/repo');
  assert.match(out, /href="https:\/\/github\.com\/owner\/repo\/blob\/HEAD\/src\/foo\.js#L42"/);
  assert.ok(out.includes('<code>src/foo.js:42</code>'));
});

test('renderFileSpan URL-encodes each path segment individually', () => {
  const out = renderFileSpan('src/has space.js:1', 'owner/repo');
  assert.match(out, /blob\/HEAD\/src\/has%20space\.js/);
});

test('renderFileSpan falls back to plain code when slug is invalid', () => {
  const out = renderFileSpan('src/foo.js:42', 'not-a-slug');
  assert.ok(!out.includes('<a href'));
  assert.equal(out, '<code>src/foo.js:42</code>');
});

test('renderFileSpan renders detail as <sub> suffix', () => {
  const out = renderFileSpan('src/foo.js:1\tno-console', 'owner/repo');
  assert.match(out, /<sub>no-console<\/sub>$/);
});

test('renderFileSpan handles malformed entries (no :line) without breaking', () => {
  const out = renderFileSpan('src/foo.js', 'owner/repo');
  assert.equal(out, '<code>src/foo.js</code>');
});

test('renderFileSpan escapes HTML in path', () => {
  const out = renderFileSpan('src/weird<x.js:1', 'owner/repo');
  assert.ok(!out.includes('<x.js'), 'raw <x.js leaked');
  assert.ok(out.includes('&lt;x.js'));
});
