import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../dist/tools/command_tool.js';

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-cmd-test-'));
}

test('dryRun does not execute the command', async () => {
  const root = makeWorkspace();
  const result = await runCommand(root, 'echo should-not-run', undefined, 5000, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /\[DRY-RUN\]/);
});

test('runs a simple command and captures stdout', async () => {
  const root = makeWorkspace();
  const result = await runCommand(root, 'echo hello-synai');
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /hello-synai/);
});

test('times out a long-running command and reports exit code 124', async () => {
  const root = makeWorkspace();
  const result = await runCommand(root, 'sleep 5', undefined, 300);
  assert.equal(result.exitCode, 124);
  assert.equal(result.isError, true);
  assert.match(result.output, /timed out/);
});

test('kills a command producing runaway output before it exhausts memory', async () => {
  const root = makeWorkspace();
  // Emits well past the 5MB hard cap; the process must be killed, not left to
  // run to completion or buffer unbounded output.
  // `runCommand` shells out to PowerShell on Windows and /bin/sh elsewhere, so the
  // generator has to match the platform — `yes`/`head` simply don't exist on Windows
  // and the test would "pass" only by failing to start the command at all.
  const line = '01234567890123456789012345678901234567890123456789';
  const runawayCommand =
    process.platform === 'win32' ? `while ($true) { "${line}" }` : `yes "${line}"`;

  const result = await runCommand(root, runawayCommand);
  assert.equal(result.isError, true);
  assert.match(result.output, /terminated to avoid excessive memory use/);
}, { timeout: 20000 });
