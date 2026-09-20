import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './command_tool.js';

export interface GitToolResult {
  output: string;
  isError?: boolean;
  actionType: 'git';
}

/**
 * Messages that say nothing about what actually changed. Committing one of these is
 * worse than generating a real message from the diff, so they are replaced.
 */
const PLACEHOLDER_COMMIT_MESSAGE =
  /^(fix|fixed|update|updated|changes|change|wip|commit|done|ok|okay|test|final|final version)\.?$/i;

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

/** Keep the last two path segments so commit subjects stay readable. */
function shortenPath(file: string): string {
  const parts = file.split('/');
  return parts.length <= 2 ? file : parts.slice(-2).join('/');
}

/**
 * Derive a commit message from the staged diff, so a commit made without an
 * explicit message still tells a reader what happened — which files, in what
 * direction, and at what size.
 */
async function generateCommitMessage(workspaceRoot: string): Promise<string> {
  const nameStatus = await runCommand(workspaceRoot, 'git diff --cached --name-status');
  const entries = (nameStatus.output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[AMDRC]\d*\s+\S/.test(line))
    .map((line) => {
      const [status, ...rest] = line.split(/\s+/);
      return { status, file: rest.join(' ').replace(/\t/g, ' -> ') };
    });

  if (entries.length === 0) {
    return 'Update workspace files';
  }

  const added = entries.filter((e) => e.status === 'A').length;
  const removed = entries.filter((e) => e.status === 'D').length;
  const preview = entries.slice(0, 3).map((e) => shortenPath(e.file)).join(', ');
  const more = entries.length > 3 ? ` (+${entries.length - 3} more)` : '';

  let subject: string;
  if (added === entries.length) {
    subject = `Add ${entries.length} file${plural(entries.length)}: ${preview}${more}`;
  } else if (removed === entries.length) {
    subject = `Remove ${entries.length} file${plural(entries.length)}: ${preview}${more}`;
  } else {
    subject = `Update ${entries.length} file${plural(entries.length)}: ${preview}${more}`;
  }

  const stat = await runCommand(workspaceRoot, 'git diff --cached --stat');
  const summary = (stat.output || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /files? changed/.test(line));

  const body = entries
    .slice(0, 10)
    .map((e) => `- ${e.status}: ${e.file}`)
    .join('\n');

  return summary ? `${subject}\n\n${body}\n\n${summary}` : `${subject}\n\n${body}`;
}

export async function gitStatus(workspaceRoot: string): Promise<GitToolResult> {
  const res = await runCommand(workspaceRoot, 'git status -s -b');
  return {
    output: res.output,
    isError: res.isError,
    actionType: 'git',
  };
}

export async function gitDiff(workspaceRoot: string, staged: boolean = false): Promise<GitToolResult> {
  const cmd = staged ? 'git diff --staged' : 'git diff';
  const res = await runCommand(workspaceRoot, cmd);
  return {
    output: res.output || '(No git changes)',
    isError: res.isError,
    actionType: 'git',
  };
}

export async function gitCommit(workspaceRoot: string, message: string, stageAll: boolean = true): Promise<GitToolResult> {
  if (stageAll) {
    await runCommand(workspaceRoot, 'git add -A');
  }

  // Use the caller's message when it is meaningful; a lazy one-word placeholder
  // gets replaced by a message derived from the actual staged diff instead.
  const provided = (message || '').trim();
  const commitMessage =
    provided && !PLACEHOLDER_COMMIT_MESSAGE.test(provided)
      ? provided
      : await generateCommitMessage(workspaceRoot);

  // Deliver the message through a temp file (`git commit -F`) rather than inlining
  // it into the shell command. Besides supporting multi-line bodies, this takes the
  // shell out of the loop entirely: a commit message containing quotes, backticks
  // or $(...) must never be interpreted as shell syntax.
  const tmpMessagePath = path.join(
    os.tmpdir(),
    `synai-commit-${process.pid}-${Date.now()}.txt`
  );
  try {
    fs.writeFileSync(tmpMessagePath, commitMessage, 'utf8');
    const res = await runCommand(workspaceRoot, `git commit -F "${tmpMessagePath}"`);
    return {
      output: res.output,
      isError: res.isError,
      actionType: 'git',
    };
  } finally {
    try {
      fs.unlinkSync(tmpMessagePath);
    } catch {
      // Best effort — a leftover file in the OS temp dir is harmless.
    }
  }
}

export async function gitLog(workspaceRoot: string, maxCount: number = 10): Promise<GitToolResult> {
  const res = await runCommand(workspaceRoot, `git log -n ${maxCount} --oneline`);
  return {
    output: res.output,
    isError: res.isError,
    actionType: 'git',
  };
}
