import { basename } from "node:path";

export const SYNAI_BUILD_ENV_ENV = "SYNAI_BUILD_ENV";
export const SYNAI_DEBUG_HOST_ENV = "SYNAI_DEBUG_HOST";
export const SYNAI_DEBUG_PORT_BASE_ENV = "SYNAI_DEBUG_PORT_BASE";

export type SynAIBuildEnv = "development" | "production";
export type SynAIDebugRole =
	| "rpc"
	| "hook"
	| "plugin-sandbox"
	| "connector"
	| "sandbox";

export interface ResolveSynAIBuildEnvOptions {
	env?: NodeJS.ProcessEnv;
	execArgv?: string[];
	debugRole?: SynAIDebugRole;
}

function normalizeBuildEnv(
	value: string | undefined,
): SynAIBuildEnv | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "development" || normalized === "production") {
		return normalized;
	}
	return undefined;
}

function hasDevelopmentCondition(execArgv: string[]): boolean {
	for (let index = 0; index < execArgv.length; index += 1) {
		const value = execArgv[index]?.trim();
		if (!value) {
			continue;
		}
		if (
			value === "--conditions" &&
			execArgv[index + 1]?.trim() === "development"
		) {
			return true;
		}
		if (
			value.startsWith("--conditions=") &&
			value
				.slice("--conditions=".length)
				.split(",")
				.map((entry) => entry.trim())
				.includes("development")
		) {
			return true;
		}
	}
	return false;
}

function isNodeLauncher(command: string | undefined): boolean {
	if (!command?.trim()) {
		return false;
	}
	const name = basename(command).toLowerCase();
	return (
		name === "node" ||
		name === "node.exe" ||
		name === "bun" ||
		name === "bun.exe"
	);
}

function hasInspectFlag(values: string[]): boolean {
	return values.some(
		(value) =>
			value === "--inspect" ||
			value.startsWith("--inspect=") ||
			value === "--inspect-brk" ||
			value.startsWith("--inspect-brk="),
	);
}

function hasSourceMapFlag(values: string[]): boolean {
	return values.some((value) => value === "--enable-source-maps");
}

function resolveDebugHost(env: NodeJS.ProcessEnv): string {
	return env[SYNAI_DEBUG_HOST_ENV]?.trim() || "127.0.0.1";
}

function resolveDebugPortBase(env: NodeJS.ProcessEnv): number | undefined {
	const raw = env[SYNAI_DEBUG_PORT_BASE_ENV]?.trim();
	if (!raw) {
		return undefined;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveRolePortOffset(role: SynAIDebugRole | undefined): number {
	switch (role) {
		case "rpc":
			return 0;
		case "hook":
			return 1;
		case "plugin-sandbox":
			return 2;
		case "connector":
			return 3;
		case "sandbox":
			return 4;
		default:
			return 9;
	}
}

export function resolveSynAIBuildEnv(
	options: ResolveSynAIBuildEnvOptions = {},
): SynAIBuildEnv {
	const env = options.env ?? process.env;
	const execArgv = options.execArgv ?? process.execArgv;

	const explicit = normalizeBuildEnv(env[SYNAI_BUILD_ENV_ENV]);
	if (explicit) {
		return explicit;
	}

	const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
	if (nodeEnv === "production") {
		return "production";
	}
	if (nodeEnv === "development") {
		return "development";
	}

	return hasDevelopmentCondition(execArgv) ? "development" : "production";
}

export function withResolvedSynAIBuildEnv(
	env: NodeJS.ProcessEnv = process.env,
	options: Omit<ResolveSynAIBuildEnvOptions, "env"> = {},
): NodeJS.ProcessEnv {
	if (normalizeBuildEnv(env[SYNAI_BUILD_ENV_ENV])) {
		return env;
	}
	return {
		...env,
		[SYNAI_BUILD_ENV_ENV]: resolveSynAIBuildEnv({
			env,
			execArgv: options.execArgv,
		}),
	};
}

export function augmentNodeCommandForDebug(
	command: string[],
	options: ResolveSynAIBuildEnvOptions = {},
): string[] {
	if (command.length === 0 || !isNodeLauncher(command[0])) {
		return [...command];
	}
	if (resolveSynAIBuildEnv(options) !== "development") {
		return [...command];
	}

	const env = options.env ?? process.env;
	const existingFlags = [
		...(env.NODE_OPTIONS?.split(/\s+/).filter(Boolean) ?? []),
		...command.slice(1),
	];
	const debugFlags: string[] = [];
	if (!hasInspectFlag(existingFlags)) {
		const host = resolveDebugHost(env);
		const portBase = resolveDebugPortBase(env);
		const port =
			portBase === undefined
				? 0
				: portBase + resolveRolePortOffset(options.debugRole);
		debugFlags.push(`--inspect=${host}:${port}`);
	}
	if (!hasSourceMapFlag(existingFlags)) {
		debugFlags.push("--enable-source-maps");
	}

	return [command[0], ...debugFlags, ...command.slice(1)];
}
