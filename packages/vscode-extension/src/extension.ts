import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { fetchAllOpenRouterModels } from './models';

let chatViewProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('SynAI VS Code extension is active.');

  // Initialize the chat view provider
  chatViewProvider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'synai.chatView',
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Command: Start / Focus SynAI
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.start', async () => {
      await vscode.commands.executeCommand('synai.chatView.focus');
    })
  );

  // Command: Stop Generation
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.stop', () => {
      if (chatViewProvider) {
        chatViewProvider.stopGeneration();
        vscode.window.showInformationMessage('SynAI: Generation stopped.');
      }
    })
  );

  // Command: Open Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'synai');
    })
  );

  // Command: Select Model (Interactive QuickPick with All Models)
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.selectModel', async () => {
      const config = vscode.workspace.getConfiguration('synai');
      const apiKey = config.get<string>('apiKey') || '';
      const currentModel = config.get<string>('model') || 'anthropic/claude-3.7-sonnet';

      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = 'Search all OpenRouter models or enter a custom model ID...';
      quickPick.busy = true;
      quickPick.show();

      try {
        const allModels = await fetchAllOpenRouterModels(apiKey);
        quickPick.busy = false;

        const items: vscode.QuickPickItem[] = [
          {
            label: '$(edit) Custom Model ID...',
            description: 'Enter any OpenRouter or OpenAI-compatible model ID manually'
          },
          {
            label: '',
            kind: vscode.QuickPickItemKind.Separator
          }
        ];

        // Group models for quickpick
        const groups: { key: string; label: string }[] = [
          { key: 'recommended', label: '⭐ Recommended Models' },
          { key: 'free', label: '🆓 100% Free Models' },
          { key: 'anthropic', label: '🟣 Anthropic (Claude)' },
          { key: 'openai', label: '🟢 OpenAI' },
          { key: 'google', label: '🔵 Google (Gemini)' },
          { key: 'deepseek', label: '🔴 DeepSeek' },
          { key: 'meta', label: '🟠 Meta (Llama)' },
          { key: 'mistral', label: '🟡 Mistral' },
          { key: 'qwen', label: '🩵 Qwen / Alibaba' },
          { key: 'other', label: '🌐 Other OpenRouter Models' }
        ];

        for (const g of groups) {
          const groupModels = allModels.filter(m => m.group === g.key);
          if (groupModels.length > 0) {
            items.push({ label: `${g.label} (${groupModels.length})`, kind: vscode.QuickPickItemKind.Separator });
            items.push(...groupModels.map(m => {
              const freeSuffix = m.isFree ? ' [FREE]' : '';
              const ctxSuffix = m.contextLength ? ` [${Math.round(m.contextLength / 1000)}k]` : '';
              return {
                label: m.id === currentModel ? `$(check) ${m.name}` : m.name,
                description: `${m.id}${freeSuffix}${ctxSuffix}`,
                detail: m.description
              };
            }));
          }
        }

        quickPick.items = items;

        quickPick.onDidAccept(async () => {
          const selected = quickPick.selectedItems[0];
          quickPick.hide();

          if (!selected) return;

          if (selected.label.includes('Custom Model ID')) {
            const customId = await vscode.window.showInputBox({
              prompt: 'Enter full OpenRouter model ID (e.g. anthropic/claude-3.7-sonnet or deepseek/deepseek-r1)',
              value: currentModel
            });
            if (customId && customId.trim()) {
              await chatViewProvider?.setModelFromExternal(customId.trim());
              vscode.window.showInformationMessage(`SynAI: Model set to ${customId.trim()}`);
            }
          } else {
            // Find model id from description
            const match = selected.description?.split(' ')[0];
            if (match) {
              await chatViewProvider?.setModelFromExternal(match);
              vscode.window.showInformationMessage(`SynAI: Model set to ${match}`);
            }
          }
        });
      } catch (err: any) {
        quickPick.hide();
        vscode.window.showErrorMessage(`Failed to load models: ${err.message}`);
      }
    })
  );

  // Command: Clear History
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.clearHistory', () => {
      if (chatViewProvider) {
        chatViewProvider.clearHistory();
        vscode.window.showInformationMessage('SynAI: Chat history cleared.');
      }
    })
  );

  // Code Context Menu Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.explainCode', async () => {
      await vscode.commands.executeCommand('synai.chatView.focus');
      chatViewProvider?.sendExternalPrompt(
        'Please explain this code thoroughly. Detail its logic, architecture, inputs/outputs, and any noteworthy patterns.',
        true
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.refactorCode', async () => {
      await vscode.commands.executeCommand('synai.chatView.focus');
      chatViewProvider?.sendExternalPrompt(
        'Please refactor this code to improve clarity, maintainability, and runtime performance while adhering to idiomatic patterns.',
        true
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.findBugs', async () => {
      await vscode.commands.executeCommand('synai.chatView.focus');
      chatViewProvider?.sendExternalPrompt(
        'Review this code carefully for bugs, memory leaks, security vulnerabilities, edge cases, and unexpected behaviors.',
        true
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.generateTests', async () => {
      await vscode.commands.executeCommand('synai.chatView.focus');
      chatViewProvider?.sendExternalPrompt(
        'Generate a comprehensive suite of unit tests with edge cases, happy paths, and error scenarios for this code.',
        true
      );
    })
  );
}

export function deactivate() {
  if (chatViewProvider) {
    chatViewProvider.stopGeneration();
    chatViewProvider = undefined;
  }
}
