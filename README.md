# ⚡ SynAI — Autonomous Open-Source AI Coding Agent

<p align="center">
  <img src="https://img.shields.io/npm/v/synai.svg?style=for-the-badge&logo=npm&color=38bdf8" alt="npm version"/>
  <img src="https://img.shields.io/npm/dm/synai.svg?style=for-the-badge&logo=npm&color=10b981" alt="npm downloads"/>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT License"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=for-the-badge&logo=nodedotjs" alt="Node Version"/>
  <img src="https://img.shields.io/badge/AI-OpenRouter-7c3aed.svg?style=for-the-badge" alt="OpenRouter Powered"/>
</p>

<p align="center">
  <b>The modern, autonomous open-source AI pair programmer.</b><br/>
  <i>Think less. Build more. Ship faster.</i>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 🚀 What is SynAI?

**SynAI** is an autonomous AI coding agent that works as your intelligent pair programmer. Powered by cutting-edge frontier models through OpenRouter, it understands context, writes code, fixes bugs, refactors architecture, and executes commands—all from your terminal or web browser.

Unlike other AI tools, SynAI is:

- ✨ **Truly Autonomous** — Plans, executes, and verifies its own work
- 🔓 **100% Open Source** — MIT licensed, community-driven, transparent
- 🎯 **Context-Aware** — Understands your entire codebase, not just snippets
- 🛡️ **Safe by Default** — Interactive approval modes prevent unwanted changes
- 🌐 **Model Agnostic** — Works with 20+ free models or bring your own API key

---

## ✨ Features

### 🧠 **Intelligent Agent Core**

- **Multi-Step Planning** — Breaks complex tasks into executable steps
- **Self-Correction** — Detects and fixes its own errors automatically
- **Context Management** — Maintains conversation history and project understanding
- **Tool Integration** — File editing, shell commands, web search, and more
- **Multi-Agent Collaboration** — Multiple AI agents discuss and solve problems together

### 💻 **Dual Interface**

- **Terminal CLI** — Beautiful, themed REPL with live streaming and syntax highlighting
- **Web Dashboard** — Modern React UI with real-time chat, file explorer, and diff viewer

### 🎨 **Personalization**

- **7 Built-in Themes** — Cyan, Cyberpunk, Matrix, Dracula, Ocean, Amber, Monochrome
- **Custom Workflows** — Slash commands, approval modes, and model switching
- **Checkpoint System** — Atomic undo with automatic rollback capabilities

### 🔧 **Developer Tools**

- **Smart File Editor** — Context-aware atomic patches with diff preview
- **Symbol Search** — AST-based code navigation across your project
- **Web Integration** — Fetch documentation, search Stack Overflow, browse APIs
- **Math Engine** — High-precision calculations with BigInt and symbolic algebra

### 🌍 **Model Freedom**

- **20+ Free Models** — No API key required to start coding
- **OpenRouter Integration** — Access Claude, GPT-4, DeepSeek, Gemini, and more
- **Local Model Support** — Run completely offline with Ollama or LM Studio
- **Dynamic Discovery** — Automatically finds the best available model

---

## 📦 Quick Start

### Two Versions Available

**🔹 synai (Lightweight)** — Basic AI chat wrapper (9KB)

```bash
npm i -g synai
```

**🔸 Full CLI (From Source)** — Complete feature set with multi-agent, web UI, etc.

```bash
git clone https://github.com/realutj/synai.git
cd synai
npm install
npm run build
npm start
```

### One-Line Install Scripts

**Linux/macOS:**

```bash
curl -fsSL cdn.jsdelivr.net/gh/realutj/synai/install.sh | bash
```

**Windows:**

```powershell
irm cdn.jsdelivr.net/gh/realutj/synai/install.ps1 | iex
```

### Usage

**Lightweight version (npm):**

```bash
# Quick AI chat
export OPENROUTER_API_KEY="your-key"
synai "create a hello world app"
```

**Full CLI (source build):**

```bash
# Complete features
cd synai
npm start
# or use: synai collab "topic"
```

### Build from Source (Optional for Development)

```bash
# Clone repository
git clone https://github.com/realutj/synai.git
cd synai

# Install dependencies
npm install

# Build all packages
npm run build

# Run locally
npm start
```

> **💡 Note:** For most users, `npm install -g synai` is recommended. Building from source is only needed for development or customization.

---

## 🎯 Installation

### Prerequisites

- **Node.js** ≥ 22.0.0 (Latest LTS recommended)
- **npm** ≥ 9.0.0
- **Terminal** with UTF-8 support (Windows Terminal, iTerm2, or modern Linux terminal)
- **OpenRouter API Key** — Get free at https://openrouter.ai

### Platform Support

| Platform          | Status             | Notes                   |
| ----------------- | ------------------ | ----------------------- |
| macOS (x64/arm64) | ✅ Fully Supported | Native performance      |
| Linux (x64/arm64) | ✅ Fully Supported | Tested on Ubuntu 20.04+ |
| Windows 10/11     | ✅ Fully Supported | Use PowerShell or WSL2  |

---

## ⚙️ Configuration

### First-Time Setup

When you first run `synai`, an interactive onboarding wizard will guide you through:

1. **Theme Selection** — Choose your terminal color scheme
2. **API Key Setup** — Enter your OpenRouter key or use free models
3. **Approval Mode** — Select safety level (confirm/auto/dry-run)

### Manual Configuration

```bash
# Set OpenRouter API key
synai config --key "sk-or-v1-..."

# Change theme
synai theme matrix

# Set default approval mode
synai mode auto

# View current configuration
synai config --show
```

### Environment Variables

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export SYNAI_THEME="cyberpunk"
export SYNAI_APPROVAL_MODE="confirm"
export SYNAI_MODEL="anthropic/claude-3.5-sonnet"
```

---

## 🎨 Themes

SynAI includes 7 carefully crafted color schemes:

| Theme                | Colors                | Best For                |
| -------------------- | --------------------- | ----------------------- |
| **Cyan** _(Default)_ | Electric blue & amber | Modern clean aesthetic  |
| **Cyberpunk**        | Neon pink & cyan      | High-energy futuristic  |
| **Matrix**           | Terminal green & lime | Classic hacker terminal |
| **Dracula**          | Purple & pink         | Dark mode night coding  |
| **Ocean**            | Royal blue & teal     | Calming cool tones      |
| **Amber**            | Warm amber & gold     | Vintage CRT nostalgia   |
| **Monochrome**       | White & slate         | Minimalist focus        |

Switch themes anytime:

```bash
synai theme --list         # List all themes
synai theme cyberpunk      # Switch to Cyberpunk
/theme                     # Interactive theme picker in REPL
```

---

## 📚 CLI Commands

### Interactive REPL

Inside the `synai` REPL, use slash commands:

| Command                          | Description                               |
| -------------------------------- | ----------------------------------------- |
| `/model [name]`                  | Switch AI model                           |
| `/mode [confirm\|auto\|dry-run]` | Change approval mode                      |
| `/theme [name]`                  | Switch color theme                        |
| `/plan`                          | View or create task plans                 |
| `/undo`                          | Rollback recent changes                   |
| `/files [path]`                  | Browse workspace files                    |
| `/view <file>`                   | Display file with syntax highlighting     |
| `/grep <pattern>`                | Search code with regex                    |
| `/symbols`                       | Extract code symbols (functions, classes) |
| `/browser <url>`                 | Fetch web content or search               |
| `/collab <topic>`                | Start multi-agent collaboration           |
| `/web`                           | Launch Web Dashboard                      |
| `/status`                        | Show session info                         |
| `/help`                          | Display command reference                 |
| `/exit`                          | Exit SynAI                                |

### Global CLI Commands

````bash
synai init              # Run onboarding wizard
synai collab "task"     # Multi-agent collaboration mode
synai web               # Launch Web Dashboard
### Global CLI Commands

```bash
synai "task"            # Execute task
synai collab "topic"    # Multi-agent collaboration
synai studio            # Launch Web Dashboard
synai board             # Kanban board
synai -i                # Interactive TUI
synai --help            # Full help
```🤝 Multi-Agent Collaboration

SynAI features a unique **multi-agent collaboration mode** where multiple AI agents with different expertise discuss and solve problems together, just like a real development team.

### How It Works

When you start a collaboration session, SynAI spawns multiple specialized AI agents:

- 🏗️ **Alex (Architect)** — Focuses on system design, architecture, and scalability
- 💻 **Dev (Developer)** — Handles implementation details, code quality, and best practices
- 🔍 **Riley (Reviewer)** — Identifies edge cases, security issues, and potential bugs

These agents engage in a structured discussion, each bringing their unique perspective to solve your problem collaboratively.

### Usage

```bash
# Start multi-agent collaboration
synai collab "Build a REST API with authentication"

# Specify different models for each agent
synai collab "Design microservices" -m "claude-3.5-sonnet,gpt-4-turbo,deepseek-chat"

# Use same model for all agents
synai collab "Optimize database queries" --models "gemini-pro"

# Use specific agents with custom models
synai collab "Fix security issues" -a architect,reviewer -m "claude-3.5-sonnet,gpt-4"

# Limit discussion rounds
synai collab "Review code architecture" --rounds 3 -m "claude-3.5-sonnet,deepseek-chat,gemini-pro"

# Verbose mode for detailed reasoning
synai collab "Design system architecture" --verbose -m "claude-3.5-sonnet"
````

### Example Session

```
═══════════════════════════════════════════════════════
🤝 MULTI-AGENT COLLABORATION
Topic: Build a REST API with authentication
═══════════════════════════════════════════════════════

Participants:
  • Alex (Architect) — System Designer
  • Dev (Developer) — Implementation Expert
  • Riley (Reviewer) — Quality Assurance

Discussion:

💡 Alex (Architect):
   For this problem, I suggest we design a modular architecture with
   clear separation of concerns. We should consider scalability from
   the start and use JWT for stateless authentication.

💡 Dev (Developer):
   I can implement this using Node.js with Express and TypeScript.
   We'll need bcrypt for password hashing, jsonwebtoken for JWT,
   and proper middleware for auth verification.

💡 Riley (Reviewer):
   What about rate limiting? We need to protect against brute force
   attacks. Also consider refresh token rotation and secure cookie
   settings with httpOnly and SameSite flags.

💬 Alex (Architect):
   Good points. Let's add Redis for session management and rate
   limiting. We should also implement proper CORS configuration.

💬 Dev (Developer):
   Agreed. I'll structure it with controllers, services, and
   middleware layers. Unit tests for all critical paths.

✅ Riley (Reviewer):
   Perfect. Don't forget input validation with Zod or Joi, and
   proper error handling middleware.

═══════════════════════════════════════════════════════
✅ FINAL DECISION:

The team has reached consensus on building a REST API with:

Key Decisions:
• Architecture: Modular Express.js with TypeScript
• Authentication: JWT with refresh tokens, bcrypt password hashing
• Security: Rate limiting, CORS, input validation, secure cookies
• Testing: Comprehensive unit and integration tests

Implementation Plan:
1. Set up Express server with TypeScript configuration
2. Implement authentication middleware and JWT handling
3. Add Redis for rate limiting and session management
4. Create user routes with proper validation
5. Write tests and security audit

All agents have approved this plan. Ready to proceed!
═══════════════════════════════════════════════════════
```

### Options

| Option                  | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `-a, --agents <names>`  | Comma-separated agent IDs (default: all three)            |
| `-r, --rounds <number>` | Maximum discussion rounds (default: 5)                    |
| `-m, --models <models>` | Models for agents: "model1,model2,model3" or single model |
| `-P, --provider <id>`   | Provider service (default: openrouter)                    |
| `-k, --key <api-key>`   | API key override                                          |
| `-v, --verbose`         | Show detailed agent reasoning and thought processes       |

**Popular Models:**

- `claude-3.5-sonnet` — Best reasoning and code quality
- `gpt-4-turbo` — Excellent for implementation details
- `deepseek-chat` — Fast and cost-effective
- `gemini-pro` — Strong at system design
- `mistral-large` — Good balance of speed and quality

### Benefits

- 🎯 **Better Decisions** — Multiple perspectives catch more issues
- 🔒 **Improved Security** — Dedicated reviewer identifies vulnerabilities
- 📐 **Solid Architecture** — Expert architect ensures scalability
- 🐛 **Fewer Bugs** — Collaborative review catches edge cases
- 📚 **Learning Tool** — See how experts approach problems differently

---

## 🌐 Web Dashboard

Launch the full-featured web interface:

```bash
synai web
# Opens http://localhost:4242
```

### Features

- 💬 **Live Chat Interface** — Real-time streaming with markdown & syntax highlighting
- 📁 **File Explorer** — Browse, view, and edit project files
- 🔍 **Diff Viewer** — Side-by-side comparison of agent changes
- 📊 **Status Dashboard** — Monitor token usage, costs, and performance
- 🖥️ **Integrated Terminal** — View logs and command outputs

---

## 🏗️ Architecture

SynAI is built as a TypeScript monorepo:

```
synai/
├── packages/
│   ├── synai/           # Main npm package (lightweight CLI wrapper)
│   ├── core/            # Agent engine, tools, OpenRouter client
│   ├── cli/             # Full-featured interactive CLI
│   ├── web/             # React + Vite web dashboard
│   └── shared/          # Shared types and utilities
├── scripts/             # Build and distribution tools
├── docs/                # Documentation
├── LICENSE              # MIT License
├── CODE_OF_CONDUCT.md   # Contributor Covenant 2.1
├── CONTRIBUTING.md      # Contribution guidelines
└── SECURITY.md          # Security policy
```

---

## 🔧 Development

### Building from Source

```bash
# Clone and install
git clone https://github.com/realutj/synai.git
cd synai
npm install

# Build all packages
npm run build

# Development mode (watch for changes)
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Package Scripts

| Script           | Description            |
| ---------------- | ---------------------- |
| `npm run build`  | Build all packages     |
| `npm run dev`    | Watch mode development |
| `npm test`       | Run test suites        |
| `npm run lint`   | Lint with ESLint       |
| `npm run format` | Format with Prettier   |
| `npm start`      | Launch CLI             |

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Read Guidelines** — Check [`CONTRIBUTING.md`](./CONTRIBUTING.md)
2. **Follow Code of Conduct** — See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
3. **Open an Issue** — Discuss features or report bugs
4. **Submit a PR** — Fork, branch, code, test, submit

### Areas to Contribute

- 🐛 Bug fixes and error handling
- ✨ New features and tools
- 📝 Documentation improvements
- 🎨 UI/UX enhancements
- 🌍 Internationalization (i18n)
- 🧪 Test coverage expansion

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

```
MIT License

Copyright (c) 2026 SynAI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🌟 Acknowledgments

SynAI is built on the shoulders of giants:

- **OpenRouter** — Multi-model API aggregation
- **Anthropic Claude** — Advanced reasoning models
- **Commander.js** — CLI argument parsing
- **Chalk** — Terminal styling
- **React** — Web UI framework
- **Vite** — Lightning-fast build tool

---

## 📞 Support & Community

- 🐛 **Issues** — [GitHub Issues](https://github.com/realutj/synai/issues)
- 💬 **Discussions** — [GitHub Discussions](https://github.com/realutj/synai/discussions)
- 📧 **Email** — synai2026@hotmail.com

---

## 🗺️ Roadmap

### v1.3.0 (Q2 2026)

- [x] Multi-agent collaboration mode
- [ ] Plugin system for custom tools
- [ ] VS Code extension
- [ ] Docker container support

### v1.4.0 (Q3 2026)

- [ ] Team collaboration features
- [ ] Cloud sync for settings
- [ ] Advanced debugging tools
- [ ] Performance profiling

### v2.0.0 (Q4 2026)

- [ ] GUI desktop application
- [ ] Enterprise features
- [ ] Self-hosting capabilities
- [ ] Advanced security auditing

---

<p align="center">
  <sub>Built with ❤️ by the SynAI community</sub>
</p>

<p align="center">
  <a href="https://github.com/realutj/synai">⭐ Star us on GitHub</a> •
  <a href="https://www.npmjs.com/package/synai">📦 npm Package</a> •
  <a href="./docs">📖 Documentation</a>
</p>
