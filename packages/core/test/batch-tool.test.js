import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeBatchEdit } from '../dist/tools/batch_tool.js';

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-batch-test-'));
}

test('batch edit action uses the same fuzzy matching editFile uses, not a naive exact match', () => {
  const root = makeWorkspace();
  const content = ['function f() {', '    if (x) {', '      doThing();', '    }', '}'].join('\n');
  fs.writeFileSync(path.join(root, 'a.txt'), content);

  const result = executeBatchEdit(root, [
    {
      filePath: 'a.txt',
      action: 'edit',
      targetContent: ['if (x) {', '  doThing();', '}'].join('\n'),
      replacementContent: ['if (x) {', '  doOtherThing();', '}'].join('\n'),
    },
  ]);

  assert.equal(result.isError, undefined, result.output);
  assert.match(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), /doOtherThing/);
});

test('batch edit rejects an ambiguous multi-match without allowMultiple, and touches nothing', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'foo();\nfoo();\n');
  const result = executeBatchEdit(root, [
    { filePath: 'a.txt', action: 'edit', targetContent: 'foo();', replacementContent: 'bar();' },
  ]);
  assert.equal(result.isError, true);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'foo();\nfoo();\n');
});

test('batch edit respects per-operation allowMultiple', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'foo();\nfoo();\n');
  const result = executeBatchEdit(root, [
    { filePath: 'a.txt', action: 'edit', targetContent: 'foo();', replacementContent: 'bar();', allowMultiple: true },
  ]);
  assert.equal(result.isError, undefined, result.output);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'bar();\nbar();\n');
});

test('a mid-batch write failure rolls back every file already written in this batch', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'ok.txt'), 'original content');
  // 'blocked' is a plain FILE, not a directory. Writing to 'blocked/sub.txt'
  // passes validation (existsSync on the target itself is false) but throws
  // ENOTDIR during the actual write phase — after op #1 has already been
  // written to disk — simulating a real mid-batch I/O failure.
  fs.writeFileSync(path.join(root, 'blocked'), 'i am a file, not a directory');

  const result = executeBatchEdit(root, [
    { filePath: 'ok.txt', action: 'write', content: 'new content' },
    { filePath: 'blocked/sub.txt', action: 'write', content: 'will fail' },
  ]);

  assert.equal(result.isError, true);
  assert.match(result.output, /Rolled back/);
  assert.equal(
    fs.readFileSync(path.join(root, 'ok.txt'), 'utf8'),
    'original content',
    'the first file must be restored to its pre-batch content, not left with the partial change'
  );
});

test('dryRun does not write or roll back anything', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'original');
  const result = executeBatchEdit(root, [{ filePath: 'a.txt', action: 'write', content: 'changed' }], true);
  assert.equal(result.isError, undefined);
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'original');
});
