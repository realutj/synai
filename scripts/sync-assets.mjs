import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔄 Synchronizing build assets across SynAI monorepo...');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Sync web dist into packages/cli/web-dist and packages/cli/dist/web
const webDist = path.join(rootDir, 'packages', 'web', 'dist');
const cliWebDist = path.join(rootDir, 'packages', 'cli', 'web-dist');
const cliDistWeb = path.join(rootDir, 'packages', 'cli', 'dist', 'web');

if (fs.existsSync(webDist)) {
  console.log('  -> Bundling Web Dashboard into CLI package (web-dist)...');
  copyDirRecursive(webDist, cliWebDist);
  copyDirRecursive(webDist, cliDistWeb);
} else {
  console.warn('  ⚠️ packages/web/dist does not exist yet. Run npm run build:web first.');
}

// 2. Sync core dist into packages/cli/node_modules/@synai-code/core/dist
const coreDir = path.join(rootDir, 'packages', 'core');
const coreDist = path.join(coreDir, 'dist');
const cliBundledCore = path.join(rootDir, 'packages', 'cli', 'node_modules', '@synai-code', 'core');
const cliBundledCoreDist = path.join(cliBundledCore, 'dist');

if (fs.existsSync(coreDist)) {
  console.log('  -> Bundling Core Engine into CLI package (bundledDependencies)...');
  copyDirRecursive(coreDist, cliBundledCoreDist);
  const corePkg = path.join(coreDir, 'package.json');
  if (fs.existsSync(corePkg)) {
    fs.mkdirSync(cliBundledCore, { recursive: true });
    fs.copyFileSync(corePkg, path.join(cliBundledCore, 'package.json'));
  }
}

console.log('✅ Asset synchronization complete!');
