import { decodeJwtPayload } from "@synai/shared";

export interface ProviderRequestHeaderClientContext {
	name?: string;
	version?: string;
	versionHeaderFallback?: string;
	platform?: string;
	platformVersion?: string;
	isMultiRoot?: boolean;
}

export interface ProviderRequestHeaderLayers {
	stored?: Record<string, string>;
	config?: Record<string, string>;
	session?: Record<string, string>;
}

export interface OpenAICodexRequestHeaderContext {
	accountId?: string;
	accessToken?: string;
	userAgentVersion?: string;
}

export interface ResolveProviderRequestHeadersInput {
	providerId: string;
	sessionId: string;
	source?: string;
	defaultSource: string;
	client?: ProviderRequestHeaderClientContext;
	coreVersion: string;
	openAiCodex?: OpenAICodexRequestHeaderContext;
	headers?: ProviderRequestHeaderLayers;
}

const DEFAULT_SYNAI_REQUEST_HEADERS: Record<string, string> = {
	"HTTP-Referer": "https://synai.bot",
	"X-Title": "SynAI",
	"X-IS-MULTIROOT": "false",
	"X-CLIENT-TYPE": "synai-sdk",
};

function isSynAIBillingProvider(providerId: string): boolean {
	return providerId === "synai" || providerId === "synai-pass";
}

function trimNonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveSource(
	source: string | undefined,
	defaultSource: string,
): string {
	return trimNonEmpty(source) ?? defaultSource;
}

function resolveSynAIClientVersion(
	client: ProviderRequestHeaderClientContext | undefined,
): string {
	return (
		trimNonEmpty(client?.version) ??
		trimNonEmpty(client?.versionHeaderFallback) ??
		"unknown"
	);
}

function buildSynAIRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (!isSynAIBillingProvider(input.providerId)) {
		return undefined;
	}
	const source = resolveSource(input.source, input.defaultSource);
	const clientType = trimNonEmpty(input.client?.name) ?? `synai-${source}`;
	const clientVersion = resolveSynAIClientVersion(input.client);
	const platform = trimNonEmpty(input.client?.platform) ?? source;
	const platformVersion =
		trimNonEmpty(input.client?.platformVersion) ?? clientVersion;
	return {
		...DEFAULT_SYNAI_REQUEST_HEADERS,
		"User-Agent": `SynAI/${clientVersion}`,
		"X-IS-MULTIROOT": input.client?.isMultiRoot === true ? "true" : "false",
		"X-CLIENT-TYPE": clientType,
		"X-CLIENT-VERSION": clientVersion,
		"X-PLATFORM": platform,
		"X-PLATFORM-VERSION": platformVersion,
		"X-CORE-VERSION": input.coreVersion,
		"X-Task-ID": input.sessionId,
	};
}

function deriveOpenAICodexAccountId(
	accessToken: string | undefined,
): string | undefined {
	const payload = decodeJwtPayload(accessToken) as
		| {
				"https://api.openai.com/auth"?: { chatgpt_account_id?: string };
				organizations?: Array<{ id?: string }>;
				chatgpt_account_id?: string;
		  }
		| undefined;
	const authAccountId =
		payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
	if (typeof authAccountId === "string" && authAccountId.length > 0) {
		return authAccountId;
	}
	const orgAccountId = payload?.organizations?.[0]?.id;
	if (typeof orgAccountId === "string" && orgAccountId.length > 0) {
		return orgAccountId;
	}
	const rootAccountId = payload?.chatgpt_account_id;
	if (typeof rootAccountId === "string" && rootAccountId.length > 0) {
		return rootAccountId;
	}
	return undefined;
}

function buildOpenAICodexRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (input.providerId !== "openai-codex") {
		return undefined;
	}
	const accountId =
		trimNonEmpty(input.openAiCodex?.accountId) ??
		deriveOpenAICodexAccountId(input.openAiCodex?.accessToken);
	return {
		originator: "synai",
		session_id: input.sessionId,
		"User-Agent": `SynAI/${trimNonEmpty(input.openAiCodex?.userAgentVersion) ?? "1.0.0"}`,
		...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
	};
}

function resolveRequiredProviderHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (input.providerId === "opencode-go") {
		return {
			"x-opencode-session": input.sessionId,
			"User-Agent": `SynAI/${trimNonEmpty(input.client?.version) ?? input.coreVersion}`,
		};
	}
	return (
		buildSynAIRequestHeaders(input) ?? buildOpenAICodexRequestHeaders(input)
	);
}

function resolveDefaultProviderHeaders(
	headers: ProviderRequestHeaderLayers | undefined,
): Record<string, string> | undefined {
	return headers?.session ?? headers?.config ?? headers?.stored;
}

export function resolveProviderRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	const requiredHeaders = resolveRequiredProviderHeaders(input);
	if (requiredHeaders) {
		return {
			...(input.headers?.stored ?? {}),
			...(input.headers?.config ?? {}),
			...(input.headers?.session ?? {}),
			...requiredHeaders,
		};
	}
	const headers = resolveDefaultProviderHeaders(input.headers);
	return headers ? { ...headers } : undefined;
}
