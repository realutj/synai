import {
	listLocalProviders as internalListLocalProviders,
	type ProviderSettingsManager,
} from "@synai/core";

export async function listLocalProviders(
	manager: ProviderSettingsManager,
): ReturnType<typeof internalListLocalProviders> {
	const res = await internalListLocalProviders(manager, {
		isSynAIPassEnabled: true,
	});
	return {
		...res,
		providers: res.providers
			.filter((p) => p.id !== "synai-pass" && p.id !== "synai")
			.map((p) => {
				const name = p.name.replaceAll("Synai", "SynAI").replaceAll("synai", "synai");
				const isTopPopular =
					p.id === "openrouter" ||
					p.id === "anthropic" ||
					p.id === "openai" ||
					p.id === "deepseek";
				const capabilities = isTopPopular
					? Array.from(new Set([...(p.capabilities ?? []), "popular"]))
					: p.capabilities;
				return {
					...p,
					name,
					capabilities,
				};
			}),
	};
}
