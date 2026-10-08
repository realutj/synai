import { join } from "node:path";
import { registerDisposable } from "@synai/shared";
import { resolveSynaiDataDir } from "@synai/shared/storage";

export interface FeatureFlagsContext {
	clientName?: string;
	distinctId?: string;
	userId?: string;
	email?: string;
	[key: string]: unknown;
}

export class FeatureFlagsService {
	private context: FeatureFlagsContext;
	constructor(options?: any) {
		this.context = options?.context ?? { clientName: "synai-cli" };
	}
	async poll(): Promise<void> {}
	async dispose(): Promise<void> {}
	setContext(context: FeatureFlagsContext): void {
		this.context = { ...this.context, ...context };
	}
	getContext(): FeatureFlagsContext {
		return this.context;
	}
	isEnabled(_key: string, defaultValue = false): boolean {
		return defaultValue;
	}
	getVariant(_key: string, defaultValue?: string): string | undefined {
		return defaultValue;
	}
}

let cliFeatureFlagsContext: FeatureFlagsContext = { clientName: "synai-cli" };
let cliFeatureFlagsService: FeatureFlagsService | undefined;

const CLI_FEATURE_FLAGS_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function resolveCliFeatureFlagsCachePath(): string {
	return join(resolveSynaiDataDir(), "cache", "feature-flags.json");
}

function ensureCliDistinctId(): string {
	const distinctId = cliFeatureFlagsContext.distinctId?.trim();
	if (distinctId) {
		return distinctId;
	}
	const resolved = "synai-user";
	cliFeatureFlagsContext.distinctId = resolved;
	return resolved;
}

export function getCliFeatureFlagsContext(): FeatureFlagsContext {
	ensureCliDistinctId();
	return { ...cliFeatureFlagsContext };
}

export function getCliFeatureFlagsService(options?: {
	logger?: any;
	telemetry?: any;
}): FeatureFlagsService {
	if (!cliFeatureFlagsService) {
		cliFeatureFlagsService = new FeatureFlagsService({
			telemetry: options?.telemetry,
			logger: options?.logger,
			context: getCliFeatureFlagsContext(),
			cacheFilePath: resolveCliFeatureFlagsCachePath(),
			persistentCacheMaxAgeMs: CLI_FEATURE_FLAGS_CACHE_MAX_AGE_MS,
		});
		registerDisposable(disposeCliFeatureFlagsService);
	}

	return cliFeatureFlagsService;
}

export function refreshCliFeatureFlagsInBackground(logger?: any): void {
	const service = getCliFeatureFlagsService({ logger });
	void service.poll().catch((error) => {
		logger?.error?.("Error refreshing CLI feature flags", { error });
	});
}

export async function disposeCliFeatureFlagsService(): Promise<void> {
	if (!cliFeatureFlagsService) {
		return;
	}

	const current = cliFeatureFlagsService;
	cliFeatureFlagsService = undefined;
	await current.dispose();
}

export function setCliFeatureFlagsAccountContext(account: {
	id?: string;
	email?: string;
}): void {
	const accountId = account.id?.trim();
	cliFeatureFlagsContext = {
		...cliFeatureFlagsContext,
		...(accountId ? { distinctId: accountId, userId: accountId } : {}),
		...(account.email?.trim() ? { email: account.email.trim() } : {}),
	};
	cliFeatureFlagsService?.setContext(getCliFeatureFlagsContext());
}

export async function identifyFeatureFlagsAccount(
	account: { id?: string; email?: string },
	logger?: any,
): Promise<void> {
	setCliFeatureFlagsAccountContext(account);

	if (!cliFeatureFlagsService) {
		return;
	}

	try {
		await cliFeatureFlagsService.poll();
	} catch (error) {
		logger?.error?.("Error polling CLI feature flags", { error });
	}
}
