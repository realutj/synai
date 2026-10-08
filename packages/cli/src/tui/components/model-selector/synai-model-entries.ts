import type {
	SynaiRecommendedModel,
	SynaiRecommendedModelsData,
} from "@synai/core";

export type SynaiModelPickerTier = "recommended" | "subscribed" | "free";

export interface SynaiModelPickerItem {
	kind: "model";
	model: SynaiRecommendedModel;
	tier: SynaiModelPickerTier;
}

export interface SynaiModelPickerBrowse {
	kind: "browse";
}

export type SynaiModelPickerEntry =
	| SynaiModelPickerItem
	| SynaiModelPickerBrowse;

export const SYNAI_MODEL_PICKER_TIER_LABELS: Record<
	SynaiModelPickerTier,
	string
> = {
	recommended: "Recommended",
	subscribed: "Subscribed",
	free: "Free",
};

// Featured entries for the sectioned picker, keyed by provider: synai gets
// Recommended/Free with a browse-all escape into the full catalog; synai-pass
// gets Subscribed/Free (see buildSynaiPassModelEntries for why no browse-all).
export function buildFeaturedModelEntries(
	providerId: string,
	data: SynaiRecommendedModelsData,
): SynaiModelPickerEntry[] {
	return providerId === "synai-pass"
		? buildSynaiPassModelEntries(data)
		: buildSynaiModelEntries(data);
}

function buildSynaiModelEntries(
	data: SynaiRecommendedModelsData,
): SynaiModelPickerEntry[] {
	const entries: SynaiModelPickerEntry[] = [];
	for (const m of data.recommended) {
		entries.push({ kind: "model", model: m, tier: "recommended" });
	}
	for (const m of data.free) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	entries.push({ kind: "browse" });
	return entries;
}

// Shown under the Free section header when picking a model
export const SYNAI_PASS_FREE_SECTION_DESCRIPTION =
	"Try with limited usage, separate from account quota.";
export const SYNAI_FREE_SECTION_DESCRIPTION =
	SYNAI_PASS_FREE_SECTION_DESCRIPTION;

// SynaiPass shows the subscription's models plus the synai free models - both
// providers hit the same synai API, so free models are selectable in place
// (they ride usage billing at $0 instead of the subscription quota).
// No "browse all" entry when the synaiPass bucket is populated: unlike synai,
// the SynaiPass catalog contains exactly these two buckets, so the sections
// already list every selectable model. An empty synaiPass bucket means the
// fetch fell back to the bundled list (which has no pass models) - without an
// escape into the full catalog a subscriber could only pick free models, so
// browse-all comes back in that degraded mode.
function buildSynaiPassModelEntries(
	data: SynaiRecommendedModelsData,
): SynaiModelPickerEntry[] {
	const entries: SynaiModelPickerEntry[] = [];
	const passModels = (data as any)?.SynAIPass ?? data?.synaiPass ?? [];
	for (const m of passModels) {
		entries.push({ kind: "model", model: m, tier: "subscribed" });
	}
	for (const m of data?.free ?? []) {
		entries.push({ kind: "model", model: m, tier: "free" });
	}
	if (passModels.length === 0) {
		entries.push({ kind: "browse" });
	}
	return entries;
}

// The quota explainer only makes sense in the SynaiPass picker, which is the
// only picker that has a "subscribed" section
export function freeTierDescriptionFor(
	entries: SynaiModelPickerEntry[],
): string | undefined {
	const isSynaiPassPicker = entries.some(
		(entry) => entry.kind === "model" && entry.tier === "subscribed",
	);
	return isSynaiPassPicker ? SYNAI_PASS_FREE_SECTION_DESCRIPTION : undefined;
}
