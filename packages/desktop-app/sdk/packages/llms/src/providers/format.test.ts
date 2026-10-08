import { describe, expect, it } from "vitest";
import {
	SynAINotSubscribedError,
	SynAIOrgIndividualInferenceSubscriptionError,
	SynAIPassLimitError,
	getSynAINotSubscribedMessage,
	getSynAIOrgIndividualInferenceSubscriptionMessage,
	isSynAINotSubscribedMessage,
	isSynAIOrgIndividualInferenceSubscriptionMessage,
	isSynAIPassLimitMessage,
} from "./errors";
import { extractErrorMessage } from "./format";

describe("extractErrorMessage", () => {
	it("extracts structured provider errors without fallback branches", () => {
		expect(
			extractErrorMessage({
				statusCode: 400,
				responseBody: {
					error: {
						message: "Bad request detail",
					},
				},
				message: "Bad Request",
			}),
		).toBe("Bad request detail");

		expect(
			extractErrorMessage({
				cause: new Error("Nested failure"),
			}),
		).toBe("Nested failure");

		expect(extractErrorMessage(new Error("Plain failure"))).toBe(
			"Plain failure",
		);
	});

	it("preserves native transport error wrappers and cause metadata", () => {
		const socketError = Object.assign(new Error("other side closed"), {
			name: "SocketError",
			code: "UND_ERR_SOCKET",
		});

		expect(
			extractErrorMessage(
				new TypeError("fetch failed", { cause: socketError }),
			),
		).toBe("fetch failed: SocketError: other side closed (UND_ERR_SOCKET)");
	});

	it("prefers nested stream error details over generic wrapper messages", () => {
		expect(
			extractErrorMessage({
				message: "Stream error occurred",
				errors: [
					{
						responseBody: JSON.stringify({
							error: { message: "Missing upstream API key" },
						}),
					},
				],
			}),
		).toBe("Missing upstream API key");
	});

	it("unwraps gateway-forwarded upstream errors from value.error_message", () => {
		// Exact shape streamed by Vercel AI Gateway when the upstream provider
		// (Alibaba Qwen) rejects a request: the gateway's own parse failure sits
		// in message/cause, the real rejection is JSON-encoded in
		// value.error_message.
		const contextLengthMessage =
			"This model's maximum context length is 40960 tokens. However, you requested 100 output tokens and your prompt contains at least 40861 input tokens.";
		expect(
			extractErrorMessage({
				code: "error",
				message: "Stream error occurred",
				name: "AI_TypeValidationError",
				cause: {
					name: "ZodError",
					message:
						'[\n  {\n    "code": "invalid_union",\n    "path": [],\n    "message": "Invalid input"\n  }\n]',
				},
				value: {
					error_type: "validation_error",
					error_message: JSON.stringify({
						error: {
							message: contextLengthMessage,
							code: 400,
						},
					}),
				},
			}),
		).toBe(contextLengthMessage);
	});

	it("handles a plain-string value.error_message", () => {
		expect(
			extractErrorMessage({
				message: "Stream error occurred",
				value: { error_message: "upstream rejected the request" },
			}),
		).toBe("upstream rejected the request");
	});

	it("falls back to JSON instead of [object Object] for opaque objects", () => {
		expect(extractErrorMessage({ status: 502 })).toBe('{"status":502}');
	});
});

describe("SynAINotSubscribedError", () => {
	it("uses the user-facing subscription message", () => {
		expect(new SynAINotSubscribedError("synai-pass").message).toBe(
			getSynAINotSubscribedMessage(),
		);
	});

	it("detects the SynAIPass required-plan message", () => {
		expect(
			isSynAINotSubscribedMessage(
				JSON.stringify({
					error: {
						message: "the user is not subscribed to required model plan",
					},
				}),
			),
		).toBe(true);
		expect(isSynAINotSubscribedMessage("different forbidden error")).toBe(
			false,
		);
	});

	it("detects the formatted SynAIPass subscription message regardless of URL", () => {
		expect(
			isSynAINotSubscribedMessage(
				"No access to SynAIPass subscription models yet. Subscribe to SynAIPass, the low cost open weights model coding plan:",
			),
		).toBe(true);
	});
});

describe("SynAIOrgIndividualInferenceSubscriptionError", () => {
	it("uses the user-facing organization account message", () => {
		expect(
			new SynAIOrgIndividualInferenceSubscriptionError("synai").message,
		).toBe(getSynAIOrgIndividualInferenceSubscriptionMessage());
	});

	it("detects the organization individual-subscription entitlement message", () => {
		expect(
			isSynAIOrgIndividualInferenceSubscriptionMessage(
				JSON.stringify({
					error: {
						code: "ENTITLEMENT_ERROR",
						message:
							"organization accounts cannot use individual model inference subscriptions",
					},
				}),
			),
		).toBe(true);
		expect(
			isSynAIOrgIndividualInferenceSubscriptionMessage(
				"the user is not subscribed to required model plan",
			),
		).toBe(false);
	});
});

describe("SynAIPassLimitError", () => {
	it("preserves the dynamic backend limit message", () => {
		const message =
			"You have reached your weekly SynAIpass limit. The limit resets in 7d, please try again later.";
		expect(new SynAIPassLimitError(message, "synai-pass").message).toBe(
			message,
		);
	});

	it("detects SynAIPass period limit messages with variable period and reset", () => {
		expect(
			isSynAIPassLimitMessage(
				"You have reached your weekly SynAIpass limit. The limit resets in 7d, please try again later.",
			),
		).toBe(true);
		expect(
			isSynAIPassLimitMessage(
				"You have reached your monthly SynAIpass limit. The limit resets in 12h, please try again later.",
			),
		).toBe(true);
		expect(
			isSynAIPassLimitMessage(
				`You have reached your\t-\tSynAIpass limit.The limit resets in\t${"\t".repeat(10_000)}`,
			),
		).toBe(false);
		expect(
			isSynAIPassLimitMessage(
				"the user is not subscribed to required model plan",
			),
		).toBe(false);
	});
});
