# [experimental] @synai/core

`@synai/core` is the stateful orchestration layer of the SynAI SDK. It
connects the agent runtime, provider settings, storage, default tools, and
session lifecycle into a host-ready runtime.

## What You Get

- session lifecycle and orchestration primitives
- provider settings and account services
- default runtime tools and MCP integration
- storage-backed session and team state helpers
- host-facing Node helpers through `@synai/core`

## Installation

```bash
npm install @synai/core
```

## Entry Points

- `@synai/core`: core contracts, shared utilities, and Node/server helpers for building hosts and runtimes

## Typical Usage

Most host apps should start with `@synai/core`.

```ts
import { SynAICore } from "@synai/core";

const synai = await SynAICore.create({});

const result = await synai.start({
	config: {
		providerId: "anthropic",
		modelId: "claude-sonnet-4-6",
		apiKey: process.env.ANTHROPIC_API_KEY ?? "",
		cwd: process.cwd(),
		mode: "act",
		enableTools: true,
		enableSpawnAgent: false,
		enableAgentTeams: false,
		systemPrompt: "You are a concise assistant.",
	},
	prompt: "Summarize this project.",
	interactive: false,
});

console.log(result.result?.text);
await synai.dispose();
```

When both `cwd` and `workspaceRoot` are omitted, the execution host places
the session in the shared chat workspace at
`<synai-data-dir>/workspaces/chat` (by default
`~/.synai/data/workspaces/chat`), seeded with an `AGENTS.md` rules file that
tells the agent to treat the session as a chat and only create a named
project folder when the user asks for one.
Read the resolved paths from `result.manifest.cwd` and
`result.manifest.workspace_root`.

## Session Bootstrap

`SynAICore.create(...)` also accepts `prepare(input)`.

Use it when a host needs to prepare workspace-scoped runtime state before each
session starts, then apply watcher/extensions/telemetry inputs through
explicit `localRuntime` bootstrap fields without widening the shared host
contract.

Preparation runs before the execution host resolves an omitted workspace, so
pathless starts expose neither `cwd` nor `workspaceRoot` to `prepare(input)`.

## Main APIs

### Runtime and Sessions

Use `@synai/core` for host-facing runtime assembly:

- `SynAICore.create(...)`
- `createRuntimeHost(...)`
- `LocalRuntimeHost`
- `HubRuntimeHost` and `RemoteRuntimeHost`
- `DefaultRuntimeBuilder`

`SynAICore` is the app-facing session API. The lower-level `RuntimeHost`
boundary uses runtime-primitive names such as `startSession` and `runTurn` so
transport adapters stay distinct from product methods like `start` and `send`.
Service-style operations such as pending prompt edits, accumulated usage lookup,
and active-session model switching are exposed through `SynAICore` when the
selected transport supports them rather than being part of the minimal host
primitive vocabulary.

### Default Tools

`@synai/core` owns the built-in host tools and executors:

- `createBuiltinTools(...)`
- `createDefaultTools(...)`
- `createDefaultExecutors(...)`

### Storage and Settings

The package also exports storage and settings helpers such as:

- `ProviderSettingsManager`
- `CoreSettingsService` and `createCoreSettingsService`
- MCP settings helpers such as `setMcpServerDisabled`
- `SqliteTeamStore`
- SQLite-backed local session stores and artifacts through `@synai/core`

## Related Packages

- `@synai/agents`: stateless agent loop and tool primitives
- `@synai/llms`: provider/model configuration and handlers

## More Examples

- Repo examples: [examples](https://github.com/synai/sdk/tree/main/examples), [apps/examples](https://github.com/synai/sdk/tree/main/apps/examples)
- Workspace overview: [README.md](https://github.com/synai/synai/blob/main/README.md)
- API and architecture references: [DOC.md](https://github.com/synai/synai/blob/main/DOC.md), [ARCHITECTURE.md](https://github.com/synai/synai/blob/main/ARCHITECTURE.md)
