# SynAI for VS Code 🚀

Next-Generation Autonomous AI Coding Assistant for Visual Studio Code, powered by OpenRouter and all frontier AI models.

## ✨ Key Features

- 🧠 **Frontier Reasoning & Coding Models**: Instant access to Claude 3.7 Sonnet (with Thinking), OpenAI o3-mini, DeepSeek R1, Gemini 2.0 Flash Thinking, Qwen 2.5 Coder 32B, and more.
- 🌐 **All OpenRouter Models Supported**: Live model explorer lets you search, filter, and pick from **hundreds of models** or enter any custom model ID.
- 🆓 **100% Free Tier Included**: Route to free models with zero credit required (`openrouter/free`, `deepseek/deepseek-r1:free`, `google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`).
- ⚡ **Real-Time Streaming**: Low-latency token streaming with live thinking/reasoning collapsible display.
- 📎 **Context-Aware**: Automatically captures your active file, selection range, and programming language.
- ✍️ **One-Click Code Actions**:
  - **Insert at Cursor**: Directly insert code snippets into your active editor.
  - **Create New File**: Open a new editor tab populated with the generated code.
  - **Copy Code**: One-click clipboard copy with visual feedback.
- 🔍 **Editor Context Menu Integrations**:
  - Right-click any selection: **SynAI: Explain Code**, **Refactor Code**, **Find Bugs**, or **Generate Unit Tests**.

---

## 🚀 Quick Start

1. Get your API key from [openrouter.ai/keys](https://openrouter.ai/keys).
2. In VS Code, press `Ctrl+,` (or `Cmd+,`), search for `synai.apiKey`, and paste your key.
3. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) to focus SynAI in the sidebar.
4. Select your favorite model from the dropdown and start building!

---

## 🏆 Supported Models (Catalog & Live Fetch)

SynAI includes curated presets and dynamically fetches the entire OpenRouter roster:

### 🧠 Reasoning & Frontier (2025/2026)
- **Claude 3.7 Sonnet** (`anthropic/claude-3.7-sonnet`) - Hybrid coding & reasoning champion
- **Claude 3.7 Sonnet (Thinking)** (`anthropic/claude-3.7-sonnet:thinking`) - Extended chain-of-thought
- **OpenAI o3-mini** (`openai/o3-mini`) - SOTA STEM & code reasoning
- **OpenAI o1** (`openai/o1`) - Deep reasoning foundation
- **DeepSeek R1** (`deepseek/deepseek-r1` / `deepseek/deepseek-r1:free`) - Open reasoning benchmark leader
- **Gemini 2.0 Flash Thinking** (`google/gemini-2.0-flash-thinking-exp:free`)

### 💻 Coding Specialists
- **Claude 3.5 Sonnet** (`anthropic/claude-3.5-sonnet`)
- **Qwen 2.5 Coder 32B** (`qwen/qwen-2.5-coder-32b-instruct`)
- **DeepSeek V3** (`deepseek/deepseek-chat`)
- **Mistral Codestral 2501** (`mistralai/codestral-2501`)

### ⚡ Fast & Economical
- **Claude 3.5 Haiku** (`anthropic/claude-3.5-haiku`)
- **OpenAI GPT-4o-mini** (`openai/gpt-4o-mini`)
- **Gemini 2.0 Flash** (`google/gemini-2.0-flash-001`)
- **Meta Llama 3.3 70B** (`meta-llama/llama-3.3-70b-instruct`)

### 🆓 100% Free Tier
- **OpenRouter Free Auto-Router** (`openrouter/free`)
- **DeepSeek R1 Free** (`deepseek/deepseek-r1:free`)
- **Gemini 2.0 Flash Exp Free** (`google/gemini-2.0-flash-exp:free`)
- **Llama 3.3 70B Free** (`meta-llama/llama-3.3-70b-instruct:free`)
- **Qwen 2.5 Coder 32B Free** (`qwen/qwen-2.5-coder-32b-instruct:free`)

---

## ⌨️ Commands & Shortcuts

| Command | Shortcut | Description |
|---|---|---|
| `SynAI: Open Chat` | `Ctrl+Shift+A` | Focuses the SynAI sidebar chat |
| `SynAI: Stop Generation` | - | Aborts the active streaming response |
| `SynAI: Select Model` | - | QuickPick modal to search all models |
| `SynAI: Explain Selected Code` | Right-click | Explains the selected code block |
| `SynAI: Refactor Selected Code` | Right-click | Refactors selected code for quality & speed |
| `SynAI: Find Bugs in Selection` | Right-click | Scans selection for edge cases & security bugs |
| `SynAI: Generate Unit Tests` | Right-click | Writes unit test suite for selected code |
| `SynAI: Clear Chat History` | - | Clears session conversation history |

---

## ⚙️ Configuration Settings

Configure SynAI under `Settings > Extensions > SynAI`:

```json
{
  "synai.apiKey": "sk-or-v1-...",
  "synai.model": "anthropic/claude-3.7-sonnet",
  "synai.maxTokens": 8192,
  "synai.temperature": 0.7,
  "synai.systemPrompt": ""
}
```

---

## 📄 License

MIT © [realutj](https://github.com/realutj/synai)
