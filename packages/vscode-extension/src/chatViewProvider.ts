import * as vscode from 'vscode';
import { SynAIAgent } from './agent';
import { fetchAllOpenRouterModels, ModelDefinition } from './models';
import {
  getActiveEditorContext,
  formatContextPrompt,
  insertCodeAtCursor,
  createNewFileWithContent
} from './context';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private agent?: SynAIAgent;
  private currentAbortController?: AbortController;
  private cachedModels: ModelDefinition[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for messages from webview
    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'ready':
        case 'requestModels':
          await this.sendModelsList(data.force === true);
          break;
        case 'sendMessage':
          await this.handleSendMessage(data.message, data.attachContext);
          break;
        case 'stopGeneration':
          this.stopGeneration();
          break;
        case 'clearHistory':
          this.clearHistory();
          break;
        case 'selectModel':
          await this.handleModelSelection(data.modelId);
          break;
        case 'refreshModels':
          await this.sendModelsList(true);
          break;
        case 'insertCode':
          await insertCodeAtCursor(data.code);
          break;
        case 'newFile':
          await createNewFileWithContent(data.code, data.language);
          break;
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'synai');
          break;
        case 'requestContext':
          this.sendActiveContext();
          break;
      }
    });

    // Update active context whenever editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.sendActiveContext();
    });

    vscode.window.onDidChangeTextEditorSelection(() => {
      this.sendActiveContext();
    });
  }

  public sendActiveContext() {
    if (!this._view) return;
    const context = getActiveEditorContext();
    this._view.webview.postMessage({
      type: 'contextUpdate',
      context
    });
  }

  public async setModelFromExternal(modelId: string) {
    const config = vscode.workspace.getConfiguration('synai');
    await config.update('model', modelId, vscode.ConfigurationTarget.Global);
    if (this.agent) {
      this.agent.setModel(modelId);
    }
    if (this._view) {
      this._view.webview.postMessage({
        type: 'modelSelected',
        modelId
      });
    }
  }

  public async sendModelsList(forceRefresh: boolean = false) {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('synai');
    const apiKey = config.get<string>('apiKey') || '';
    const currentModel = config.get<string>('model') || 'anthropic/claude-3.7-sonnet';

    // Send loading state
    this._view.webview.postMessage({ type: 'modelsLoading' });

    try {
      this.cachedModels = await fetchAllOpenRouterModels(apiKey, forceRefresh);
    } catch {
      // Fallback
    }

    this._view.webview.postMessage({
      type: 'modelsList',
      models: this.cachedModels,
      currentModel,
      count: this.cachedModels.length
    });
  }

  private async handleModelSelection(modelId: string) {
    const config = vscode.workspace.getConfiguration('synai');
    await config.update('model', modelId, vscode.ConfigurationTarget.Global);
    if (this.agent) {
      this.agent.setModel(modelId);
    }
    vscode.window.showInformationMessage(`SynAI: Active model switched to ${modelId}`);
  }

  private async handleSendMessage(userMessage: string, attachContext: boolean) {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('synai');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
      this._view.webview.postMessage({
        type: 'error',
        content: 'OpenRouter API Key not configured. Please enter your OpenRouter API key in settings.'
      });
      const action = await vscode.window.showErrorMessage(
        'SynAI: OpenRouter API Key not configured.',
        'Configure API Key'
      );
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'synai.apiKey');
      }
      return;
    }

    if (!this.agent) {
      this.agent = new SynAIAgent(apiKey, config);
    } else {
      this.agent.updateConfig({
        apiKey,
        model: config.get<string>('model') || 'anthropic/claude-3.7-sonnet',
        maxTokens: config.get<number>('maxTokens') || 8192,
        temperature: config.get<number>('temperature') || 0.7,
        systemPrompt: config.get<string>('systemPrompt'),
        customBaseUrl: config.get<string>('customBaseUrl')
      });
    }

    // Build context prefix if enabled
    let promptToSend = userMessage;
    if (attachContext) {
      const editorCtx = getActiveEditorContext();
      if (editorCtx.hasEditor) {
        promptToSend = formatContextPrompt(editorCtx) + userMessage;
      }
    }

    this.currentAbortController = new AbortController();

    this._view.webview.postMessage({
      type: 'userMessage',
      content: userMessage,
      attachedContext: attachContext ? getActiveEditorContext().fileName : undefined
    });

    this._view.webview.postMessage({
      type: 'streamStart',
      modelId: this.agent.getModel()
    });

    try {
      await this.agent.sendMessageStream(promptToSend, {
        signal: this.currentAbortController.signal,
        onReasoning: (chunk) => {
          this._view?.webview.postMessage({
            type: 'streamReasoning',
            chunk
          });
        },
        onChunk: (chunk) => {
          this._view?.webview.postMessage({
            type: 'streamChunk',
            chunk
          });
        }
      });

      this._view.webview.postMessage({
        type: 'streamEnd'
      });
    } catch (err: any) {
      if (this.currentAbortController.signal.aborted) {
        this._view.webview.postMessage({
          type: 'streamEnd',
          cancelled: true
        });
      } else {
        this._view.webview.postMessage({
          type: 'error',
          content: err.message || 'An error occurred during response generation.'
        });
      }
    } finally {
      this.currentAbortController = undefined;
    }
  }

  public stopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = undefined;
    }
  }

  public clearHistory() {
    this.stopGeneration();
    if (this.agent) {
      this.agent.clearHistory();
    }
    if (this._view) {
      this._view.webview.postMessage({ type: 'clearMessages' });
    }
  }

  public sendExternalPrompt(prompt: string, attachContext: boolean = true) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'triggerPrompt',
        prompt,
        attachContext
      });
    }
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SynAI</title>
  <style>
    :root {
      --radius: 6px;
      --transition: 0.15s ease;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* --- TOP HEADER TOOLBAR --- */
    .header-bar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      background-color: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.08));
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border, rgba(128, 128, 128, 0.2)));
      flex-shrink: 0;
    }

    .top-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .model-selector-wrap {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    .model-select {
      width: 100%;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 500;
      background-color: var(--vscode-dropdown-background, var(--vscode-input-background));
      color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground));
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, transparent));
      border-radius: var(--radius);
      outline: none;
      cursor: pointer;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .model-select:focus {
      border-color: var(--vscode-focusBorder);
    }

    .search-filter-wrap {
      display: flex;
      align-items: center;
      position: relative;
    }

    .search-filter-input {
      width: 100%;
      padding: 4px 8px;
      font-size: 10.5px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.2));
      border-radius: var(--radius);
      outline: none;
    }

    .search-filter-input:focus {
      border-color: var(--vscode-focusBorder);
    }

    .header-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--vscode-icon-foreground, var(--vscode-foreground));
      padding: 5px 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      line-height: 1;
      opacity: 0.85;
      transition: all var(--transition);
    }

    .header-btn:hover {
      background-color: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.15));
      opacity: 1;
    }

    /* --- CHAT MESSAGES CONTAINER --- */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    /* --- WELCOME EMPTY STATE --- */
    .welcome-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px 12px;
      margin: auto 0;
      color: var(--vscode-descriptionForeground);
    }

    .welcome-logo {
      width: 44px;
      height: 44px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }

    .welcome-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 4px;
    }

    .welcome-subtitle {
      font-size: 12px;
      margin-bottom: 16px;
      max-width: 270px;
      line-height: 1.4;
    }

    .starter-chips {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      max-width: 280px;
    }

    .chip-btn {
      text-align: left;
      font-size: 11px;
      padding: 7px 10px;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.2));
      color: var(--vscode-foreground);
      border-radius: var(--radius);
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chip-btn:hover {
      background-color: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    /* --- MESSAGES --- */
    .msg-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 100%;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.75;
      padding: 0 2px;
    }

    .msg-badge {
      font-size: 9px;
      font-weight: 500;
      padding: 1px 5px;
      border-radius: 3px;
      background-color: var(--vscode-badge-background, rgba(128, 128, 128, 0.2));
      color: var(--vscode-badge-foreground, var(--vscode-foreground));
    }

    .msg-bubble {
      padding: 10px 12px;
      border-radius: var(--radius);
      line-height: 1.5;
      word-break: break-word;
      font-size: 12.5px;
    }

    .user-row .msg-bubble {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.15));
      border-left: 3px solid var(--vscode-button-background, #007acc);
    }

    .assistant-row .msg-bubble {
      background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.08));
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.1));
      border-left: 3px solid #10b981;
    }

    .context-tag {
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      background-color: var(--vscode-badge-background, rgba(128, 128, 128, 0.15));
      border-radius: 4px;
      margin-bottom: 6px;
      color: var(--vscode-descriptionForeground);
    }

    /* --- REASONING / THOUGHT COLLAPSIBLE --- */
    .thought-details {
      margin-bottom: 8px;
      background-color: rgba(128, 128, 128, 0.08);
      border: 1px solid rgba(128, 128, 128, 0.15);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .thought-summary {
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 500;
      color: var(--vscode-textLink-foreground, #38bdf8);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }

    .thought-summary:hover {
      background-color: rgba(128, 128, 128, 0.12);
    }

    .thought-content {
      padding: 8px;
      font-size: 11px;
      line-height: 1.45;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
      border-top: 1px solid rgba(128, 128, 128, 0.1);
    }

    /* --- CODE BLOCKS --- */
    .code-block-wrap {
      margin: 8px 0;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
      overflow: hidden;
      background-color: var(--vscode-editor-background);
    }

    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 8px;
      background-color: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.15));
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    .code-block-actions {
      display: flex;
      gap: 4px;
    }

    .code-action-btn {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid var(--vscode-button-border, transparent);
      background-color: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.2));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 3px;
      transition: var(--transition);
    }

    .code-action-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3));
    }

    pre code {
      display: block;
      padding: 8px 10px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11.5px;
      overflow-x: auto;
      line-height: 1.45;
      background-color: var(--vscode-editor-background);
    }

    code:not(pre code) {
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      background-color: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.2));
    }

    /* --- CURSOR / STREAMING PULSE --- */
    .stream-cursor {
      display: inline-block;
      width: 7px;
      height: 13px;
      background-color: var(--vscode-editorCursor-foreground, #007acc);
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 0.8s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .error-card {
      background-color: var(--vscode-inputValidation-errorBackground, rgba(239, 68, 68, 0.15));
      border: 1px solid var(--vscode-inputValidation-errorBorder, #ef4444);
      color: var(--vscode-errorForeground, #ef4444);
      padding: 8px 10px;
      border-radius: var(--radius);
      font-size: 11.5px;
    }

    /* --- CONTEXT PILL & BOTTOM INPUT --- */
    .bottom-panel {
      padding: 8px 10px;
      background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }

    .context-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      user-select: none;
    }

    .context-chip input {
      cursor: pointer;
    }

    .input-box-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
      border-radius: var(--radius);
      background-color: var(--vscode-input-background);
      transition: border-color var(--transition);
    }

    .input-box-wrapper:focus-within {
      border-color: var(--vscode-focusBorder);
    }

    #messageInput {
      width: 100%;
      min-height: 48px;
      max-height: 140px;
      resize: none;
      padding: 8px;
      font-family: inherit;
      font-size: 12.5px;
      line-height: 1.4;
      background: transparent;
      color: var(--vscode-input-foreground);
      border: none;
      outline: none;
    }

    .input-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      background-color: rgba(128, 128, 128, 0.05);
      border-top: 1px solid rgba(128, 128, 128, 0.08);
    }

    .send-btn {
      padding: 4px 12px;
      font-size: 11.5px;
      font-weight: 500;
      border-radius: 4px;
      border: none;
      background-color: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #ffffff);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: var(--transition);
    }

    .send-btn:hover {
      background-color: var(--vscode-button-hoverBackground, #0062a3);
    }

    .stop-btn {
      padding: 4px 10px;
      font-size: 11.5px;
      font-weight: 500;
      border-radius: 4px;
      border: none;
      background-color: #ef4444;
      color: #ffffff;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 4px;
    }

    .stop-btn:hover {
      background-color: #dc2626;
    }
  </style>
</head>
<body>

  <!-- Top Header Toolbar -->
  <div class="header-bar">
    <div class="top-controls">
      <div class="model-selector-wrap">
        <select id="modelSelect" class="model-select" title="Active Model">
          <option value="loading">Loading models directly from OpenRouter...</option>
        </select>
      </div>
      <button id="refreshModelsBtn" class="header-btn" title="Refresh Live OpenRouter Models">🔄</button>
      <button id="clearChatBtn" class="header-btn" title="Clear Chat History">🗑️</button>
      <button id="settingsBtn" class="header-btn" title="SynAI Settings">⚙️</button>
    </div>

    <!-- Live Search Filter for 450+ Models -->
    <div class="search-filter-wrap">
      <input
        type="text"
        id="modelFilterInput"
        class="search-filter-input"
        placeholder="🔍 Filter models (e.g. claude, r1, o3, free, qwen)..."
      />
    </div>
  </div>

  <!-- Messages Container -->
  <div class="chat-container" id="chatContainer">
    <div class="welcome-card" id="welcomeCard">
      <div class="welcome-logo">S</div>
      <div class="welcome-title">SynAI Coding Assistant</div>
      <div class="welcome-subtitle" id="welcomeSubtitle">
        Connected to OpenRouter. Access hundreds of frontier AI models.
      </div>

      <div class="starter-chips">
        <button class="chip-btn" onclick="sendStarter('Explain the currently opened code file and highlight key architecture.')">
          <span>💡</span> Explain active file
        </button>
        <button class="chip-btn" onclick="sendStarter('Review the selected code for bugs, edge cases, and performance bottlenecks.')">
          <span>🐛</span> Find bugs & edge cases
        </button>
        <button class="chip-btn" onclick="sendStarter('Write comprehensive unit tests with edge cases for this code.')">
          <span>🧪</span> Generate unit tests
        </button>
        <button class="chip-btn" onclick="sendStarter('Refactor and optimize this code for maximum clarity and efficiency.')">
          <span>⚡</span> Refactor & optimize
        </button>
      </div>
    </div>
  </div>

  <!-- Bottom Input Bar -->
  <div class="bottom-panel">
    <div class="context-bar">
      <label class="context-chip" title="Toggle sending active editor context">
        <input type="checkbox" id="attachContextCheckbox" checked />
        <span id="contextLabel">📎 No file open</span>
      </label>
      <span id="modelPill" style="font-size: 10px; opacity: 0.7;">claude-3.7-sonnet</span>
    </div>

    <div class="input-box-wrapper">
      <textarea
        id="messageInput"
        placeholder="Ask SynAI anything... (Shift+Enter for newline)"
        rows="2"
      ></textarea>
      <div class="input-actions">
        <button id="stopBtn" class="stop-btn">⏹ Stop</button>
        <button id="sendBtn" class="send-btn">Send ↵</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const chatContainer = document.getElementById('chatContainer');
    const welcomeCard = document.getElementById('welcomeCard');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');
    const modelSelect = document.getElementById('modelSelect');
    const modelFilterInput = document.getElementById('modelFilterInput');
    const refreshModelsBtn = document.getElementById('refreshModelsBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const attachContextCheckbox = document.getElementById('attachContextCheckbox');
    const contextLabel = document.getElementById('contextLabel');
    const modelPill = document.getElementById('modelPill');

    let allLoadedModels = [];
    let currentSelectedModel = 'anthropic/claude-3.7-sonnet';
    let isStreaming = false;
    let currentAssistantRow = null;
    let currentBubble = null;
    let currentThoughtBox = null;
    let currentThoughtContent = null;
    let currentRawContent = '';
    let currentRawReasoning = '';
    let activeEditorContext = null;

    // Immediately notify extension that Webview is ready to receive models & context
    vscode.postMessage({ type: 'ready' });
    vscode.postMessage({ type: 'requestContext' });

    // Model select change handler
    modelSelect.addEventListener('change', () => {
      const selectedModel = modelSelect.value;
      if (selectedModel && selectedModel !== 'loading') {
        currentSelectedModel = selectedModel;
        vscode.postMessage({ type: 'selectModel', modelId: selectedModel });
        updateModelPill(selectedModel);
      }
    });

    // Model filter input handler
    modelFilterInput.addEventListener('input', () => {
      const filterText = modelFilterInput.value.toLowerCase().trim();
      renderFilteredDropdown(filterText);
    });

    refreshModelsBtn.addEventListener('click', () => {
      refreshModelsBtn.textContent = '⏳';
      vscode.postMessage({ type: 'refreshModels' });
    });

    clearChatBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
    });

    settingsBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });

    sendBtn.addEventListener('click', triggerSend);
    stopBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'stopGeneration' });
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        triggerSend();
      }
    });

    // Auto-expand textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
    });

    function triggerSend() {
      const text = messageInput.value.trim();
      if (!text || isStreaming) return;

      vscode.postMessage({
        type: 'sendMessage',
        message: text,
        attachContext: attachContextCheckbox.checked
      });

      messageInput.value = '';
      messageInput.style.height = 'auto';
    }

    function sendStarter(prompt) {
      if (isStreaming) return;
      vscode.postMessage({
        type: 'sendMessage',
        message: prompt,
        attachContext: true
      });
    }

    function updateModelPill(modelId) {
      const parts = modelId.split('/');
      modelPill.textContent = parts[parts.length - 1];
    }

    function renderFilteredDropdown(filterText) {
      modelSelect.innerHTML = '';

      let filtered = allLoadedModels;
      if (filterText) {
        filtered = allLoadedModels.filter(m =>
          m.id.toLowerCase().includes(filterText) ||
          m.name.toLowerCase().includes(filterText) ||
          m.provider.toLowerCase().includes(filterText) ||
          (filterText === 'free' && m.isFree)
        );
      }

      if (filtered.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No matching OpenRouter models';
        modelSelect.appendChild(opt);
        return;
      }

      const groups = [
        { key: 'recommended', label: '⭐ Top Recommended' },
        { key: 'free', label: '🆓 100% Free Models' },
        { key: 'anthropic', label: '🟣 Anthropic (Claude)' },
        { key: 'openai', label: '🟢 OpenAI' },
        { key: 'google', label: '🔵 Google (Gemini)' },
        { key: 'deepseek', label: '🔴 DeepSeek' },
        { key: 'meta', label: '🟠 Meta (Llama)' },
        { key: 'mistral', label: '🟡 Mistral' },
        { key: 'qwen', label: '🩵 Qwen / Alibaba' },
        { key: 'other', label: '🌐 All Other OpenRouter Models' }
      ];

      groups.forEach(g => {
        const groupItems = filtered.filter(m => m.group === g.key);
        if (groupItems.length > 0) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = \`\${g.label} (\${groupItems.length})\`;

          groupItems.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            const ctx = m.contextLength ? \` [\${Math.round(m.contextLength / 1000)}k]\` : '';
            const freeTag = m.isFree ? ' [FREE]' : '';
            opt.textContent = \`\${m.name}\${ctx}\${freeTag}\`;
            if (m.id === currentSelectedModel) {
              opt.selected = true;
            }
            optgroup.appendChild(opt);
          });

          modelSelect.appendChild(optgroup);
        }
      });

      // If active model wasn't inside the groups (e.g. filtered out), add it
      if (!Array.from(modelSelect.options).some(o => o.value === currentSelectedModel)) {
        const opt = document.createElement('option');
        opt.value = currentSelectedModel;
        opt.textContent = currentSelectedModel;
        opt.selected = true;
        modelSelect.insertBefore(opt, modelSelect.firstChild);
      }

      updateModelPill(currentSelectedModel);
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function renderMarkdown(rawText) {
      const codeBlockRegex = /\`\`\`([a-zA-Z0-9_-]*)\n([\s\S]*?)\`\`\`/g;
      let html = '';
      let lastIndex = 0;
      let match;

      while ((match = codeBlockRegex.exec(rawText)) !== null) {
        const prevText = rawText.slice(lastIndex, match.index);
        html += renderInlineMarkdown(prevText);

        const lang = match[1] || 'code';
        const codeContent = match[2];
        const encodedCode = encodeURIComponent(codeContent);

        html += \`
          <div class="code-block-wrap">
            <div class="code-block-header">
              <span>\${escapeHtml(lang)}</span>
              <div class="code-block-actions">
                <button class="code-action-btn" onclick="copyCode('\${encodedCode}', this)">📋 Copy</button>
                <button class="code-action-btn" onclick="insertCode('\${encodedCode}')">✍️ Insert</button>
                <button class="code-action-btn" onclick="createFile('\${encodedCode}', '\${lang}')">📄 New File</button>
              </div>
            </div>
            <pre><code>\${escapeHtml(codeContent)}</code></pre>
          </div>
        \`;

        lastIndex = match.index + match[0].length;
      }

      html += renderInlineMarkdown(rawText.slice(lastIndex));
      return html;
    }

    function renderInlineMarkdown(text) {
      return escapeHtml(text)
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    }

    window.copyCode = function(encoded, btn) {
      const code = decodeURIComponent(encoded);
      navigator.clipboard.writeText(code).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = orig, 1500);
      });
    };

    window.insertCode = function(encoded) {
      const code = decodeURIComponent(encoded);
      vscode.postMessage({ type: 'insertCode', code });
    };

    window.createFile = function(encoded, lang) {
      const code = decodeURIComponent(encoded);
      vscode.postMessage({ type: 'newFile', code, language: lang });
    };

    // Incoming Messages from Extension
    window.addEventListener('message', (event) => {
      const data = event.data;

      switch (data.type) {
        case 'modelsLoading':
          refreshModelsBtn.textContent = '⏳';
          break;

        case 'modelsList':
          refreshModelsBtn.textContent = '🔄';
          allLoadedModels = data.models || [];
          currentSelectedModel = data.currentModel || currentSelectedModel;
          if (welcomeSubtitle) {
            welcomeSubtitle.textContent = \`Connected to OpenRouter with \${data.count || allLoadedModels.length} models available.\`;
          }
          renderFilteredDropdown(modelFilterInput.value.toLowerCase().trim());
          break;

        case 'modelSelected':
          currentSelectedModel = data.modelId;
          modelSelect.value = data.modelId;
          updateModelPill(data.modelId);
          break;

        case 'contextUpdate':
          activeEditorContext = data.context;
          if (activeEditorContext && activeEditorContext.hasEditor) {
            const loc = activeEditorContext.selectionRange
              ? \` (L\${activeEditorContext.selectionRange.startLine}-\${activeEditorContext.selectionRange.endLine})\`
              : '';
            contextLabel.textContent = \`📎 \${activeEditorContext.fileName}\${loc}\`;
            contextLabel.title = \`Active: \${activeEditorContext.relativePath || activeEditorContext.fileName}\`;
          } else {
            contextLabel.textContent = '📎 No file open';
            contextLabel.title = 'No active file in editor';
          }
          break;

        case 'userMessage':
          if (welcomeCard) welcomeCard.style.display = 'none';

          const userRow = document.createElement('div');
          userRow.className = 'msg-row user-row';

          let contextTagHtml = '';
          if (data.attachedContext) {
            contextTagHtml = \`<div class="context-tag">📎 Context: \${escapeHtml(data.attachedContext)}</div>\`;
          }

          userRow.innerHTML = \`
            <div class="msg-header">
              <span>You</span>
            </div>
            <div class="msg-bubble">
              \${contextTagHtml}
              \${escapeHtml(data.content).replace(/\\n/g, '<br>')}
            </div>
          \`;
          chatContainer.appendChild(userRow);
          chatContainer.scrollTop = chatContainer.scrollHeight;
          break;

        case 'streamStart':
          isStreaming = true;
          sendBtn.style.display = 'none';
          stopBtn.style.display = 'inline-flex';

          currentRawContent = '';
          currentRawReasoning = '';

          currentAssistantRow = document.createElement('div');
          currentAssistantRow.className = 'msg-row assistant-row';

          const modelNameParts = (data.modelId || 'SynAI').split('/');
          const shortModel = modelNameParts[modelNameParts.length - 1];

          currentAssistantRow.innerHTML = \`
            <div class="msg-header">
              <span>SynAI</span>
              <span class="msg-badge">\${escapeHtml(shortModel)}</span>
            </div>
            <div class="msg-bubble">
              <div class="thought-container" style="display:none;"></div>
              <div class="content-container"></div>
              <span class="stream-cursor"></span>
            </div>
          \`;
          chatContainer.appendChild(currentAssistantRow);
          currentBubble = currentAssistantRow.querySelector('.msg-bubble');
          currentThoughtBox = currentAssistantRow.querySelector('.thought-container');
          chatContainer.scrollTop = chatContainer.scrollHeight;
          break;

        case 'streamReasoning':
          currentRawReasoning += data.chunk;
          if (currentThoughtBox) {
            currentThoughtBox.style.display = 'block';
            if (!currentThoughtContent) {
              currentThoughtBox.innerHTML = \`
                <details class="thought-details" open>
                  <summary class="thought-summary">🧠 Thinking Process</summary>
                  <div class="thought-content"></div>
                </details>
              \`;
              currentThoughtContent = currentThoughtBox.querySelector('.thought-content');
            }
            if (currentThoughtContent) {
              currentThoughtContent.textContent = currentRawReasoning;
            }
          }
          chatContainer.scrollTop = chatContainer.scrollHeight;
          break;

        case 'streamChunk':
          currentRawContent += data.chunk;
          if (currentBubble) {
            const contentContainer = currentBubble.querySelector('.content-container');
            if (contentContainer) {
              contentContainer.innerHTML = renderMarkdown(currentRawContent);
            }
          }
          chatContainer.scrollTop = chatContainer.scrollHeight;
          break;

        case 'streamEnd':
          isStreaming = false;
          sendBtn.style.display = 'inline-flex';
          stopBtn.style.display = 'none';

          if (currentBubble) {
            const cursor = currentBubble.querySelector('.stream-cursor');
            if (cursor) cursor.remove();

            const thoughtDetails = currentBubble.querySelector('.thought-details');
            if (thoughtDetails && !data.cancelled) {
              thoughtDetails.removeAttribute('open');
            }
          }

          currentAssistantRow = null;
          currentBubble = null;
          currentThoughtBox = null;
          currentThoughtContent = null;
          break;

        case 'error':
          isStreaming = false;
          sendBtn.style.display = 'inline-flex';
          stopBtn.style.display = 'none';

          if (welcomeCard) welcomeCard.style.display = 'none';

          const errRow = document.createElement('div');
          errRow.className = 'msg-row';
          errRow.innerHTML = \`
            <div class="error-card">
              ⚠️ \${escapeHtml(data.content)}
            </div>
          \`;
          chatContainer.appendChild(errRow);
          chatContainer.scrollTop = chatContainer.scrollHeight;
          break;

        case 'clearMessages':
          chatContainer.innerHTML = '';
          if (welcomeCard) {
            chatContainer.appendChild(welcomeCard);
            welcomeCard.style.display = 'flex';
          }
          break;

        case 'triggerPrompt':
          if (data.prompt) {
            messageInput.value = data.prompt;
            attachContextCheckbox.checked = !!data.attachContext;
            triggerSend();
          }
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
