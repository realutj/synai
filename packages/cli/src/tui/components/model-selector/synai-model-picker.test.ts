import { describe, expect, it } from "vitest";
import {
	buildFeaturedModelEntries,
	SYNAI_PASS_FREE_SECTION_DESCRIPTION,
	freeTierDescriptionFor,
} from "./synai-model-entries";

const model = (id: string) => ({ id, name: id, description: "", tags: [] });

describe("synai model picker entries", () => {
	it("builds Recommended/Free sections for the synai provider", () => {
		const entries = buildFeaturedModelEntries("synai", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			SynAIPass: [model("synai-pass/glm-5.1")],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("anthropic/claude-sonnet-5"),
				tier: "recommended",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("builds Subscribed/Free sections for the synai-pass provider", () => {
		const entries = buildFeaturedModelEntries("synai-pass", {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			SynAIPass: [model("synai-pass/glm-5.1"), model("synai-pass/kimi-k2.6")],
		});

		expect(entries).toEqual([
			{ kind: "model", model: model("synai-pass/glm-5.1"), tier: "subscribed" },
			{
				kind: "model",
				model: model("synai-pass/kimi-k2.6"),
				tier: "subscribed",
			},
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
		]);
	});

	it("adds the browse-all escape when the SynAIPass bucket is empty", () => {
		// The fetch fell back to the bundled list (no pass models); the sections
		// alone would leave a subscriber able to pick only free models.
		const entries = buildFeaturedModelEntries("synai-pass", {
			recommended: [],
			free: [model("deepseek/deepseek-v4-flash")],
			SynAIPass: [],
		});

		expect(entries).toEqual([
			{
				kind: "model",
				model: model("deepseek/deepseek-v4-flash"),
				tier: "free",
			},
			{ kind: "browse" },
		]);
	});

	it("attaches the quota explainer only to the SynAIPass picker's free section", () => {
		const data = {
			recommended: [model("anthropic/claude-sonnet-5")],
			free: [model("deepseek/deepseek-v4-flash")],
			SynAIPass: [model("synai-pass/glm-5.1")],
		};

		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("synai-pass", data)),
		).toBe(SYNAI_PASS_FREE_SECTION_DESCRIPTION);
		expect(
			freeTierDescriptionFor(buildFeaturedModelEntries("synai", data)),
		).toBe(undefined);
	});
});
