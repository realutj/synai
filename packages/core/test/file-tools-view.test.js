import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { viewFile, resolveSafePath, UnsafePathError } from '../dist/tools/file_tools.js';

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-test-'));
}

test('viewFile returns the whole file when it is under the default window', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'small.txt'), 'a\nb\nc');
  const result = viewFile(root, 'small.txt');
  assert.equal(result.isError, undefined);
  assert.match(result.output, /Lines 1-3 of 3/);
  assert.doesNotMatch(result.output, /truncated/);
});

test('viewFile caps to a 2000-line default window on a huge file and says so', () => {
  const root = makeWorkspace();
  const lines = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`);
  fs.writeFileSync(path.join(root, 'big.txt'), lines.join('\n'));
  const result = viewFile(root, 'big.txt');
  assert.match(result.output, /Lines 1-2000 of 5000/);
  assert.match(result.output, /Pass startLine\/endLine to view more/);
});

test('viewFile still honors an explicit range beyond the default window', () => {
  const root = makeWorkspace();
  const lines = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`);
  fs.writeFileSync(path.join(root, 'big.txt'), lines.join('\n'));
  const result = viewFile(root, 'big.txt', 3000, 3005);
  assert.match(result.output, /Lines 3000-3005 of 5000/);
});

test('viewFile truncates an individual very long line', () => {
  const root = makeWorkspace();
  const longLine = 'x'.repeat(5000);
  fs.writeFileSync(path.join(root, 'minified.js'), longLine);
  const result = viewFile(root, 'minified.js');
  assert.match(result.output, /line truncated, 5000 chars total/);
});

test('resolveSafePath blocks path traversal outside the workspace root', () => {
  const root = makeWorkspace();
  assert.throws(() => resolveSafePath(root, '../../etc/passwd'), UnsafePathError);
});
