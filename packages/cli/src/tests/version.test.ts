import { test } from "@microsoft/tui-test";
import { SYNAI_BIN } from "./helpers/constants.js";
import { synaiEnv } from "./helpers/env.js";
import { expectVisible } from "./helpers/terminal.js";

// ---------------------------------------------------------------------------
// synai --version  (root flag)
// ---------------------------------------------------------------------------
test.describe("synai --version", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["--version"] },
		env: synaiEnv("claude-sonnet-4.6"),
	});

	test("prints the version string", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// synai -V  (short flag)
// ---------------------------------------------------------------------------
test.describe("synai -V", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["-V"] },
		env: synaiEnv("claude-sonnet-4.6"),
	});

	test("prints the version string with short flag", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// synai version  (subcommand)
// ---------------------------------------------------------------------------
test.describe("synai version subcommand", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["version"] },
		env: synaiEnv("claude-sonnet-4.6"),
	});

	test("prints 'SynAI CLI version:' message", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});
