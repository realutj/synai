# SynAI for VS Code

Autonomous AI Coding Agent for Visual Studio Code, powered by OpenRouter.

## Features

- 🤖 **Autonomous AI Agent**: Let AI handle coding tasks autonomously
- 💬 **Interactive Chat**: Natural language interface for coding assistance
- 🔧 **Multiple Models**: Support for Claude, GPT-4, Gemini, and more via OpenRouter
- ⚡ **Fast & Efficient**: Optimized for developer workflow
- 🎨 **Beautiful UI**: Clean, modern interface that matches VS Code theme

## Installation

1. Install the extension from VS Code Marketplace
2. Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai)
3. Configure your API key in VS Code settings (`Ctrl+,` → Search for "SynAI")

## Quick Start

1. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) to start SynAI
2. Open the SynAI sidebar from the activity bar
3. Start chatting with your AI coding assistant!

## Commands

- `SynAI: Start Agent` - Start the AI agent
- `SynAI: Stop Agent` - Stop the AI agent
- `SynAI: Select Model` - Choose a different AI model
- `SynAI: Open Settings` - Configure SynAI settings
- `SynAI: Clear Chat History` - Clear the conversation history

## Configuration

Configure SynAI in VS Code settings:

```json
{
  "synai.apiKey": "your-openrouter-api-key",
  "synai.model": "anthropic/claude-3.5-sonnet",
  "synai.maxTokens": 4096,
  "synai.temperature": 0.7,
  "synai.autoApprove": false
}
```

## Supported Models

- Anthropic Claude 3.5 Sonnet
- Anthropic Claude 3 Opus
- OpenAI GPT-4 Turbo
- OpenAI GPT-4
- Google Gemini Pro
- Meta Llama 3 70B

## Requirements

- VS Code 1.85.0 or higher
- OpenRouter API key

## Privacy

Your code and conversations are sent to OpenRouter for processing. Please review their privacy policy at [openrouter.ai](https://openrouter.ai).

## License

MIT

## Support

- 🐛 [Report Issues](https://github.com/synai/synai/issues)
- 💬 [Discussions](https://github.com/synai/synai/discussions)
- 📖 [Documentation](https://github.com/synai/synai)
