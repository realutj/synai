import { getSynAIEnvironmentConfig } from "@synai/shared";

export const SYNAI_NOT_SUBSCRIBED_RESPONSE_MESSAGE =
	"the user is not subscribed to required model plan";
const SYNAI_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX =
	"no access to synaipass subscription models yet. subscribe to synaipass";
export const SYNAI_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE =
	"organization accounts cannot use individual model inference subscriptions";

const SYNAI_PASS_LIMIT_PREFIX = "you have reached your";
const SYNAI_PASS_LIMIT_MARKER = "synaipass limit";
const SYNAI_PASS_LIMIT_SUFFIX = "please try again later.";
const SYNAI_FREE_MODEL_LIMIT_MARKER = "free limit reached on model";
const SYNAI_FREE_MODEL_LIMIT_RETRY_MARKER = "try again in ";
const SYNAI_MODEL_NOT_FOUND_MARKER = "model not found";

function findSynAIPassLimitMessageBounds(
	text: string,
): { start: number; end: number } | undefined {
	const normalized = text.toLowerCase();
	const start = normalized.indexOf(SYNAI_PASS_LIMIT_PREFIX);
	if (start === -1) {
		return undefined;
	}

	const suffixStart = normalized.indexOf(SYNAI_PASS_LIMIT_SUFFIX, start);
	if (suffixStart === -1) {
		return undefined;
	}

	const end = suffixStart + SYNAI_PASS_LIMIT_SUFFIX.length;
	if (!normalized.slice(start, end).includes(SYNAI_PASS_LIMIT_MARKER)) {
		return undefined;
	}

	return { start, end };
}

export function getSynAIPassSubscriptionUrl(): string {
	return `${new URL(
		"/dashboard/subscription?personal=true",
		getSynAIEnvironmentConfig().appBaseUrl,
	).toString()}`;
}

export function getSynAINotSubscribedMessage(): string {
	return `No access to SynAIPass subscription models yet. Subscribe to SynAIPass, the low cost open weights model coding plan: ${getSynAIPassSubscriptionUrl()}`;
}

export class SynAINotSubscribedError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getSynAINotSubscribedMessage());
		this.name = "SynAINotSubscribedError";
		this.providerId = providerId;
	}
}

export function getSynAIOrgIndividualInferenceSubscriptionMessage(): string {
	return "Organization accounts cannot use SynAIPass subscriptions. Go to /account -> change account to switch to your personal account for SynAIPass";
}

export class SynAIOrgIndividualInferenceSubscriptionError extends Error {
	public readonly providerId?: string;

	constructor(providerId?: string) {
		super(getSynAIOrgIndividualInferenceSubscriptionMessage());
		this.name = "SynAIOrgIndividualInferenceSubscriptionError";
		this.providerId = providerId;
	}
}

export class SynAIPassLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "SynAIPassLimitError";
		this.providerId = providerId;
	}
}

export class SynAIFreeModelLimitError extends Error {
	public readonly providerId?: string;

	constructor(message: string, providerId?: string) {
		super(message);
		this.name = "SynAIFreeModelLimitError";
		this.providerId = providerId;
	}
}

export function isSynAINotSubscribedError(
	error: unknown,
): error is SynAINotSubscribedError {
	return error instanceof SynAINotSubscribedError;
}

export function isSynAIOrgIndividualInferenceSubscriptionError(
	error: unknown,
): error is SynAIOrgIndividualInferenceSubscriptionError {
	return error instanceof SynAIOrgIndividualInferenceSubscriptionError;
}

export function isSynAIPassLimitError(
	error: unknown,
): error is SynAIPassLimitError {
	return error instanceof SynAIPassLimitError;
}

export function isSynAIFreeModelLimitError(
	error: unknown,
): error is SynAIFreeModelLimitError {
	return error instanceof SynAIFreeModelLimitError;
}

export function isSynAINotSubscribedMessage(text: string): boolean {
	const normalized = text.trim().toLowerCase();
	return (
		normalized.includes(SYNAI_NOT_SUBSCRIBED_RESPONSE_MESSAGE) ||
		normalized.includes(SYNAI_NOT_SUBSCRIBED_FORMATTED_MESSAGE_PREFIX)
	);
}

export function isSynAIOrgIndividualInferenceSubscriptionMessage(
	text: string,
): boolean {
	return text
		.toLowerCase()
		.includes(SYNAI_ORG_INDIVIDUAL_INFERENCE_SUBSCRIPTION_RESPONSE_MESSAGE);
}

export function isSynAIPassLimitMessage(text: string): boolean {
	return findSynAIPassLimitMessageBounds(text) !== undefined;
}

export function extractSynAIPassLimitMessage(text: string): string | undefined {
	const bounds = findSynAIPassLimitMessageBounds(text);
	return bounds ? text.slice(bounds.start, bounds.end) : undefined;
}

export function isSynAIFreeModelLimitMessage(text: string): boolean {
	return text.toLowerCase().includes(SYNAI_FREE_MODEL_LIMIT_MARKER);
}

export function isSynAIModelNotFoundMessage(text: string): boolean {
	return text.toLowerCase().includes(SYNAI_MODEL_NOT_FOUND_MARKER);
}

export function extractSynAIFreeModelLimitResetTime(
	text: string,
): string | undefined {
	const message = text.toLowerCase();
	const resetStart = message.indexOf(SYNAI_FREE_MODEL_LIMIT_RETRY_MARKER);
	if (resetStart === -1) {
		return undefined;
	}

	const resetTime = message
		.slice(resetStart + SYNAI_FREE_MODEL_LIMIT_RETRY_MARKER.length)
		.trim();
	return resetTime || undefined;
}
