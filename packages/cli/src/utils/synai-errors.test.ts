import { describe, expect, it } from "vitest";
import {
	formatCliErrorMessage,
	getCliClineFreeModelLimitMessage,
	getCliSynAIPassLimitMessage,
	getCliNotSubscribedMessage,
	getClineOrgIndividualInferenceSubscriptionMessage,
	getSynAIPassLimitDetailMessage,
	isClineFreeModelLimitErrorMessage,
	isClineFreePromotionEndedErrorMessage,
	isClineOrgIndividualInferenceSubscriptionErrorMessage,
	isSynAIPassLimitErrorMessage,
	isSynAIPassSubscriptionError,
} from "./synai-errors";

describe("synai-errors", () => {
	it("recognizes both raw and formatted SynAIPass subscription messages", () => {
		expect(
			isSynAIPassSubscriptionError(
				"the user is not subscribed to required model plan",
			),
		).toBe(true);

		const sdkFormatted =
			"No access to SynAIPass subscription models yet. Subscribe to SynAIPass, the low cost open weights model coding plan: https://app.synai.bot/dashboard/subscription?personal=true";
		const formatted = getCliNotSubscribedMessage();
		expect(isSynAIPassSubscriptionError(sdkFormatted)).toBe(true);
		expect(isSynAIPassSubscriptionError(formatted)).toBe(true);
		expect(formatCliErrorMessage(new Error(sdkFormatted))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(formatted))).toBe(formatted);
	});

	it("recognizes and formats organization account individual subscription errors", () => {
		const raw =
			"403 Error 403: organization accounts cannot use individual model inference subscriptions";
		const formatted = getClineOrgIndividualInferenceSubscriptionMessage();

		expect(isClineOrgIndividualInferenceSubscriptionErrorMessage(raw)).toBe(
			true,
		);
		expect(
			isClineOrgIndividualInferenceSubscriptionErrorMessage(
				new Error(formatted),
			),
		).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(formatted);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"deepseek-v4-flash",
		);
	});

	it("recognizes and formats SynAIPass period limit errors with usage-billing guidance", () => {
		const raw =
			"Error: You have reached your 5-hour SynAIPass limit. The limit resets in 5h, please try again later.";
		const detail =
			"You have reached your 5-hour SynAIPass limit. The limit resets in 5h, please try again later.";

		expect(isSynAIPassLimitErrorMessage(raw)).toBe(true);
		expect(isSynAIPassLimitErrorMessage(new Error(raw))).toBe(true);
		expect(getSynAIPassLimitDetailMessage(raw)).toBe(detail);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliSynAIPassLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Switch to synai usage-based billing",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain("--provider cline");
	});

	it("recognizes and formats daily free model limits without usage-billing guidance", () => {
		const raw =
			"Error: Error 429: Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

		expect(isClineFreeModelLimitErrorMessage(raw)).toBe(true);
		expect(isClineFreeModelLimitErrorMessage(new Error(raw))).toBe(true);
		expect(formatCliErrorMessage(new Error(raw))).toBe(
			getCliClineFreeModelLimitMessage(raw),
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain("Error 429");
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"Try again in 23h 59m",
		);
		expect(formatCliErrorMessage(new Error(raw))).toContain(
			"select another model",
		);
		expect(formatCliErrorMessage(new Error(raw))).not.toContain(
			"usage-based billing",
		);
		expect(
			isClineFreeModelLimitErrorMessage(getCliClineFreeModelLimitMessage(raw)),
		).toBe(true);
	});

	it("formats model-not-found errors for removed free models", () => {
		const raw = new Error("Error 404: model not found");

		expect(
			formatCliErrorMessage(raw, { modelId: "cline-free/retired-model" }),
		).toContain("Free model promotion ended");
		expect(
			isClineFreePromotionEndedErrorMessage(
				formatCliErrorMessage(raw, { modelId: "cline-free/retired-model" }),
			),
		).toBe(true);
		expect(
			formatCliErrorMessage(raw, { modelId: "vendor/retired-model" }),
		).toBe(raw.message);
	});
});
