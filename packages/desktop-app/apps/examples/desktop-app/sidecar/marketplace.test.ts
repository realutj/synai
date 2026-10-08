import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installPlugin } from "@synai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getOfficialPluginInstallPath,
	installMarketplaceEntry,
	listMarketplaceInstalledEntries,
} from "./marketplace";
import type { JsonRecord } from "./types";

// Marketplace plugin installs run in-process through @synai/core (spawning a
// `synai` binary fails with 'Executable not found in $PATH: "synai"' in the
// packaged app). Stub only installPlugin; everything else stays real.
vi.mock(import("@synai/core"), async (importOriginal) => ({
	...(await importOriginal()),
	installPlugin: vi.fn(),
}));
const installPluginMock = vi.mocked(installPlugin);

const GOAL_ENTRY = {
	id: "goal",
	type: "plugin",
	name: "Goal",
	install: { args: ["goal"] },
};

let tempSynAIDir: string;
let previousSynAIDir: string | undefined;

beforeEach(async () => {
	tempSynAIDir = await mkdtemp(join(tmpdir(), "desktop-marketplace-"));
	previousSynAIDir = process.env.SYNAI_DIR;
	process.env.SYNAI_DIR = tempSynAIDir;
	installPluginMock.mockReset().mockImplementation(async (options) => ({
		source: options.source,
		installPath: goalInstallDir(),
		entryPaths: [],
		mcpSyncFailures: [],
		mcpOAuthCandidates: [],
	}));
});

afterEach(async () => {
	if (previousSynAIDir === undefined) {
		delete process.env.SYNAI_DIR;
	} else {
		process.env.SYNAI_DIR = previousSynAIDir;
	}
	await rm(tempSynAIDir, { recursive: true, force: true });
});

function goalInstallDir(): string {
	const path = getOfficialPluginInstallPath("goal");
	if (!path) {
		throw new Error("expected an official install path for goal");
	}
	return path;
}

describe("official plugin install detection", () => {
	it("installs plugins in-process through @synai/core", async () => {
		const result = await installMarketplaceEntry({ entry: GOAL_ENTRY });

		expect(result).toMatchObject({
			status: "installed",
			message: "Installed Goal.",
		});
		expect(installPluginMock).toHaveBeenCalledWith({
			source: "goal",
			force: false,
		});
	});

	it("does not treat a leftover empty install directory as installed", async () => {
		// Regression: a failed or interrupted install can leave the directory
		// behind with nothing in it. The next install attempt then returned
		// "already installed" without running the installer, so the UI flipped
		// the entry to Uninstall with no error while nothing actually worked.
		await mkdir(goalInstallDir(), { recursive: true });
		installPluginMock.mockRejectedValueOnce(new Error("install exploded"));

		await expect(
			installMarketplaceEntry({ entry: GOAL_ENTRY }),
		).rejects.toThrow(/install exploded/);
		expect(installPluginMock).toHaveBeenCalledTimes(1);
	});

	it("passes force so a retry can reclaim the leftover directory", async () => {
		// Without force the installer refuses to replace the existing path
		// ("Plugin is already installed at ... Use --force to replace it."),
		// so every retry from the UI would fail against the stale directory.
		await mkdir(goalInstallDir(), { recursive: true });

		const result = await installMarketplaceEntry({ entry: GOAL_ENTRY });

		expect(result).toMatchObject({
			status: "installed",
			message: "Installed Goal.",
		});
		expect(installPluginMock).toHaveBeenCalledWith({
			source: "goal",
			force: true,
		});
	});

	it("still short-circuits when the directory contains a plugin module", async () => {
		const installDir = goalInstallDir();
		await mkdir(join(installDir, "package"), { recursive: true });
		await writeFile(
			join(installDir, "package.json"),
			JSON.stringify({
				name: "goal",
				private: true,
				synai: { plugins: [{ paths: ["./package/index.ts"] }] },
			}),
		);
		await writeFile(
			join(installDir, "package", "index.ts"),
			"export default {};",
		);

		const result = await installMarketplaceEntry({ entry: GOAL_ENTRY });

		expect(result).toMatchObject({
			status: "installed",
			message: "Goal is already installed.",
		});
		expect(installPluginMock).not.toHaveBeenCalled();
	});

	it("registers MCP servers in-process, honoring the -- args separator", async () => {
		const settingsPath = join(tempSynAIDir, "synai_mcp_settings.json");
		const previousSettingsPath = process.env.SYNAI_MCP_SETTINGS_PATH;
		process.env.SYNAI_MCP_SETTINGS_PATH = settingsPath;
		try {
			const result = await installMarketplaceEntry({
				entry: {
					id: "aikido",
					type: "mcp",
					name: "Aikido",
					install: {
						args: ["aikido", "--", "npx", "-y", "@aikidosec/mcp@1.0.9"],
					},
				},
			});

			expect(result).toMatchObject({
				status: "installed",
				message: "Installed Aikido.",
			});
			const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
				mcpServers: Record<string, { transport?: unknown }>;
			};
			expect(settings.mcpServers.aikido?.transport).toEqual({
				type: "stdio",
				command: "npx",
				args: ["-y", "@aikidosec/mcp@1.0.9"],
			});
		} finally {
			if (previousSettingsPath === undefined) {
				delete process.env.SYNAI_MCP_SETTINGS_PATH;
			} else {
				process.env.SYNAI_MCP_SETTINGS_PATH = previousSettingsPath;
			}
		}
	});

	it("excludes partial install directories from the installed entries list", async () => {
		await mkdir(goalInstallDir(), { recursive: true });

		const empty = listMarketplaceInstalledEntries({ entries: [GOAL_ENTRY] }, {
			plugins: [],
		} as JsonRecord);
		expect(empty.installedKeys).toEqual([]);

		const installDir = goalInstallDir();
		await mkdir(join(installDir, "package"), { recursive: true });
		await writeFile(
			join(installDir, "package", "index.ts"),
			"export default {};",
		);
		const populated = listMarketplaceInstalledEntries(
			{ entries: [GOAL_ENTRY] },
			{ plugins: [] } as JsonRecord,
		);
		expect(populated.installedKeys).toEqual(["plugin:goal"]);
	});

	it("does not match portable Agent Plugins to SynAI marketplace entries", () => {
		const result = listMarketplaceInstalledEntries({ entries: [GOAL_ENTRY] }, {
			plugins: [
				{
					id: "agent-plugin:goal",
					name: "goal",
					path: "/home/user/.agents/plugins/goal",
					agentPlugin: true,
				},
			],
		} as JsonRecord);

		expect(result.installedKeys).toEqual([]);
	});
});
