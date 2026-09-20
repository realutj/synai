import { createPatch } from 'diff';

export interface DiffResult {
  patch: string;
  addedLines: number;
  removedLines: number;
}

export function generateDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): DiffResult {
  const patch = createPatch(filePath, oldContent, newContent, 'Original', 'Modified');
  const lines = patch.split('\n');
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed++;
    }
  }

  return {
    patch,
    addedLines: added,
    removedLines: removed,
  };
}

export function formatTerminalDiff(diffPatch: string): string {
  const lines = diffPatch.split('\n');
  return lines
    .map((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        return `\x1b[32m${line}\x1b[0m`; // Green
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        return `\x1b[31m${line}\x1b[0m`; // Red
      }
      if (line.startsWith('@@')) {
        return `\x1b[36m${line}\x1b[0m`; // Cyan
      }
      return line;
    })
    .join('\n');
}
