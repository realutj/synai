import { $ } from "bun";

const main = async () => {
	await $`bun run --bun next build webview`;
	await $`bun run build:sidecar:bin`;
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
