import {
	type SynaiAccountBalance,
	type SynaiAccountOrganization,
	type SynaiAccountOrganizationBalance,
	SynaiAccountService,
	type SynaiAccountUser,
	type SynaiSubscriptionPlan,
	formatProviderOAuthApiKey,
	getPersistedProviderApiKey,
	getProviderOAuthCredentialsFromSettings,
	getValidSynaiCredentials,
	type ProviderSettings,
	ProviderSettingsManager,
	persistSynaiAccountTelemetryIdentity,
	resolveSynaiAccountTelemetryIdentity,
	saveLocalProviderOAuthCredentials,
	type UserCurrentPlan,
} from "@synai/core";
import { getSynaiEnvironmentConfig } from "@synai/shared";
import { formatCreditBalance, normalizeCreditBalance } from "../utils/output";
import { identifyTelemetryAccount } from "../utils/telemetry";
import type { Config } from "../utils/types";

export const SYNAI_CREDITS_DASHBOARD_URL =
	"https://synai.dev/dashboard/account?tab=credits";

type SynaiAccountConfig = Pick<Config, "apiKey" | "logger" | "providerId">;

const SYNAI_PASS_PROVIDER_ID = "synai-pass";

export interface SynaiAccountSnapshot {
	user: SynaiAccountUser;
	balance: SynaiAccountBalance;
	organizationBalance: SynaiAccountOrganizationBalance | null;
	organizations: SynaiAccountOrganization[];
	activeOrganization: SynaiAccountOrganization | null;
	displayedBalance: number;
}

export function formatSynaiCredits(value: number): string {
	return formatCreditBalance(normalizeCreditBalance(value));
}

// FIXME: These message checks are temporary until structured error types are
// passed through to the CLI instead of plain error strings.
export function isSynaiAccountAuthErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized.includes("account auth token found") ||
		normalized.includes("requires re-authentication")
	);
}

export function isSynaiAccountCreditsErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	// The synai API's 402 response carries `code: "insufficient_credits"` and
	// the message "Not enough credits available". Depending on how much of the
	// payload survives error extraction, the CLI may see the raw JSON blob or
	// just the human-readable message, so match both. The
	// "insufficient balance" pair is an older backend phrasing kept for safety.
	return (
		normalized.includes("insufficient_credits") ||
		normalized.includes("not enough credits") ||
		(normalized.includes("insufficient balance") &&
			normalized.includes("synai credits balance"))
	);
}

function resolveAccountApiBaseUrl(input: {
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
}): string {
	const settingsBaseUrl = input.synaiProviderSettings?.baseUrl?.trim();
	if (settingsBaseUrl) {
		return settingsBaseUrl;
	}
	const configuredBaseUrl = input.synaiApiBaseUrl?.trim();
	if (configuredBaseUrl) {
		return configuredBaseUrl;
	}
	return getSynaiEnvironmentConfig().apiBaseUrl;
}

function resolveSynaiAccountAuthToken(input: {
	config: SynaiAccountConfig;
	synaiProviderSettings?: ProviderSettings;
}): string | undefined {
	const configApiKey =
		input.config.providerId === "synai" ? input.config.apiKey.trim() : "";
	return (
		getPersistedProviderApiKey("synai", input.synaiProviderSettings) ||
		configApiKey ||
		undefined
	);
}

async function resolveValidSynaiAccountAuthToken(input: {
	config: SynaiAccountConfig;
	synaiProviderSettings?: ProviderSettings;
	manager: ProviderSettingsManager;
	apiBaseUrl: string;
}): Promise<string | undefined> {
	const settings = input.synaiProviderSettings;
	const credentials = settings
		? getProviderOAuthCredentialsFromSettings("synai", settings)
		: null;
	if (settings && credentials) {
		const nextCredentials = await getValidSynaiCredentials(credentials, {
			apiBaseUrl: input.apiBaseUrl,
		});
		if (!nextCredentials) {
			throw new Error(
				"Synai account requires re-authentication. Run synai login synai.",
			);
		}
		const nextAccessToken = formatProviderOAuthApiKey("synai", nextCredentials);
		if (nextCredentials !== credentials) {
			saveLocalProviderOAuthCredentials(
				input.manager,
				"synai",
				settings,
				nextCredentials,
				{ setLastUsed: false },
			);
		}
		return nextAccessToken;
	}
	return resolveSynaiAccountAuthToken({
		config: input.config,
		synaiProviderSettings: settings,
	});
}

export async function createSynaiAccountService(input: {
	config: SynaiAccountConfig;
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
	providerSettingsManager?: ProviderSettingsManager;
}): Promise<SynaiAccountService | undefined> {
	const manager =
		input.providerSettingsManager ?? new ProviderSettingsManager();
	const settings =
		manager.getProviderSettings("synai") ?? input.synaiProviderSettings;
	const apiBaseUrl = resolveAccountApiBaseUrl({
		synaiApiBaseUrl: input.synaiApiBaseUrl,
		synaiProviderSettings: settings,
	});
	const authToken = await resolveValidSynaiAccountAuthToken({
		config: input.config,
		synaiProviderSettings: settings,
		manager,
		apiBaseUrl,
	});
	if (!authToken) {
		return undefined;
	}
	return new SynaiAccountService({
		apiBaseUrl,
		getAuthToken: async () => authToken,
	});
}

export async function loadSynaiAccountSnapshot(input: {
	config: SynaiAccountConfig;
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
}): Promise<SynaiAccountSnapshot> {
	const service = await createSynaiAccountService(input);
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}

	const user = await service.fetchMe();
	const organizations = user.organizations ?? [];
	const activeOrganization =
		organizations.find((organization: any) => organization.active) ?? null;
	const [balance, organizationBalance] = await Promise.all([
		service.fetchBalance(user.id),
		activeOrganization
			? service.fetchOrganizationBalance(activeOrganization.organizationId)
			: Promise.resolve(null),
	]);
	const displayedBalance = activeOrganization
		? (organizationBalance?.balance ?? balance.balance)
		: balance.balance;
	const accountContext = resolveSynaiAccountTelemetryIdentity(user);
	identifyTelemetryAccount(accountContext, input.config.logger);
	persistSynaiAccountTelemetryIdentity(
		new ProviderSettingsManager(),
		accountContext,
	);

	return {
		user,
		balance,
		organizationBalance,
		organizations,
		activeOrganization,
		displayedBalance,
	};
}

export async function switchSynaiAccount(input: {
	config: SynaiAccountConfig;
	organizationId?: string | null;
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
}): Promise<void> {
	const service = await createSynaiAccountService(input);
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}
	await service.switchAccount(input.organizationId);
}

export async function loadIndividualSubscriptionPlans(input: {
	config: SynaiAccountConfig;
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
}): Promise<SynaiSubscriptionPlan[]> {
	const service = await createSynaiAccountService(input);
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

export async function loadCurrentUserPlan(input: {
	config: SynaiAccountConfig;
	synaiApiBaseUrl?: string;
	synaiProviderSettings?: ProviderSettings;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createSynaiAccountService(input);
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadCurrentUserPlanFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	synaiApiBaseUrl?: string;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createSynaiAccountService({
		config: { apiKey: "", logger: undefined, providerId: "synai" },
		synaiApiBaseUrl: input.synaiApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadIndividualSubscriptionPlansFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	synaiApiBaseUrl?: string;
}): Promise<SynaiSubscriptionPlan[]> {
	const service = await createSynaiAccountService({
		config: { apiKey: "", logger: undefined, providerId: "synai" },
		synaiApiBaseUrl: input.synaiApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No SynAI account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

async function onChangeToSynaiPass(config: SynaiAccountConfig) {
	try {
		await switchSynaiAccount({
			config: config,
			organizationId: null,
		});
	} catch (error) {
		config.logger?.debug("Failed to switch SynaiPass to personal account", {
			error,
		});
	}
}

export async function onProviderChange(input: {
	config: SynaiAccountConfig;
	providerId: string;
}): Promise<void> {
	if (input.providerId === SYNAI_PASS_PROVIDER_ID) {
		return onChangeToSynaiPass(input.config);
	}

	return;
}
