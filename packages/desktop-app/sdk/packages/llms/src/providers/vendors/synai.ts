import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
	LanguageModelV4,
	LanguageModelV4FunctionTool,
	LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import { createProviderDefinedToolFactory } from "@ai-sdk/provider-utils";
import type {
	GatewayProviderContext,
	GatewayResolvedProviderConfig,
} from "@synai/shared";
import {
	modelProducesImages,
	usesImageGenerationOperation,
} from "@synai/shared";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import { z } from "zod";
import { ensureFetch, resolveApiKey } from "../http";
import { splitToolImagesMiddleware } from "../middleware/split-tool-images";
import {
	createSuccessDataResponseFetch,
	withMaxCompletionTokensForReasoningModels,
} from "./openai-compatible";
import type { ProviderFactoryResult } from "./types";

export interface SynAIWebSearchInput {
	query: string;
	allowed_domains?: string[];
	blocked_domains?: string[];
}

export interface SynAIWebSearchResult {
	results: Array<{ title?: string; url?: string }>;
}

export interface SynAIWebSearchOptions {
	allowedDomains?: string[];
	blockedDomains?: string[];
}

export interface SynAIProviderOptions {
	apiKey?: string;
	baseURL: string;
	headers?: Record<string, string>;
	fetch?: typeof fetch;
	onResponseError?: (response: Response) => Promise<void> | void;
}

const SYNAI_WEB_SEARCH_INPUT_SCHEMA: LanguageModelV4FunctionTool["inputSchema"] =
	{
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The search query.",
			},
			allowed_domains: {
				type: "array",
				items: { type: "string" },
				description: "Optional domains to restrict results to.",
			},
			blocked_domains: {
				type: "array",
				items: { type: "string" },
				description: "Optional domains to exclude from results.",
			},
		},
		required: ["query"],
		additionalProperties: false,
	};

const SynAIWebSearchInputSchema = z.object({
	query: z.string().min(1),
	allowed_domains: z.array(z.string()).optional(),
	blocked_domains: z.array(z.string()).optional(),
});

const webSearchFactory = createProviderDefinedToolFactory<
	SynAIWebSearchInput,
	SynAIWebSearchOptions
>({
	id: "synai.web_search",
	inputSchema: SynAIWebSearchInputSchema,
});

function withoutTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeDomains(value: string[] | undefined): string[] | undefined {
	const domains = value?.map((domain) => domain.trim()).filter(Boolean);
	return domains?.length ? domains : undefined;
}

function createSynAIFetch(options: SynAIProviderOptions): typeof fetch {
	const baseFetch = ensureFetch(options.fetch);
	return (async (input, init) => {
		const response = await baseFetch(input, init);
		await options.onResponseError?.(response);
		return response;
	}) as typeof fetch;
}

async function executeWebSearch(
	input: SynAIWebSearchInput,
	options: SynAIWebSearchOptions,
	provider: SynAIProviderOptions,
	abortSignal?: AbortSignal,
): Promise<SynAIWebSearchResult> {
	const allowedDomains = normalizeDomains(
		input.allowed_domains ?? options.allowedDomains,
	);
	const blockedDomains = normalizeDomains(
		input.blocked_domains ?? options.blockedDomains,
	);
	if (allowedDomains && blockedDomains) {
		throw new Error(
			"web_search accepts allowed domains or blocked domains, but not both.",
		);
	}

	const response = await createSynAIFetch(provider)(
		`${withoutTrailingSlash(provider.baseURL)}/search/websearch`,
		{
			method: "POST",
			headers: {
				...(provider.apiKey
					? { Authorization: `Bearer ${provider.apiKey}` }
					: {}),
				"Content-Type": "application/json",
				...provider.headers,
			},
			body: JSON.stringify({
				query: input.query,
				...(allowedDomains ? { allowed_domains: allowedDomains } : {}),
				...(blockedDomains ? { blocked_domains: blockedDomains } : {}),
			}),
			signal: abortSignal,
		},
	);
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`SynAI web search failed (HTTP ${response.status}): ${body || response.statusText}`,
		);
	}

	const parsed = body ? (JSON.parse(body) as unknown) : {};
	const result = parsed as {
		data?: { results?: Array<{ title?: string; url?: string }> };
	};
	return {
		results: Array.isArray(result.data?.results) ? result.data.results : [],
	};
}

function createSynAIProviderToolMiddleware(): LanguageModelV4Middleware {
	return {
		specificationVersion: "v4",
		transformParams: async ({ params }) => ({
			...params,
			tools: params.tools?.map((tool) => {
				if (tool.type !== "provider" || tool.id !== "synai.web_search") {
					return tool;
				}
				return {
					type: "function",
					name: tool.name,
					description:
						"Search the public web for current information and return matching pages.",
					inputSchema: SYNAI_WEB_SEARCH_INPUT_SCHEMA,
				} satisfies LanguageModelV4FunctionTool;
			}),
		}),
	};
}

export interface SynAIProvider {
	(modelId: string): LanguageModelV4;
	tools: {
		webSearch(
			options?: SynAIWebSearchOptions,
		): ReturnType<typeof webSearchFactory<SynAIWebSearchResult>>;
	};
}

/** Create the SynAI AI SDK provider, including SynAI-native client tools. */
export function createSynAI(options: SynAIProviderOptions): SynAIProvider {
	const providerFetch = createSynAIFetch(options);
	const compatible = createOpenAICompatible({
		// Both SynAI gateway providers ("synai" and "synai-pass") share this AI
		// SDK provider and the same SynAI API; option routing keys their
		// providerOptions to the "synai" bucket (see buildProviderAndAliasPatch).
		name: "synai",
		baseURL: withoutTrailingSlash(options.baseURL),
		apiKey: options.apiKey,
		headers: options.headers,
		fetch: providerFetch,
		includeUsage: true,
		transformRequestBody: withMaxCompletionTokensForReasoningModels,
	});
	const createModel = (modelId: string): LanguageModelV4 =>
		wrapLanguageModel({
			model: wrapLanguageModel({
				model: compatible(modelId),
				middleware: createSynAIProviderToolMiddleware(),
			}),
			middleware: splitToolImagesMiddleware,
		});
	const synai = ((modelId: string) => createModel(modelId)) as SynAIProvider;
	synai.tools = {
		webSearch: (toolOptions = {}) =>
			webSearchFactory<SynAIWebSearchResult>({
				...toolOptions,
				execute: (input, execution) =>
					executeWebSearch(input, toolOptions, options, execution.abortSignal),
			}),
	};
	return synai;
}

function readResponseErrorHandler(
	config: GatewayResolvedProviderConfig,
): SynAIProviderOptions["onResponseError"] {
	const candidate = config.options?.onResponseError;
	return typeof candidate === "function"
		? (candidate as SynAIProviderOptions["onResponseError"])
		: undefined;
}

export async function createSynAIProviderModule(
	config: GatewayResolvedProviderConfig,
	context: GatewayProviderContext,
): Promise<ProviderFactoryResult> {
	const providerOptions: SynAIProviderOptions = {
		apiKey: await resolveApiKey(config),
		baseURL: config.baseUrl ?? "https://api.synai.bot/api/v1",
		headers: config.headers,
		fetch: config.fetch,
		onResponseError: readResponseErrorHandler(config),
	};
	const synai = createSynAI(providerOptions);
	const openRouter =
		context.provider.metadata?.imageTransport === "openrouter"
			? createOpenRouter({
					apiKey: providerOptions.apiKey,
					baseURL: providerOptions.baseURL,
					headers: providerOptions.headers,
					fetch: createSuccessDataResponseFetch(
						createSynAIFetch(providerOptions),
					),
					compatibility: "compatible",
				})
			: undefined;
	return {
		operations: {
			language: (modelId) =>
				openRouter &&
				modelProducesImages(context.model) &&
				!usesImageGenerationOperation(context.model)
					? openRouter.chat(modelId)
					: synai(modelId),
			...(openRouter
				? {
						imageGeneration: (modelId: string) =>
							openRouter.imageModel(modelId),
					}
				: {}),
		},
		buildModelTools: (tools) => {
			const result: ReturnType<
				NonNullable<ProviderFactoryResult["buildModelTools"]>
			> = {};
			for (const tool of tools) {
				if (tool.name === "web_search") {
					result.web_search = {
						tool: synai.tools.webSearch({
							allowedDomains: tool.allowedDomains,
							blockedDomains: tool.blockedDomains,
						}),
					};
				}
			}
			return result;
		},
		executesModelTools: true,
	};
}
