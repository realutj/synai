/**
 * Storage utilities for SynAI
 */

import { homedir } from 'os';
import { join } from 'path';

let customSynaiDir: string | null = null;
let customHomeDir: string | null = null;

export function resolveSynAIDataDir(): string {
  return process.env.SYNAI_DATA_DIR || join(customHomeDir || homedir(), '.synai', 'data');
}

export function resolveSynAIDir(): string {
  return process.env.SYNAI_DIR || customSynaiDir || join(customHomeDir || homedir(), '.synai');
}

export const resolveSynaiDataDir = resolveSynAIDataDir;
export const resolveSynaiDir = resolveSynAIDir;

export function setSynaiDir(dir: string): void {
  customSynaiDir = dir;
  process.env.SYNAI_DIR = dir;
}

export function setHomeDir(dir: string): void {
  customHomeDir = dir;
}

export function getHomeDir(): string {
  return customHomeDir || homedir();
}

export function resolveExistingFilePath(filePath: string): string | null {
  try {
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    const { dirname, basename, join } = require('path');
    const dir = dirname(filePath);
    if (!fs.existsSync(dir)) {
      return null;
    }
    const targetName = basename(filePath);
    const normalize = (s: string) => s.normalize("NFKC").replace(/\s+/gu, " ").trim();
    const targetNorm = normalize(targetName);
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (normalize(entry) === targetNorm) {
        return join(dir, entry);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function discoverPluginModulePaths(dir: string): string[] {
  if (!dir) return [];
  const results: string[] = [];
  try {
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(dir)) return [];

    function walk(current: string) {
      let entries: any[] = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }
      const pkgPath = path.join(current, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          if (pkg?.synai?.plugins && Array.isArray(pkg.synai.plugins)) {
            for (const p of pkg.synai.plugins) {
              if (Array.isArray(p.paths)) {
                for (const rel of p.paths) {
                  const full = path.resolve(current, rel);
                  if (fs.existsSync(full)) results.push(full);
                }
              }
            }
            return;
          }
        } catch {}
      }
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (
            (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".ts") &&
            !entry.name.endsWith(".d.ts") &&
            !entry.name.endsWith(".test.ts") &&
            !entry.name.endsWith(".test.js") &&
            !entry.name.endsWith(".spec.ts") &&
            !entry.name.endsWith(".spec.js")
          ) {
            results.push(full);
          }
        }
      }
    }

    walk(dir);
  } catch {}
  return results;
}

export function ensureHookLogDir(filePath?: string): string {
  try {
    const fs = require('fs');
    const { dirname } = require('path');
    if (filePath) {
      const dir = dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
    const baseDir = process.env.SYNAI_DATA_DIR || resolveSynAIDir();
    const d = join(baseDir, 'logs');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    return d;
  } catch {
    const baseDir = process.env.SYNAI_DATA_DIR || resolveSynAIDir();
    return join(baseDir, 'logs');
  }
}

export function resolvePluginConfigSearchPaths(workspaceRoot?: string): string[] {
  const paths: string[] = [];
  if (workspaceRoot) {
    paths.push(join(workspaceRoot, '.synai', 'plugins'));
  }
  paths.push(join(resolveSynAIDir(), 'plugins'));
  return paths;
}


