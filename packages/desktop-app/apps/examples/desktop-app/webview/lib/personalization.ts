export interface PersonalizationProfile {
	name?: string;
	role?: string;
	language?: string;
	tone?: "concise" | "detailed" | "friendly" | "formal" | "direct" | "mentor" | string;
	techStack?: string[];
	codingStyle?: string;
	customInstructions?: string;
}

export const PERSONALIZATION_STORAGE_KEY = "synai.personalization.v1";
export const PERSONALIZATION_CHANGED_EVENT = "synai:personalization-changed";

export const DEFAULT_PERSONALIZATION: PersonalizationProfile = {
	name: "",
	role: "",
	language: "English",
	tone: "concise",
	techStack: ["TypeScript", "React", "Next.js", "Tailwind CSS"],
	codingStyle: "Clean code, strict types, early returns, concise explanations",
	customInstructions: "",
};

export const TONE_OPTIONS = [
	{
		id: "concise",
		title: "Concise",
		description: "Brief, direct responses with minimal fluff and no unnecessary preamble.",
		badge: "Fast & Focused",
	},
	{
		id: "detailed",
		title: "Detailed",
		description: "In-depth explanations with step-by-step reasoning and full context.",
		badge: "Thorough",
	},
	{
		id: "mentor",
		title: "Mentor",
		description: "Educational guidance explaining the 'why' behind architectural choices and best practices.",
		badge: "Educational",
	},
	{
		id: "direct",
		title: "Direct",
		description: "Code-first, strictly actionable solutions, no pleasantries.",
		badge: "Code-First",
	},
	{
		id: "friendly",
		title: "Friendly",
		description: "Warm, collaborative, and conversational partner tone.",
		badge: "Warm",
	},
] as const;

export const LANGUAGE_OPTIONS = [
	{ id: "English", label: "English" },
	{ id: "Turkish", label: "Turkish" },
	{ id: "German", label: "German" },
	{ id: "Spanish", label: "Spanish" },
	{ id: "French", label: "French" },
	{ id: "Russian", label: "Russian" },
	{ id: "Chinese", label: "Chinese" },
	{ id: "Japanese", label: "Japanese" },
] as const;

export const POPULAR_TECH_STACKS = [
	"TypeScript",
	"JavaScript",
	"React",
	"Next.js",
	"Node.js",
	"Tailwind CSS",
	"Python",
	"Rust",
	"Go",
	"Vue",
	"Svelte",
	"Docker",
	"PostgreSQL",
	"Prisma",
	"GraphQL",
] as const;

export function readStoredPersonalization(): PersonalizationProfile {
	if (typeof window === "undefined") return { ...DEFAULT_PERSONALIZATION };
	try {
		const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_PERSONALIZATION };
		const parsed = JSON.parse(raw);
		return {
			...DEFAULT_PERSONALIZATION,
			...(parsed && typeof parsed === "object" ? parsed : {}),
		};
	} catch {
		return { ...DEFAULT_PERSONALIZATION };
	}
}

export function setStoredPersonalization(
	updates: Partial<PersonalizationProfile>,
): PersonalizationProfile {
	const current = readStoredPersonalization();
	const next: PersonalizationProfile = {
		...current,
		...updates,
	};
	if (typeof window !== "undefined") {
		try {
			localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(next));
			window.dispatchEvent(
				new CustomEvent(PERSONALIZATION_CHANGED_EVENT, { detail: next }),
			);
		} catch {}
	}
	return next;
}

export function formatPersonalizationPrompt(
	profile: PersonalizationProfile,
): string {
	const parts: string[] = [];

	if (profile.name?.trim()) {
		parts.push(`- User's Preferred Name: ${profile.name.trim()}`);
	}
	if (profile.role?.trim()) {
		parts.push(`- User's Role / Background: ${profile.role.trim()}`);
	}
	if (profile.language?.trim()) {
		parts.push(`- Preferred Response Language: ${profile.language.trim()}`);
	}
	if (profile.tone?.trim()) {
		parts.push(`- Preferred Communication Tone: ${profile.tone.trim()}`);
	}
	if (profile.techStack && profile.techStack.length > 0) {
		parts.push(`- Preferred Tech Stack: ${profile.techStack.join(", ")}`);
	}
	if (profile.codingStyle?.trim()) {
		parts.push(`- Coding Style Preferences: ${profile.codingStyle.trim()}`);
	}
	if (profile.customInstructions && profile.customInstructions.trim().length > 0) {
		parts.push(`- Specific User Directives:\n  ${profile.customInstructions.trim()}`);
	}

	if (parts.length === 0) {
		return "";
	}

	return `\n# User Personalization & Preferences\n${parts.join("\n")}\n`;
}
