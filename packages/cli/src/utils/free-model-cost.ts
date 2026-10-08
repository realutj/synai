import type { AgentEvent } from "@synai/core";
import { getSynaiEnvironmentConfig } from "@synai/shared";
import type { Config } from "./types";

const SYNAI_RECOMMENDED_MODELS_TIMEOUT_MS = 5_000;
const freeModelIdsByBaseUrl = new Map<
	string,
	Promise<readonly string[] | undefined>
>();

function normalizeModelId(modelId: string | undefined): string {
	return modelId?.trim().toLowerCase() ?? "";
}

function modelIdsMatch(selectedModelId: string, freeModelId: string): boolean {
	const selected = normalizeModelId(selectedModelId);
	const free = normalizeModelId(freeModelId);
	if (!selected || !free) return false;
	return selected === free;
}

function resolveSynaiRecommendedModelsUrl(baseUrl: string): string {
	const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
	const apiBaseUrl = normalizedBaseUrl.endsWith("/api/v1")
		? normalizedBaseUrl.slice(0, -"/api/v1".length)
		: normalizedBaseUrl;
	return `${apiBaseUrl}/api/v1/ai/SynAI/recommended-models`;
}

async function fetchSynaiFreeModelIds(
	baseUrl: string,
): Promise<readonly string[] | undefined> {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		SYNAI_RECOMMENDED_MODELS_TIMEOUT_MS,
	);
	try {
		const response = await fetch(resolveSynaiRecommendedModelsUrl(baseUrl), {
			signal: controller.signal,
		});
		if (!response.ok) return undefined;
		const json = (await response.json()) as { free?: unknown };
		return Array.isArray(json.free)
			? json.free
					.map((model) =>
						model && typeof model === "object"
							? (model as Record<string, unknown>).id
							: undefined,
					)
					.filter((id): id is string => typeof id === "string" && id.length > 0)
			: [];
	} catch {
		return undefined;
	} finally {
		clearTimeout(timeout);
	}
}

function getSynaiFreeModelIds(baseUrl: string): Promise<readonly string[]> {
	const cacheKey = baseUrl.trim();
	let cached = freeModelIdsByBaseUrl.get(cacheKey);
	if (!cached) {
		cached = fetchSynaiFreeModelIds(cacheKey).then((ids) => {
			if (!ids) freeModelIdsByBaseUrl.delete(cacheKey);
			return ids;
		});
		freeModelIdsByBaseUrl.set(cacheKey, cached);
	}
	return cached.then((ids) => ids ?? []);
}

export async function shouldZeroSynaiFreeModelCost(
	config: Pick<Config, "providerId" | "modelId" | "baseUrl">,
): Promise<boolean> {
	// Free models are also selectable on SynaiPass - they ride usage billing at $0
	if (config.providerId !== "synai" && config.providerId !== "synai-pass")
		return false;
	const modelId = normalizeModelId(config.modelId);
	if (!modelId) return false;

	const baseUrl =
		config.baseUrl?.trim() || getSynaiEnvironmentConfig().apiBaseUrl;
	const freeModelIds = await getSynaiFreeModelIds(baseUrl);
	return freeModelIds.some((freeModelId) =>
		modelIdsMatch(modelId, freeModelId),
	);
}

export function zeroCliUsageCost<T extends { totalCost?: number } | undefined>(
	usage: T,
	shouldZeroCost: boolean,
): T {
	if (
		!shouldZeroCost ||
		!usage ||
		typeof usage.totalCost !== "number" ||
		usage.totalCost === 0
	) {
		return usage;
	}
	return { ...usage, totalCost: 0 } as T;
}

export function zeroCliAgentEventCost(
	event: AgentEvent,
	shouldZeroCost: boolean,
): AgentEvent {
	if (!shouldZeroCost) return event;
	if (event.type === "done" && event.usage) {
		return {
			...event,
			usage: zeroCliUsageCost(event.usage, true),
		};
	}
	if (event.type !== "usage") return event;
	const next = { ...event } as Record<string, unknown>;
	if (typeof next.cost === "number") next.cost = 0;
	if (typeof next.totalCost === "number") next.totalCost = 0;
	return next as unknown as AgentEvent;
}

export function clearSynaiFreeModelCostCache(): void {
	freeModelIdsByBaseUrl.clear();
}


