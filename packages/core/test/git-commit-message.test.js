import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from '../dist/tools/command_tool.js';
import { gitCommit } from '../dist/tools/git_tool.js';

async function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synai-git-test-'));
  await runCommand(root, 'git init');
  await runCommand(root, 'git config user.email test@synai.local');
  await runCommand(root, 'git config user.name "SynAI Tests"');
  return root;
}

async function lastMessage(root) {
  const res = await runCommand(root, 'git log -1 --pretty=%B');
  return (res.output || '').trim();
}

test('an empty message is replaced by one derived from the staged diff', async () => {
  const root = await makeRepo();
  fs.writeFileSync(path.join(root, 'parser.ts'), 'export const x = 1;\n');
  const res = await gitCommit(root, '');
  assert.equal(res.isError, false, res.output);
  const msg = await lastMessage(root);
  assert.match(msg, /^Add 1 file: /);
  assert.match(msg, /parser\.ts/);
});

test('a lazy placeholder message is replaced by a generated one', async () => {
  const root = await makeRepo();
  fs.writeFileSync(path.join(root, 'a.ts'), 'a\n');
  await gitCommit(root, 'first');
  fs.writeFileSync(path.join(root, 'b.ts'), 'b\n');
  const res = await gitCommit(root, 'fix');
  assert.equal(res.isError, false, res.output);
  const msg = await lastMessage(root);
  assert.doesNotMatch(msg, /^fix$/i, 'placeholder must not be committed verbatim');
  assert.match(msg, /^Add 1 file: /);
});

test('a meaningful message is used verbatim', async () => {
  const root = await makeRepo();
  fs.writeFileSync(path.join(root, 'c.ts'), 'c\n');
  await gitCommit(root, 'Add parser for config files');
  assert.equal(await lastMessage(root), 'Add parser for config files');
});

test('shell metacharacters in a message are stored literally, never executed', async () => {
  const root = await makeRepo();
  fs.writeFileSync(path.join(root, 'd.ts'), 'd\n');
  // If this ever reached a shell, $(echo ...) would be substituted and the
  // backticks executed. With `git commit -F <file>` the text must survive intact.
  const nasty = 'Handle "quotes" and $(echo PWNED) and `whoami`';
  const res = await gitCommit(root, nasty);
  assert.equal(res.isError, false, res.output);
  const msg = await lastMessage(root);
  assert.ok(msg.includes('$(echo PWNED)'), 'command substitution must be preserved literally');
  assert.ok(msg.includes('`whoami`'), 'backticks must be preserved literally');
});
