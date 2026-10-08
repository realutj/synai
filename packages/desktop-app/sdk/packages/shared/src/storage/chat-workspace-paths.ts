export const SYNAI_WORKSPACES_DIRECTORY_NAME = "workspaces";
export const SYNAI_CHAT_WORKSPACE_DIRECTORY_NAME = "chat";

// Default data-dir anchors for the structural check below. The Node resolver
// derives the real location from resolveSynAIDataDir(), which defaults to
// `~/.synai/data`.
const SYNAI_CONFIG_DIRECTORY_NAME = ".synai";
const SYNAI_DATA_DIRECTORY_NAME = "data";

/**
 * Browser-safe structural check for the shared chat workspace that hosts
 * sessions started without a project: `.synai/data/workspaces/chat`. Matches
 * the directory itself only — project folders created inside it are regular
 * workspaces. Matches the default data-dir layout; explicit `SYNAI_DATA_DIR`
 * overrides are not detectable from a bare path string.
 */
export function isChatWorkspacePath(path: string): boolean {
	const normalizedPath = path.trim();
	const isWindowsAbsolute =
		/^[A-Za-z]:[\\/]/.test(normalizedPath) || normalizedPath.startsWith("\\\\");
	const isPosixAbsolute = normalizedPath.startsWith("/");
	if (!isWindowsAbsolute && !isPosixAbsolute) {
		return false;
	}
	const segments = normalizedPath
		.split(isWindowsAbsolute ? /[\\/]+/ : /\/+/)
		.filter(Boolean);
	const chatDirectory = segments.at(-1) ?? "";
	const workspacesDirectory = segments.at(-2) ?? "";
	const dataDirectory = segments.at(-3) ?? "";
	const configDirectory = segments.at(-4) ?? "";
	return (
		configDirectory === SYNAI_CONFIG_DIRECTORY_NAME &&
		dataDirectory === SYNAI_DATA_DIRECTORY_NAME &&
		workspacesDirectory === SYNAI_WORKSPACES_DIRECTORY_NAME &&
		chatDirectory === SYNAI_CHAT_WORKSPACE_DIRECTORY_NAME
	);
}
