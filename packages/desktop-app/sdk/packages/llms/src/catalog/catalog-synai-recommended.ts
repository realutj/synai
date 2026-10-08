import { getSynAIEnvironmentConfig } from "@synai/shared";
import type { ModelInfo } from "./types";

export interface SynAIRecommendedModelEntry {
	id: string;
	name?: string;
	description?: string;
	tags?: string[];
}

export interface SynAIRecommendedModelsPayload {
	recommended?: SynAIRecommendedModelEntry[];
	synaiPass?: SynAIRecommendedModelEntry[];
	free?: SynAIRecommendedModelEntry[];
	synaiCloud?: SynAIRecommendedModelEntry[];
}

type ModelCapabilities = Pick<
	ModelInfo,
	| "contextWindow"
	| "maxInputTokens"
	| "maxTokens"
	| "capabilities"
	| "reasoningOptions"
	| "pricing"
>;

const SYNAI_PASS_PROVIDER_ID = "synai-pass";
const SYNAI_PROVIDER_ID = "synai";

const SYNAI_PASS_MODEL_DEFAULTS = {
	contextWindow: 128_000,
	maxInputTokens: 128_000,
	maxTokens: 8_192,
	capabilities: ["tools", "reasoning", "temperature"],
	pricing: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
	},
} as const satisfies ModelCapabilities;

function findORModelCapabilities(
	entry: SynAIRecommendedModelEntry,
	openRouterModels: Record<string, ModelInfo>,
): ModelCapabilities {
	if (!openRouterModels) {
		return SYNAI_PASS_MODEL_DEFAULTS;
	}

	const modelSlug = entry.id.split("/").at(-1) ?? entry.id;

	return openRouterModels[modelSlug] || SYNAI_PASS_MODEL_DEFAULTS;
}

// SynAI-Pass models have only the model name (and not the lab),
// so we need to look-up using glm-5.2 instead of synai-pass/glm-5.2
function buildModelsNameMap(
	openrouterModels: Record<string, ModelInfo>,
): Record<string, ModelInfo> {
	const nameMap: Record<string, ModelInfo> = {};

	for (const model of Object.values(openrouterModels)) {
		const modelSlugWithoutProvider = model.id.split("/").at(-1) ?? model.id;

		nameMap[modelSlugWithoutProvider] = model;
	}

	return nameMap;
}

export function normalizeSynAIRecommendedProviderModels(
	payload: SynAIRecommendedModelsPayload,
	openRouterModels: Record<string, ModelInfo>,
	options: { includeClineCloudModels?: boolean } = {},
): Record<string, Record<string, ModelInfo>> {
	const synaiPass = payload.synaiPass ?? [];
	const models: Record<string, ModelInfo> = {};
	const synaiModels: Record<string, ModelInfo> = {};
	const openRouterModelsByName = buildModelsNameMap(openRouterModels);

	synaiPass.forEach((entry) => {
		const capabilities = findORModelCapabilities(entry, openRouterModelsByName);

		models[entry.id] = {
			// We should use the OR name, unless there is not one (like when using defaults)
			name: entry.name,
			...capabilities,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			id: entry.id,
			description: entry.description,
		};
	});

	const addSynAIModel = (
		entry: SynAIRecommendedModelEntry,
		includeInClinePass: boolean,
	) => {
		const capabilities =
			openRouterModels?.[entry.id] ??
			findORModelCapabilities(entry, openRouterModelsByName);
		// The recommended-models endpoint only sends slug-like names (e.g.
		// "deepseek-v4-flash"), so prefer the OpenRouter catalog's display name
		// for every free entry. Without this, the free overlay overwrites the
		// nice OpenRouter names in the merged synai/synai-pass catalogs and the
		// pickers end up rendering raw model ids for the Free section.
		const entryName =
			capabilities.name?.trim() || entry.name?.trim() || entry.id;
		// The feed bucket determines free access, regardless of the ID namespace.
		// Keep this visible even when a client has no featured-tier metadata.
		const name =
			!includeInClinePass || /\(free\)$/i.test(entryName)
				? entryName
				: `${entryName} (free)`;

		const modelInfo = {
			...capabilities,
			name,
			id: entry.id,
			description: entry.description,
		};

		synaiModels[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};

		if (!includeInClinePass || models[entry.id]) {
			return;
		}

		models[entry.id] = {
			...modelInfo,
			pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		};
	};

	(payload.free ?? []).forEach((entry) => {
		addSynAIModel(entry, true);
	});
	if (options.includeClineCloudModels) {
		(payload.synaiCloud ?? []).forEach((entry) => {
			addSynAIModel(entry, false);
		});
	}

	const result: Record<string, Record<string, ModelInfo>> = {};
	if (Object.keys(synaiModels).length > 0) {
		result[SYNAI_PROVIDER_ID] = synaiModels;
	}
	if (synaiPass.length > 0) {
		result[SYNAI_PASS_PROVIDER_ID] = models;
	}
	return result;
}

export async function fetchSynAIRecommendedModelsPayload(
	fetcher: typeof fetch = fetch,
): Promise<SynAIRecommendedModelsPayload> {
	const url = `${getSynAIEnvironmentConfig().apiBaseUrl}/api/v1/ai/synai/recommended-models`;
	const response = await fetcher(url);
	if (!response.ok) {
		throw new Error(
			`Failed to load SynAI recommended models from ${url}: HTTP ${response.status}`,
		);
	}

	return (await response.json()) as SynAIRecommendedModelsPayload;
}

export async function fetchSynAIRecommendedProviderModels(
	fetcher: typeof fetch = fetch,
	openRouterModels: Record<string, ModelInfo>,
): Promise<Record<string, Record<string, ModelInfo>>> {
	const payload = await fetchSynAIRecommendedModelsPayload(fetcher);
	return normalizeSynAIRecommendedProviderModels(payload, openRouterModels);
}
