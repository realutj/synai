import { join } from "node:path";
import type { ProviderSettings } from "@synai/core";
import { describe, expect, it } from "vitest";
import { isProviderConfigured } from "./provider-auth";

describe("isProviderConfigured", () => {
	it("returns false when settings is undefined", () => {
		expect(isProviderConfigured("anthropic", undefined)).toBe(false);
	});

	it("returns false when api-key settings have no useful fields", () => {
		expect(
			isProviderConfigured("anthropic", {
				provider: "anthropic",
			} satisfies ProviderSettings),
		).toBe(false);
	});

	it("treats any persisted api key as configured", () => {
		expect(
			isProviderConfigured("anthropic", {
				provider: "anthropic",
				apiKey: "sk-test",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats a persisted base URL as configured", () => {
		expect(
			isProviderConfigured("ollama", {
				provider: "ollama",
				baseUrl: "http://localhost:11434/v1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats a persisted model id as configured", () => {
		expect(
			isProviderConfigured("ollama", {
				provider: "ollama",
				model: "llama3.1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats lmstudio with model + base url as configured", () => {
		expect(
			isProviderConfigured("lmstudio", {
				provider: "lmstudio",
				model: "qwen2",
				baseUrl: "http://localhost:1234/v1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("requires an OAuth access token for synai", () => {
		expect(
			isProviderConfigured("synai", {
				provider: "synai",
			} satisfies ProviderSettings),
		).toBe(false);

		expect(
			isProviderConfigured("synai", {
				provider: "synai",
				auth: { accessToken: "workos:abc" },
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats openai-codex with access token as configured", () => {
		expect(
			isProviderConfigured("openai-codex", {
				provider: "openai-codex",
				auth: { accessToken: "eyJhbGciOi..." },
			} as any),
		).toBe(true);

		expect(
			isProviderConfigured("openai-codex", {
				provider: "openai-codex",
				auth: { access: "eyJhbGciOi..." },
			} as any),
		).toBe(true);
	});
});

describe("live model discovery & catalog resolution", () => {
	it("fetches and resolves live models dynamically from source", async () => {
		const { refreshProviderModelsFromSource, resolveProviderConfig, getLocalProviderModels } = await import("@synai/core");
		const models = await refreshProviderModelsFromSource(undefined, "openai");
		expect(Array.isArray(models)).toBe(true);
		expect(models.length).toBeGreaterThan(0);
		expect(models.some((m: any) => m.id === "gpt-4o")).toBe(true);

		const localList = getLocalProviderModels("openai");
		expect(localList.length).toBeGreaterThan(0);
		expect(localList[0].contextWindow).toBeGreaterThan(0);

		const resolved = resolveProviderConfig("openai");
		expect(resolved).toBeDefined();
		expect(resolved.knownModels).toBeDefined();
		expect(resolved.knownModels["gpt-4o"]).toBeDefined();
		expect(resolved.knownModels["gpt-4o"].capabilities).toContain("tools");
	});

	it("intelligently resolves openai-codex models with gpt-5.6-luna", async () => {
		const { resolveProviderConfig } = await import("@synai/core");
		const resolved = resolveProviderConfig("openai-codex");
		expect(resolved).toBeDefined();
		expect(resolved.knownModels["gpt-5.6-luna"]).toBeDefined();
		expect(resolved.knownModels["gpt-5.6-luna"].supportsReasoning).toBe(true);
		expect(resolved.knownModels["gpt-5.6-luna"].capabilities).toContain("reasoning");
	});

	it("intelligently falls back from unconfigured provider to authenticated provider", async () => {
		const { ProviderSettingsManager } = await import("@synai/core");
		const tmpFile = join(process.env.TEMP || "C:\\temp", `test-providers-${Date.now()}.json`);
		const manager = new ProviderSettingsManager({ filePath: tmpFile });
		manager.saveProviderSettings(
			{ provider: "openai-codex", auth: { accessToken: "token-123" } },
			{ setLastUsed: false }
		);
		manager.saveProviderSettings(
			{ provider: "anthropic" },
			{ setLastUsed: true }
		);
		const lastSettings = manager.getLastUsedProviderSettings();
		expect(lastSettings.provider).toBe("openai-codex");
		expect(lastSettings.auth.accessToken).toBe("token-123");
	});
});

