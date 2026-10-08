import { isSynAIAccountNotAuthenticatedResult } from "@/lib/synai-account-state";
import type {
	SynAIGitHubRepository,
	SynAIIntegration,
} from "@/lib/synai-integrations-types";
import { desktopClient } from "@/lib/desktop-client";

export * from "@/lib/synai-integrations-types";

export type SynAIIntegrationsListResult =
	| { status: "ok"; integrations: SynAIIntegration[] }
	| { status: "not-authenticated" };

export async function listSynAIIntegrations(): Promise<SynAIIntegrationsListResult> {
	const result = await desktopClient.invoke("synai_integrations", {
		operation: "list",
	});
	if (isSynAIAccountNotAuthenticatedResult(result)) {
		return { status: "not-authenticated" };
	}
	return {
		status: "ok",
		integrations: Array.isArray(result) ? (result as SynAIIntegration[]) : [],
	};
}

export async function listSynAIGitHubRepositories(): Promise<
	SynAIGitHubRepository[]
> {
	const result = await desktopClient.invoke("synai_integrations", {
		operation: "listGitHubRepositories",
	});
	return Array.isArray(result) ? (result as SynAIGitHubRepository[]) : [];
}

export async function fetchGitHubInstallUrl(): Promise<string> {
	const result = await desktopClient.invoke("synai_integrations", {
		operation: "githubInstallUrl",
	});
	if (isSynAIAccountNotAuthenticatedResult(result)) {
		throw new Error("sign in to your SynAI account first");
	}
	const url = (result as { url?: unknown } | null)?.url;
	if (typeof url !== "string" || !url.trim()) {
		throw new Error("no GitHub install URL was returned");
	}
	return url;
}
