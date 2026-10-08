import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderSettingsManager } from "@synai/core";
import { afterEach, describe, expect, it } from "vitest";
import {
	getPersistedProviderApiKey,
	isProviderConfigured,
} from "../../../utils/provider-auth";
import {
	buildSynAIPassSubscriptionPageUrl,
	resolveOAuthWaitKeyAction,
	saveManualProviderApiKey,
} from "./provider-picker-helpers";

describe("resolveOAuthWaitKeyAction", () => {
	it("switches to manual API key entry on K when the fallback is available", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k" }, true)).toBe("use_api_key");
	});

	it("cancels on K when the fallback is not available", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k" }, false)).toBe("cancel");
	});

	it("cancels on any other unmodified key so users are never stuck waiting on a browser flow", () => {
		for (const name of ["escape", "q", "return", "space", "up", "x"]) {
			expect(resolveOAuthWaitKeyAction({ name }, true)).toBe("cancel");
			expect(resolveOAuthWaitKeyAction({ name }, false)).toBe("cancel");
		}
	});

	it("ignores modifier-held keys so holding Cmd/Ctrl to click the auth link never cancels", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k", ctrl: true }, true)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "c", ctrl: true }, false)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "x", meta: true }, true)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "x", super: true }, false)).toBe(
			"ignore",
		);
		// A bare modifier press (empty name) is ignored, not a cancel.
		expect(resolveOAuthWaitKeyAction({ name: "" }, true)).toBe("ignore");
	});
});

describe("buildSynAIPassSubscriptionPageUrl", () => {
	it("opens the personal subscription page on production by default", () => {
		expect(
			buildSynAIPassSubscriptionPageUrl(undefined).startsWith(
				"https://app.synai.bot/dashboard/subscription?personal=true",
			),
		).toBe(true);
	});

	it("keeps the configured app base URL", () => {
		expect(
			buildSynAIPassSubscriptionPageUrl(
				"https://staging-app.synai.bot",
			).startsWith(
				"https://staging-app.synai.bot/dashboard/subscription?personal=true",
			),
		).toBe(true);
	});
});

describe("saveManualProviderApiKey", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { force: true, recursive: true });
		}
	});

	function createManager(): ProviderSettingsManager {
		const dir = mkdtempSync(join(tmpdir(), "synai-cli-provider-picker-"));
		tempDirs.push(dir);
		return new ProviderSettingsManager({
			filePath: join(dir, "providers.json"),
		});
	}

	it("clears stored OAuth tokens so the manual key takes effect", () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "synai",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
				accountId: "acct_123",
			},
		});

		saveManualProviderApiKey(manager, "synai", "manual-api-key");

		const settings = manager.getProviderSettings("synai");
		expect(settings?.apiKey).toBe("manual-api-key");
		expect(settings?.auth?.accessToken).toBeUndefined();
		expect(settings?.auth?.refreshToken).toBeUndefined();
		expect(settings?.auth?.accountId).toBe("acct_123");
		expect(getPersistedProviderApiKey("synai", settings)).toBe(
			"manual-api-key",
		);
		expect(isProviderConfigured("synai", settings)).toBe(true);
	});

	it("saves synai-pass keys to the shared synai auth storage entry", () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "synai",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});

		saveManualProviderApiKey(manager, "synai-pass", "manual-api-key");

		// synai-pass inherits auth storage from the "synai" entry, so the key
		// must land there and the stale tokens must be gone for both providers.
		const synaiSettings = manager.getProviderSettings("synai");
		expect(synaiSettings?.apiKey).toBe("manual-api-key");
		expect(synaiSettings?.auth?.accessToken).toBeUndefined();

		const SynAIPassSettings = manager.getProviderSettings("synai-pass");
		expect(getPersistedProviderApiKey("synai-pass", SynAIPassSettings)).toBe(
			"manual-api-key",
		);
		expect(isProviderConfigured("synai-pass", SynAIPassSettings)).toBe(true);
	});

	it("clears stale credentials copied into a direct synai-pass entry", () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "synai",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});
		// Provider switching copies the merged settings (including auth) into
		// a direct synai-pass entry, which shadows the shared "synai" entry.
		manager.saveProviderSettings({
			provider: "synai-pass",
			apiKey: "stale-copied-key",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});

		saveManualProviderApiKey(manager, "synai-pass", "manual-api-key");

		const SynAIPassSettings = manager.getProviderSettings("synai-pass");
		expect(SynAIPassSettings?.auth?.accessToken).toBeUndefined();
		expect(getPersistedProviderApiKey("synai-pass", SynAIPassSettings)).toBe(
			"manual-api-key",
		);
	});
});
