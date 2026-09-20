/**
 * Storage utilities for SynAI
 */

import { homedir } from 'os';
import { join } from 'path';

export function resolveSynAIDataDir(): string {
  return process.env.SYNAI_DATA_DIR || join(homedir(), '.synai', 'data');
}

export function resolveSynAIDir(): string {
  return process.env.SYNAI_DIR || join(homedir(), '.synai');
}

export function resolveExistingFilePath(path: string): string | null {
  try {
    const fs = require('fs');
    if (fs.existsSync(path)) {
      return path;
    }
    return null;
  } catch {
    return null;
  }
}
