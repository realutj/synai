import * as vscode from 'vscode';
import { SynAIAgent } from './agent';
import { ChatViewProvider } from './chatViewProvider';

let agent: SynAIAgent | undefined;
let chatViewProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('SynAI extension is now active!');

  // Initialize the chat view provider
  chatViewProvider = new ChatViewProvider(context.extensionUri);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'synai.chatView',
      chatViewProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('synai.start', async () => {
      const config = vscode.workspace.getConfiguration('synai');
      const apiKey = config.get<string>('apiKey');
      
      if (!apiKey) {
        const action = await vscode.window.showErrorMessage(
          'SynAI API Key not configured',
          'Configure Now'
        );
        
        if (action === 'Configure Now') {
          await vscode.commands.executeCommand('synai.openSettings');
        }
        return;
      }

      if (!agent) {
        agent = new SynAIAgent(apiKey, config);
        vscode.window.showInformationMessage('SynAI Agent started');
      } else {
        vscode.window.showWarningMessage('SynAI Agent is already running');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.stop', () => {
      if (agent) {
        agent.dispose();
        agent = undefined;
        vscode.window.showInformationMessage('SynAI Agent stopped');
      } else {
        vscode.window.showWarningMessage('SynAI Agent is not running');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.openSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'synai'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.selectModel', async () => {
      const models = [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-opus',
        'openai/gpt-4-turbo',
        'openai/gpt-4',
        'google/gemini-pro',
        'meta-llama/llama-3-70b-instruct'
      ];

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select a model'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('synai');
        await config.update('model', selected, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Model changed to: ${selected}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('synai.clearHistory', () => {
      if (chatViewProvider) {
        chatViewProvider.clearHistory();
        vscode.window.showInformationMessage('Chat history cleared');
      }
    })
  );

  // Show welcome message
  vscode.window.showInformationMessage('Welcome to SynAI! Press Ctrl+Shift+A to start.');
}

export function deactivate() {
  if (agent) {
    agent.dispose();
    agent = undefined;
  }
}
