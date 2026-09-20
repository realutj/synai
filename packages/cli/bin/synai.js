#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(fs.realpathSync(__filename));
const cliRootDir = path.resolve(scriptDir, "..");

// 1. Check for standalone compiled binary (fastest, self-contained)
const binaryName = os.platform() === "win32" ? "synai.exe" : "synai";
const candidatePaths = [
  path.join(cliRootDir, "dist", "cli-windows-x64", "bin", binaryName),
  path.join(cliRootDir, "dist", `cli-${os.platform()}-${os.arch()}`, "bin", binaryName),
  path.join(cliRootDir, "bin", binaryName),
];

let targetBinary = candidatePaths.find((p) => fs.existsSync(p));

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

// 2. Fallback: run via bun if installed
const bunCheck = spawnSync("bun", ["--version"], { stdio: "ignore" });
if (bunCheck.status === 0) {
  const entrypoint = fs.existsSync(path.join(cliRootDir, "dist", "index.js"))
    ? path.join(cliRootDir, "dist", "index.js")
    : path.join(cliRootDir, "src", "index.ts");

  const result = spawnSync("bun", [entrypoint, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
}

console.error("Error: Could not find compiled SynAI CLI binary or Bun runtime.");
process.exit(1);
