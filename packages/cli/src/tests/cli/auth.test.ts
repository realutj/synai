// ---------------------------------------------------------------------------
// synai auth - CLI flag and contract tests
//
// These tests cover the `synai auth` subcommand behavior:
//   - Interactive auth screen navigation
//   - `synai auth -p <provider> -k <apiKey> -m <modelId>` golden path
//   - Invalid provider / key / model error handling
//   - Partial-flag error handling (exit with failure)
//   - `synai auth --help`
// ---------------------------------------------------------------------------

import { test } from "@microsoft/tui-test";
import {
	SYNAI_BIN,
	EXIT_CODE_FAIL,
	EXIT_CODE_SUCCESS,
	TERMINAL_WIDE,
} from "../helpers/constants.js";
import { synaiEnv } from "../helpers/env.js";
import { waitForAuthScreen } from "../helpers/page-objects/auth.js";
import { expectExitCode, expectVisible } from "../helpers/terminal.js";

test.describe("synai auth (interactive screen)", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["provider"] },
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("shows all auth options", async ({ terminal }) => {
		await waitForAuthScreen(terminal);
	});

	test("can navigate options with keyUp / keyDown", async ({ terminal }) => {
		await waitForAuthScreen(terminal);
		terminal.keyDown();
		terminal.keyUp();
		await expectVisible(terminal, "Sign in with SynAI");
	});
});

test.describe("synai auth --help", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["provider", "--help"] },
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("shows auth help page", async ({ terminal }) => {
		await expectVisible(terminal, [
			"Usage:",
			"--provider",
			"--apikey",
			"--modelid",
			"--baseurl",
		]);
	});
});

// ---------------------------------------------------------------------------
// synai auth with only partial flags -> exits with error
// ---------------------------------------------------------------------------
test.describe("synai auth --provider only (partial flags)", () => {
	test.use({
		program: { file: SYNAI_BIN, args: ["provider", "--provider", "openai"] },
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits with failure", async ({ terminal }) => {
		await expectVisible(terminal, "error");
		await expectExitCode(terminal, EXIT_CODE_FAIL);
	});
});

test.describe("synai auth --apikey only (partial flags)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--apikey", "sk-test-key"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits with error requiring --provider", async ({ terminal }) => {
		await expectVisible(terminal, "provider");
		await expectExitCode(terminal, EXIT_CODE_FAIL);
	});
});

test.describe("synai auth --modelid only (partial flags)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--modelid", "gpt-4o"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits with error requiring --provider", async ({ terminal }) => {
		await expectVisible(terminal, "provider");
		await expectExitCode(terminal, EXIT_CODE_FAIL);
	});
});

test.describe("synai auth --baseurl only (partial flags)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--baseurl", "https://api.example.com"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits with error requiring --provider", async ({ terminal }) => {
		await expectVisible(terminal, "provider");
		await expectExitCode(terminal, EXIT_CODE_FAIL);
	});
});

test.describe("synai auth --verbose only", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--verbose"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("accepts --verbose and shows interactive auth screen", async ({
		terminal,
	}) => {
		await waitForAuthScreen(terminal);
	});
});

test.describe("synai auth --cwd", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--cwd", "/tmp"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("accepts --cwd and shows interactive auth screen", async ({
		terminal,
	}) => {
		await waitForAuthScreen(terminal);
	});
});

test.describe("synai auth --config", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: ["provider", "--config", "configs/unauthenticated"],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("accepts --config and shows interactive auth screen", async ({
		terminal,
	}) => {
		await waitForAuthScreen(terminal);
	});
});

test.describe("synai auth -p -k -m (golden path)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: [
				"provider",
				"--provider",
				"openai",
				"--apikey",
				"sk-test-key-12345",
				"--modelid",
				"gpt-4o",
			],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits successfully with valid provider, key, and model", async ({
		terminal,
	}) => {
		// Golden path: should not show interactive auth screen, should exit cleanly
		await expectExitCode(terminal, EXIT_CODE_SUCCESS);
	});
});

test.describe("synai auth with invalid key (still exits 0)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: [
				"provider",
				"--provider",
				"openai",
				"--apikey",
				"invalid-key",
				"--modelid",
				"gpt-4o",
			],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("accepts invalid key without error at auth time", async ({
		terminal,
	}) => {
		await expectExitCode(terminal, EXIT_CODE_SUCCESS);
	});
});

test.describe("synai auth -p -k -m -b (golden path with baseUrl)", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: [
				"provider",
				"--provider",
				"openai-compatible",
				"--apikey",
				"sk-test-key-12345",
				"--modelid",
				"gpt-4o",
				"--baseurl",
				"https://api.example.com/v1",
			],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("exits successfully with baseUrl for OpenAI Compatible provider", async ({
		terminal,
	}) => {
		await expectExitCode(terminal, EXIT_CODE_SUCCESS);
	});
});

test.describe("synai auth --baseurl with non-OpenAI-compatible provider", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: [
				"provider",
				"--provider",
				"anthropic",
				"--apikey",
				"sk-ant-test",
				"--modelid",
				"claude-sonnet-4-20250514",
				"--baseurl",
				"https://api.example.com",
			],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("shows error for baseUrl with non-OpenAI provider", async ({
		terminal,
	}) => {
		await expectVisible(
			terminal,
			/only supported for openai|not supported|openai.compatible/i,
		);
	});
});

test.describe("synai auth with invalid provider", () => {
	test.use({
		program: {
			file: SYNAI_BIN,
			args: [
				"provider",
				"--provider",
				"not-a-real-provider",
				"--apikey",
				"sk-test",
				"--modelid",
				"gpt-4o",
			],
		},
		...TERMINAL_WIDE,
		env: synaiEnv("unauthenticated"),
	});

	test("shows invalid provider error", async ({ terminal }) => {
		await expectVisible(terminal, /invalid provider/i);
	});
});
