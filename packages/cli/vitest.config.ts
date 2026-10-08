import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@synai\/core$/,
				replacement: resolve(rootDir, "../core/src/index.ts"),
			},
			{
				find: /^@synai\/core\/(.+)$/,
				replacement: resolve(rootDir, "../core/src/$1"),
			},
			{
				find: /^@synai\/shared$/,
				replacement: resolve(rootDir, "../shared/src/index.ts"),
			},
			{
				find: /^@synai\/shared\/(.+)$/,
				replacement: resolve(rootDir, "../shared/src/$1"),
			},
			{
				find: "react-reconciler/constants",
				replacement: resolve(rootDir, "../../node_modules/react-reconciler/constants.js"),
			},
		],
	},
	test: {
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.ts"],
		exclude: ["src/**/*.e2e.test.ts", "src/tests/**"],
		// Default 5s is tight on CI: each test uses `resetModules()` + dynamic `import("./main")`
		// (large graph). Cold transforms occasionally exceed 5s on shared runners.
		testTimeout: 15_000,
		pool: "forks",
		maxWorkers: 1,
		fileParallelism: false,
		server: {
			deps: {
				inline: [/@opentui/],
			},
		},
	},
});
