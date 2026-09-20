import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const zipOutput = path.join(rootDir, 'synai-v1.0.0.zip');

console.log('📦 Bundling SynAI Open-Source Project into standalone ZIP archive...');

// Remove existing zip if any
if (fs.existsSync(zipOutput)) {
  fs.unlinkSync(zipOutput);
}

// Clean any leftover staging directory in workspace
const localStaging = path.join(rootDir, '.staging_bundle');
if (fs.existsSync(localStaging)) {
  try {
    fs.rmSync(localStaging, { recursive: true, force: true });
  } catch {}
}

const tempStagingDir = path.join(os.tmpdir(), `synai-bundle-${Date.now()}`);

try {
  if (fs.existsSync(tempStagingDir)) {
    fs.rmSync(tempStagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempStagingDir, { recursive: true });

  const excludeDirs = new Set([
    'node_modules',
    '.git',
    '.gemini',
    '.staging_bundle',
    '.vscode',
    '.idea',
  ]);

  const excludeFiles = new Set([
    'synai-v1.0.0.zip',
  ]);

  function copyDirClean(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name) || entry.name.startsWith('.staging')) continue;
        const subDest = path.join(dest, entry.name);
        fs.mkdirSync(subDest, { recursive: true });
        copyDirClean(path.join(src, entry.name), subDest);
      } else {
        if (excludeFiles.has(entry.name) || entry.name.endsWith('.zip')) continue;
        fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
      }
    }
  }

  console.log('  -> Copying source files to clean temp directory...');
  copyDirClean(rootDir, tempStagingDir);

  console.log('  -> Compressing archive...');
  if (process.platform === 'win32') {
    execSync(
      `powershell.exe -NoProfile -Command "Compress-Archive -Path '${tempStagingDir}\\*' -DestinationPath '${zipOutput}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(
      `zip -r "${zipOutput}" .`,
      { cwd: tempStagingDir, stdio: 'inherit' }
    );
  }

  // Clean temp staging
  fs.rmSync(tempStagingDir, { recursive: true, force: true });

  const stats = fs.statSync(zipOutput);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);
  console.log(`\n🎉 DONE! Standalone Open-Source archive created:`);
  console.log(`📁 File: ${zipOutput}`);
  console.log(`📊 Size: ${sizeMb > 1 ? sizeMb + ' MB' : sizeKb + ' KB'}`);
} catch (err) {
  console.error('❌ Failed to bundle ZIP:', err);
  if (fs.existsSync(tempStagingDir)) {
    try {
      fs.rmSync(tempStagingDir, { recursive: true, force: true });
    } catch {}
  }
  process.exit(1);
}
