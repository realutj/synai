import {
	listLocalProviders as internalListLocalProviders,
	type ProviderSettingsManager,
} from "@synai/core";

export async function listLocalProviders(
	manager: ProviderSettingsManager,
): ReturnType<typeof internalListLocalProviders> {
	const res = await internalListLocalProviders(manager, {
		isClinePassEnabled: false,
	});
	return {
		...res,
		providers: res.providers
			.filter((p) => p.id !== "cline-pass" && p.id !== "cline")
			.map((p) => {
				const name = p.name.replaceAll("Cline", "SynAI").replaceAll("cline", "synai");
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
