import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ToolRegistry } from '../dist/tools/registry.js';
import { editFile } from '../dist/tools/file_tools.js';

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-approval-test-'));
}

test('approval preview diff is non-empty for an edit that only succeeds via fuzzy indentation matching', () => {
  const root = makeWorkspace();
  // Indented differently than the literal targetContent below, so only the
  // indentation-flexible strategy (not a naive exact string replace) finds it.
  const content = ['function f() {', '    if (x) {', '      doThing();', '    }', '}'].join('\n');
  fs.writeFileSync(path.join(root, 'a.txt'), content);

  const registry = new ToolRegistry(root);
  const args = {
    filePath: 'a.txt',
    targetContent: ['if (x) {', '  doThing();', '}'].join('\n'),
    replacementContent: ['if (x) {', '  doOtherThing();', '}'].join('\n'),
  };

  const approval = registry.createApprovalRequest('call_1', 'edit_file', args);

  // The old naive preview (plain string .replace()) would find no match here and
  // produce an empty/undefined diff, even though the real edit succeeds — that
  // mismatch is exactly the bug being guarded against.
  assert.ok(approval.diff, 'approval preview must show a real diff, not silently show nothing');
  assert.match(approval.diff, /doOtherThing/);

  // And the actual edit must apply the same change the preview promised.
  const result = editFile(root, 'a.txt', args.targetContent, args.replacementContent);
  assert.equal(result.isError, undefined);
  assert.match(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), /doOtherThing/);
});

test('approval preview flags an edit that will actually fail, instead of a silent no-op diff', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'b.txt'), 'nothing matches this');

  const registry = new ToolRegistry(root);
  const approval = registry.createApprovalRequest('call_2', 'edit_file', {
    filePath: 'b.txt',
    targetContent: 'this text is not present',
    replacementContent: 'replacement',
  });

  assert.equal(approval.diff, undefined);
  assert.match(approval.description, /WARNING/);
});
