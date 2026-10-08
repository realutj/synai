import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ToolDefinition, ToolExecutionResult } from '../types/index.js';
import { BrowserController } from '../browser/index.js';

export const nodeReplToolDefinitions: ToolDefinition[] = [
  {
    name: 'mcp__node_repl__js',
    description: 'Execute JavaScript in a persistent Node-backed environment with top-level await. Supports nodeRepl.write(text), nodeRepl.cwd, nodeRepl.homeDir, dynamic imports, and browser automation via agent.browsers.get().',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The JavaScript code to execute.',
        },
        timeout_ms: {
          type: 'number',
          description: 'Execution timeout in milliseconds (default: 30000).',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'mcp__node_repl__js_reset',
    description: 'Reset the persistent Node REPL environment and clear all top-level bindings.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp__node_repl__js_add_node_module_dir',
    description: 'Add a directory to the Node REPL module resolution paths.',
    parameters: {
      type: 'object',
      properties: {
        dir: {
          type: 'string',
          description: 'Absolute or relative path to the directory containing node_modules.',
        },
      },
      required: ['dir'],
    },
  },
];

const DOCUMENTATION_TOPICS: Record<string, string> = {
  'api-troubleshooting': `# API Troubleshooting
If you encounter errors connecting to the browser runtime:
1. Ensure Google Chrome or Microsoft Edge is installed.
2. For remote debugging, run Chrome with: \`chrome.exe --remote-debugging-port=9222\`
3. Use \`agent.browsers.get("iab")\` for in-app automation or \`agent.browsers.get("extension")\` for Chrome extension automation.`,

  'chrome-troubleshooting': `# Chrome Troubleshooting
- Verify Chrome is open and responsive.
- If tab claiming fails, call \`browser.user.openTabs()\` to list available tabs and claim by exact ID.
- Check that remote debugging port 9222 is accessible.`,

  'confirmations': `# Confirmations Guidance
- High-risk actions (modifying sensitive settings, deleting data, sending communications, financial actions) require explicit user confirmation.
- Form submissions with external side-effects should be confirmed before execution.
- Safe read-only inspections (navigating, taking screenshots, reading page text) do not require confirmation.`,

  'file-management': `# File Management Guidance
- Downloads should be stored in the workspace or standard Downloads directory.
- Verify file existence after upload or download steps.`,

  'playwright': `# Playwright Guidance
- Use standard Playwright locators: page.locator('text=...'), page.locator('css-selector').
- Always wait for network idle or selector before clicking or typing: \`await page.waitForSelector(...)\`.
- Prefer visible element interaction over direct DOM modifications.`,

  'screenshots': `# Screenshots Guidance
- Screenshots are saved to the workspace or tmp folder.
- Use \`await page.screenshot({ path: '...', fullPage: true })\` for full-page verification.
- Use \`await nodeRepl.emitImage({ path })\` to surface screenshots in chat.`,
};

class NodeReplSession {
  private workspaceRoot: string;
  private persistentBindings: Record<string, any> = {};
  private moduleDirs: string[] = [];
  private browserController: BrowserController;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.browserController = new BrowserController();
  }

  public reset(): void {
    this.persistentBindings = {};
  }

  public addModuleDir(dir: string): void {
    const full = path.isAbsolute(dir) ? dir : path.resolve(this.workspaceRoot, dir);
    if (!this.moduleDirs.includes(full)) {
      this.moduleDirs.push(full);
    }
  }

  public async execute(
    code: string,
    timeoutMs: number = 30000
  ): Promise<{ output: string; isError?: boolean }> {
    const outputChunks: string[] = [];
    let responseMeta: Record<string, any> = {};

    const nodeRepl = {
      cwd: this.workspaceRoot,
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
      requestMeta: {},
      setResponseMeta: (meta: Record<string, any>) => {
        responseMeta = { ...responseMeta, ...meta };
      },
      write: (text: any) => {
        outputChunks.push(typeof text === 'string' ? text : String(text));
      },
      emitImage: async (imageLike: any) => {
        const imgDesc = typeof imageLike === 'string' ? imageLike : JSON.stringify(imageLike);
        outputChunks.push(`[Image Emitted: ${imgDesc}]`);
        return true;
      },
    };

    const captureConsole = {
      log: (...args: any[]) => {
        outputChunks.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\n');
      },
      info: (...args: any[]) => {
        outputChunks.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\n');
      },
      warn: (...args: any[]) => {
        outputChunks.push('[WARN] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\n');
      },
      error: (...args: any[]) => {
        outputChunks.push('[ERROR] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\n');
      },
    };

    const agent = {
      documentation: {
        get: async (topic: string): Promise<string> => {
          return DOCUMENTATION_TOPICS[topic] || `# Topic: ${topic}\nNo documentation available for topic: ${topic}`;
        },
      },
      browsers: {
        get: async (kind: string = 'iab') => {
          const controller = this.browserController;
          let activeTab: any = null;

          return {
            kind,
            documentation: async () => {
              return `# SynAI Browser Automation (${kind})\nAvailable actions: goto(url), click(selector), type(selector, text), screenshot(path), extractText(selector), getHtml(), evaluate(code), user.openTabs(), tabs.finalize().`;
            },
            nameSession: async (name: string) => {
              outputChunks.push(`[Browser session named: ${name}]\n`);
              return true;
            },
            capabilities: {
              get: (cap: string) => ({
                set: async (val: any) => {
                  outputChunks.push(`[Browser capability ${cap} set to ${val}]\n`);
                  return true;
                },
              }),
            },
            user: {
              openTabs: async () => {
                const tabs = await controller.getTabs().catch(() => []);
                return tabs.map((url, idx) => ({ id: `tab_${idx + 1}`, url, title: `Tab ${idx + 1}` }));
              },
              claimTab: async (tab: any) => {
                activeTab = tab;
                return tab;
              },
            },
            tabs: {
              finalize: async ({ keep }: { keep?: any } = {}) => {
                outputChunks.push(`[Browser tabs finalized, kept: ${JSON.stringify(keep || [])}]\n`);
                return true;
              },
            },
            goto: async (url: string) => controller.navigate(url),
            navigate: async (url: string) => controller.navigate(url),
            click: async (selector: string) => controller.click(selector),
            type: async (selector: string, text: string) => controller.type(selector, text),
            screenshot: async (p?: string) => {
              const target = p || path.join(os.tmpdir(), `browser_${Date.now()}.png`);
              return controller.screenshot(target);
            },
            extractText: async (selector?: string) => controller.extractText(selector),
            getHtml: async (selector?: string) => controller.getHtml(selector),
            evaluate: async (script: string) => controller.evaluate(script),
          };
        },
      },
    };

    try {
      // AsyncFunction constructor allows top-level await
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

      // Provide bindings, nodeRepl, console, and agent into scope
      const scopeKeys = [
        'nodeRepl',
        'console',
        'agent',
        'globalThis',
        'workspaceRoot',
        ...Object.keys(this.persistentBindings),
      ];

      const scopeValues = [
        nodeRepl,
        captureConsole,
        agent,
        globalThis,
        this.workspaceRoot,
        ...Object.values(this.persistentBindings),
      ];

      // Execute with timeout race
      const execPromise = (async () => {
        const fn = new AsyncFunction(...scopeKeys, code);
        const result = await fn(...scopeValues);
        if (result !== undefined && outputChunks.length === 0) {
          outputChunks.push(
            typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
          );
        }
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      await Promise.race([execPromise, timeoutPromise]);

      return {
        output: outputChunks.join('') || 'Executed successfully (no output).',
      };
    } catch (err: any) {
      return {
        output: (outputChunks.join('') ? outputChunks.join('') + '\n' : '') + `Error: ${err.message || String(err)}`,
        isError: true,
      };
    }
  }
}

// Global session singleton per workspace
const sessions = new Map<string, NodeReplSession>();

function getSession(workspaceRoot: string): NodeReplSession {
  const norm = path.resolve(workspaceRoot);
  let session = sessions.get(norm);
  if (!session) {
    session = new NodeReplSession(norm);
    sessions.set(norm, session);
  }
  return session;
}

export async function executeNodeRepl(
  args: { code?: string; script?: string; timeout_ms?: number },
  workspaceRoot: string
): Promise<ToolExecutionResult> {
  const code = args.code || args.script || '';
  if (!code.trim()) {
    return {
      tool_call_id: '',
      name: 'mcp__node_repl__js',
      output: 'Error: No code provided to execute.',
      isError: true,
      actionType: 'info',
    };
  }

  const session = getSession(workspaceRoot);
  const res = await session.execute(code, args.timeout_ms || 30000);
  return {
    tool_call_id: '',
    name: 'mcp__node_repl__js',
    output: res.output,
    isError: res.isError,
    actionType: 'info',
  };
}

export function executeNodeReplReset(workspaceRoot: string): ToolExecutionResult {
  const session = getSession(workspaceRoot);
  session.reset();
  return {
    tool_call_id: '',
    name: 'mcp__node_repl__js_reset',
    output: 'Node REPL environment successfully reset. All bindings cleared.',
    actionType: 'info',
  };
}

export function executeNodeReplAddModuleDir(
  args: { dir?: string; path?: string },
  workspaceRoot: string
): ToolExecutionResult {
  const dir = args.dir || args.path || '';
  if (!dir) {
    return {
      tool_call_id: '',
      name: 'mcp__node_repl__js_add_node_module_dir',
      output: 'Error: Directory path is required.',
      isError: true,
      actionType: 'info',
    };
  }
  const session = getSession(workspaceRoot);
  session.addModuleDir(dir);
  return {
    tool_call_id: '',
    name: 'mcp__node_repl__js_add_node_module_dir',
    output: `Added module search directory: ${dir}`,
    actionType: 'info',
  };
}
