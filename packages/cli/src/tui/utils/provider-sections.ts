export const POPULAR_PROVIDER_SECTION = "Popular";
export const OTHER_PROVIDER_SECTION = "Other";

export type ProviderSection =
	| typeof POPULAR_PROVIDER_SECTION
	| typeof OTHER_PROVIDER_SECTION;

export interface ProviderSectionItem {
	id?: string;
	key?: string;
	capabilities?: readonly string[] | null;
}

const POPULAR_IDS = new Set([
	"openrouter",
	"anthropic",
	"openai",
	"deepseek",
	"gemini",
	"ollama",
]);

export function isPopularProvider(provider: ProviderSectionItem): boolean {
	const id = provider.id ?? provider.key;
	if (id && POPULAR_IDS.has(id.toLowerCase())) {
		return true;
	}
	return provider.capabilities?.includes("popular") ?? false;
}

export function getProviderSection(
	provider: ProviderSectionItem,
): ProviderSection {
	return isPopularProvider(provider)
		? POPULAR_PROVIDER_SECTION
		: OTHER_PROVIDER_SECTION;
}
