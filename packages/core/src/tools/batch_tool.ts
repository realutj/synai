import fs from 'node:fs';
import path from 'node:path';
import { generateDiff } from './diff_utils.js';
import { resolveSafePath, performFuzzyReplacement } from './file_tools.js';

export interface BatchFileOp {
  filePath: string;
  action: 'write' | 'edit' | 'delete';
  content?: string;
  targetContent?: string;
  replacementContent?: string;
  allowMultiple?: boolean;
}

export interface BatchResult {
  output: string;
  isError?: boolean;
  diff: string;
  modifiedFiles: string[];
}

export function executeBatchEdit(
  workspaceRoot: string,
  operations: BatchFileOp[],
  dryRun: boolean = false
): BatchResult {
  const combinedDiffs: string[] = [];
  const modifiedFiles: string[] = [];
  // originalContent is captured for every file we touch (even ones being newly
  // created, where it's ''), so a failure partway through the write phase can
  // actually roll everything back — a real transaction, not just "written
  // sequentially and hope nothing goes wrong," which is what "atomic" claims.
  const pendingWrites: { fullPath: string; rel: string; newContent?: string; isDelete?: boolean; originalContent: string; existedBefore: boolean }[] = [];

  try {
    for (const op of operations) {
      let fullPath: string;
      try {
        fullPath = resolveSafePath(workspaceRoot, op.filePath);
      } catch (err: any) {
        return {
          output: `Batch Error: ${err.message}`,
          isError: true,
          diff: '',
          modifiedFiles: [],
        };
      }
      const rel = path.relative(workspaceRoot, fullPath);
      const existedBefore = fs.existsSync(fullPath);

      if (op.action === 'delete') {
        const oldContent = existedBefore ? fs.readFileSync(fullPath, 'utf8') : '';
        const diff = generateDiff(rel, oldContent, '');
        combinedDiffs.push(diff.patch);
        modifiedFiles.push(rel);
        pendingWrites.push({ fullPath, rel, isDelete: true, originalContent: oldContent, existedBefore });
      } else if (op.action === 'write') {
        const oldContent = existedBefore ? fs.readFileSync(fullPath, 'utf8') : '';
        const newContent = op.content || '';
        const diff = generateDiff(rel, oldContent, newContent);
        combinedDiffs.push(diff.patch);
        modifiedFiles.push(rel);
        pendingWrites.push({ fullPath, rel, newContent, originalContent: oldContent, existedBefore });
      } else if (op.action === 'edit') {
        if (!existedBefore) {
          return {
            output: `Batch Error: File not found for editing: ${rel}`,
            isError: true,
            diff: '',
            modifiedFiles: [],
          };
        }
        const oldContent = fs.readFileSync(fullPath, 'utf8');
        const target = op.targetContent || '';
        const rep = op.replacementContent || '';
        // Use the same fuzzy-matching engine editFile() uses (exact match, line-ending
        // normalization, indentation-flexible, anchor matching) instead of a naive
        // .replace() that only ever touches the first exact occurrence and silently
        // ignores ambiguous multi-match cases that editFile would refuse outright.
        const matchResult = performFuzzyReplacement(oldContent, target, rep, !!op.allowMultiple);
        if (!matchResult.success || matchResult.newContent === undefined) {
          return {
            output: `Batch Error in ${rel}: ${matchResult.error || 'target content not found'}${
              matchResult.closestMatchSnippet ? `\n\nClosest match:\n${matchResult.closestMatchSnippet}` : ''
            }`,
            isError: true,
            diff: '',
            modifiedFiles: [],
          };
        }
        const newContent = matchResult.newContent;
        const diff = generateDiff(rel, oldContent, newContent);
        combinedDiffs.push(diff.patch);
        modifiedFiles.push(rel);
        pendingWrites.push({ fullPath, rel, newContent, originalContent: oldContent, existedBefore });
      }
    }

    if (!dryRun) {
      const applied: typeof pendingWrites = [];
      try {
        for (const item of pendingWrites) {
          if (item.isDelete) {
            if (fs.existsSync(item.fullPath)) {
              fs.unlinkSync(item.fullPath);
            }
          } else if (item.newContent !== undefined) {
            const parent = path.dirname(item.fullPath);
            if (!fs.existsSync(parent)) {
              fs.mkdirSync(parent, { recursive: true });
            }
            fs.writeFileSync(item.fullPath, item.newContent, 'utf8');
          }
          applied.push(item);
        }
      } catch (writeErr: any) {
        // Roll back every file this batch already touched before the failure,
        // so a mid-batch I/O error can't leave the workspace half-refactored.
        const rollbackFailures: string[] = [];
        for (const item of applied) {
          try {
            if (!item.existedBefore) {
              if (fs.existsSync(item.fullPath)) fs.unlinkSync(item.fullPath);
            } else {
              fs.writeFileSync(item.fullPath, item.originalContent, 'utf8');
            }
          } catch {
            rollbackFailures.push(item.rel);
          }
        }
        return {
          output:
            `Batch execution failed while writing "${applied[applied.length - 1]?.rel ?? '?'}": ${writeErr.message}\n` +
            `Rolled back ${applied.length} file(s) already written this batch.` +
            (rollbackFailures.length > 0
              ? ` WARNING: rollback itself failed for: ${rollbackFailures.join(', ')} — check these manually.`
              : ''),
          isError: true,
          diff: '',
          modifiedFiles: [],
        };
      }
    }

    const tag = dryRun ? ' [DRY-RUN]' : '';
    return {
      output: `Batch operation completed successfully on ${modifiedFiles.length} files${tag}:\n${modifiedFiles.map((f) => `  * ${f}`).join('\n')}`,
      diff: combinedDiffs.join('\n\n'),
      modifiedFiles,
    };
  } catch (err: any) {
    return {
      output: `Batch execution failed: ${err.message}`,
      isError: true,
      diff: '',
      modifiedFiles: [],
    };
  }
}
