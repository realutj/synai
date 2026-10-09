<div align="center">
  <img src="packages/cli/assets/synai-logo.png" width="120" alt="SynAI logo" />
  <h1>SynAI</h1>
  <p><strong>An open-source coding agent for the work between idea and release.</strong><br />
  Explore a codebase, plan a change, implement it, and review the result from your terminal.</p>
  <p>
    <a href="https://www.npmjs.com/package/synai"><img src="https://img.shields.io/npm/v/synai?label=npm&color=1f6feb" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/synai"><img src="https://img.shields.io/npm/dm/synai?label=monthly%20downloads&color=0a7f5a" alt="monthly npm downloads" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748b" alt="MIT license" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22%2B-43853d" alt="Node.js 22 or newer" /></a>
  </p>
  <p>
    <a href="https://docs.synai.bot">Documentation</a> ·
    <a href="https://github.com/realutj/synai/issues">Report an issue</a> ·
    <a href="https://github.com/realutj/synai/discussions">Discussions</a>
  </p>
</div>

---

SynAI is a terminal-first AI coding agent that works in the context of your project. It can inspect files, plan multi-step work, make code changes, run commands, and help you review the result. Use an interactive terminal session, run a single prompt, stream structured output into another tool, or connect SynAI to your existing workflow.

## Quick start

Install SynAI from npm:

```sh
npm install --global synai
```

Sign in or configure a model provider, then start SynAI in a project:

```sh
cd path/to/your-project
synai login
synai
```

You can also run a task directly:

```sh
synai "Review this project and suggest the highest-impact improvements"
```

SynAI publishes prebuilt platform binaries for Windows, macOS, and Linux on x64 and arm64. Installing from npm downloads the matching CLI binary; it does not compile the source on your machine. Source builds are for development and maintainers preparing a release. The CLI package requires Node.js 22 or newer.

## What SynAI can do

- **Work across a codebase:** search files and symbols, edit code, run commands, and inspect diagnostics.
- **Plan before acting:** use plan mode for a proposed approach, then switch to implementation when ready.
- **Keep work reviewable:** use tool approval settings and checkpoints to inspect or undo changes.
- **Coordinate agents:** delegate parallel work to sub-agents or continue a named team workflow.
- **Control Chrome:** inspect pages and tabs, click and fill page controls, evaluate page JavaScript, and capture screenshots.
- **Connect your tools:** add MCP servers, schedule recurring tasks, and route sessions through supported chat connectors.
- **Fit into automation:** run one-shot tasks or stream newline-delimited JSON (NDJSON) for scripts and CI.

## Common workflows

| Goal | Command |
| --- | --- |
| Start the interactive terminal UI | `synai` |
| Run a focused task | `synai "Explain how authentication works in this repository"` |
| Ask for a plan | `synai --plan "Migrate this service to the new API"` |
| Require approval before tool calls | `synai --auto-approve false "Inspect and update this project"` |
| Stream machine-readable events | `synai --json "Summarize the current changes"` |
| Continue a named team workflow | `synai --team-name release "Review the release checklist"` |

SynAI can use its supported sign-in providers or an API key from providers such as Anthropic, OpenAI, Google Gemini, OpenRouter, AWS Bedrock, Google Cloud Vertex, Cerebras, Groq, and OpenAI-compatible endpoints. Run `synai login` for the setup flow or see the [CLI guide](packages/cli/README.md) for provider details.

## Chrome control

The CLI includes a browser command for controlling Chrome and inspecting web pages:

```sh
synai browser --status
synai browser --tabs
synai browser https://example.com --inspect
synai browser https://example.com --click 'button[type="submit"]'
synai browser https://example.com --screenshot ./page.png
```

Run `synai browser --help` for the full list of actions and options.

## Integrations

- **MCP:** connect local or remote Model Context Protocol servers with `synai mcp`.
- **Schedules:** create and manage recurring or event-driven agent runs with `synai schedule`.
- **Chat connectors:** bridge SynAI sessions to Telegram, Slack, Google Chat, WhatsApp, or Linear.
- **Structured output:** use `--json` to stream NDJSON events to scripts and other tools.

## Product surfaces

The repository includes the CLI, a Tauri desktop client, and a VS Code extension. Start with the [CLI documentation](packages/cli/README.md), or explore the [desktop app source](packages/desktop-app/apps/examples/desktop-app/README.md) and [VS Code extension source](packages/vscode-extension/README.md). Desktop installers are published on [GitHub Releases](https://github.com/realutj/synai/releases).

## Build from source

The repository is a TypeScript monorepo. Install Node.js 22 or newer and Bun, then build and launch the CLI:

```sh
git clone https://github.com/realutj/synai.git
cd synai
npm install
npm run build
npm start
```

For development, use `npm run dev:cli` or `npm run dev:web`. Package-specific setup and architecture notes are in each package directory.

## Contributing

Bug reports, feature requests, documentation improvements, and code contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

SynAI is available under the [MIT License](LICENSE).

<p align="center"><sub>Built in the open by SynAI contributors.</sub></p>
