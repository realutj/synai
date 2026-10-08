// @jsxImportSource @opentui/react
import type { ChoiceContext } from "@opentui-ui/dialog";
import { useDialogKeyboard } from "@opentui-ui/dialog/react";
import { useDialogPalette } from "../../hooks/use-theme";

type HelpRow =
	| { kind: "heading"; id: string; text: string }
	| { kind: "entry"; id: string; key: string; desc: string }
	| { kind: "spacer"; id: string };

const HELP_ROWS: HelpRow[] = [
	{ kind: "heading", id: "h-keys", text: "* Interactive Controls & Shortcuts" },
	{
		kind: "entry",
		id: "k-enter",
		key: "Enter",
		desc: "Send instruction / Confirm selection",
	},
	{
		kind: "entry",
		id: "k-shift-enter",
		key: "Shift+Enter",
		desc: "Insert multi-line break",
	},
	{
		kind: "entry",
		id: "k-tab",
		key: "Tab",
		desc: "Switch between Plan and Act execution modes",
	},
	{
		kind: "entry",
		id: "k-shift-tab",
		key: "Shift+Tab",
		desc: "Toggle autonomous auto-approval",
	},
	{
		kind: "entry",
		id: "k-ctrl-c",
		key: "Ctrl+C",
		desc: "Cancel current input / Interrupt execution",
	},
	{
		kind: "entry",
		id: "k-ctrl-d",
		key: "Ctrl+D",
		desc: "Exit SynAI console when idle",
	},
	{
		kind: "entry",
		id: "k-ctrl-l",
		key: "Ctrl+L",
		desc: "Clear screen buffer & conversation view",
	},
	{
		kind: "entry",
		id: "k-ctrl-s",
		key: "Ctrl+S",
		desc: "Steer agent dynamically during active execution",
	},
	{
		kind: "entry",
		id: "k-ctrl-p",
		key: "Ctrl+P",
		desc: "Quick command palette & actions",
	},
	{
		kind: "entry",
		id: "k-opt-help",
		key: "Opt+K",
		desc: "Display this reference matrix",
	},
	{
		kind: "entry",
		id: "k-escape",
		key: "Escape",
		desc: "Dismiss active dialog / Stop agent",
	},
	{
		kind: "entry",
		id: "k-esc-esc",
		key: "Esc Esc",
		desc: "Roll back to previous snapshot checkpoint",
	},
	{
		kind: "entry",
		id: "k-updown",
		key: "Up/Down",
		desc: "Cycle input history & autocomplete",
	},
	{
		kind: "entry",
		id: "k-page-scroll",
		key: "PgUp/PgDn",
		desc: "Fast scroll chat stream",
	},
	{
		kind: "entry",
		id: "k-transcript-bounds",
		key: "Ctrl+G / Ctrl+Alt+G",
		desc: "Jump directly to start or latest message",
	},

	{ kind: "spacer", id: "s1" },
	{ kind: "heading", id: "h-slash", text: "* Interactive Actions & Directives" },
	{
		kind: "entry",
		id: "c-model",
		key: "/model",
		desc: "Select active LLM model or engine",
	},
	{
		kind: "entry",
		id: "c-settings",
		key: "/settings",
		desc: "Open SynAI system configuration hub",
	},
	{
		kind: "entry",
		id: "c-theme",
		key: "/theme",
		desc: "Customize visual color scheme",
	},
	{
		kind: "entry",
		id: "c-mcp",
		key: "/mcp",
		desc: "Manage external MCP protocol servers",
	},
	{
		kind: "entry",
		id: "c-plugins",
		key: "/plugins",
		desc: "Manage extensions & plugin modules",
	},
	{
		kind: "entry",
		id: "c-account",
		key: "/account",
		desc: "SynAI Cloud account & quota overview",
	},
	{
		kind: "entry",
		id: "c-compact",
		key: "/compact",
		desc: "Condense context window to reduce tokens",
	},
	{
		kind: "entry",
		id: "c-clear",
		key: "/clear",
		desc: "Reset conversation and start fresh session",
	},
	{
		kind: "entry",
		id: "c-team",
		key: "/team",
		desc: "Dispatch collaborative multi-agent swarm",
	},
	{
		kind: "entry",
		id: "c-history",
		key: "/history",
		desc: "Browse and restore past work sessions",
	},
	{
		kind: "entry",
		id: "c-fork",
		key: "/fork",
		desc: "Branch current session into isolated stream",
	},
	{
		kind: "entry",
		id: "c-undo",
		key: "/undo",
		desc: "Revert workspace to previous checkpoint",
	},
	{ kind: "entry", id: "c-quit", key: "/quit", desc: "Safely shutdown SynAI CLI" },
	{ kind: "entry", id: "c-help", key: "/help", desc: "Open this reference panel" },

	{ kind: "spacer", id: "s2" },
	{ kind: "heading", id: "h-mentions", text: "* Context Ingestion" },
	{
		kind: "entry",
		id: "m-file",
		key: "@filename",
		desc: "Directly inject file or directory into prompt context",
	},

	{ kind: "spacer", id: "s3" },
	{ kind: "heading", id: "h-modes", text: "* Operating Modes" },
	{
		kind: "entry",
		id: "mode-plan",
		key: "Plan Mode",
		desc: "Architectural strategy & analysis without applying changes",
	},
	{
		kind: "entry",
		id: "mode-act",
		key: "Act Mode",
		desc: "Autonomous full execution with file and tool operations",
	},

	{ kind: "spacer", id: "s4" },
	{ kind: "heading", id: "h-wizards", text: "* SynAI Terminal CLI Tools" },
	{
		kind: "entry",
		id: "w-provider",
		key: "synai provider",
		desc: "Configure API credentials and LLM engine access",
	},
	{
		kind: "entry",
		id: "w-settings",
		key: "synai settings",
		desc: "Manage global and workspace environment settings",
	},
	{
		kind: "entry",
		id: "w-diagnose",
		key: "synai diagnose",
		desc: "Run system diagnostics and verify dependencies",
	},
	{
		kind: "entry",
		id: "w-servers",
		key: "synai servers",
		desc: "Register and connect MCP protocol tools",
	},
	{
		kind: "entry",
		id: "w-jobs",
		key: "synai jobs",
		desc: "Configure scheduled background jobs and automations",
	},
	{
		kind: "entry",
		id: "w-bridge",
		key: "synai bridge",
		desc: "Integrate with external communication gateways",
	},
];

const KEY_WIDTH = 20;

export function HelpDialogContent(props: ChoiceContext<void>) {
	const { dismiss, dialogId } = props;
	const palette = useDialogPalette();

	useDialogKeyboard((key) => {
		if (
			key.name === "escape" ||
			key.name === "return" ||
			key.name === "enter" ||
			key.name === "q"
		) {
			dismiss();
		}
	}, dialogId);

	return (
		<box flexDirection="column" paddingX={1}>
			<scrollbox flexGrow={1}>
				<box flexDirection="column">
					{HELP_ROWS.map((row) => {
						if (row.kind === "spacer") {
							return <text key={row.id}> </text>;
						}
						if (row.kind === "heading") {
							return (
								<text key={row.id} fg="white">
									{row.text}
								</text>
							);
						}
						return (
							<box key={row.id} flexDirection="row" paddingX={1}>
								<text fg={palette.act} width={KEY_WIDTH} flexShrink={0}>
									{row.key}
								</text>
								<text fg="gray">{row.desc}</text>
							</box>
						);
					})}
				</box>
			</scrollbox>

			<text fg="gray" marginTop={1}>
				<em>Esc/Enter to close</em>
			</text>
		</box>
	);
}
