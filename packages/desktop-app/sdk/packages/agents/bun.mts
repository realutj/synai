/// <reference types="@types/bun" />
export {};

// Externalize third-party runtime deps plus the provider/runtime layer that
// the Agent facade loads dynamically. `@synai/shared` stays bundled.
const external = ["@synai/llms", "nanoid"];
const sourcemap = Bun.env.SYNAI_SOURCEMAPS === "1" ? "linked" : "none";
// minify: true keeps identifier mangling active even when sourcemaps are enabled.
const minify = Bun.env.SYNAI_SOURCEMAPS !== "1";

const builds: Parameters<typeof Bun.build>[0][] = [
	{
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		target: "node",
		minify,
		sourcemap,
		packages: "bundle",
		external,
	},
];

for (const config of builds) {
	const result = await Bun.build(config);

	if (result.logs.length > 0) {
		for (const log of result.logs) {
			console.warn(log);
		}
	}
}
