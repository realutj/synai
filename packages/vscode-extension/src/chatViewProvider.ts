import * as vscode from 'vscode';
import { SynAIAgent } from './agent';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private agent?: SynAIAgent;
  private messages: Array<{ role: string; content: string }> = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage':
          await this.handleSendMessage(data.message);
          break;
        case 'clearHistory':
          this.clearHistory();
          break;
      }
    });
  }

  private async handleSendMessage(message: string) {
    if (!this._view) return;

    this.messages.push({ role: 'user', content: message });
    this._view.webview.postMessage({
      type: 'userMessage',
      content: message
    });

    try {
      const config = vscode.workspace.getConfiguration('synai');
      const apiKey = config.get<string>('apiKey');

      if (!apiKey) {
        this._view.webview.postMessage({
          type: 'error',
          content: 'API Key not configured. Please configure it in settings.'
        });
        return;
      }

      if (!this.agent) {
        this.agent = new SynAIAgent(apiKey, config);
      }

      const response = await this.agent.sendMessage(message);
      
      this.messages.push({ role: 'assistant', content: response });
      this._view.webview.postMessage({
        type: 'assistantMessage',
        content: response
      });
    } catch (error: any) {
      this._view.webview.postMessage({
        type: 'error',
        content: error.message
      });
    }
  }

  public clearHistory() {
    this.messages = [];
    if (this.agent) {
      this.agent.clearHistory();
    }
    if (this._view) {
      this._view.webview.postMessage({ type: 'clearMessages' });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SynAI Chat</title>
      <style>
        body {
          margin: 0;
          padding: 10px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .messages {
          height: calc(100vh - 120px);
          overflow-y: auto;
          padding: 10px;
          margin-bottom: 10px;
        }
        .message {
          margin: 10px 0;
          padding: 10px;
          border-radius: 5px;
        }
        .user-message {
          background-color: var(--vscode-input-background);
          border-left: 3px solid var(--vscode-activityBarBadge-background);
        }
        .assistant-message {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-left: 3px solid var(--vscode-charts-green);
        }
        .error-message {
          background-color: var(--vscode-inputValidation-errorBackground);
          border-left: 3px solid var(--vscode-inputValidation-errorBorder);
          color: var(--vscode-errorForeground);
        }
        .input-container {
          display: flex;
          gap: 5px;
        }
        #messageInput {
          flex: 1;
          padding: 8px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 3px;
        }
        button {
          padding: 8px 16px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .role-label {
          font-weight: bold;
          margin-bottom: 5px;
          font-size: 12px;
          opacity: 0.8;
        }
        pre {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 8px;
          border-radius: 3px;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <div class="messages" id="messages"></div>
      <div class="input-container">
        <input type="text" id="messageInput" placeholder="Type your message..." />
        <button id="sendBtn">Send</button>
        <button id="clearBtn">Clear</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const clearBtn = document.getElementById('clearBtn');

        function addMessage(role, content) {
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message ' + role + '-message';
          
          const labelDiv = document.createElement('div');
          labelDiv.className = 'role-label';
          labelDiv.textContent = role.charAt(0).toUpperCase() + role.slice(1);
          
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = formatContent(content);
          
          messageDiv.appendChild(labelDiv);
          messageDiv.appendChild(contentDiv);
          messagesDiv.appendChild(messageDiv);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function formatContent(content) {
          // Basic markdown-like formatting
          return content
            .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre>$1</pre>')
            .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
            .replace(/\\n/g, '<br>');
        }

        sendBtn.addEventListener('click', sendMessage);
        clearBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'clearHistory' });
        });

        messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });

        function sendMessage() {
          const message = messageInput.value.trim();
          if (message) {
            vscode.postMessage({
              type: 'sendMessage',
              message: message
            });
            messageInput.value = '';
          }
        }

        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'userMessage':
              addMessage('user', message.content);
              break;
            case 'assistantMessage':
              addMessage('assistant', message.content);
              break;
            case 'error':
              addMessage('error', message.content);
              break;
            case 'clearMessages':
              messagesDiv.innerHTML = '';
              break;
          }
        });
      </script>
    </body>
    </html>`;
  }
}
