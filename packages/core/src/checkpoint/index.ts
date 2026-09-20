import fs from 'node:fs';
import path from 'node:path';
import { Checkpoint, CheckpointFileState } from '../types/index.js';

export class CheckpointManager {
  private workspaceRoot: string;
  private checkpoints: Checkpoint[] = [];
  private maxCheckpoints: number = 50;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public recordPreModificationState(
    description: string,
    toolName: string,
    targetFilePaths: string[]
  ): Checkpoint {
    const fileStates: CheckpointFileState[] = [];

    for (const relPath of targetFilePaths) {
      const fullPath = path.isAbsolute(relPath)
        ? relPath
        : path.resolve(this.workspaceRoot, relPath);

      const existed = fs.existsSync(fullPath);
      let content = '';
      if (existed) {
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          content = '';
        }
      }

      fileStates.push({
        path: path.relative(this.workspaceRoot, fullPath),
        content,
        existed,
      });
    }

    const checkpoint: Checkpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      description,
      toolName,
      files: fileStates,
    };

    this.checkpoints.unshift(checkpoint);
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.pop();
    }

    return checkpoint;
  }

  public undoLatest(): { success: boolean; message: string; restoredFiles: string[] } {
    if (this.checkpoints.length === 0) {
      return {
        success: false,
        message: 'No checkpoints available to undo.',
        restoredFiles: [],
      };
    }

    const checkpoint = this.checkpoints.shift()!;
    const restored: string[] = [];

    for (const file of checkpoint.files) {
      const fullPath = path.resolve(this.workspaceRoot, file.path);
      try {
        if (!file.existed) {
          // File did not exist before, so delete it to restore state
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } else {
          const parent = path.dirname(fullPath);
          if (!fs.existsSync(parent)) {
            fs.mkdirSync(parent, { recursive: true });
          }
          fs.writeFileSync(fullPath, file.content || '', 'utf8');
        }
        restored.push(file.path);
      } catch (err: any) {
        console.error(`Failed to restore ${file.path}:`, err);
      }
    }

    return {
      success: true,
      message: `Restored checkpoint "${checkpoint.description}" (${restored.length} files reverted)`,
      restoredFiles: restored,
    };
  }

  public listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }
}
