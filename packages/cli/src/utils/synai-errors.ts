import {
	type SynaiSubscriptionPlan,
	extractSynaiFreeModelLimitResetTime,
	extractSynaiPassLimitMessage,
	getSynaiOrgIndividualInferenceSubscriptionMessage,
	isSynaiFreeModelLimitError,
	isSynaiFreeModelLimitMessage,
	isSynaiModelNotFoundMessage,
	isSynaiNotSubscribedError,
	isSynaiNotSubscribedMessage,
	isSynaiOrgIndividualInferenceSubscriptionError,
	isSynaiOrgIndividualInferenceSubscriptionMessage,
	isSynaiPassLimitError,
	isSynaiPassLimitMessage,
} from "@synai/core";

import { getSynaiEnvironmentConfig } from "@synai/shared";

export { getSynaiOrgIndividualInferenceSubscriptionMessage };

export function getCliSubscriptionUrl(): string {
	const baseUrl = getSynaiEnvironmentConfig()?.appBaseUrl || "https://synai.org";
	return new URL(
		`/dashboard/subscription?personal=true`,
		baseUrl,
	).toString();
}

export function getCliNotSubscribedMessage(): string {
	return `No access to SynAIPass subscription models yet. Subscribe to SynAIPass, the low cost open weights model coding plan: ${getCliSubscriptionUrl()}`;
}

export function getCliSynaiPassLimitMessage(message: string): string {
	const detail = getSynaiPassLimitDetailMessage(message) ?? message.trim();
	const lines = [
		"SynAIPass limit reached",
		detail,
		"Switch to synai usage-based billing and retry with the synai provider.",
		"Interactive CLI: open the model selector with /model, choose SynAI, then retry.",
		"Headless CLI: rerun with --provider synai.",
	];
	return lines.filter((line) => line.trim().length > 0).join("\n");
}

const SYNAI_FREE_PROMOTION_ENDED_HEADER = "Free model promotion ended";
const SYNAI_FREE_MODEL_LIMIT_HEADER = "Daily free model limit reached";

export function getCliSynaiFreePromotionEndedMessage(): string {
	return [
		SYNAI_FREE_PROMOTION_ENDED_HEADER,
		"The promotion for this model has ended and it is no longer available.",
		"Select another model to continue.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getCliSynaiFreeModelLimitMessage(message: string): string {
	const resetTime = extractSynaiFreeModelLimitResetTime(message);
	return [
		SYNAI_FREE_MODEL_LIMIT_HEADER,
		"You've reached today's free usage limit for this model.",
		resetTime
			? `Try again in ${resetTime} or select another model.`
			: "Try again later or select another model.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getIndividualPlanFeatures(
	plans: SynaiSubscriptionPlan[],
): string[] {
	const planWithFeatures = plans.find((plan) => plan.interval === "Monthly");

	return planWithFeatures?.features?.included ?? [];
}

function isFormattedSynaiPassSubscriptionMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		(normalized.includes("no access to synaipass subscription models yet") &&
			(normalized.includes("subscribe to synaipass") || normalized.includes("subscribe to synai pass"))) ||
		(normalized.includes("no access to synai pass models yet") &&
			(normalized.includes("subscribe to synaipass") || normalized.includes("subscribe to synai pass")))
	);
}

export function isSynaiPassSubscriptionError(error: unknown): boolean {
	if (isSynaiNotSubscribedError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "SynaiNotSubscribedError" ||
			isSynaiNotSubscribedMessage(error.message) ||
			isFormattedSynaiPassSubscriptionMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(isSynaiNotSubscribedMessage(error) ||
			isFormattedSynaiPassSubscriptionMessage(error))
	);
}

export function isSynaiOrgIndividualInferenceSubscriptionErrorMessage(
	error: unknown,
): boolean {
	if (isSynaiOrgIndividualInferenceSubscriptionError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "SynaiOrgIndividualInferenceSubscriptionError" ||
			isSynaiOrgIndividualInferenceSubscriptionMessage(error.message) ||
			error.message === getSynaiOrgIndividualInferenceSubscriptionMessage()
		);
	}
	return (
		typeof error === "string" &&
		(isSynaiOrgIndividualInferenceSubscriptionMessage(error) ||
			error === getSynaiOrgIndividualInferenceSubscriptionMessage())
	);
}

export function getSynaiPassLimitDetailMessage(
	error: unknown,
): string | undefined {
	return extractSynaiPassLimitMessage(
		error instanceof Error ? error.message : String(error),
	);
}

export function isSynaiPassLimitErrorMessage(error: unknown): boolean {
	if (isSynaiPassLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "SynaiPassLimitError" ||
			isSynaiPassLimitMessage(error.message)
		);
	}
	return typeof error === "string" && isSynaiPassLimitMessage(error);
}

// Detects that a deleted free model was requested: the backend answers "model
// not found" once a free promotion ends and the synai-free/ model is removed.
// The modelId gate keeps regular model-not-found errors on their generic path.
export function isSynaiFreePromotionEndedErrorMessage(
	error: unknown,
	modelId?: string,
): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	if (
		message
			.toLowerCase()
			.includes(SYNAI_FREE_PROMOTION_ENDED_HEADER.toLowerCase())
	) {
		return true;
	}
	if (
		!modelId?.startsWith("free/") &&
		!modelId?.startsWith("synai-free/")
	) {
		return false;
	}
	return isSynaiModelNotFoundMessage(message);
}

export function isSynaiFreeModelLimitErrorMessage(error: unknown): boolean {
	if (isSynaiFreeModelLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "SynaiFreeModelLimitError" ||
			isSynaiFreeModelLimitMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(error
			.toLowerCase()
			.includes(SYNAI_FREE_MODEL_LIMIT_HEADER.toLowerCase()) ||
			isSynaiFreeModelLimitMessage(error))
	);
}

export function formatCliErrorMessage(
	error: unknown,
	options?: { modelId?: string },
): string {
	if (isSynaiPassSubscriptionError(error)) {
		return getCliNotSubscribedMessage();
	}
	if (isSynaiOrgIndividualInferenceSubscriptionErrorMessage(error)) {
		return getSynaiOrgIndividualInferenceSubscriptionMessage();
	}
	if (isSynaiPassLimitErrorMessage(error)) {
		return getCliSynaiPassLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isSynaiFreeModelLimitErrorMessage(error)) {
		return getCliSynaiFreeModelLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isSynaiFreePromotionEndedErrorMessage(error, options?.modelId)) {
		return getCliSynaiFreePromotionEndedMessage();
	}
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "object" && error !== null && "message" in error) {
		return String((error as any).message);
	}
	return String(error);
}
