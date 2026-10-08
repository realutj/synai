#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";


process.env.OTUI_USE_CONSOLE = "false";
process.env.SHOW_CONSOLE = "false";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(fs.realpathSync(__filename));
const cliRootDir = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

const nodePathDirs = [
  path.join(cliRootDir, "node_modules"),
  path.join(cliRootDir, "..", "..", "node_modules"),
  process.env.NODE_PATH || "",
].filter(Boolean).join(path.delimiter);

process.env.NODE_PATH = nodePathDirs;

// 1. Check for standalone compiled binary (fastest, self-contained)
const binaryName = os.platform() === "win32" ? "synai.exe" : "synai";
const displayPlatform = os.platform() === "win32" ? "windows" : os.platform();
const platformPackageName = `synai-cli-${displayPlatform}-${os.arch()}`;
const candidatePaths = [
  path.join(cliRootDir, "bin", ".synai"),
  path.join(cliRootDir, "dist", `cli-${displayPlatform}-${os.arch()}`, "bin", binaryName),
  path.join(cliRootDir, "bin", binaryName),
];

let targetBinary = candidatePaths.find((p) => fs.existsSync(p));
if (!targetBinary) {
  try {
    const packageJsonPath = require.resolve(`${platformPackageName}/package.json`, {
      paths: [cliRootDir],
    });
    const packageDir = path.dirname(packageJsonPath);
    const packageBinary = path.join(packageDir, "bin", binaryName);
    if (fs.existsSync(packageBinary)) targetBinary = packageBinary;
  } catch {
    // Keep the Bun and source-based development fallbacks available below.
  }
}

if (targetBinary) {
  const result = spawnSync(targetBinary, process.argv.slice(2), {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("Failed to run binary:", result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

// 2. If bun is installed, run dist/index.js (or src/index.ts) via bun so @opentui/core (bun:ffi) works natively
const distIndex = path.join(cliRootDir, "dist", "index.js");
const srcIndex = path.join(cliRootDir, "src", "index.ts");
let bunExec = "bun";
if (os.platform() === "win32") {
  const npmBun = path.join(process.env.APPDATA || "", "npm", "node_modules", "bun", "bin", "bun.exe");
  if (fs.existsSync(npmBun)) {
    bunExec = npmBun;
  }
}
const bunCheck = spawnSync(bunExec, ["--version"], { stdio: "ignore" });
if (bunCheck.status === 0) {
  const entrypoint = fs.existsSync(distIndex) ? distIndex : srcIndex;
  if (fs.existsSync(entrypoint)) {
    const result = spawnSync(bunExec, [entrypoint, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: process.env,
    });
    process.exit(result.status ?? 0);
  }
}

// 3. Pure Node.js execution (runs anywhere with Node.js >= 22 without bun)
if (fs.existsSync(distIndex)) {
  const result = spawnSync(process.execPath, [distIndex, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("Failed to run SynAI CLI:", result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

console.error("Error: Failed to start SynAI CLI (dist/index.js not found).");
process.exit(1);
