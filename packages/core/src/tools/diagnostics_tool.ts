import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from './command_tool.js';
import { DiagnosticIssue, DiagnosticsResult } from '../types/index.js';

export async function runWorkspaceDiagnostics(
  workspaceRoot: string,
  customCommand?: string
): Promise<DiagnosticsResult> {
  const root = path.resolve(workspaceRoot);
  let command = customCommand;

  if (!command) {
    // Auto-detect best diagnostic command
    if (fs.existsSync(path.join(root, 'tsconfig.json'))) {
      command = 'npx tsc --noEmit';
    } else if (fs.existsSync(path.join(root, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.scripts?.typecheck) {
        command = 'npm run typecheck';
      } else if (pkg.scripts?.lint) {
        command = 'npm run lint';
      } else {
        command = 'node -e "console.log(\'No type checker configured\')"';
      }
    } else if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
      command = 'cargo check';
    } else if (fs.existsSync(path.join(root, 'go.mod'))) {
      command = 'go vet ./...';
    } else if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) {
      command = 'python -m py_compile **/*.py';
    } else {
      return {
        hasErrors: false,
        issues: [],
        rawOutput: 'No project configuration found for automated diagnostics.',
        commandUsed: 'none',
      };
    }
  }

  const result = await runCommand(root, command, undefined, 30000, false);
  const issues: DiagnosticIssue[] = parseCompilerErrors(result.output, root);

  return {
    hasErrors: result.exitCode !== 0 || issues.length > 0,
    issues,
    rawOutput: result.output,
    commandUsed: command,
  };
}

function parseCompilerErrors(output: string, workspaceRoot: string): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const lines = output.split('\n');

  // Regex patterns
  const tsPattern1 = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+)?:?\s*(.+)$/i;
  const tsPattern2 = /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s*(TS\d+)?:?\s*(.+)$/i;
  const posixPattern = /^([^:\n]+):(\d+):(\d+):\s*(error|warning)?:\s*(.+)$/i;
  const rustLocPattern = /-->\s+([^:\n]+):(\d+):(\d+)/i;
  const pyPattern = /File\s+"([^"]+)",\s+line\s+(\d+)/i;

  let currentRustError: { code: string; message: string } | null = null;
  let currentPyError: { file: string; line: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // 1. TypeScript / ESLint
    let match = tsPattern1.exec(trimmed) || tsPattern2.exec(trimmed);
    if (match) {
      issues.push({
        file: path.relative(workspaceRoot, path.resolve(workspaceRoot, match[1].trim())),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4].toLowerCase().includes('err') ? 'error' : 'warning',
        code: match[5] || '',
        message: match[6].trim(),
        source: 'compiler',
      });
      continue;
    }

    // 2. POSIX / Go / GCC / Clang
    let posixMatch = posixPattern.exec(trimmed);
    if (posixMatch && !trimmed.startsWith('node_modules')) {
      issues.push({
        file: path.relative(workspaceRoot, path.resolve(workspaceRoot, posixMatch[1].trim())),
        line: parseInt(posixMatch[2], 10),
        column: parseInt(posixMatch[3], 10),
        severity: (posixMatch[4] || 'error').toLowerCase().includes('warn') ? 'warning' : 'error',
        code: '',
        message: posixMatch[5].trim(),
        source: 'compiler',
      });
      continue;
    }

    // 3. Rust error header: error[E0123]: message
    if (trimmed.startsWith('error[') || trimmed.startsWith('warning[')) {
      const parts = trimmed.split(':');
      currentRustError = {
        code: parts[0]?.trim() || '',
        message: parts.slice(1).join(':').trim(),
      };
      continue;
    }
    // Rust location: --> src/main.rs:10:5
    let rustLocMatch = rustLocPattern.exec(trimmed);
    if (rustLocMatch && currentRustError) {
      issues.push({
        file: path.relative(workspaceRoot, path.resolve(workspaceRoot, rustLocMatch[1].trim())),
        line: parseInt(rustLocMatch[2], 10),
        column: parseInt(rustLocMatch[3], 10),
        severity: currentRustError.code.includes('warning') ? 'warning' : 'error',
        code: currentRustError.code,
        message: currentRustError.message,
        source: 'cargo',
      });
      currentRustError = null;
      continue;
    }

    // 4. Python traceback
    let pyMatch = pyPattern.exec(trimmed);
    if (pyMatch) {
      currentPyError = {
        file: pyMatch[1],
        line: parseInt(pyMatch[2], 10),
      };
      continue;
    }
    if (currentPyError && (trimmed.includes('Error:') || trimmed.includes('Exception:'))) {
      issues.push({
        file: path.relative(workspaceRoot, path.resolve(workspaceRoot, currentPyError.file)),
        line: currentPyError.line,
        column: 1,
        severity: 'error',
        code: trimmed.split(':')[0] || 'PythonError',
        message: trimmed,
        source: 'python',
      });
      currentPyError = null;
      continue;
    }
  }

  return issues;
}
