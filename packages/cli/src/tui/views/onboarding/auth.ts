import {
	completeSynaiDeviceAuth,
	type ITelemetryService,
	isOAuthProvider,
	loginLocalProvider,
	type ProviderSettingsManager,
	saveLocalProviderOAuthCredentials,
	startSynaiDeviceAuth,
} from "@synai/core";
import { getSynaiEnvironmentConfig } from "@synai/shared";
import { identifyFeatureFlagsAccount } from "../../../utils/feature-flags";
import open from "../../../utils/open";

export type OnboardingOAuthProviderId = string;

export function isOnboardingOAuthProviderId(
	providerId: string,
): providerId is OnboardingOAuthProviderId {
	return isOAuthProvider(providerId);
}

function isSynaiAccountOAuthProvider(providerId: string): boolean {
	return providerId === "synai" || providerId === "synai-pass";
}

export function runOAuthAuthFlow(input: {
	providerId: OnboardingOAuthProviderId;
	providerSettingsManager: ProviderSettingsManager;
	isAborted: () => boolean;
	setStatus: (status: string) => void;
	setAuthUrl: (url: string) => void;
	setError: (error: string) => void;
	onComplete: (providerId: OnboardingOAuthProviderId) => void;
	telemetry?: ITelemetryService;
}): void {
	const existing = input.providerSettingsManager.getProviderSettings(
		input.providerId,
	);

	loginLocalProvider(
		input.providerId,
		existing,
		(url: string) => {
			input.setAuthUrl(url);
			input.setStatus("Waiting for sign-in...");
			try {
				void open(url, { wait: false }).catch(() => {
					input.setStatus("Could not open browser. Visit the URL below.");
				});
			} catch {
				input.setStatus("Could not open browser. Visit the URL below.");
			}
		},
		input.telemetry,
	)
		.then((credentials) => {
			if (input.isAborted()) return;
			if (!credentials) {
				input.setError("Failed to retrieve authentication credentials.");
				input.setStatus("Authentication failed");
				return;
			}
			saveLocalProviderOAuthCredentials(
				input.providerSettingsManager,
				input.providerId,
				existing,
				credentials,
			);
			if (isSynaiAccountOAuthProvider(input.providerId)) {
				void identifyFeatureFlagsAccount({
					id: credentials.accountId,
					email: credentials.email,
				}).catch(() => {});
			}
			input.onComplete(input.providerId);
		})
		.catch((err: unknown) => {
			if (input.isAborted()) return;
			input.setError(err instanceof Error ? err.message : String(err));
			input.setStatus("Authentication failed");
		});
}

export function runDeviceCodeAuthFlow(input: {
	providerId: OnboardingOAuthProviderId;
	providerSettingsManager: ProviderSettingsManager;
	isAborted: () => boolean;
	setUserCode: (code: string) => void;
	setVerifyUrl: (url: string) => void;
	setStatus: (status: string) => void;
	setError: (error: string) => void;
	onComplete: (providerId: OnboardingOAuthProviderId) => void;
	telemetry?: ITelemetryService;
}): void {
	const existing = input.providerSettingsManager.getProviderSettings(
		input.providerId,
	);
	const apiBaseUrl =
		existing?.baseUrl?.trim() || getSynaiEnvironmentConfig().apiBaseUrl;

	// `startSynaiDeviceAuth` only requests the user/device code pair; the
	// `auth_started` telemetry event is emitted by `completeSynaiDeviceAuth`
	// (which owns the actual login lifecycle), so we intentionally do NOT
	// pass telemetry into `startSynaiDeviceAuth` here.
	startSynaiDeviceAuth()
		.then((result) => {
			if (input.isAborted()) return;
			if (!result) {
				input.setError("Device authentication service is unavailable.");
				input.setStatus("Authentication failed");
				return;
			}
			const verifyUrl =
				result.verificationUriComplete || result.verificationUri || "https://synai.bot/auth/device";
			input.setUserCode(result.userCode || "");
			input.setVerifyUrl(verifyUrl);
			input.setStatus("Enter the code at the URL below");
			try {
				void open(verifyUrl, { wait: false }).catch(() => {
					input.setStatus("Could not open browser. Visit the URL below.");
				});
			} catch {
				input.setStatus("Could not open browser. Visit the URL below.");
			}

			completeSynaiDeviceAuth({
				deviceCode: result.deviceCode,
				expiresInSeconds: result.expiresInSeconds,
				pollIntervalSeconds: result.pollIntervalSeconds,
				apiBaseUrl,
				provider: input.providerId,
				telemetry: input.telemetry,
			})
				.then((credentials) => {
					if (input.isAborted()) return;
					if (!credentials) {
						input.setError("Failed to retrieve authentication credentials.");
						input.setStatus("Authentication failed");
						return;
					}
					saveLocalProviderOAuthCredentials(
						input.providerSettingsManager,
						input.providerId,
						existing,
						credentials,
					);
					if (isSynaiAccountOAuthProvider(input.providerId)) {
						void identifyFeatureFlagsAccount({
							id: credentials.accountId,
							email: credentials.email,
						}).catch(() => {});
					}
					input.onComplete(input.providerId);
				})
				.catch((err: unknown) => {
					if (input.isAborted()) return;
					input.setError(err instanceof Error ? err.message : String(err));
					input.setStatus("Authentication failed");
				});
		})
		.catch((err: unknown) => {
			if (input.isAborted()) return;
			input.setError(err instanceof Error ? err.message : String(err));
			input.setStatus("Could not start device code flow");
		});
}
