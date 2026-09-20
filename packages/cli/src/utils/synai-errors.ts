import {
	type ClineSubscriptionPlan,
	extractClineFreeModelLimitResetTime,
	extractClinePassLimitMessage,
	getClineOrgIndividualInferenceSubscriptionMessage,
	isClineFreeModelLimitError,
	isClineFreeModelLimitMessage,
	isClineModelNotFoundMessage,
	isClineNotSubscribedError,
	isClineNotSubscribedMessage,
	isClineOrgIndividualInferenceSubscriptionError,
	isClineOrgIndividualInferenceSubscriptionMessage,
	isClinePassLimitError,
	isClinePassLimitMessage,
} from "@synai/core";

import { getClineEnvironmentConfig } from "@synai/shared";

export { getClineOrgIndividualInferenceSubscriptionMessage };

export function getCliSubscriptionUrl(): string {
	return new URL(
		`/dashboard/subscription?personal=true`,
		getClineEnvironmentConfig().appBaseUrl,
	).toString();
}

export function getCliNotSubscribedMessage(): string {
	return `Subscription or API key required to use this model. Please configure an API key in settings or select another model: ${getCliSubscriptionUrl()}`;
}

export function getCliClinePassLimitMessage(message: string): string {
	const detail = getClinePassLimitDetailMessage(message) ?? message.trim();
	const lines = [
		"Usage limit reached",
		detail,
		"Switch to usage-based billing or select another provider.",
		"Interactive CLI: open the model selector with /model and choose a provider.",
		"Headless CLI: rerun with --provider <name>.",
	];
	return lines.filter((line) => line.trim().length > 0).join("\n");
}

const SYNAI_FREE_MODEL_PREFIX = "free/";
const SYNAI_FREE_PROMOTION_ENDED_HEADER = "Model promotion ended";
const SYNAI_FREE_MODEL_LIMIT_HEADER = "Daily free usage limit reached";

export function getCliClineFreePromotionEndedMessage(): string {
	return [
		SYNAI_FREE_PROMOTION_ENDED_HEADER,
		"The promotion for this model has ended and it is no longer available.",
		"Select another model to continue.",
		"Open the model selector with /model.",
	].join("\n");
}

export function getCliClineFreeModelLimitMessage(message: string): string {
	const resetTime = extractClineFreeModelLimitResetTime(message);
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
	plans: ClineSubscriptionPlan[],
): string[] {
	const planWithFeatures = plans.find((plan) => plan.interval === "Monthly");

	return planWithFeatures?.features?.included ?? [];
}

function isFormattedClinePassSubscriptionMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		(normalized.includes("no access to clinepass subscription models yet") &&
			normalized.includes("subscribe to clinepass")) ||
		(normalized.includes("no access to synai pass models yet") &&
			normalized.includes("subscribe to synai pass"))
	);
}

export function isClinePassSubscriptionError(error: unknown): boolean {
	if (isClineNotSubscribedError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ClineNotSubscribedError" ||
			isClineNotSubscribedMessage(error.message) ||
			isFormattedClinePassSubscriptionMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(isClineNotSubscribedMessage(error) ||
			isFormattedClinePassSubscriptionMessage(error))
	);
}

export function isClineOrgIndividualInferenceSubscriptionErrorMessage(
	error: unknown,
): boolean {
	if (isClineOrgIndividualInferenceSubscriptionError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ClineOrgIndividualInferenceSubscriptionError" ||
			isClineOrgIndividualInferenceSubscriptionMessage(error.message) ||
			error.message === getClineOrgIndividualInferenceSubscriptionMessage()
		);
	}
	return (
		typeof error === "string" &&
		(isClineOrgIndividualInferenceSubscriptionMessage(error) ||
			error === getClineOrgIndividualInferenceSubscriptionMessage())
	);
}

export function getClinePassLimitDetailMessage(
	error: unknown,
): string | undefined {
	return extractClinePassLimitMessage(
		error instanceof Error ? error.message : String(error),
	);
}

export function isClinePassLimitErrorMessage(error: unknown): boolean {
	if (isClinePassLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ClinePassLimitError" ||
			isClinePassLimitMessage(error.message)
		);
	}
	return typeof error === "string" && isClinePassLimitMessage(error);
}

// Detects that a deleted free model was requested: the backend answers "model
// not found" once a free promotion ends and the cline-free/ model is removed.
// The modelId gate keeps regular model-not-found errors on their generic path.
export function isClineFreePromotionEndedErrorMessage(
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
	if (!modelId?.startsWith(SYNAI_FREE_MODEL_PREFIX)) {
		return false;
	}
	return isClineModelNotFoundMessage(message);
}

export function isClineFreeModelLimitErrorMessage(error: unknown): boolean {
	if (isClineFreeModelLimitError(error)) {
		return true;
	}
	if (error instanceof Error) {
		return (
			error.name === "ClineFreeModelLimitError" ||
			isClineFreeModelLimitMessage(error.message)
		);
	}
	return (
		typeof error === "string" &&
		(error
			.toLowerCase()
			.includes(SYNAI_FREE_MODEL_LIMIT_HEADER.toLowerCase()) ||
			isClineFreeModelLimitMessage(error))
	);
}

export function formatCliErrorMessage(
	error: unknown,
	options?: { modelId?: string },
): string {
	if (isClinePassSubscriptionError(error)) {
		return getCliNotSubscribedMessage();
	}
	if (isClineOrgIndividualInferenceSubscriptionErrorMessage(error)) {
		return getClineOrgIndividualInferenceSubscriptionMessage();
	}
	if (isClinePassLimitErrorMessage(error)) {
		return getCliClinePassLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isClineFreeModelLimitErrorMessage(error)) {
		return getCliClineFreeModelLimitMessage(
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isClineFreePromotionEndedErrorMessage(error, options?.modelId)) {
		return getCliClineFreePromotionEndedMessage();
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
