export type ApprovalMode = "ask" | "approve-for-me" | "full-access";

export const APPROVAL_STORAGE_KEY = "synai.approval-mode.v1";
export const APPROVAL_MODE_CHANGED_EVENT = "synai:approval-mode-changed";

export interface ApprovalOption {
	id: ApprovalMode;
	label: string;
	description: string;
}

export const APPROVAL_OPTIONS: ApprovalOption[] = [
	{
		id: "ask",
		label: "Ask for approval",
		description: "Always ask to edit external files and use the internet",
	},
	{
		id: "approve-for-me",
		label: "Approve for me",
		description: "Only ask for actions detected as potentially unsafe",
	},
	{
		id: "full-access",
		label: "Full access",
		description: "Unrestricted access to the internet and any file on your computer",
	},
];

export function getStoredApprovalMode(): ApprovalMode {
	if (typeof window === "undefined") return "ask";
	try {
		const val = localStorage.getItem(APPROVAL_STORAGE_KEY);
		if (val === "approve-for-me" || val === "full-access" || val === "ask") {
			return val;
		}
	} catch {}
	return "ask";
}

export function setStoredApprovalMode(mode: ApprovalMode): ApprovalMode {
	if (typeof window === "undefined") return mode;
	try {
		localStorage.setItem(APPROVAL_STORAGE_KEY, mode);
		window.dispatchEvent(
			new CustomEvent(APPROVAL_MODE_CHANGED_EVENT, { detail: mode }),
		);
	} catch {}
	return mode;
}
