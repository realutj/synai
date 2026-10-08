import type { Command } from "commander";
import type { TuiStartupTarget } from "../tui/types";
import type { CliOutputMode } from "../utils/types";
import {
	runHistoryDelete,
	runHistoryExport,
	runHistoryList,
	runHistoryUpdate,
} from "./history";

type HistoryCommandIo = {
	writeln: (text?: string) => void;
	writeErr: (text: string) => void;
};

type RegisterHistoryCommandOptions = {
	program: Command;
	io: HistoryCommandIo;
	setExitCode: (code: number) => void;
	setStartupTarget: (target: TuiStartupTarget) => void;
	isInteractiveTTY?: () => boolean;
};

function resolveHistoryOutputMode(
	program: Command,
	historyCmd: Command,
): CliOutputMode {
	return program.opts().json || historyCmd.opts().json ? "json" : "text";
}

export function registerHistoryCommand({
	program,
	io,
	setExitCode,
	setStartupTarget,
	isInteractiveTTY = () =>
		process.stdin.isTTY === true && process.stdout.isTTY === true,
}: RegisterHistoryCommandOptions): void {
	const historyCmd = program
		.command("sessions")
		.alias("history")
		.alias("logs")
		.alias("h")
		.description("Browse interactive session transcripts, resume workflows, or export audit logs")
		.option("--json", "Output as JSON")
		.option("--limit <count>", "Maximum number of sessions to show", "50")
		.option("--page <number>", "Page number for paginated results")
		.option("--config <dir>", "configuration directory")
		.action(async () => {
			const opts = historyCmd.opts();
			const limit = Number.parseInt(opts.limit, 10);
			const outputMode = resolveHistoryOutputMode(program, historyCmd);
			if (outputMode === "text" && isInteractiveTTY()) {
				setStartupTarget("history");
				return;
			}
			setExitCode(
				await runHistoryList({
					limit,
					outputMode,
					io,
				}),
			);
		});

	const historyDeleteCmd = historyCmd
		.command("delete")
		.alias("rm")
		.description("Permanently delete a recorded session trajectory")
		.option("--session-id <id>", "Target session identifier to purge")
		.action(async () => {
			const opts = historyDeleteCmd.opts();
			if (!opts.sessionId) {
				io.writeErr("history delete requires --session-id <id>");
				setExitCode(1);
				return;
			}
			const outputMode = resolveHistoryOutputMode(program, historyCmd);
			setExitCode(await runHistoryDelete(opts.sessionId, outputMode, io));
		});

	const historyUpdateCmd = historyCmd
		.command("update")
		.description("Modify title or custom metadata of an existing session")
		.option("--metadata <json>", "Metadata JSON payload")
		.option("--prompt <text>", "Updated prompt description")
		.option("--session-id <id>", "Target session identifier")
		.option("--title <text>", "New display title")
		.action(async () => {
			const opts = historyUpdateCmd.opts();
			if (!opts.sessionId) {
				io.writeErr("sessions update requires --session-id <id>");
				setExitCode(1);
				return;
			}
			const outputMode = resolveHistoryOutputMode(program, historyCmd);
			setExitCode(
				await runHistoryUpdate(
					opts.sessionId,
					opts.prompt,
					opts.title,
					opts.metadata,
					outputMode,
					io,
				),
			);
		});

	const historyExportCmd = historyCmd
		.command("export <sessionId>")
		.description("Compile session trajectory into a standalone visual HTML report")
		.option("-o, --output <path>", "Destination HTML file path")
		.action(async (sessionId: string) => {
			const opts = historyExportCmd.opts();
			const outputMode = resolveHistoryOutputMode(program, historyCmd);
			setExitCode(
				await runHistoryExport(sessionId, opts.output, outputMode, io),
			);
		});
}
