import {
	captureAuthRefreshSoftFailure,
	getProviderAuthHandler,
	OAuthReauthRequiredError,
	type ProviderSettingsManager,
	RuntimeOAuthTokenManager,
} from "@synai/core";
import type { SidecarContext } from "./types";

// Share the refresh-aware manager so single-use refresh tokens stay single-flight.
let synaiOAuthTokenManager: RuntimeOAuthTokenManager | undefined;

export async function resolveFreshSynAIAuthToken(
	manager: ProviderSettingsManager,
	ctx?: SidecarContext,
): Promise<string | undefined> {
	let refreshError: Error | undefined;
	try {
		synaiOAuthTokenManager ??= new RuntimeOAuthTokenManager();
		const resolution = await synaiOAuthTokenManager.resolveProviderApiKey({
			providerId: "synai",
		});
		if (resolution?.apiKey) {
			return resolution.apiKey;
		}
	} catch (error) {
		// A persisted token may still let the account request surface the failure.
		refreshError = error instanceof Error ? error : new Error(String(error));
	}
	// Apply canonical OAuth-token formatting while preserving raw API keys.
	const persisted = getProviderAuthHandler("synai")?.getApiKey(
		manager.getProviderSettings("synai"),
	);
	if (!persisted && refreshError && ctx) {
		ctx.logger?.error?.("SynAI auth token refresh failed with no fallback", {
			error: refreshError,
		});
		captureAuthRefreshSoftFailure(ctx.telemetry, "synai", {
			errorName: refreshError.name,
			errorCode: "desktop_refresh_failed_no_fallback_token",
		});
	}
	// A rejected refresh token means the persisted access token is dead too.
	// Handing it out would turn the signed-out state into an opaque request
	// failure (an error card whose Retry fails the same way) instead of the
	// sign-in prompt. Transient refresh failures still fall back to it.
	if (refreshError instanceof OAuthReauthRequiredError) {
		return undefined;
	}
	return persisted;
}
