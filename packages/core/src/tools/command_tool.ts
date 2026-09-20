import { spawn } from 'node:child_process';
import path from 'node:path';

export interface CommandToolResult {
  output: string;
  isError?: boolean;
  exitCode: number | null;
  actionType: 'command';
}

export async function runCommand(
  workspaceRoot: string,
  command: string,
  cwd?: string,
  timeoutMs: number = 60000,
  dryRun: boolean = false
): Promise<CommandToolResult> {
  if (dryRun) {
    return {
      output: `[DRY-RUN] Command skipped: ${command}`,
      exitCode: 0,
      actionType: 'command',
    };
  }

  const workingDir = cwd
    ? path.isAbsolute(cwd)
      ? cwd
      : path.resolve(workspaceRoot, cwd)
    : workspaceRoot;

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];

    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;
    let outputCapped = false;
    const HARD_OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5MB accumulated before we cut a runaway command off

    const child = spawn(shell, shellArgs, {
      cwd: workingDir,
      env: { ...process.env },
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore
      }
    }, timeoutMs);

    // A command that starts dumping huge or infinite output (an accidental `find /`,
    // a runaway `yes`, a verbose build loop) shouldn't be allowed to grow this
    // buffer unbounded — kill it early instead of risking OOM before the
    // end-of-output truncation logic ever gets a chance to run.
    const killForOutputCap = () => {
      if (outputCapped) return;
      outputCapped = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore
      }
    };

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      if (stdoutData.length + stderrData.length > HARD_OUTPUT_CAP_BYTES) killForOutputCap();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      if (stdoutData.length + stderrData.length > HARD_OUTPUT_CAP_BYTES) killForOutputCap();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        output: `Failed to start process: ${err.message}`,
        isError: true,
        exitCode: 1,
        actionType: 'command',
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (isTimedOut) {
        resolve({
          output: `Command timed out after ${timeoutMs / 1000}s.\nPartial stdout:\n${stdoutData}\nPartial stderr:\n${stderrData}`,
          isError: true,
          exitCode: 124,
          actionType: 'command',
        });
        return;
      }

      if (outputCapped) {
        resolve({
          output: `Command produced more than ${(HARD_OUTPUT_CAP_BYTES / (1024 * 1024)).toFixed(0)}MB of output and was terminated to avoid excessive memory use. Partial output:\n${stdoutData.slice(0, 15000)}`,
          isError: true,
          exitCode: 1,
          actionType: 'command',
        });
        return;
      }

      let combined = '';
      if (stdoutData.trim()) combined += stdoutData;
      if (stderrData.trim()) {
        if (combined) combined += '\n--- STDERR ---\n';
        combined += stderrData;
      }

      if (!combined.trim()) {
        combined = `(Command executed with exit code ${code} and no output)`;
      }

      const MAX_OUTPUT_CHARS = 30000;
      if (combined.length > MAX_OUTPUT_CHARS) {
        const headLen = Math.floor(MAX_OUTPUT_CHARS * 0.7);
        const tailLen = MAX_OUTPUT_CHARS - headLen;
        combined =
          `${combined.slice(0, headLen)}\n\n...[output truncated — ${combined.length - MAX_OUTPUT_CHARS} characters omitted]...\n\n${combined.slice(-tailLen)}`;
      }

      resolve({
        output: combined,
        isError: code !== 0,
        exitCode: code,
        actionType: 'command',
      });
    });
  });
}
