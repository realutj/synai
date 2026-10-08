#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const platform = os.platform() === "win32" ? "windows" : os.platform();
const executable = platform === "windows" ? "synai.exe" : "synai";
const packageName = `synai-cli-${platform}-${os.arch()}`;
const binarySpecifier = `${packageName}/bin/${executable}`;

let binaryPath;
try {
	binaryPath = fileURLToPath(import.meta.resolve(binarySpecifier));
} catch {
	console.error(
		`No SynAI binary is available for ${platform} ${os.arch()}. Reinstall synai to fetch the matching platform package.`,
	);
	process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
	stdio: "inherit",
});

if (result.error) {
	console.error(`Failed to start SynAI: ${result.error.message}`);
	process.exit(1);
}

process.exit(result.status ?? 1);
