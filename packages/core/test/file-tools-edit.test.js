import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { editFile } from '../dist/tools/file_tools.js';

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-edit-test-'));
}

test('exact match: single occurrence is replaced', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'const x = 1;\nconst y = 2;\n');
  const result = editFile(root, 'a.txt', 'const x = 1;', 'const x = 42;');
  assert.equal(result.isError, undefined);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'const x = 42;\nconst y = 2;\n');
});

test('exact match: multiple occurrences without allowMultiple is rejected, not partially applied', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'foo();\nfoo();\n');
  const result = editFile(root, 'a.txt', 'foo();', 'bar();');
  assert.equal(result.isError, true);
  // File on disk must be untouched.
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'foo();\nfoo();\n');
});

test('exact match: allowMultiple replaces every occurrence', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'foo();\nfoo();\n');
  const result = editFile(root, 'a.txt', 'foo();', 'bar();', true);
  assert.equal(result.isError, undefined);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'bar();\nbar();\n');
});

test('indentation-flexible strategy: allowMultiple actually rewrites ALL matching blocks, not just the first', () => {
  const root = makeWorkspace();
  // Two structurally-identical blocks at different indentation levels — a
  // classic case where a naive exact-match would fail but the caller wants
  // both sites fixed at once.
  const content = [
    'function a() {',
    '  if (x) {',
    '    doThing();',
    '  }',
    '}',
    '',
    'function b() {',
    '    if (x) {',
    '      doThing();',
    '    }',
    '}',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'b.txt'), content);

  const target = ['if (x) {', '  doThing();', '}'].join('\n');
  const replacement = ['if (x) {', '  doOtherThing();', '}'].join('\n');

  const result = editFile(root, 'b.txt', target, replacement, true);
  assert.equal(result.isError, undefined, result.output);
  const updated = fs.readFileSync(path.join(root, 'b.txt'), 'utf8');
  assert.equal((updated.match(/doOtherThing/g) || []).length, 2, 'both blocks should have been rewritten');
  assert.equal((updated.match(/doThing\(\)/g) || []).length, 0, 'no original block should remain');
});

test('indentation-flexible strategy: ambiguous multi-match without allowMultiple is rejected', () => {
  const root = makeWorkspace();
  const content = ['if (x) {', '  doThing();', '}', '', 'if (x) {', '  doThing();', '}'].join('\n');
  fs.writeFileSync(path.join(root, 'c.txt'), content);
  const target = ['if (x) {', '  doThing();', '}'].join('\n');
  const result = editFile(root, 'c.txt', target, 'REPLACED');
  assert.equal(result.isError, true);
  assert.match(result.output, /allowMultiple/);
});

test('rejects an empty targetContent instead of matching everything', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'd.txt'), 'hello world');
  const result = editFile(root, 'd.txt', '', 'oops');
  assert.equal(result.isError, true);
  assert.match(result.output, /cannot be empty/);
  assert.equal(fs.readFileSync(path.join(root, 'd.txt'), 'utf8'), 'hello world');
});

test('rejects a no-op edit where target equals replacement', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'e.txt'), 'same text here');
  const result = editFile(root, 'e.txt', 'same text here', 'same text here');
  assert.equal(result.isError, true);
  assert.match(result.output, /identical/);
});
