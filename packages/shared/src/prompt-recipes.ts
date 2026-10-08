/** Reusable engineering workflows shown in the SynAI CLI slash-command menu. */
export interface PromptRecipe {
	name: string;
	label: string;
	description: string;
	instructions: string;
}

export const PROMPT_RECIPES: readonly PromptRecipe[] = [
	{
		name: "map",
		label: "Map this codebase",
		description: "Find the entry points, architecture, and test paths.",
		instructions:
			"Inspect this repository without changing files. Build a concise architecture map: important entry points, major modules, data flow, key commands, test conventions, and how to run the project. Verify every path you mention exists, follow only the paths needed to understand the request, and call out anything you could not confirm.",
	},
	{
		name: "review",
		label: "Review my changes",
		description: "Look for real bugs in the current diff; do not edit files.",
		instructions:
			"Review the current uncommitted changes for actionable bugs, regressions, security issues, and missing edge cases. Read the surrounding code before judging a diff. Do not edit files. Report findings first, ordered by severity, with exact file and line references; if you find none, say so and mention any important areas you could not verify.",
	},
	{
		name: "tests",
		label: "Strengthen the tests",
		description: "Add focused regression coverage for the behavior at hand.",
		instructions:
			"Inspect the requested behavior and the repository's existing test conventions. Add the smallest focused regression tests that exercise the important success and failure cases. Keep production changes out unless a test exposes a necessary bug fix, avoid unrelated test churn, and run the narrowest relevant test command when finished.",
	},
	{
		name: "debug",
		label: "Trace a bug",
		description: "Follow the failure to its root cause, then make a narrow fix.",
		instructions:
			"Investigate the reported bug from its observable behavior to the root cause. Trace the relevant inputs and state transitions, reproduce the failure when practical, then make the narrowest durable fix. Check adjacent edge cases and report the cause, changed files, and the verification you performed. Do not guess or make unrelated cleanup changes.",
	},
] as const;
