/**
 * Settings navigation constants, split from settings-view.tsx so the sidebar
 * (always mounted) can reference section names without pulling the entire
 * settings module graph — providers, MCP, schedules — into the
 * initial chat bundle. The heavy views load on demand via next/dynamic.
 */

const ALL_SETTINGS_SECTIONS = [
	"General",
	"Personalization",
	"API Providers",
	"Voice",
	"Channels",
	"Schedules",
	"Import",
	"Account",
] as const;

// Customize is the unified hub for everything that extends SynAI — skills,
// MCP servers, plugins, rules, hooks, and tools.
const ALL_CUSTOMIZATION_SECTIONS = ["Customize"] as const;

// Sidebar labels for the Customize group.
export const CUSTOMIZATION_SECTION_LABELS: Record<
	(typeof ALL_CUSTOMIZATION_SECTIONS)[number],
	string
> = {
	Customize: "Customize",
};

export type SettingsSection =
	| (typeof ALL_SETTINGS_SECTIONS)[number]
	| (typeof ALL_CUSTOMIZATION_SECTIONS)[number];

// Temporarily hidden from the sidebar. The views and routes still exist —
const HIDDEN_SECTIONS: ReadonlySet<SettingsSection> = new Set([
	"Channels",
	"Account",
]);

export const SETTINGS_SECTIONS = ALL_SETTINGS_SECTIONS.filter(
	(section) => !HIDDEN_SECTIONS.has(section),
);

export const CUSTOMIZATION_SECTIONS = ALL_CUSTOMIZATION_SECTIONS.filter(
	(section) => !HIDDEN_SECTIONS.has(section),
);
