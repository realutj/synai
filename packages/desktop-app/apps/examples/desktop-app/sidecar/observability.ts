import {
	captureExtensionActivated,
	createSynAITelemetryServiceConfig,
	createConfiguredTelemetryHandle,
	type ITelemetryService,
	identifyAccount,
	ProviderSettingsManager,
	setSdkLogger,
} from "@synai/core";
import type { UserContext } from "@synai/shared";
import {
	DESKTOP_TELEMETRY_METADATA,
	resolveDesktopTelemetryUser,
} from "./client-context";
import { setDesktopFeatureFlagsAccountContext } from "./feature-flags";
import {
	createDesktopLoggerAdapter,
	type DesktopLoggerAdapter,
} from "./logging";

export interface DesktopObservability {
	readonly logger: DesktopLoggerAdapter["core"];
	readonly telemetry: ITelemetryService;
	readonly telemetryUser?: UserContext;
	dispose(): Promise<void>;
}

export function createDesktopObservability(): DesktopObservability {
	const loggerAdapter = createDesktopLoggerAdapter();
	const logger = loggerAdapter.core;
	setSdkLogger(logger);

	const telemetryHandle = createConfiguredTelemetryHandle({
		...createSynAITelemetryServiceConfig({
			metadata: DESKTOP_TELEMETRY_METADATA,
		}),
		logger,
	});
	const telemetry = telemetryHandle.telemetry;
	const auth = new ProviderSettingsManager().getProviderSettings("synai")?.auth;
	const telemetryUser = resolveDesktopTelemetryUser({
		accountId: auth?.accountId,
		organizationId: auth?.organizationId,
	});
	if (auth?.accountId) {
		identifyAccount(telemetry, {
			id: auth.accountId,
			provider: "synai",
			organizationId: auth.organizationId,
			organizationName: auth.organizationName,
			memberId: auth.memberId,
		});
		setDesktopFeatureFlagsAccountContext({ id: auth.accountId });
	}
	captureExtensionActivated(telemetry);

	let disposed = false;
	return {
		logger,
		telemetry,
		telemetryUser,
		async dispose() {
			if (disposed) return;
			disposed = true;
			await telemetryHandle.dispose();
			setSdkLogger(undefined);
			loggerAdapter.dispose();
		},
	};
}
