import { describe, expect, it } from "vitest";
import { normalizeSynAICoreStartInput } from "./start-input";
import type { SynAICoreStartInput } from "./types";

function createInput(
	overrides: Partial<SynAICoreStartInput> = {},
): SynAICoreStartInput {
	return {
		config: {
			providerId: "anthropic",
			modelId: "claude-sonnet-4-6",
			cwd: "/workspace",
			systemPrompt: "",
			enableTools: true,
			enableSpawnAgent: true,
			enableAgentTeams: true,
			extensionContext: {
				client: {
					name: "VSCode Extension",
					version: "3.99.0",
				},
			},
		},
		...overrides,
	};
}

describe("normalizeSynAICoreStartInput", () => {
	it("captures the client surface, version, and default user mode", () => {
		const normalized = normalizeSynAICoreStartInput(createInput());

		expect(normalized.source).toBe("vscode");
		expect(normalized.sessionMetadata).toMatchObject({
			sessionHistoryOrigin: {
				mode: "user",
				version: "3.99.0",
			},
		});
	});

	it("keeps an explicit session mode separate from the client", () => {
		const normalized = normalizeSynAICoreStartInput(
			createInput({ mode: "automation" }),
		);

		expect(normalized.source).toBe("vscode");
		expect(normalized.sessionMetadata).toMatchObject({
			sessionHistoryOrigin: {
				mode: "automation",
				version: "3.99.0",
			},
		});
	});
});
