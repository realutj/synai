import { execSync } from 'node:child_process';

/**
 * Read text content from the system clipboard synchronously.
 * Works on Windows, macOS, and Linux without native dependencies.
 */
export function getClipboardText(): string {
  try {
    if (process.platform === 'win32') {
      const output = execSync('powershell.exe -NoProfile -NonInteractive -Command "Get-Clipboard"', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 2500,
        windowsHide: true,
      });
      return output.trim();
    } else if (process.platform === 'darwin') {
      const output = execSync('pbpaste', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 2000,
      });
      return output.trim();
    } else {
      try {
        const output = execSync('xclip -selection clipboard -o', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
          timeout: 2000,
        });
        return output.trim();
      } catch {
        const output = execSync('xsel --clipboard --output', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
          timeout: 2000,
        });
        return output.trim();
      }
    }
  } catch {
    return '';
  }
}
