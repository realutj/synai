// Shared between the sidecar (which produces this result) and the webview
// (which consumes it), like the desktop transport types.

/**
 * Typed result the `synai_account` sidecar command returns when no SynAI
 * account credentials exist. Being signed out is an expected state, so it
 * travels as a structured response instead of a thrown error: it must not be
 * reported to error telemetry or rendered as a raw error string.
 */
export const SYNAI_ACCOUNT_NOT_AUTHENTICATED_CODE =
	"ACCOUNT_NOT_AUTHENTICATED" as const;

export type SynAIAccountNotAuthenticatedResult = {
	signedIn: false;
	code: typeof SYNAI_ACCOUNT_NOT_AUTHENTICATED_CODE;
};

export const SYNAI_ACCOUNT_NOT_AUTHENTICATED_RESULT: SynAIAccountNotAuthenticatedResult =
	{
		signedIn: false,
		code: SYNAI_ACCOUNT_NOT_AUTHENTICATED_CODE,
	};

export function isSynAIAccountNotAuthenticatedResult(
	value: unknown,
): value is SynAIAccountNotAuthenticatedResult {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as SynAIAccountNotAuthenticatedResult).code ===
			SYNAI_ACCOUNT_NOT_AUTHENTICATED_CODE &&
		(value as SynAIAccountNotAuthenticatedResult).signedIn === false
	);
}
