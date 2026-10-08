import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Agent } from '../agent/index.js';
import { OpenRouterClient } from '../openrouter/index.js';
import { ConfigManager } from '../config/index.js';
import { AgentConfig, ModelInfo, WorkspaceFile, ApprovalRequest } from '../types/index.js';
import {
  BrowserManager,
  checkRemoteDebugging,
  launchRemoteDebuggingChrome,
} from '../tools/browser_tool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SynAIServerOptions {
  port?: number;
  host?: string;
  workspaceRoot?: string;
  staticDir?: string;
}

export class SynAIServer {
  private port: number;
  private host: string;
  private workspaceRoot: string;
  private staticDir?: string;
  private configManager: ConfigManager;
  private agent: Agent;
  private openrouter: OpenRouterClient;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private pendingApprovals: Map<string, (approved: boolean) => void> = new Map();

  constructor(options: SynAIServerOptions = {}) {
    this.workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
    this.configManager = new ConfigManager(this.workspaceRoot);
    const initialConfig = this.configManager.getConfig();

    this.port = options.port || initialConfig.port || 4242;
    this.host = options.host || 'localhost';

    // Auto-detect web UI build directory if not explicitly provided
    if (options.staticDir) {
      this.staticDir = options.staticDir;
    } else {
      const candidates = [
        // 1. Packaged with synai CLI (node_modules/@synai-code/core/dist/server -> 5 levels up to synai package root)
        path.resolve(__dirname, '../../../../../web-dist'),
        path.resolve(__dirname, '../../../../../dist/web'),
        path.resolve(__dirname, '../../../../web-dist'),
        path.resolve(__dirname, '../../../../dist/web'),
        // 2. Monorepo web/dist from packages/core/dist/server
        path.resolve(__dirname, '../../../web/dist'),
        path.resolve(__dirname, '../../web/dist'),
        path.resolve(__dirname, '../web/dist'),
        path.resolve(__dirname, '../../web-dist'),
        // 3. Process cwd fallbacks
        path.resolve(process.cwd(), 'packages/web/dist'),
        path.resolve(process.cwd(), 'web-dist'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'index.html'))) {
          this.staticDir = cand;
          break;
        }
      }
    }

    this.openrouter = new OpenRouterClient(initialConfig.apiKey);
    this.agent = new Agent(initialConfig);

    // Attach agent approval handler to resolve via WebSocket
    this.agent.setApprovalHandler((req: ApprovalRequest) => {
      return new Promise<boolean>((resolve) => {
        this.pendingApprovals.set(req.id, resolve);
        this.broadcast({
          type: 'approval_required',
          payload: req,
        });
      });
    });

    // Forward all agent events to connected WebSocket clients
    this.agent.on('event', (event) => {
      this.broadcast({
        type: 'agent_event',
        event,
      });

      if (event.type === 'topic_determined') {
        const updatedList = this.agent.getStorage().listConversations();
        this.broadcast({ type: 'conversations_list', payload: updatedList });
      }
    });
  }

  public getAgent(): Agent {
    return this.agent;
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public broadcast(data: any): void {
    if (!this.wss) return;
    const json = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  public async start(): Promise<{ port: number; url: string }> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });

      this.wss.on('connection', (ws) => {
        // Send initial state
        ws.send(JSON.stringify({ type: 'config', payload: this.agent.getConfig() }));
        ws.send(JSON.stringify({ type: 'plan_state', payload: this.agent.getPlanner().getPlan() }));
        ws.send(JSON.stringify({ type: 'checkpoints_state', payload: this.agent.getCheckpoints().listCheckpoints() }));
        ws.send(JSON.stringify({ type: 'rules_state', payload: this.agent.getMemory().discoverRules() }));

        this.openrouter.fetchAvailableModels().then((models) => {
          ws.send(JSON.stringify({ type: 'models', payload: models }));
        });

        ws.on('message', async (data) => {
          try {
            const msg = JSON.parse(data.toString());
            await this.handleWsMessage(ws, msg);
          } catch (err: any) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
          }
        });
      });

      this.httpServer.on('error', (err) => {
        reject(err);
      });

      this.httpServer.listen(this.port, this.host, () => {
        const url = `http://${this.host}:${this.port}`;
        resolve({ port: this.port, url });
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      await new Promise<void>((res) => this.httpServer!.close(() => res()));
    }
  }

  private async handleWsMessage(ws: WebSocket, msg: any): Promise<void> {
    switch (msg.type) {
      case 'chat': {
        const userInput = msg.payload?.message;
        if (!userInput) return;

        const currentApiKey = (this.agent.getConfig().apiKey || this.configManager.getConfig().apiKey || process.env.OPENROUTER_API_KEY || '').trim();
        if (!currentApiKey) {
          ws.send(JSON.stringify({
            type: 'error',
            payload: {
              message: 'OpenRouter API Key is not configured. Please enter a valid API key in Settings.'
            }
          }));
          return;
        }

        let finalInput = userInput;
        if (userInput.startsWith('/browser ')) {
          const instruction = userInput.slice('/browser '.length).trim();
          finalInput = `[Autonomous Browser Task]: ${instruction}\n\nUse your interactive 'browser' tool (with action: "navigate", "click", "type", "fill_form", "inspect", "press_key", "screenshot", etc.) to execute this task on the web and report back the results.`;
        }

        this.agent.chat(finalInput).catch((err) => {
          ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
        });
        break;
      }
      case 'abort': {
        this.agent.abort();
        break;
      }
      case 'reset': {
        this.agent.resetConversation();
        ws.send(JSON.stringify({ type: 'reset_done' }));
        break;
      }
      case 'undo': {
        const undoRes = this.agent.undoLatestChange();
        this.broadcast({ type: 'undo_result', payload: undoRes });
        this.broadcast({ type: 'checkpoints_state', payload: this.agent.getCheckpoints().listCheckpoints() });
        const files = this.getWorkspaceFiles(this.workspaceRoot);
        this.broadcast({ type: 'file_tree', payload: files });
        break;
      }
      case 'approval_response': {
        const { id, approved } = msg.payload;
        const resolver = this.pendingApprovals.get(id);
        if (resolver) {
          resolver(Boolean(approved));
          this.pendingApprovals.delete(id);
        }
        break;
      }
      case 'update_config': {
        const partial: Partial<AgentConfig> = msg.payload || {};
        this.agent.setConfig(partial);
        this.configManager.updateConfig(partial);

        if (partial.apiKey !== undefined) {
          this.openrouter.setApiKey(partial.apiKey);
        }

        if (partial.apiKey !== undefined || partial.model !== undefined || partial.mode !== undefined || partial.thinkingLevel !== undefined) {
          this.configManager.saveGlobalConfig({
            apiKey: partial.apiKey,
            defaultModel: partial.model,
            defaultMode: partial.mode,
            defaultThinkingLevel: partial.thinkingLevel,
            thinkingLevel: partial.thinkingLevel,
            systemPrompt: partial.systemPrompt,
          });
          this.configManager.saveLocalConfig({
            apiKey: partial.apiKey,
            defaultModel: partial.model,
            defaultMode: partial.mode,
            defaultThinkingLevel: partial.thinkingLevel,
            thinkingLevel: partial.thinkingLevel,
          });
        }

        this.broadcast({ type: 'config', payload: this.agent.getConfig() });

        if (partial.apiKey !== undefined) {
          this.openrouter
            .fetchAvailableModels()
            .then((models) => {
              this.broadcast({ type: 'models', payload: models });
            })
            .catch(() => {});
        }
        break;
      }
      case 'list_conversations': {
        const list = this.agent.getStorage().listConversations();
        ws.send(JSON.stringify({ type: 'conversations_list', payload: list }));
        break;
      }
      case 'load_conversation': {
        const convId = msg.payload?.id;
        if (!convId) return;
        const conv = this.agent.getStorage().getConversation(convId);
        if (conv) {
          this.agent.loadConversation(convId);
          this.broadcast({
            type: 'conversation_loaded',
            payload: conv,
          });
          this.broadcast({
            type: 'plan_state',
            payload: this.agent.getPlanner().getPlan(),
          });
        }
        break;
      }
      case 'new_conversation': {
        this.agent.resetConversation();
        const newId = this.agent.getConversationId();
        this.broadcast({
          type: 'new_conversation_started',
          payload: { id: newId },
        });
        this.broadcast({
          type: 'plan_state',
          payload: [],
        });
        break;
      }
      case 'delete_conversation': {
        const convId = msg.payload?.id;
        if (convId) {
          this.agent.getStorage().deleteConversation(convId);
          const updatedList = this.agent.getStorage().listConversations();
          this.broadcast({ type: 'conversations_list', payload: updatedList });
        }
        break;
      }
      case 'get_files': {
        const files = this.getWorkspaceFiles(this.workspaceRoot);
        ws.send(JSON.stringify({ type: 'file_tree', payload: files }));
        break;
      }
      case 'get_plan': {
        ws.send(JSON.stringify({ type: 'plan_state', payload: this.agent.getPlanner().getPlan() }));
        break;
      }
      case 'get_rules': {
        ws.send(JSON.stringify({ type: 'rules_state', payload: this.agent.getMemory().discoverRules() }));
        break;
      }
    }
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname.startsWith('/api/')) {
      this.handleApiRoute(req, res, pathname, parsedUrl);
      return;
    }

    // Static assets
    if (this.staticDir && fs.existsSync(this.staticDir)) {
      let filePath = path.join(this.staticDir, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(this.staticDir, 'index.html');
      }

      if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.webp': 'image/webp',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // Fallback: If browser is requesting HTML page, show friendly info
    if (req.headers.accept?.includes('text/html') || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SynAI Core Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }
    h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .code { background: #0f172a; padding: 8px 12px; border-radius: 6px; font-family: monospace; color: #38bdf8; font-size: 13px; display: inline-block; margin: 8px 0; }
    .status { display: inline-flex; align-items: center; gap: 8px; color: #10b981; font-weight: 600; margin-bottom: 16px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status"><span class="dot"></span> SynAI Server Active</div>
    <h1>SynAI Web Dashboard</h1>
    <p>Workspace: <strong style="color:#fff;">${this.workspaceRoot}</strong></p>
    <p>Web dashboard assets are being built or synced. Run:</p>
    <div class="code">npm run build</div>
    <p style="margin-top: 16px; font-size: 12px; color: #64748b;">SynAI Server Active on port ${this.port}</p>
  </div>
</body>
</html>`);
      return;
    }

    // Default Fallback
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SynAI Core Server Active', workspace: this.workspaceRoot }));
  }

  private handleApiRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    url: URL
  ): void {
    if (pathname === '/api/config') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: this.agent.getConfig() }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const partial: Partial<AgentConfig> = JSON.parse(body || '{}');
            this.agent.setConfig(partial);
            this.configManager.updateConfig(partial);
            if (partial.apiKey !== undefined) {
              this.openrouter.setApiKey(partial.apiKey);
            }
            this.configManager.saveGlobalConfig({
              apiKey: partial.apiKey,
              defaultModel: partial.model,
              defaultMode: partial.mode,
              defaultThinkingLevel: partial.thinkingLevel,
              thinkingLevel: partial.thinkingLevel,
              systemPrompt: partial.systemPrompt,
            });
            this.configManager.saveLocalConfig({
              apiKey: partial.apiKey,
              defaultModel: partial.model,
              defaultMode: partial.mode,
              defaultThinkingLevel: partial.thinkingLevel,
              thinkingLevel: partial.thinkingLevel,
            });
            this.broadcast({ type: 'config', payload: this.agent.getConfig() });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, config: this.agent.getConfig() }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
    }

    if (pathname === '/api/models' && req.method === 'GET') {
      this.openrouter
        .fetchAvailableModels()
        .then((models) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, models }));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      return;
    }

    if (pathname === '/api/undo' && req.method === 'POST') {
      const undoRes = this.agent.undoLatestChange();
      const files = this.getWorkspaceFiles(this.workspaceRoot);
      this.broadcast({ type: 'file_tree', payload: files });
      this.broadcast({ type: 'checkpoints_state', payload: this.agent.getCheckpoints().listCheckpoints() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(undoRes));
      return;
    }

    if (pathname === '/api/plan' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, plan: this.agent.getPlanner().getPlan() }));
      return;
    }

    if (pathname === '/api/checkpoints' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, checkpoints: this.agent.getCheckpoints().listCheckpoints() }));
      return;
    }

    if (pathname === '/api/rules' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, rules: this.agent.getMemory().discoverRules() }));
      return;
    }

    if (pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: this.agent.getConfig() }));
      return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      this.readJsonBody(req, (err, body) => {
        if (err || !body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return;
        }
        this.agent.setConfig(body);
        this.configManager.updateConfig(body);
        this.configManager.saveGlobalConfig({
          apiKey: body.apiKey,
          defaultModel: body.model,
          defaultMode: body.mode,
          systemPrompt: body.systemPrompt,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: this.agent.getConfig() }));
      });
      return;
    }

    if (pathname === '/api/files' && req.method === 'GET') {
      const files = this.getWorkspaceFiles(this.workspaceRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, files }));
      return;
    }

    // Browser Status & Remote Debugging API Routes
    if (pathname === '/api/browser/status' && req.method === 'GET') {
      BrowserManager.getInstance()
        .getStatus()
        .then((status) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...status }));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      return;
    }

    if (pathname === '/api/browser/check' && (req.method === 'GET' || req.method === 'POST')) {
      checkRemoteDebugging(9222)
        .then((status) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...status }));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      return;
    }

    if (pathname === '/api/browser/launch' && req.method === 'POST') {
      launchRemoteDebuggingChrome(9222)
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        });
      return;
    }

    if (pathname === '/api/browser/connect' && req.method === 'POST') {
      BrowserManager.getInstance()
        .connectToRemote(9222)
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        });
      return;
    }

    if (pathname === '/api/browser/action' && req.method === 'POST') {
      this.readJsonBody(req, async (err, body) => {
        if (err || !body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return;
        }
        try {
          const result = await BrowserManager.getInstance().execute(this.workspaceRoot, body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: !result.isError, ...result }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/api/file' && req.method === 'GET') {
      const relPath = url.searchParams.get('path');
      if (!relPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing path parameter' }));
        return;
      }
      const fullPath = path.resolve(this.workspaceRoot, relPath);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'File not found' }));
        return;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: relPath, content }));
      return;
    }

    if (pathname === '/api/file' && req.method === 'POST') {
      this.readJsonBody(req, (err, body) => {
        if (err || !body || !body.path || body.content === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid file write payload' }));
          return;
        }
        const fullPath = path.resolve(this.workspaceRoot, body.path);
        const parent = path.dirname(fullPath);
        if (!fs.existsSync(parent)) {
          fs.mkdirSync(parent, { recursive: true });
        }
        fs.writeFileSync(fullPath, body.content, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, path: body.path }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  private readJsonBody(
    req: http.IncomingMessage,
    callback: (err: any, body?: any) => void
  ): void {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(raw);
        callback(null, parsed);
      } catch (err) {
        callback(err);
      }
    });
  }

  private getWorkspaceFiles(dir: string, currentDepth: number = 1): WorkspaceFile[] {
    const maxDepth = 4;
    if (currentDepth > maxDepth) return [];

    const ignore = new Set(['node_modules', '.git', 'dist', 'build', '.gemini', '.next', '.vscode']);
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      const result: WorkspaceFile[] = [];

      for (const item of items) {
        if (ignore.has(item.name)) continue;
        const full = path.join(dir, item.name);
        const rel = path.relative(this.workspaceRoot, full);

        if (item.isDirectory()) {
          result.push({
            name: item.name,
            path: full,
            relativePath: rel,
            isDirectory: true,
            children: this.getWorkspaceFiles(full, currentDepth + 1),
          });
        } else {
          result.push({
            name: item.name,
            path: full,
            relativePath: rel,
            isDirectory: false,
            size: fs.statSync(full).size,
          });
        }
      }

      result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch {
      return [];
    }
  }
}
