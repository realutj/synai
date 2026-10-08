export const SYNAI_ENVIRONMENT_ENV = "SYNAI_ENVIRONMENT";
export const SYNAI_ENVIRONMENT_OVERRIDE_ENV = "SYNAI_ENVIRONMENT_OVERRIDE";

export type SynAIEnvironment = "production" | "staging" | "local";

export interface SynAIEnvironmentConfig {
	readonly environment: SynAIEnvironment;
	readonly appBaseUrl: string;
	readonly apiBaseUrl: string;
	readonly mcpBaseUrl: string;
	readonly workOsClientId: string;
}

export const SYNAI_ENVIRONMENTS: Readonly<
	Record<SynAIEnvironment, SynAIEnvironmentConfig>
> = {
	production: {
		environment: "production",
		appBaseUrl: "https://app.synai.bot",
		apiBaseUrl: "https://api.synai.bot",
		mcpBaseUrl: "https://api.synai.bot/v1/mcp",
		workOsClientId: "client_01K3A541FN8TA3EPPHTD2325AR",
	},
	staging: {
		environment: "staging",
		appBaseUrl: "https://staging-app.synai.bot",
		apiBaseUrl: "https://core-api.staging.int.synai.bot",
		mcpBaseUrl: "https://core-api.staging.int.synai.bot/v1/mcp",
		workOsClientId: "client_01K3A5415VF6QBQBG3XYCW91G6",
	},
	local: {
		environment: "local",
		appBaseUrl: "http://localhost:3000",
		apiBaseUrl: "http://localhost:7777",
		mcpBaseUrl: "http://localhost:7777/v1/mcp",
		workOsClientId: "client_01K6XQAY7JK6T5HXVSZW2S5VYK",
	},
};

export const DEFAULT_SYNAI_ENVIRONMENT: SynAIEnvironment = "production";

export interface ResolveSynAIEnvironmentOptions {
	env?: Partial<NodeJS.ProcessEnv>;
}

function normalizeSynAIEnvironment(
	value: string | undefined,
): SynAIEnvironment | undefined {
	const normalized = value?.trim().toLowerCase();
	if (
		normalized === "production" ||
		normalized === "staging" ||
		normalized === "local"
	) {
		return normalized;
	}
	return undefined;
}

function readProcessEnv(): NodeJS.ProcessEnv {
	// `process` may be absent in browser-style runtimes (this module ships
	// from the browser entry of `@synai/shared`). Treat its absence as "no
	// env vars set" so callers always get a deterministic default.
	if (typeof process === "undefined" || !process?.env) {
		return {};
	}
	return process.env;
}

export function resolveSynAIEnvironment(): SynAIEnvironment {
	const env = readProcessEnv();
	return (
		normalizeSynAIEnvironment(env[SYNAI_ENVIRONMENT_OVERRIDE_ENV]) ??
		normalizeSynAIEnvironment(env[SYNAI_ENVIRONMENT_ENV]) ??
		DEFAULT_SYNAI_ENVIRONMENT
	);
}

function getEnvConfig(env?: SynAIEnvironment) {
	if (typeof env === "string") {
		return SYNAI_ENVIRONMENTS[env];
	}
	return SYNAI_ENVIRONMENTS[resolveSynAIEnvironment()];
}

function applyConfigOverrides(
	config: SynAIEnvironmentConfig,
	env: NodeJS.ProcessEnv,
): SynAIEnvironmentConfig {
	if (env.SYNAI_API_BASE_URL) {
		config = {
			...config,
			apiBaseUrl: env.SYNAI_API_BASE_URL,
			mcpBaseUrl: `${env.SYNAI_API_BASE_URL}/v1/mcp`,
		};
	}

	return config;
}

export function getSynAIEnvironmentConfig(
	env?: SynAIEnvironment,
): SynAIEnvironmentConfig {
	const config = getEnvConfig(env);

	return applyConfigOverrides(config, readProcessEnv());
}
