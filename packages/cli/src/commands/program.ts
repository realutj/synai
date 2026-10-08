import { relative, sep } from "node:path";
import { Command, CommanderError, Option } from "commander";
import { getHomeDir, resolveSynaiDataDir, resolveSynaiDir } from "@synai/shared/storage";
import { version } from "../../package.json";
import {
	CLI_COMPACTION_MODE_OPTION_DESCRIPTION,
	parseCliCompactionMode,
} from "../utils/compaction-mode";
import type { ParsedArgs } from "../utils/types";

export { CommanderError };

function normalizeAutoApproveValue(
	value: string | boolean | undefined,
): string {
	if (value === undefined || value === true) {
		return "true";
	}
	return String(value);
}

/**
 * Add the shared root-level options to any command.
 */
export function addRootOptions(cmd: Command): Command {
	return (
		cmd
			.option("-p, --plan", "Engage architectural planning mode before executing any code changes")
			.option("--json", "Emit structured JSON stream events instead of styled console output")
			.option(
				"--auto-approve <boolean>",
				"Configure autonomous tool execution permission (default: true)",
				normalizeAutoApproveValue,
			)
			.option("-c, --cwd <path>", "Target workspace directory path for execution")
			.option(
				"--thinking <level>",
				"Configure deep reasoning effort: none|low|medium|high|xhigh (bare flag defaults to medium)",
			)
			.option("--compaction <mode>", CLI_COMPACTION_MODE_OPTION_DESCRIPTION)
			.option(
				"-i, --tui",
				"Launch full interactive terminal user interface (TUI)",
			)
			.option("--id <session-id>", "Resume an active or archived session by unique ID")
			.option("-P, --provider <id>", "Active model provider service (default: openrouter)")
			.option("-k, --key <api-key>", "Runtime API authentication key override")
			.option(
				"-m, --model <model-id>",
				"Target foundation model identifier for the active provider",
			)
			.option(
				"-s, --system <system-prompt>",
				"Supply custom system instruction prompt override",
			)
			.option("-z, --zen", "Run headless agent session in background engine")
			.option(
				"--retries [value]",
				"Maximum consecutive self-correction attempts before terminating (default: 6)",
			)
			.option(
				"-t, --timeout <seconds>",
				"Session execution deadline in seconds (default: 0 for unlimited)",
			)
			.option(
				"--acp",
				"Initialize Agent Client Protocol stdio interface for editor integration",
			)
			.option(
				"--config <path>",
				`Configuration directory (default: ~/${relative(getHomeDir(), resolveSynaiDir()).split(sep).join("/")})`,
			)
			.option(
				"--data-dir <path>",
				`Use isolated local state at this directory path (default: ~/${relative(getHomeDir(), resolveSynaiDataDir()).split(sep).join("/")})`,
			)
			.option(
				"--hooks-dir <path>",
				"Directory path containing custom lifecycle hook scripts (default: ~/.synai/hooks)",
			)
			.option(
				"--worktree",
				"Spawn an isolated git worktree sandbox and run task safely",
			)
			.option("--upgrade", "Check for latest SynAI version and install available updates")
			.option("--update", "Alias for --upgrade")
			.option("-v, --verbose", "Enable detailed diagnostic and transport tracing")
			// HIDDEN/LEGACY OPTIONS BELOW
			.addOption(
				// Act mode is the default. Keep the legacy flags accepted for users who
				// still pass them, but do not advertise them in help output.
				new Option("-a, --act", "Run in autonomous execution mode").hideHelp(),
			)
			.addOption(
				// `-y, --yolo` is still accepted (and behaves the same as before) but
				// hidden from `--help` output.
				new Option(
					"-y, --yolo",
					"Enable non-interactive execution without permission gates.",
				).hideHelp(),
			)
			.addOption(
				new Option(
					"--team-name <name>",
					"Override the runtime team state name",
				).hideHelp(),
			)
			.addOption(
				new Option(
					"--board",
					"Launch the board interface",
				).hideHelp(),
			)
	);
}

export function createProgram(): Command {
	const program = new Command("synai")
		.description("SynAI CLI - Autonomous AI Coding Engineer for Terminal and Enterprise Workflows")
		.version(version, "-V, --version", "Display active SynAI version")
		.exitOverride() // don't call process.exit
		.configureOutput({
			writeOut: () => {}, // suppress by default; main.ts re-enables for routing
			writeErr: () => {},
		})
		.allowExcessArguments()
		.enablePositionalOptions()
		.argument(
			"[prompt]",
			"Task objective or coding instruction to execute autonomously.",
		);

	addRootOptions(program);

	return program;
}

export function commanderToParsedArgs(program: Command): ParsedArgs {
	const opts = program.opts();

	const result: ParsedArgs = {
		verbose: !!opts.verbose,
		interactive: !!opts.tui,
		outputMode: opts.json ? "json" : "text",
		mode: opts.plan ? "plan" : opts.yolo ? "yolo" : opts.zen ? "zen" : "act",
		modeExplicitlySet: !!(opts.plan || opts.act || opts.yolo || opts.zen),
		sandbox: !!opts.dataDir,
		acpMode: !!opts.acp,
		thinking: false,
		reasoningEffort: undefined,
		defaultToolAutoApprove: true,
		...(opts.id ? { id: opts.id } : {}),
		...(opts.board ? { board: true } : {}),
	};

	// Approval: last-wins semantics
	if (opts.autoApprove !== undefined) {
		const raw = String(opts.autoApprove).trim().toLowerCase();
		if (raw === "true") {
			result.defaultToolAutoApprove = true;
			result.autoApproveOverride = true;
		} else if (raw === "false") {
			result.defaultToolAutoApprove = false;
			result.autoApproveOverride = false;
		} else if (raw) {
			result.invalidAutoApprove = raw;
		}
	}
	if (opts.yolo) {
		result.defaultToolAutoApprove = true;
		result.autoApproveOverride = true;
	}

	// Timeout validation
	if (opts.timeout !== undefined) {
		const raw = opts.timeout.trim();
		const parsed = Number.parseInt(raw, 10);
		if (raw && Number.isInteger(parsed) && parsed >= 1) {
			result.timeoutSeconds = parsed;
		} else if (raw) {
			result.invalidTimeoutSeconds = raw;
		}
	}

	if (opts.thinking !== undefined) {
		const effort = String(opts.thinking).trim().toLowerCase();
		if (
			effort === "none" ||
			effort === "low" ||
			effort === "medium" ||
			effort === "high" ||
			effort === "xhigh"
		) {
			result.thinkingExplicitlySet = true;
			if (effort === "none") {
				result.thinking = false;
				result.reasoningEffort = undefined;
			} else {
				result.thinking = true;
				result.reasoningEffort = effort;
			}
		} else if (effort) {
			result.invalidThinkingLevel = effort;
		}
	}

	if (opts.compaction !== undefined) {
		const mode = String(opts.compaction).trim().toLowerCase();
		const compactionMode = parseCliCompactionMode(mode);
		if (compactionMode) {
			result.compactionMode = compactionMode;
		} else if (mode) {
			result.invalidCompactionMode = mode;
		}
	}

	// Retries (max consecutive mistakes) validation
	if (opts.retries !== undefined) {
		const raw = opts.retries.trim();
		const parsed = Number.parseInt(raw, 10);
		if (raw && Number.isInteger(parsed) && parsed >= 1) {
			result.retries = parsed;
		} else if (raw) {
			result.invalidRetries = raw;
		}
	}

	// Simple string/number options
	if (opts.dataDir !== undefined) result.dataDir = opts.dataDir;
	if (opts.config !== undefined) result.configDir = opts.config;
	if (opts.hooksDir !== undefined) result.hooksDir = opts.hooksDir;
	if (opts.worktree !== undefined) result.worktree = !!opts.worktree;
	if (opts.cwd !== undefined) result.cwd = opts.cwd;
	if (opts.teamName !== undefined) result.teamName = opts.teamName;
	if (opts.system !== undefined) result.systemPrompt = opts.system;
	if (opts.model !== undefined) result.model = opts.model;
	if (opts.provider !== undefined) result.provider = opts.provider;
	if (opts.key !== undefined) result.key = opts.key;
	else if (opts.apiKey !== undefined) result.key = opts.apiKey;
	if (opts.id !== undefined) result.id = opts.id;

	// Positional args -> prompt
	const positional = program.args;
	if (positional.length > 0) {
		result.prompt = positional.join(" ");
	}

	return result;
}
