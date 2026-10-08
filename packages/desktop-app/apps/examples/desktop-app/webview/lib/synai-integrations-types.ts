export type SynAIIntegration = {
	provider?: string;
	created_at?: string;
};

export type SynAIGitHubRepository = {
	id?: number;
	name?: string;
	full_name?: string;
	html_url?: string;
	private?: boolean;
};

export const GITHUB_INTEGRATION_PROVIDER = "github";

export function findGitHubIntegration(
	integrations: SynAIIntegration[],
): SynAIIntegration | undefined {
	return integrations.find(
		(integration) => integration?.provider === GITHUB_INTEGRATION_PROVIDER,
	);
}
