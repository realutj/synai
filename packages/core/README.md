# 🧠 @synai-code/core

> **The Supreme Autonomous AI Agent Engine, OpenRouter Client, and Multi-Domain Pipeline for SynAI.**

[![npm version](https://img.shields.io/npm/v/@synai-code/core.svg?style=flat-square&color=38bdf8)](https://www.npmjs.com/package/@synai-code/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square)](https://www.typescriptlang.org/)

`@synai-code/core` powers [SynAI](https://www.npmjs.com/package/synai) — the autonomous open-source AI coding assistant and supreme software engineering partner. It provides a headless, robust, fully-typed TypeScript engine for building autonomous AI agents with tools, streaming LLM providers, planning, and sandboxed computation.

---

## 🌟 Capabilities

- 🤖 **Supreme Autonomous Agent Engine (`Agent`)**: Full multi-turn conversational loop with live event emission, token tracking, interrupt/abort mechanics, and self-healing error recovery.
- 🌐 **OpenRouter Frontier & Free Model Integration (`OpenRouterClient`)**: Works out of the box with free frontier models (`cohere/north-mini-code:free`, `qwen/qwen-2.5-coder-32b-instruct:free`, `deepseek/deepseek-r1:free`) or any paid OpenRouter model.
- 🔢 **God-Tier Mathematics Engine (`math_eval`)**: Sandboxed Node VM execution with BigInt, combinatorics ($nCr$, $nPr$, factorial), number theory (GCD, LCM, modPow, prime factors, isPrime), linear algebra (matrices, determinants, dot, cross), statistics, and numerical calculus.
- 👥 **Multi-Domain Specialized Subagents (`SubagentOrchestrator`)**:
  - `mathematician` (Supreme Mathematical, Algorithmic & Scientific Specialist)
  - `coder` (Surgical Implementation Specialist)
  - `architect` (Principal Systems Architect)
  - `legal` (Supreme Legal Counsel & Contract Analyst)
  - `analyst` (Business Strategy & Unit Economics Analyst)
  - `research` (Codebase & Web Researcher)
  - `tester` (QA & Diagnostics Specialist)
  - `conversational` (High-IQ Intellectual Conversationalist)
- 🛠️ **Full Suite of Autonomous Tools (`ToolRegistry`)**:
  - Surgical file inspection (`view_file`), creation (`write_file`), search-and-replace (`edit_file`), and atomic transactions (`batch_edit`).
  - AST-aware symbol search (`find_symbols`), globbing (`find_files`), and ripgrep search (`grep_search`).
  - Safe terminal command runner (`run_command`) with read-only auto-approval heuristic.
  - Automated diagnostics & compiler typechecks (`run_diagnostics`).
  - Web research (`web_search`, `web_fetch`) and browser control (`browser`).
  - Human collaboration (`ask_user_question`).
- ⏪ **Atomic Checkpoint & Undo Engine (`CheckpointManager`)**: Records pre-modification file states before any write or edit, enabling instant `/undo` rollbacks.
- 📋 **Autonomous Roadmap Planner (`TaskPlanner`)**: Step-by-step milestone planning, task status tracking, and dependency management.
- 🔌 **Full-Duplex WebSocket & HTTP Server (`SynAIServer`)**: Powers web interfaces and remote IDE dashboards.

---

## 📦 Installation

```bash
npm install @synai-code/core
```

---

## 🚀 Quick Usage

```typescript
import { Agent, ConfigManager } from '@synai-code/core';

// 1. Initialize configuration with workspace root
const configManager = new ConfigManager(process.cwd());
const config = configManager.getConfig();

// 2. Instantiate autonomous agent
const agent = new Agent({
  ...config,
  model: 'cohere/north-mini-code:free',
  mode: 'confirm', // 'confirm' | 'auto' | 'dry-run'
  thinkingLevel: 'medium', // 'low' | 'medium' | 'high' | 'max'
});

// 3. Listen to streaming lifecycle events
agent.on('event', (event) => {
  if (event.type === 'token') {
    process.stdout.write(event.payload.text);
  } else if (event.type === 'tool_start') {
    console.log(`\nExecuting ${event.payload.tool}...`);
  }
});

// 4. Send prompt
await agent.chat('Calculate the 50th Fibonacci number and factorize 2^32 - 1');
```

---

## 📄 License

MIT © [SynAI Contributors](https://github.com/synai/synai)
