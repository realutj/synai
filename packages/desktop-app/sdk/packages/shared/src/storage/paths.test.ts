import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	AGENT_CONFIG_DIRECTORY_NAME,
	SYNAI_CHAT_WORKSPACE_DIRECTORY_NAME,
	SYNAI_CONNECTOR_SETTINGS_FILE_NAME,
	SYNAI_MCP_SETTINGS_FILE_NAME,
	SYNAI_WORKSPACES_DIRECTORY_NAME,
	discoverPluginModulePaths,
	getPluginDisplayName,
	HOOKS_CONFIG_DIRECTORY_NAME,
	isAgentPluginDirectory,
	isChatWorkspacePath,
	RULES_CONFIG_DIRECTORY_NAME,
	resolveAgentPluginSearchPaths,
	resolveAgentsConfigDirPath,
	resolveChatWorkspacePath,
	resolveSynAIDataDir,
	resolveConfiguredPluginModulePaths,
	resolveConnectorDataDir,
	resolveConnectorSettingsPath,
	resolveDbDataDir,
	resolveGlobalAgentsRulesPath,
	resolveGlobalSettingsPath,
	resolveHooksConfigSearchPaths,
	resolveMcpSettingsPath,
	resolvePluginModuleEntries,
	resolveProviderSettingsPath,
	resolveRulesConfigSearchPaths,
	resolveSessionDataDir,
	resolveTeamDataDir,
	resolveWorkflowsConfigSearchPaths,
	setHomeDir,
} from "./paths";

type EnvSnapshot = {
	SYNAI_DIR: string | undefined;
	SYNAI_DATA_DIR: string | undefined;
	SYNAI_CONNECTOR_DATA_DIR: string | undefined;
	SYNAI_CONNECTOR_SETTINGS_PATH: string | undefined;
	SYNAI_DB_DATA_DIR: string | undefined;
	SYNAI_GLOBAL_SETTINGS_PATH: string | undefined;
	SYNAI_MCP_SETTINGS_PATH: string | undefined;
	SYNAI_PROVIDER_SETTINGS_PATH: string | undefined;
	SYNAI_SESSION_DATA_DIR: string | undefined;
	SYNAI_TEAM_DATA_DIR: string | undefined;
};

function captureEnv(): EnvSnapshot {
	return {
		SYNAI_DIR: process.env.SYNAI_DIR,
		SYNAI_DATA_DIR: process.env.SYNAI_DATA_DIR,
		SYNAI_CONNECTOR_DATA_DIR: process.env.SYNAI_CONNECTOR_DATA_DIR,
		SYNAI_CONNECTOR_SETTINGS_PATH: process.env.SYNAI_CONNECTOR_SETTINGS_PATH,
		SYNAI_DB_DATA_DIR: process.env.SYNAI_DB_DATA_DIR,
		SYNAI_GLOBAL_SETTINGS_PATH: process.env.SYNAI_GLOBAL_SETTINGS_PATH,
		SYNAI_MCP_SETTINGS_PATH: process.env.SYNAI_MCP_SETTINGS_PATH,
		SYNAI_PROVIDER_SETTINGS_PATH: process.env.SYNAI_PROVIDER_SETTINGS_PATH,
		SYNAI_SESSION_DATA_DIR: process.env.SYNAI_SESSION_DATA_DIR,
		SYNAI_TEAM_DATA_DIR: process.env.SYNAI_TEAM_DATA_DIR,
	};
}

function restoreEnv(snapshot: EnvSnapshot): void {
	process.env.SYNAI_DATA_DIR = snapshot.SYNAI_DATA_DIR;
	process.env.SYNAI_CONNECTOR_DATA_DIR = snapshot.SYNAI_CONNECTOR_DATA_DIR;
	process.env.SYNAI_CONNECTOR_SETTINGS_PATH =
		snapshot.SYNAI_CONNECTOR_SETTINGS_PATH;
	process.env.SYNAI_DIR = snapshot.SYNAI_DIR;
	process.env.SYNAI_DB_DATA_DIR = snapshot.SYNAI_DB_DATA_DIR;
	process.env.SYNAI_GLOBAL_SETTINGS_PATH = snapshot.SYNAI_GLOBAL_SETTINGS_PATH;
	process.env.SYNAI_MCP_SETTINGS_PATH = snapshot.SYNAI_MCP_SETTINGS_PATH;
	process.env.SYNAI_PROVIDER_SETTINGS_PATH =
		snapshot.SYNAI_PROVIDER_SETTINGS_PATH;
	process.env.SYNAI_SESSION_DATA_DIR = snapshot.SYNAI_SESSION_DATA_DIR;
	process.env.SYNAI_TEAM_DATA_DIR = snapshot.SYNAI_TEAM_DATA_DIR;
}

describe("storage path resolution", () => {
	let snapshot: EnvSnapshot = captureEnv();

	afterEach(() => {
		restoreEnv(snapshot);
	});

	it("only auto-discovers Agent Plugins from the user home", () => {
		const homeRoot = mkdtempSync(join(tmpdir(), "synai-agent-plugin-home-"));
		const previousHome = process.env.HOME ?? "~";
		try {
			setHomeDir(homeRoot);
			expect(resolveAgentPluginSearchPaths()).toEqual([
				join(homeRoot, ".agents", "plugins"),
			]);
		} finally {
			setHomeDir(previousHome);
			rmSync(homeRoot, { recursive: true, force: true });
		}
	});

	it("uses SYNAI_DATA_DIR as-is when set", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveSynAIDataDir()).toBe("/tmp/synai-data");
	});

	it("falls back to SYNAI_DATA_DIR/sessions for session storage", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_SESSION_DATA_DIR;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveSessionDataDir()).toBe(join("/tmp/synai-data", "sessions"));
	});

	it("falls back to SYNAI_DATA_DIR/teams for team storage", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_TEAM_DATA_DIR;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveTeamDataDir()).toBe(join("/tmp/synai-data", "teams"));
	});

	it("falls back to SYNAI_DATA_DIR/connectors for connector storage", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_CONNECTOR_DATA_DIR;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveConnectorDataDir()).toBe(
			join("/tmp/synai-data", "connectors"),
		);
	});

	it("falls back to SYNAI_DATA_DIR/connectors/settings.json for connector settings", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_CONNECTOR_DATA_DIR;
		delete process.env.SYNAI_CONNECTOR_SETTINGS_PATH;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveConnectorSettingsPath()).toBe(
			join("/tmp/synai-data", "connectors", SYNAI_CONNECTOR_SETTINGS_FILE_NAME),
		);
	});

	it("uses SYNAI_CONNECTOR_SETTINGS_PATH as-is when set", () => {
		snapshot = captureEnv();
		process.env.SYNAI_CONNECTOR_SETTINGS_PATH =
			"/tmp/synai-connectors/custom-settings.json";

		expect(resolveConnectorSettingsPath()).toBe(
			"/tmp/synai-connectors/custom-settings.json",
		);
	});

	it("falls back to SYNAI_DATA_DIR/db for sqlite storage", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_DB_DATA_DIR;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveDbDataDir()).toBe(join("/tmp/synai-data", "db"));
	});

	it("falls back to SYNAI_DATA_DIR/settings/providers.json for provider settings", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_PROVIDER_SETTINGS_PATH;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveProviderSettingsPath()).toBe(
			join("/tmp/synai-data", "settings", "providers.json"),
		);
	});

	it("falls back to SYNAI_DATA_DIR/settings/global-settings.json for global settings", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_GLOBAL_SETTINGS_PATH;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveGlobalSettingsPath()).toBe(
			join("/tmp/synai-data", "settings", "global-settings.json"),
		);
	});

	it("falls back to SYNAI_DATA_DIR/settings/synai_mcp_settings.json for MCP settings", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_MCP_SETTINGS_PATH;
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveMcpSettingsPath()).toBe(
			join("/tmp/synai-data", "settings", SYNAI_MCP_SETTINGS_FILE_NAME),
		);
	});

	it("falls back to ~/.synai/.agents for agent configs", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DIR = "/tmp/home/.synai";

		expect(resolveAgentsConfigDirPath()).toBe(
			join("/tmp/home", ".synai", AGENT_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves global hooks from ~/.synai", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DIR = "/tmp/home/.synai";
		process.env.SYNAI_DATA_DIR = "/tmp/home/.synai/data";

		expect(resolveHooksConfigSearchPaths()).toEqual(
			expect.arrayContaining([
				join("/tmp/home", ".synai", HOOKS_CONFIG_DIRECTORY_NAME),
			]),
		);
		expect(resolveHooksConfigSearchPaths()).not.toContain(
			join("/tmp/home", ".synai", "data", HOOKS_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves global rules from ~/.synai", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DIR = "/tmp/home/.synai";
		process.env.SYNAI_DATA_DIR = "/tmp/home/.synai/data";

		expect(resolveRulesConfigSearchPaths()).toEqual(
			expect.arrayContaining([
				resolveGlobalAgentsRulesPath(),
				join("/tmp/home", ".synai", RULES_CONFIG_DIRECTORY_NAME),
				// xdg-user-dir's unconfigured Documents fallback (synai/synai#13542)
				join(
					dirname(dirname(resolveGlobalAgentsRulesPath())),
					"SynAI",
					"Rules",
				),
			]),
		);
		expect(resolveRulesConfigSearchPaths()).not.toContain(
			join("/tmp/home", ".synai", "data", RULES_CONFIG_DIRECTORY_NAME),
		);
	});

	it("resolves legacy and new workflow paths, with .synai paths later for duplicate-name precedence", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DIR = "/tmp/home/.synai";
		const workspacePath = "/repo/demo";

		const paths = resolveWorkflowsConfigSearchPaths(workspacePath);

		expect(paths).toEqual([
			join(workspacePath, ".synairules", "workflows"),
			expect.stringContaining(join("Documents", "SynAI", "Workflows")),
			join("/tmp/home", ".synai", "workflows"),
			join(workspacePath, ".synai", "workflows"),
		]);
	});
});

describe("chat workspace paths", () => {
	let snapshot: EnvSnapshot = captureEnv();

	afterEach(() => {
		restoreEnv(snapshot);
	});

	it("exports the canonical path segments", () => {
		expect(SYNAI_WORKSPACES_DIRECTORY_NAME).toBe("workspaces");
		expect(SYNAI_CHAT_WORKSPACE_DIRECTORY_NAME).toBe("chat");
	});

	it("resolves the shared chat workspace under the synai data dir", () => {
		snapshot = captureEnv();
		delete process.env.SYNAI_DATA_DIR;
		process.env.SYNAI_DIR = "/tmp/home/.synai";

		expect(resolveChatWorkspacePath()).toBe(
			join("/tmp/home/.synai", "data", "workspaces", "chat"),
		);
	});

	it("honors the SYNAI_DATA_DIR override", () => {
		snapshot = captureEnv();
		process.env.SYNAI_DATA_DIR = "/tmp/synai-data";

		expect(resolveChatWorkspacePath()).toBe(
			join("/tmp/synai-data", "workspaces", "chat"),
		);
	});

	it.each([
		"/home/user/.synai/data/workspaces/chat",
		"//home//user//.synai//data//workspaces//chat//",
		"C:\\Users\\dev\\.synai\\data\\workspaces\\chat\\",
		"\\\\server\\share\\.synai\\data\\workspaces\\chat",
	])("recognizes chat workspace root %s", (path) => {
		expect(isChatWorkspacePath(path)).toBe(true);
	});

	it.each([
		".synai/data/workspaces/chat",
		"/tmp/chat",
		"/tmp/synai/sessions/session-a1b2c3-temp/project",
		"/home/user/synai/data/workspaces/chat",
		"/home/user/.synai/workspaces/chat",
		"/home/user/.synai/data/other/chat",
		"/home/user/.synai/data/workspaces/Chat",
		"/home/user/.synai/data/workspaces/chat/my-app",
		"/home/user/.synai/data/workspaces",
	])("rejects non-chat workspace path %s", (path) => {
		expect(isChatWorkspacePath(path)).toBe(false);
	});
});

describe("getPluginDisplayName", () => {
	const tempRoots: string[] = [];

	function createTempRoot(): string {
		const root = mkdtempSync(join(tmpdir(), "synai-plugin-name-"));
		tempRoots.push(root);
		return root;
	}

	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("uses the package name for package-backed installed plugin entries", () => {
		const root = createTempRoot();
		const packageDir = join(
			root,
			"_installed",
			"local",
			"agents-squad-057fda0dd505",
			"package",
		);
		mkdirSync(packageDir, { recursive: true });
		writeFileSync(
			join(packageDir, "package.json"),
			JSON.stringify({ name: "synai-agents-squad-plugin" }),
		);
		const entryPath = join(packageDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe(
			"synai-agents-squad-plugin",
		);
	});

	it("finds the package name in an ancestor directory within the search root", () => {
		const root = createTempRoot();
		const packageDir = join(root, "my-plugin");
		const srcDir = join(packageDir, "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(
			join(packageDir, "package.json"),
			JSON.stringify({ name: "my-plugin" }),
		);
		const entryPath = join(srcDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("my-plugin");
	});

	it("falls back to the file basename when package.json has no usable name", () => {
		const root = createTempRoot();
		const packageDir = join(root, "unnamed", "package");
		mkdirSync(packageDir, { recursive: true });
		writeFileSync(join(packageDir, "package.json"), JSON.stringify({}));
		const entryPath = join(packageDir, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("index");
	});

	it("falls back to the file basename for bare plugin modules", () => {
		const root = createTempRoot();
		const entryPath = join(root, "x-poster.js");
		writeFileSync(entryPath, "module.exports = {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("x-poster");
	});

	it("does not read package.json files above the search root", () => {
		const outer = createTempRoot();
		writeFileSync(
			join(outer, "package.json"),
			JSON.stringify({ name: "outer-package" }),
		);
		const root = join(outer, "plugins");
		mkdirSync(root, { recursive: true });
		const entryPath = join(root, "index.ts");
		writeFileSync(entryPath, "export default {};");

		expect(getPluginDisplayName(entryPath, root)).toBe("index");
	});
});

describe("SynAI plugin discovery boundary", () => {
	const tempRoots: string[] = [];

	function createTempRoot(): string {
		const root = mkdtempSync(join(tmpdir(), "synai-plugin-boundary-"));
		tempRoots.push(root);
		return root;
	}

	function writeFile(path: string, contents: string): string {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, contents);
		return path;
	}

	/**
	 * A minimal conformant Agent Plugin: a skill with an executable script, a
	 * second vendor's extension directory, and a vendored dependency. None of it
	 * is a SynAI plugin module.
	 */
	function writeAgentPlugin(pluginRoot: string): void {
		writeFile(
			join(pluginRoot, "plugin.json"),
			JSON.stringify({
				$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
				name: "summarizer",
			}),
		);
		writeFile(
			join(pluginRoot, "mcp.json"),
			JSON.stringify({
				$schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
				mcpServers: {},
			}),
		);
		writeFile(
			join(pluginRoot, "skills", "summarize", "SKILL.md"),
			"---\nname: summarize\n---\n",
		);
		writeFile(
			join(pluginRoot, "skills", "summarize", "scripts", "fetch.js"),
			"throw new Error('skill script must never be imported');",
		);
		writeFile(
			join(pluginRoot, "skills", "summarize", "scripts", "build.ts"),
			"export const helper = 1;",
		);
		writeFile(
			join(pluginRoot, "com.example.client", "setup.js"),
			"throw new Error('another vendor namespace must never be imported');",
		);
		writeFile(
			join(pluginRoot, "node_modules", "left-pad", "package.json"),
			JSON.stringify({ name: "left-pad", main: "index.js" }),
		);
		writeFile(
			join(pluginRoot, "node_modules", "left-pad", "index.js"),
			"module.exports = () => {};",
		);
	}

	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("claims nothing from an Agent Plugin dropped into a SynAI plugin root", () => {
		const root = createTempRoot();
		writeAgentPlugin(join(root, "summarizer"));

		expect(discoverPluginModulePaths(root)).toEqual([]);
	});

	it("claims nothing when the scan root is itself an Agent Plugin", () => {
		const root = createTempRoot();
		writeAgentPlugin(root);

		expect(discoverPluginModulePaths(root)).toEqual([]);
	});

	it("never descends into node_modules", () => {
		const root = createTempRoot();
		const entryPath = writeFile(
			join(root, "my-plugin", "index.ts"),
			"export default {};",
		);
		writeFile(
			join(root, "my-plugin", "node_modules", "dep", "index.js"),
			"module.exports = {};",
		);

		expect(discoverPluginModulePaths(root)).toEqual([entryPath]);
	});

	it("never descends into dot directories", () => {
		const root = createTempRoot();
		const entryPath = writeFile(join(root, "plugin.ts"), "export default {};");
		writeFile(
			join(root, ".git", "hooks", "pre-commit.js"),
			"module.exports={};",
		);

		expect(discoverPluginModulePaths(root)).toEqual([entryPath]);
	});

	it("still discovers bare SynAI plugin modules", () => {
		const root = createTempRoot();
		const first = writeFile(join(root, "alpha.ts"), "export default {};");
		const second = writeFile(
			join(root, "nested", "beta.js"),
			"export default {};",
		);

		expect(discoverPluginModulePaths(root)).toEqual([first, second]);
	});

	it("still honors package.json-declared SynAI plugin entries", () => {
		const root = createTempRoot();
		const packageDir = join(root, "declared");
		writeFile(
			join(packageDir, "package.json"),
			JSON.stringify({ synai: { plugins: [{ paths: ["entry.ts"] }] } }),
		);
		const entryPath = writeFile(
			join(packageDir, "entry.ts"),
			"export default {};",
		);
		writeFile(join(packageDir, "helper.ts"), "export const helper = 1;");

		expect(discoverPluginModulePaths(root)).toEqual([entryPath]);
	});

	it("resolves no module entries for an Agent Plugin directory", () => {
		const root = createTempRoot();
		writeAgentPlugin(root);
		// An index.ts at the root would otherwise be claimed as the SynAI plugin
		// entry point, so this asserts the manifest wins over the index fallback.
		writeFile(join(root, "index.ts"), "export default {};");

		expect(resolvePluginModuleEntries(root)).toBeNull();
	});

	it("resolves no modules for an explicitly configured Agent Plugin path", () => {
		const root = createTempRoot();
		writeAgentPlugin(join(root, "summarizer"));

		expect(resolveConfiguredPluginModulePaths(["summarizer"], root)).toEqual(
			[],
		);
	});

	it("detects an Agent Plugin manifest only when it is a regular file", () => {
		const root = createTempRoot();
		expect(isAgentPluginDirectory(root)).toBe(false);

		mkdirSync(join(root, "plugin.json"), { recursive: true });
		expect(isAgentPluginDirectory(root)).toBe(false);

		rmSync(join(root, "plugin.json"), { recursive: true, force: true });
		writeFileSync(join(root, "plugin.json"), "{}");
		expect(isAgentPluginDirectory(root)).toBe(true);
	});
});
