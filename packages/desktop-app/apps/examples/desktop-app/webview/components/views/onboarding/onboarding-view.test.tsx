// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountProvider } from "@/contexts/account-context";
import {
	MODEL_SELECTION_STORAGE_KEY,
	parseModelSelectionStorage,
} from "@/lib/model-selection";
import type { Provider } from "@/lib/provider-schema";
import {
	GITHUB_ONBOARDING_FEATURE_FLAG,
	OnboardingView,
	sortProvidersForApiKeySetup,
} from "./onboarding-view";

const { invoke, openExternalUrl } = vi.hoisted(() => ({
	invoke: vi.fn(),
	openExternalUrl: vi.fn(),
}));
vi.mock("@/lib/desktop-client", () => ({
	desktopClient: { invoke, subscribe: vi.fn(() => () => {}) },
	openExternalUrl,
}));

const GITHUB_STEP_ENABLED_FLAGS = {
	flags: { [GITHUB_ONBOARDING_FEATURE_FLAG]: true },
};

class StorageStub implements Storage {
	readonly #values = new Map<string, string>();
	get length() {
		return this.#values.size;
	}
	clear() {
		this.#values.clear();
	}
	getItem(key: string) {
		return this.#values.get(key) ?? null;
	}
	key(index: number) {
		return [...this.#values.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.#values.delete(key);
	}
	setItem(key: string, value: string) {
		this.#values.set(key, value);
	}
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
	return {
		id: "anthropic",
		name: "Anthropic",
		models: 4,
		color: "#000",
		letter: "A",
		enabled: false,
		...overrides,
	};
}

describe("sortProvidersForApiKeySetup", () => {
	it("drops OAuth-managed providers and ranks popular ones first", () => {
		const sorted = sortProvidersForApiKeySetup([
			makeProvider({ id: "zai", name: "Z AI" }),
			makeProvider({ id: "synai", name: "SynAI" }),
			makeProvider({ id: "openai-codex", name: "ChatGPT" }),
			makeProvider({ id: "openrouter", name: "OpenRouter" }),
			makeProvider({ id: "anthropic", name: "Anthropic" }),
			makeProvider({ id: "baseten", name: "Baseten" }),
		]);
		expect(sorted.map((provider) => provider.id)).toEqual([
			"openrouter",
			"anthropic",
			"baseten",
			"zai",
		]);
	});

	it("drops providers the API-key form cannot fully configure", () => {
		const apiKeyField = {
			path: "apiKey",
			label: "API Key",
			type: "password" as const,
		};
		const sorted = sortProvidersForApiKeySetup([
			makeProvider({
				id: "vertex",
				name: "Google Vertex AI",
				configFields: [
					{ path: "gcp.projectId", label: "Project", type: "text" },
					apiKeyField,
				],
			}),
			makeProvider({
				id: "bedrock",
				name: "AWS Bedrock",
				configFields: [
					{ path: "aws.region", label: "Region", type: "text" },
					apiKeyField,
				],
			}),
			makeProvider({
				id: "anthropic",
				name: "Anthropic",
				configFields: [apiKeyField],
			}),
		]);
		expect(sorted.map((provider) => provider.id)).toEqual(["anthropic"]);
	});
});

describe("OnboardingView", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: new StorageStub(),
		});
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		window.localStorage.clear();
		invoke.mockReset();
		invoke.mockImplementation(async (command: string) => {
			if (command === "list_provider_catalog") {
				return {
					providers: [
						makeProvider({ id: "openrouter", name: "OpenRouter" }),
						makeProvider({ id: "anthropic", name: "Anthropic" }),
					],
					settingsPath: "/tmp/providers.json",
				};
			}
			if (command === "get_feature_flags") {
				return GITHUB_STEP_ENABLED_FLAGS;
			}
			return {};
		});
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		container.remove();
	});

	function buttonByText(text: string): HTMLButtonElement {
		const button = Array.from(container.querySelectorAll("button")).find(
			(candidate) => candidate.textContent?.trim() === text,
		);
		if (!button) {
			throw new Error(`button not found: ${text}`);
		}
		return button;
	}

	async function render(onComplete = vi.fn()) {
		await act(async () => {
			root.render(
				<AccountProvider>
					<OnboardingView onComplete={onComplete} />
				</AccountProvider>,
			);
		});
		return onComplete;
	}

	it("walks from welcome to the connect step without Sign in with SynAI", async () => {
		await render();

		expect(container.textContent).toContain("Build software your way");
		const welcomeBot = container.querySelector(
			'[data-welcome-hero-variant="bot-only"]',
		);
		expect(welcomeBot).not.toBeNull();

		await act(async () => {
			buttonByText("Get started").click();
		});

		expect(container.textContent).toContain("Set up SynAI");

		// "Sign in with SynAI" option must NOT exist
		expect(container.querySelector('[data-onboarding-option="synai"]')).toBeNull();
		expect(container.textContent).not.toContain("Sign in with SynAI");
		expect(container.textContent).not.toContain("Subscribe to SynAIPass");
		expect(container.textContent).not.toContain("Recommended");

		// API Key option is directly shown and selected
		const apiKeyOption = container.querySelector(
			'[data-onboarding-option="api-key"]',
		);
		expect(apiKeyOption).not.toBeNull();
		expect(apiKeyOption?.getAttribute("data-selected")).toBe("true");

		const apiKeyForm = container.querySelector(
			"[data-onboarding-api-key-form]",
		);
		expect(apiKeyForm).not.toBeNull();
	});

	it("completes without connecting when skipped", async () => {
		const onComplete = await render();
		await act(async () => {
			buttonByText("Get started").click();
		});
		await act(async () => {
			buttonByText("Skip").click();
		});
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("connects with an API key and completes onboarding", async () => {
		const onComplete = await render();
		await act(async () => {
			buttonByText("Get started").click();
		});

		const keyInput = container.querySelector<HTMLInputElement>(
			'input[aria-label="API key"]',
		);
		expect(keyInput).not.toBeNull();

		invoke.mockClear();
		invoke.mockImplementation(async (command: string) => {
			if (command === "save_provider_settings") {
				return { providerId: "openrouter", enabled: true };
			}
			return {};
		});

		await act(async () => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				"value",
			)?.set;
			setter?.call(keyInput, "sk-test-key-123");
			keyInput?.dispatchEvent(new Event("input", { bubbles: true }));
		});

		await act(async () => {
			buttonByText("Connect").click();
		});

		expect(invoke).toHaveBeenCalledWith("save_provider_settings", {
			provider: "openrouter",
			enabled: true,
			api_key: "sk-test-key-123",
		});

		// Advances to done
		expect(container.textContent).toContain("You're all set");
		expect(container.textContent).toContain("OpenRouter is connected");
		expect(
			parseModelSelectionStorage(
				window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY),
			).lastProvider,
		).toBe("openrouter");

		await act(async () => {
			buttonByText("Start building").click();
		});
		expect(onComplete).toHaveBeenCalledTimes(1);
	});
});
