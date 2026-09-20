import type { SynAICore } from "@synai/core";
import type { MessageWithMetadata } from "@synai/shared";

export async function loadInteractiveResumeMessages(
	sessionManager: SynAICore,
	resumeSessionId?: string,
): Promise<MessageWithMetadata[] | undefined> {
	const target = resumeSessionId?.trim();
	if (!target) {
		return undefined;
	}
	return await sessionManager.readMessages(target);
}
