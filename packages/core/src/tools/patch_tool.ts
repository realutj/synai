import fs from 'node:fs';
import path from 'node:path';
import { ToolDefinition } from '../types/index.js';
import { CheckpointManager } from '../checkpoint/index.js';

export const patchToolDefinition: ToolDefinition = {
  name: 'apply_patch',
  description: 'Apply patches, additions, deletions, and updates to files using the unified patch format or Codex patch grammar.',
  parameters: {
    type: 'object',
    properties: {
      patch: {
        type: 'string',
        description: 'The complete patch content (e.g. starting with *** Begin Patch ... *** End Patch or unified diff format).',
      },
      content: {
        type: 'string',
        description: 'Alias for patch.',
      },
    },
    required: [],
  },
};

export interface PatchResult {
  success: boolean;
  output: string;
  isError?: boolean;
  modifiedFiles?: string[];
  actionType?: 'file_edit';
}

interface FileHunk {
  type: 'add' | 'update' | 'delete';
  filePath: string;
  moveTo?: string;
  lines: string[];
}

export function parseCodexPatch(rawPatch: string): FileHunk[] {
  const hunks: FileHunk[] = [];
  const lines = rawPatch.replace(/\r\n/g, '\n').split('\n');

  let currentHunk: FileHunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('*** Begin Patch') || line.startsWith('*** End Patch')) {
      continue;
    }

    if (line.startsWith('*** Add File: ')) {
      if (currentHunk) hunks.push(currentHunk);
      const filePath = line.slice('*** Add File: '.length).trim();
      currentHunk = { type: 'add', filePath, lines: [] };
      continue;
    }

    if (line.startsWith('*** Delete File: ')) {
      if (currentHunk) hunks.push(currentHunk);
      const filePath = line.slice('*** Delete File: '.length).trim();
      hunks.push({ type: 'delete', filePath, lines: [] });
      currentHunk = null;
      continue;
    }

    if (line.startsWith('*** Update File: ')) {
      if (currentHunk) hunks.push(currentHunk);
      const filePath = line.slice('*** Update File: '.length).trim();
      currentHunk = { type: 'update', filePath, lines: [] };
      continue;
    }

    if (line.startsWith('*** Move to: ') && currentHunk && currentHunk.type === 'update') {
      currentHunk.moveTo = line.slice('*** Move to: '.length).trim();
      continue;
    }

    if (currentHunk) {
      if (line.startsWith('*** End of File')) {
        continue;
      }
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

export function executeApplyPatch(
  rawInput: string | { patch?: string; content?: string },
  workspaceRoot: string,
  checkpoints?: CheckpointManager
): PatchResult {
  const patchString = typeof rawInput === 'string' ? rawInput : (rawInput.patch || rawInput.content || '');

  if (!patchString.trim()) {
    return {
      success: false,
      output: 'Error: Patch content is empty.',
      isError: true,
    };
  }

  const hunks = parseCodexPatch(patchString);

  if (hunks.length === 0) {
    if (patchString.includes('--- ') && patchString.includes('+++ ')) {
      return applyUnifiedDiff(patchString, workspaceRoot, checkpoints);
    }

    return {
      success: false,
      output: 'Error: No valid patch hunks found in patch input.',
      isError: true,
    };
  }

  if (checkpoints && hunks.length > 0) {
    checkpoints.recordPreModificationState(
      `apply_patch: ${hunks.length} files`,
      'apply_patch',
      hunks.map((h) => h.filePath)
    );
  }

  const results: string[] = [];
  const modifiedFiles: string[] = [];

  for (const hunk of hunks) {
    const targetPath = path.isAbsolute(hunk.filePath)
      ? hunk.filePath
      : path.resolve(workspaceRoot, hunk.filePath);

    try {
      if (hunk.type === 'add') {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const contentLines = hunk.lines
          .filter((l) => l.startsWith('+'))
          .map((l) => l.slice(1));

        fs.writeFileSync(targetPath, contentLines.join('\n'), 'utf8');
        results.push(`[CREATED] ${path.relative(workspaceRoot, targetPath)}`);
        modifiedFiles.push(targetPath);
      } else if (hunk.type === 'delete') {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          results.push(`[DELETED] ${path.relative(workspaceRoot, targetPath)}`);
          modifiedFiles.push(targetPath);
        } else {
          results.push(`[SKIPPED] ${path.relative(workspaceRoot, targetPath)} (file did not exist)`);
        }
      } else if (hunk.type === 'update') {
        if (!fs.existsSync(targetPath)) {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const contentLines = hunk.lines
            .filter((l) => l.startsWith('+'))
            .map((l) => l.slice(1));
          fs.writeFileSync(targetPath, contentLines.join('\n'), 'utf8');
          results.push(`[CREATED] ${path.relative(workspaceRoot, targetPath)}`);
          modifiedFiles.push(targetPath);
          continue;
        }

        const original = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
        const updated = applyHunkLines(original, hunk.lines);

        let finalPath = targetPath;
        if (hunk.moveTo) {
          const moveDest = path.isAbsolute(hunk.moveTo)
            ? hunk.moveTo
            : path.resolve(workspaceRoot, hunk.moveTo);
          const moveDir = path.dirname(moveDest);
          if (!fs.existsSync(moveDir)) fs.mkdirSync(moveDir, { recursive: true });
          fs.writeFileSync(moveDest, updated, 'utf8');
          fs.unlinkSync(targetPath);
          finalPath = moveDest;
          results.push(`[MOVED & UPDATED] ${path.relative(workspaceRoot, targetPath)} -> ${path.relative(workspaceRoot, moveDest)}`);
        } else {
          fs.writeFileSync(targetPath, updated, 'utf8');
          results.push(`[UPDATED] ${path.relative(workspaceRoot, targetPath)}`);
        }
        modifiedFiles.push(finalPath);
      }
    } catch (err: any) {
      results.push(`[FAILED] ${hunk.filePath}: ${err.message}`);
    }
  }

  const success = results.some((r) => r.startsWith('[UPDATED]') || r.startsWith('[CREATED]') || r.startsWith('[DELETED]'));
  return {
    success,
    isError: !success,
    output: results.join('\n'),
    modifiedFiles,
    actionType: 'file_edit',
  };
}

function applyHunkLines(originalContent: string, hunkLines: string[]): string {
  const originalLines = originalContent.split('\n');
  let currentLines = [...originalLines];

  const blocks: Array<{ search: string[]; replace: string[] }> = [];
  let currentSearch: string[] = [];
  let currentReplace: string[] = [];

  for (const line of hunkLines) {
    if (line.startsWith('@@')) {
      if (currentSearch.length > 0 || currentReplace.length > 0) {
        blocks.push({ search: currentSearch, replace: currentReplace });
        currentSearch = [];
        currentReplace = [];
      }
      continue;
    }

    if (line.startsWith('-')) {
      currentSearch.push(line.slice(1));
    } else if (line.startsWith('+')) {
      currentReplace.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      currentSearch.push(line.slice(1));
      currentReplace.push(line.slice(1));
    } else {
      currentSearch.push(line);
      currentReplace.push(line);
    }
  }

  if (currentSearch.length > 0 || currentReplace.length > 0) {
    blocks.push({ search: currentSearch, replace: currentReplace });
  }

  let text = currentLines.join('\n');
  for (const block of blocks) {
    const searchTarget = block.search.join('\n');
    const replacement = block.replace.join('\n');
    if (text.includes(searchTarget)) {
      text = text.replace(searchTarget, replacement);
    } else {
      const trimmedSearch = block.search.map((s) => s.trim()).join('\n');
      const linesArray = text.split('\n');
      for (let i = 0; i <= linesArray.length - block.search.length; i++) {
        const slice = linesArray.slice(i, i + block.search.length).map((s) => s.trim()).join('\n');
        if (slice === trimmedSearch) {
          linesArray.splice(i, block.search.length, ...block.replace);
          text = linesArray.join('\n');
          break;
        }
      }
    }
  }

  return text;
}

function applyUnifiedDiff(
  diffText: string,
  workspaceRoot: string,
  checkpoints?: CheckpointManager
): PatchResult {
  const lines = diffText.replace(/\r\n/g, '\n').split('\n');
  let currentFile: string | null = null;
  const hunksByFile = new Map<string, string[]>();

  for (const line of lines) {
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      currentFile = line.replace(/^\+\+\+\s+(?:b\/)?/, '').trim();
      if (!hunksByFile.has(currentFile)) {
        hunksByFile.set(currentFile, []);
      }
      continue;
    }
    if (currentFile && !line.startsWith('--- ')) {
      hunksByFile.get(currentFile)!.push(line);
    }
  }

  const results: string[] = [];
  const modifiedFiles: string[] = [];

  if (checkpoints && hunksByFile.size > 0) {
    checkpoints.recordPreModificationState(
      `apply_patch (unified): ${hunksByFile.size} files`,
      'apply_patch',
      Array.from(hunksByFile.keys())
    );
  }

  for (const [filePath, hunkLines] of hunksByFile.entries()) {
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
    try {
      if (!fs.existsSync(targetPath)) {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const contentLines = hunkLines.filter((l) => l.startsWith('+')).map((l) => l.slice(1));
        fs.writeFileSync(targetPath, contentLines.join('\n'), 'utf8');
        results.push(`[CREATED] ${filePath}`);
        modifiedFiles.push(targetPath);
      } else {
        const original = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
        const updated = applyHunkLines(original, hunkLines);
        fs.writeFileSync(targetPath, updated, 'utf8');
        results.push(`[UPDATED] ${filePath}`);
        modifiedFiles.push(targetPath);
      }
    } catch (e: any) {
      results.push(`[FAILED] ${filePath}: ${e.message}`);
    }
  }

  const success = results.some((r) => r.startsWith('[UPDATED]') || r.startsWith('[CREATED]'));
  return {
    success,
    isError: !success,
    output: results.join('\n'),
    modifiedFiles,
    actionType: 'file_edit',
  };
}
