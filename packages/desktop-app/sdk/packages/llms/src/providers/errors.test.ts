import { describe, expect, it } from "vitest";
import { isSynAIPassLimitMessage } from "../index.browser";
import {
	extractSynAIFreeModelLimitResetTime,
	extractSynAIPassLimitMessage,
	isSynAIFreeModelLimitMessage,
} from "./errors";

describe("isSynAIPassLimitMessage", () => {
	it("matches the SynAIPass weekly limit message", () => {
		const message =
			"You have reached your weekly SynAIpass limit. The limit resets in 7d, please try again later.";
		expect(isSynAIPassLimitMessage(message)).toBe(true);
	});

	it("matches the 5-hour SynAIPass limit message", () => {
		const message =
			"You have reached your 5-hour SynAIpass limit. The limit resets in 5h, please try again later.";
		expect(isSynAIPassLimitMessage(message)).toBe(true);
	});

	it("handles tab-heavy non-matches without regex backtracking", () => {
		expect(
			isSynAIPassLimitMessage(`You have reached your\t${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isSynAIPassLimitMessage(`You have reached your\t-${"\t".repeat(10_000)}`),
		).toBe(false);
		expect(
			isSynAIPassLimitMessage(
				`You have reached your\t-\tSynAIpass limit.The limit resets in\t${"\t".repeat(10_000)}`,
			),
		).toBe(false);
	});
});

describe("extractSynAIPassLimitMessage", () => {
	it("extracts the SynAIPass weekly limit message", () => {
		const message =
			"You have reached your weekly SynAIpass limit. The limit resets in 7d, please try again later.";

		const extracted = extractSynAIPassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});

	it("extracts the 5-hour SynAIPass limit message", () => {
		const message =
			"You have reached your 5-hour SynAIpass limit. The limit resets in 5h, please try again later.";

		const extracted = extractSynAIPassLimitMessage(`Error: ${message}`);
		expect(extracted).toBe(message);
	});
});

describe("SynAI free model limit messages", () => {
	const message =
		"Daily free limit reached on model deepseek/deepseek-v4-flash. Try again in 23h 59m";

	it("detects the message in an HTTP error", () => {
		const error = `Error: Error 429: ${message}`;
		expect(isSynAIFreeModelLimitMessage(error)).toBe(true);
		expect(extractSynAIFreeModelLimitResetTime(error)).toBe("23h 59m");
	});

	it("does not match unrelated daily limits", () => {
		expect(
			isSynAIFreeModelLimitMessage(
				"Your daily spend limit has been reached. Try again in 23h 59m",
			),
		).toBe(false);
	});
});
