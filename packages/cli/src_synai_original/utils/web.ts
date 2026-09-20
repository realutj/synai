import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the absolute path to the pre-built SynAI Web Dashboard assets.
 * Works seamlessly in development, local monorepo, and production globally installed CLI.
 */
export function resolveWebStaticDir(): string | undefined {
  let currentDir: string;
  try {
    currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  } catch {
    currentDir = process.cwd();
  }

  const candidates = [
    // 1. Bundled in synai package root (web-dist)
    path.resolve(currentDir, '../web-dist'),
    path.resolve(currentDir, '../../web-dist'),
    path.resolve(currentDir, 'web'),
    path.resolve(currentDir, '../dist/web'),
    path.resolve(currentDir, 'dist/web'),
    // 2. Monorepo workspace web package
    path.resolve(currentDir, '../../web/dist'),
    path.resolve(currentDir, '../../../packages/web/dist'),
    path.resolve(currentDir, '../../../../packages/web/dist'),
    // 3. Working directory fallbacks
    path.resolve(process.cwd(), 'packages/web/dist'),
    path.resolve(process.cwd(), 'web-dist'),
  ];

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'index.html'))) {
        return cand;
      }
    } catch {}
  }

  return undefined;
}
