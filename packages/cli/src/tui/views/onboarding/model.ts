import type {
	ChatModelModalities,
	ModelModality,
	ModelOperation,
} from "@synai/shared";
import { isChatProviderModel } from "../../../utils/chat-models";
import type {
	LocalCliStatus,
	ProviderLocalCli,
} from "../../../utils/local-cli";
import {
	isLocalAuthProvider,
	isOAuthProvider,
} from "../../../utils/provider-auth";

export type OnboardingStep =
	| "menu"
	| "oauth_pending"
	| "device_code"
	| "byo_provider"
	| "byo_apikey"
	| "local_cli_setup"
	| "synai_pass_subscription"
	| "synai_model"
	| "model_picker"
	| "custom_model_id"
	| "thinking_level"
	| "done";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "xhigh";
export type ReasoningEffort = Exclude<ThinkingLevel, "none">;

export const THINKING_LEVELS: {
	value: ThinkingLevel;
	label: string;
	desc: string;
}[] = [
	{ value: "none", label: "Off", desc: "No extended thinking" },
	{ value: "low", label: "Low", desc: "Minimal reasoning" },
	{ value: "medium", label: "Medium", desc: "Balanced reasoning" },
	{ value: "high", label: "High", desc: "Deep reasoning" },
	{ value: "xhigh", label: "Extra High", desc: "Maximum reasoning" },
];

export const DEFAULT_THINKING_LEVEL_INDEX = THINKING_LEVELS.findIndex(
	(l) => l.value === "medium",
);

export interface MenuOption {
	label: string;
	value: string;
	detail: string;
	icon: string;
}

export type SynaiPassSubscriptionAction =
	| "subscribe"
	| "refresh"
	| "skip"
	| "back";

export interface SynaiPassSubscriptionOption {
	value: SynaiPassSubscriptionAction;
	label: string;
}

export const MAIN_MENU: MenuOption[] = [
	{
		label: "OpenRouter Engine (Recommended)",
		value: "openrouter",
		detail: "Unified gateway to frontier coding models (Claude, GPT, DeepSeek)",
		icon: "*",
	},
	{
		label: "Anthropic Claude",
		value: "anthropic",
		detail: "Direct API integration for Claude 3.7 Sonnet & Opus",
		icon: "*",
	},
	{
		label: "OpenAI Platform",
		value: "openai",
		detail: "Direct API integration for GPT-4o, o1, and o3-mini",
		icon: "*",
	},
	{
		label: "ChatGPT OAuth",
		value: "openai-codex",
		detail: "Authenticate using your ChatGPT Plus account",
		icon: "o",
	},
	{
		label: "Custom / Local Provider",
		value: "byo",
		detail: "Connect custom API key or local model endpoint (Ollama, LM Studio)",
		icon: "[+]",
	},
];

/**
 * Which setup flow a provider needs. Keyed off how the provider authenticates,
 * so every caller routes the same way.
 */
export type ProviderSetupRoute = "oauth" | "local_cli" | "api_key";

export function resolveProviderSetupRoute(
	providerId: string,
): ProviderSetupRoute {
	if (isOAuthProvider(providerId)) return "oauth";
	if (isLocalAuthProvider(providerId)) return "local_cli";
	return "api_key";
}

/**
 * Whether the local-CLI setup screen lets the user connect.
 */
export function canContinueLocalCliSetup(
	_cli: ProviderLocalCli | undefined,
	_status: LocalCliStatus | undefined,
): boolean {
	// The probe only looks on PATH, while the runtime also accepts an explicit
	// pathToClaudeCodeExecutable and a bundled platform binary, and Codex falls
	// back through `npx`. A PATH miss therefore means "not on PATH", not
	// "unusable", so the screen reports it without blocking - a provider that
	// really cannot start says so on the first turn, in its own words.
	return true;
}

export function getMainMenuOptions(options?: {
	isSynaiPassEnabled?: boolean;
	isSynAIPassEnabled?: boolean;
}): MenuOption[] {
	const passEnabled = Boolean(
		options?.isSynaiPassEnabled || options?.isSynAIPassEnabled,
	);
	const list = MAIN_MENU.filter((option) => option.value !== "synai-pass");
	if (passEnabled) {
		list.push({
			label: "SynAIPass Subscription",
			value: "synai-pass",
			detail: "Access frontier LLMs via SynAIPass membership",
			icon: "*",
		});
	}
	return list;
}

export const SYNAI_PASS_SUBSCRIPTION_OPTIONS: SynaiPassSubscriptionOption[] = [
	{
		value: "subscribe",
		label: "Subscribe to plan",
	},
	{
		value: "refresh",
		label: "Re-check subscription status",
	},
	{
		value: "skip",
		label: "Skip for now",
	},
	{
		value: "back",
		label: "Go back",
	},
];

export interface OnboardingResult {
	providerId: string;
	modelId: string;
	apiKey?: string;
	thinking?: boolean;
	reasoningEffort?: ReasoningEffort;
}

export interface ProviderEntry {
	id: string;
	name: string;
	isOAuth: boolean;
	isLocalAuth: boolean;
	hasAuth: boolean;
	capabilities?: readonly string[];
	models: number | null;
	defaultModelId?: string;
}

export interface ModelEntry {
	id: string;
	name: string;
	supportsReasoning: boolean;
}

export type SynaiPassSubscriptionStatus =
	| "loading"
	| "subscribed"
	| "unsubscribed"
	| "error";

export interface ProviderCatalogItem {
	id: string;
	name: string;
	apiKey?: string;
	oauthAccessTokenPresent?: boolean;
	capabilities?: readonly string[];
	models: number | null;
	defaultModelId?: string;
}

export interface ProviderModelItem {
	id: string;
	name?: string;
	supportsReasoning?: boolean;
	operation?: ModelOperation;
	inputModalities?: ModelModality[];
	outputModalities?: ModelModality[];
}

export interface KnownModelInfo {
	name?: string;
	capabilities?: string[];
	operation?: ModelOperation;
	modalities?: ChatModelModalities;
}

export function toProviderEntry(provider: ProviderCatalogItem): ProviderEntry {
	return {
		id: provider.id,
		name: provider.name,
		isOAuth: isOAuthProvider(provider.id),
		isLocalAuth: isLocalAuthProvider(provider.id),
		hasAuth:
			Boolean(provider.apiKey) || provider.oauthAccessTokenPresent === true,
		...(provider.capabilities ? { capabilities: provider.capabilities } : {}),
		models: provider.models,
		defaultModelId: provider.defaultModelId,
	};
}

export function toModelEntry(model: ProviderModelItem): ModelEntry {
	return {
		id: model.id,
		name: model.name || model.id,
		supportsReasoning: model.supportsReasoning === true,
	};
}

export function toModelEntriesFromKnownModels(
	knownModels: Record<string, KnownModelInfo> | undefined,
): ModelEntry[] {
	if (!knownModels) return [];
	return Object.entries(knownModels)
		.filter(([, info]) =>
			isChatProviderModel({
				operation: info.operation,
				inputModalities: info.modalities?.input,
				outputModalities: info.modalities?.output,
			}),
		)
		.map(([id, info]) => ({
			id,
			name: info.name || id,
			supportsReasoning: info.capabilities?.includes("reasoning") ?? false,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getOAuthProviderLabel(providerId: string): string {
	if (providerId === "openai-codex") {
		return "ChatGPT";
	}
	if (providerId === "synai-pass") {
		return "SynAIPass";
	}
	return providerId;
}

export function shouldUseFeaturedSynaiModelPicker(providerId: string): boolean {
	return providerId === "synai" || providerId === "synai-pass";
}
