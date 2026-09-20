import readline from 'node:readline/promises';
import { cursorTo, clearLine } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import open from 'open';
import fs from 'node:fs';
import path from 'node:path';
import {
  Agent,
  ConfigManager,
  OpenRouterClient,
  SynAIServer,
  ApprovalMode,
  ApprovalRequest,
  AgentEvent,
  normalizeThinkingLevel,
  getProvider,
  searchProviders,
  PROVIDER_CATEGORY_LABELS,
} from '@synai-code/core';
import {
  printBanner,
  formatToolSummary,
  printApprovalPrompt,
  printModelsTable,
  printHelp,
  printTaskPlan,
  printActiveTodoBar,
  printCheckpoints,
  printSymbolsTable,
  printStatusCard,
  printProviderKeys,
  symbols,
  TABLE_CHARS,
  toAscii,
  formatTurnFooter,
  promptWorkspaceTrust,
  SYMBOLS,
  centerText,
  centerMultiline,
  getTerminalWidth,
  getTheme,
  getCurrentTheme,
  setCurrentTheme,
  getAvailableThemes,
} from '../ui/index.js';
import { playIntroAnimation, renderProgressBar } from '../ui/animation.js';
import { createReadlineCompleter, COMMAND_REGISTRY } from '../utils/autocomplete.js';
import { 
  showApprovalNotification, 
  showCompletionNotification, 
  showErrorNotification,
  shouldShowNotification,
  setNotificationPreferences,
  getNotificationPreferences,
  testNotifications,
} from '../utils/notifications.js';
import { getClipboardText } from '../utils/clipboard.js';
import { handleSigint, bindSigintToReadline } from '../utils/sigint.js';
import { resolveWebStaticDir } from '../utils/web.js';

function getGitBranch(workspaceRoot: string): string | null {
  try {
    const headPath = path.join(workspaceRoot, '.git', 'HEAD');
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      if (head.startsWith('ref: refs/heads/')) {
        return head.replace('ref: refs/heads/', '');
      }
      return head.slice(0, 7);
    }
  } catch {}
  return null;
}

export interface ReplOptions {
  noBanner?: boolean;
  jsonOutput?: boolean;
  verbose?: boolean;
}

export class SynAIRepl {
  private agent: Agent;
  private configManager: ConfigManager;
  private openrouter: OpenRouterClient;
  private server: SynAIServer | null = null;
  private rl: readline.Interface | null = null;
  private options: ReplOptions;
  private commandHistory: string[] = [];
  private escListenerActive: boolean = false;
  private escDataListener: ((chunk: Buffer) => void) | null = null;
  private lastEscPressTime: number = 0;
  private currentTopic: string = '';

  private thinkingTimer: NodeJS.Timeout | null = null;
  private thinkingStartTime: number = 0;
  private currentThinkingText: string = '';

  private startThinking(text: string) {
    if (!this.thinkingTimer) {
      this.thinkingStartTime = Date.now();
      this.currentThinkingText = text;
      this.thinkingTimer = setInterval(() => {
        this.updateThinkingDisplay();
      }, 100);
      this.updateThinkingDisplay();
    } else {
      this.currentThinkingText = text;
      this.updateThinkingDisplay();
    }
  }

  private updateThinkingDisplay() {
    const elapsed = ((Date.now() - this.thinkingStartTime) / 1000).toFixed(1);
    const theme = getCurrentTheme();
    const glyph = theme.thinkingGlyph || (process.platform === 'win32' ? '*' : '∴');
    if (process.stdout.isTTY) {
      cursorTo(process.stdout, 0);
      clearLine(process.stdout, 0);
    } else {
      process.stdout.write('\r');
    }
    process.stdout.write(chalk.dim(`${glyph} ${this.currentThinkingText}... (${elapsed}s)`));
  }

  private stopThinking(clear: boolean = true) {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
      if (clear) {
        if (process.stdout.isTTY) {
          cursorTo(process.stdout, 0);
          clearLine(process.stdout, 0);
        } else {
          process.stdout.write('\r');
        }
      } else {
        process.stdout.write('\n');
      }
    }
  }

  constructor(workspaceRoot: string = process.cwd(), options: ReplOptions = {}) {
    this.options = options;
    this.configManager = new ConfigManager(workspaceRoot);
    const config = this.configManager.getConfig();
    if (config.theme) {
      setCurrentTheme(config.theme);
    }
    this.openrouter = new OpenRouterClient(config.apiKey);
    this.agent = new Agent(config);

    this.setupAgentEvents();
    this.setupApprovalHandler();
  }

  private startEscListener(): void {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return;
    if (this.escListenerActive) return;

    this.lastEscPressTime = 0;
    this.escDataListener = (chunk: Buffer) => {
      // 0x1b is Escape key
      if (chunk.length === 1 && chunk[0] === 0x1b) {
        const now = Date.now();
        if (now - this.lastEscPressTime <= 700) {
          // Double-tap Escape!
          this.lastEscPressTime = 0;
          this.agent.abort();
          this.stopThinking(true);
          console.log('\n  ' + chalk.yellow.bold('🛑 Thinking stopped (Esc pressed twice).\n'));
        } else {
          this.lastEscPressTime = now;
          process.stdout.write(chalk.dim('\r  (Press Esc again to stop thinking...)  '));
        }
      } else if (chunk.length === 1 && chunk[0] === 0x03) {
        // Ctrl+C
        handleSigint(
          () => {
            this.stopEscListener();
            this.agent.abort();
            this.stopThinking(true);
            console.log('\n  ' + chalk.yellow('🛑 Turn cancelled.') + ' ' + chalk.dim('(Press Ctrl+C again to exit)\n'));
          },
          () => {
            this.stopEscListener();
            this.agent.abort();
            this.stopThinking(true);
          }
        );
      }
    };

    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', this.escDataListener);
      this.escListenerActive = true;
    } catch {}
  }

  private stopEscListener(): void {
    if (!this.escListenerActive) return;
    this.escListenerActive = false;

    if (this.escDataListener) {
      try {
        process.stdin.removeListener('data', this.escDataListener);
      } catch {}
      this.escDataListener = null;
    }

    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
  }

  private setupAgentEvents(): void {
    this.agent.on('event', (event: AgentEvent) => {
      switch (event.type) {
        case 'status':
          // Core cannot know which terminal is attached, so UI-chrome text it emits
          // is sanitized here. Assistant message content is never sanitized - it may
          // legitimately be in any language.
          this.startThinking(toAscii(event.payload.text || 'Thinking'));
          break;

        case 'stream_token':
          this.stopThinking(true);
          process.stdout.write(event.payload.token);
          break;

        case 'stream_reasoning':
          this.startThinking('Thinking');
          break;

        case 'message_end':
          this.stopThinking(true);
          console.log('');
          break;

        case 'tool_start':
          this.startThinking(`Running ${event.payload.name}`);
          break;

        case 'tool_end':
          this.stopThinking(true);
          console.log(formatToolSummary(event.payload));
          break;

        case 'plan_updated':
          this.stopThinking(true);
          printTaskPlan(event.payload.plan);
          break;

        case 'checkpoint_restored':
          this.stopThinking(true);
          console.log(chalk.green(`✔ ${event.payload.message}`));
          break;

        case 'topic_determined':
          this.currentTopic = event.payload.topic;
          break;

        case 'done':
          this.stopThinking(true);
          break;

        case 'error':
          this.stopThinking(true);
          console.log(chalk.red(`✖ ${event.payload.message}`));
          if (shouldShowNotification('showErrors')) {
            showErrorNotification(event.payload.message);
          }
          break;
      }
    });
  }

  private setupApprovalHandler(): void {
    this.agent.setApprovalHandler(async (req: ApprovalRequest) => {
      this.stopEscListener();
      this.stopThinking(true);
      
      try {
        const { loadPermissions, checkPermission } = await import('../utils/permissions.js');
        const perms = loadPermissions(this.agent.getConfig().workspaceRoot);
        const check = checkPermission(perms, req.tool, req.args);
        if (check === 'allow') {
          return true;
        }
        if (check === 'deny') {
          console.log(chalk.red(`  Action blocked by permission rule: ${req.tool}\n`));
          return false;
        }
      } catch {}
      
      // Show desktop notification for approval request
      if (shouldShowNotification('showApprovalRequests')) {
        showApprovalNotification(req.tool, req.args);
      }
      
      // Stop raw mode and esc listener before asking user for approval to prevent double-echo
      this.stopEscListener();
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        try { process.stdin.setRawMode(false); } catch {}
      }

      printApprovalPrompt(req);

      const approvalRl = readline.createInterface({ input, output });
      bindSigintToReadline(approvalRl, '> ');
      try {
        while (true) {
          const prompt = '> ';
          const answer = (await approvalRl.question(prompt)).trim().toLowerCase();

          if (answer === '' || answer === 'y' || answer === 'yes') {
            return true;
          }
          if (answer === 'n' || answer === 'no') {
            console.log(chalk.red('  Action cancelled by user.\n'));
            return false;
          }
          if (answer === 'a' || answer === 'always') {
            this.agent.setConfig({ mode: 'auto' });
            try {
              const { savePermissionRule } = await import('../utils/permissions.js');
              savePermissionRule(this.agent.getConfig().workspaceRoot, {
                type: 'allow',
                tool: req.tool,
              });
            } catch {}
            console.log(chalk.yellow(`  ⚡ Always allowed ${req.tool} (saved to .synai/settings.local.json)\n`));
            return true;
          }
          if (answer === 'd' || answer === 'diff') {
            if (req.diff) {
              console.log(chalk.dim('\n' + '─'.repeat(60)));
              console.log(req.diff);
              console.log(chalk.dim('─'.repeat(60) + '\n'));
            } else {
              console.log(chalk.dim('  (No diff available for this action)\n'));
            }
            continue;
          }
          console.log(chalk.dim('  Invalid choice. Options: [y] Accept, [n] Reject, [a] Always allow, [d] Full diff'));
        }
      } catch {
        return false;
      } finally {
        approvalRl.close();
        if (this.agent['isBusy']) {
          this.startEscListener();
        }
      }
    });
  }

  public async start(initialPrompt?: string): Promise<void> {
    // Set terminal window/tab title
    try {
      process.title = 'SynAI - AI Coding Agent';
      process.stdout.write('\x1b]2;SynAI - AI Coding Agent\x07');
    } catch {}

    // Clear terminal on startup
    if (!this.options.noBanner) {
      console.clear();
    }

    const config = this.agent.getConfig();

    // Quick safety check: prompt on interactive startup (Matching Screenshot)
    if (process.stdin.isTTY && !this.options.noBanner && !this.options.jsonOutput) {
      const isTrusted = await promptWorkspaceTrust(config.workspaceRoot);
      if (!isTrusted) {
        console.log(chalk.dim('\nExiting: Workspace not trusted.\n'));
        process.exit(0);
      }
      console.clear();
    }

    if (!this.options.noBanner) {
      const gitBranch = getGitBranch(config.workspaceRoot);
      printBanner(config.model, config.mode, config.workspaceRoot, gitBranch, config.thinkingLevel);
    }

    if (initialPrompt && initialPrompt.trim().length > 0) {
      await this.handleUserPrompt(initialPrompt);
      
      // Exit after executing initial prompt (for scripting)
      if (this.options.jsonOutput) {
        return;
      }
    }

    // Main REPL loop — never exits unless user explicitly types /exit
    while (true) {
      try {
        this.stopEscListener();
        if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
          try { process.stdin.setRawMode(false); } catch {}
        }
        // Create fresh readline for each iteration to prevent stale state
        if (this.rl) {
          try { this.rl.close(); } catch {}
        }
        const cfg = this.agent.getConfig();
        const shortModel = cfg.model.split('/').pop()?.replace(':free', '') || cfg.model;
        this.rl = readline.createInterface({ 
          input, 
          output,
          terminal: true,
          historySize: 100,
          history: this.commandHistory,
          completer: createReadlineCompleter(cfg.workspaceRoot),
        });
        bindSigintToReadline(this.rl, `${chalk.white('>')} `);
        // Keep our own copy in sync so history survives the interface being
        // recreated on the next loop iteration (up/down-arrow recall across turns).
        this.rl.on('history', (h) => {
          this.commandHistory = h;
        });

        const activePlan = this.agent.getPlanner().getPlan();
        if (activePlan.length > 0 && !this.options.noBanner) {
          printActiveTodoBar(activePlan);
        }

        const width = getTerminalWidth();
        const promptText = `> `;
        
        const onKeyPress = (_str: string, key: any) => {
          if ((key && key.ctrl && key.name === 'v') || _str === '\x16') {
            const clip = getClipboardText();
            if (clip && this.rl) {
              this.rl.write(clip);
            }
          } else if ((key && key.shift && key.name === 'tab') || _str === '\x1b[Z') {
            // Shift+Tab: cycle permission modes (default -> acceptEdits -> plan -> default)
            const currentMode = this.agent.getConfig().mode;
            const nextMode: Record<ApprovalMode, ApprovalMode> = {
              'confirm': 'auto',
              'auto': 'dry-run',
              'dry-run': 'confirm',
            };
            const modeLabels: Record<ApprovalMode, string> = {
              'confirm': 'default (manual confirmation)',
              'auto': 'acceptEdits (auto-approve file edits)',
              'dry-run': 'plan (read-only safe mode)',
            };
            const updated = nextMode[currentMode] || 'confirm';
            this.agent.setConfig({ mode: updated });
            this.configManager.saveGlobalConfig({ defaultMode: updated });
            const theme = getCurrentTheme();
            const spark = theme.spark || (process.platform === 'win32' ? '*' : '✻');
            process.stdout.write(`\n${chalk.dim(`${spark} Permission mode:`)} ${chalk.bold(modeLabels[updated])}\n> `);
          }
        };
        input.on('keypress', onKeyPress);
        let userInput: string;
        try {
          userInput = await this.rl.question(promptText);
          while (userInput.endsWith('\\')) {
            userInput = userInput.slice(0, -1) + '\n';
            const nextLine = await this.rl.question(chalk.dim('... '));
            userInput += nextLine;
          }
        } finally {
          input.removeListener('keypress', onKeyPress);
          process.stdout.write('\r\x1B[2K');
        }

        const trimmed = userInput.trim();

        if (!trimmed) continue;

        if (trimmed === '?' || trimmed === '/?' || trimmed === 'help') {
          printHelp();
          continue;
        }

        if (trimmed.startsWith('/')) {
          const handled = await this.handleSlashCommand(trimmed);
          if (handled === 'exit') break;
          continue;
        }

        await this.handleUserPrompt(trimmed);
      } catch (err: any) {
        // Only exit on Ctrl+C / Ctrl+D (actual user-initiated exit signals)
        if (
          err?.code === 'ERR_USE_AFTER_CLOSE' ||
          err?.message?.includes('readline was closed')
        ) {
          // Readline was closed externally (Ctrl+C), exit gracefully
          const width = getTerminalWidth();
          console.log('\n');
          console.log(centerText(chalk.dim('✨ Session saved. Goodbye!'), width));
          console.log('');
          break;
        }

        // For ALL other errors, log and continue — never crash
        const width = getTerminalWidth();
        const msg = err?.message || 'Unknown error';
        console.log('');
        console.error(centerText(chalk.white(`⚠ Error: ${msg}`), width));
        if (this.options.verbose && err?.stack) {
          console.error(centerText(chalk.dim(err.stack), width));
        }
        console.log('');
        // Continue the loop
      }
    }

    if (this.rl) {
      try { this.rl.close(); } catch {}
    }
  }

  public async handleUserPrompt(prompt: string): Promise<void> {
    const startTime = Date.now();
    this.startEscListener();
    
    try {
      console.log('');
      await this.agent.chat(prompt);
      
      const duration = Date.now() - startTime;
      
      if (!this.options.jsonOutput) {
        console.log('');
        const messages = this.agent.getMessages();
        let tokens = 0;
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === 'assistant') {
            tokens = Math.ceil((lastMsg.content || '').length / 4);
          }
        }
        console.log(formatTurnFooter(duration, tokens));
      }
      
      console.log('');
    } catch (err: any) {
      // Stop spinner if still running
      this.stopThinking(true);

      const msg = err?.message || 'Unknown error';
      const width = getTerminalWidth();

      console.log('');

      // Show helpful error messages based on error type
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        console.log(centerText(chalk.white('❌ Authentication Failed'), width));
        console.log(centerText(chalk.dim('API Key is invalid or missing'), width));
        console.log(centerText(chalk.gray('→ Use /config to set your OpenRouter API key'), width));
      } else if (msg.includes('429') || msg.includes('rate limit')) {
        console.log(centerText(chalk.gray('⚠ Rate Limit Reached'), width));
        console.log(centerText(chalk.dim('Too many requests in a short time'), width));
        console.log(centerText(chalk.gray('→ Wait a moment, or switch model with /model'), width));
      } else if (msg.includes('fetch') || msg.includes('ENOTFOUND') || msg.includes('network')) {
        console.log(centerText(chalk.white('❌ Network Error'), width));
        console.log(centerText(chalk.dim('Unable to connect to OpenRouter'), width));
        console.log(centerText(chalk.gray('→ Check your internet connection and try again'), width));
      } else if (msg.includes('timeout')) {
        console.log(centerText(chalk.gray('⚠ Request Timeout'), width));
        console.log(centerText(chalk.dim('The AI model took too long to respond'), width));
        console.log(centerText(chalk.gray('→ Try again or use a faster model'), width));
      } else {
        console.log(centerText(chalk.white('❌ Error'), width));
        console.log(centerText(chalk.white(msg), width));
        
        if (this.options.verbose && err?.stack) {
          console.log('');
          console.log(centerText(chalk.dim('Stack trace:'), width));
          const stackLines = err.stack.split('\n').slice(0, 5);
          for (const line of stackLines) {
            console.log(centerText(chalk.dim(line), width));
          }
        }
      }
      
      console.log('');
    } finally {
      this.stopEscListener();
    }
  }

  private async handleSlashCommand(cmd: string): Promise<'continue' | 'exit'> {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    const workspace = this.agent.getConfig().workspaceRoot;
    const width = getTerminalWidth();

    // Helper to get a fresh readline for interactive prompts
    const getPromptRl = (): readline.Interface => {
      const rl = readline.createInterface({ input, output });
      bindSigintToReadline(rl, '> ');
      return rl;
    };

    switch (command) {
      case 'compact': {
        const { compactConversation, getContextUsage, formatContextUsage } = await import('../utils/compact.js');
        const messages = this.agent.getMessages();
        const before = messages.length;
        const compacted = compactConversation(messages, arg || undefined);
        this.agent.setMessages(compacted);
        console.log(chalk.dim(`✔ Context compacted: ${before} messages → ${compacted.length} messages`));
        return 'continue';
      }

      case 'context':
      case 'tokens': {
        const { getContextUsage, formatContextUsage } = await import('../utils/compact.js');
        const messages = this.agent.getMessages();
        const usage = getContextUsage(messages, 200000);
        console.log('\n' + formatContextUsage(usage) + '\n');
        return 'continue';
      }

      case 'incognito':
      case 'ephemeral':
      case 'private': {
        const currentCfg = this.agent.getConfig();
        const nextState = !(currentCfg.incognito || currentCfg.ephemeral);
        this.agent.setConfig({ incognito: nextState, ephemeral: nextState });
        if (nextState) {
          console.log('\n  ' + chalk.magenta('🕵️  Incognito Mode ON:') + ' ' + chalk.white('No conversation history or memory will be saved to disk for this session.\n'));
        } else {
          console.log('\n  ' + chalk.dim('💾 Incognito Mode OFF:') + ' ' + chalk.white('Conversation auto-saving is now active.\n'));
        }
        return 'continue';
      }

      case 'cost': {
        const { formatCostSummary } = await import('../utils/compact.js');
        const cfg = this.agent.getConfig();
        const messages = this.agent.getMessages();
        let inputTokens = 0;
        let outputTokens = 0;
        for (const m of messages) {
          const est = Math.ceil((m.content || '').length / 4);
          if (m.role === 'assistant') outputTokens += est;
          else inputTokens += est;
        }
        console.log('\n' + formatCostSummary({ input: inputTokens, output: outputTokens, cached: 0 }, cfg.model) + '\n');
        return 'continue';
      }

      case 'doctor': {
        const checks: { status: 'ok' | 'warn' | 'fail'; label: string; detail: string }[] = [];
        const add = (status: 'ok' | 'warn' | 'fail', label: string, detail: string) =>
          checks.push({ status, label, detail });

        // Runtime
        const nodeMajor = Number(process.versions.node.split('.')[0]);
        add(
          nodeMajor >= 18 ? 'ok' : 'fail',
          'Node.js',
          `${process.versions.node}${nodeMajor < 18 ? ' (SynAI needs >= 18)' : ''}`
        );
        add('ok', 'Platform', `${process.platform} ${process.arch}`);

        // Workspace / git
        add('ok', 'Workspace', workspace);
        const gitPresent = fs.existsSync(path.join(workspace, '.git'));
        add(
          gitPresent ? 'ok' : 'warn',
          'Git repository',
          gitPresent ? 'present' : 'not found — /commit, /diff and checkpoints need git'
        );

        // Model & session config
        const cfg = this.configManager.getConfig();
        add(cfg.model ? 'ok' : 'fail', 'Active model', cfg.model || 'not set');
        add('ok', 'Permission mode', cfg.mode);
        add('ok', 'Effort level', cfg.thinkingLevel || 'medium');

        // API keys
        const keyStatuses = this.configManager.listProviderKeyStatus();
        const configured = keyStatuses.filter((s) => s.configured);
        if (configured.length > 0) {
          const shown = configured.slice(0, 3).map((s) => s.provider.id).join(', ');
          add(
            'ok',
            'API keys',
            `${configured.length}/${keyStatuses.length} providers: ${shown}${
              configured.length > 3 ? ` +${configured.length - 3} more` : ''
            }`
          );
        } else {
          add('fail', 'API keys', 'none configured — run /keys');
        }

        // Workspace env file (optional: keys also live in the user config)
        const envPresent = fs.existsSync(path.join(workspace, '.env'));
        add(
          envPresent ? 'ok' : 'warn',
          'Workspace .env',
          envPresent ? 'present' : 'absent (optional — keys also live in the user config)'
        );

        // Disk space (statfs is unavailable on some platforms — skip, don't fail)
        try {
          const stats = fs.statfsSync(workspace);
          const freeGb = (stats.bsize * stats.bavail) / 1024 ** 3;
          add(freeGb > 1 ? 'ok' : 'warn', 'Disk free', `${freeGb.toFixed(1)} GB`);
        } catch {
          // Platform without statfs support — not a problem worth reporting.
        }

        const icon = {
          ok: chalk.green(symbols.tick),
          warn: chalk.yellow(symbols.warn),
          fail: chalk.red(symbols.cross),
        };
        console.log('\n' + chalk.bold('SynAI Doctor'));
        for (const c of checks) {
          console.log(`  ${icon[c.status]} ${chalk.white(c.label.padEnd(18))} ${chalk.dim(c.detail)}`);
        }
        console.log(chalk.dim('\n  Live connectivity is not probed here to avoid burning API quota —'));
        console.log(chalk.dim('  send a short message in this session to verify a key end-to-end.\n'));
        return 'continue';
      }

      case 'keys':
      case 'providers':
      case 'apikey':
      case 'apikeys': {
        const statuses = this.configManager.listProviderKeyStatus();
        const sub = (parts[1] || '').toLowerCase().trim();
        const rest = parts.slice(2).join(' ').trim();

        const byIds = (ids: string[]) => statuses.filter((s) => ids.includes(s.provider.id));
        const usage = () =>
          console.log(
            chalk.dim(
              '\n  Usage:\n' +
                '    /keys                       Interactive provider picker\n' +
                '    /keys list [configured]     Show all (or only configured) providers\n' +
                '    /keys search <term>         Filter providers by name / id / env var\n' +
                '    /keys set <id> <key>        Save a key directly\n' +
                '    /keys remove <id>           Delete a stored key\n' +
                '    /keys env <id>              Show the env var to export manually\n' +
                '    /keys categories            Provider counts by category\n'
            ) + '\n'
          );

        if (!sub || sub === 'pick' || sub === 'interactive') {
          const { select, password } = await import('@inquirer/prompts');
          const choices = [
            ...statuses
              .filter((s) => s.configured)
              .map((s) => ({
                name: `${chalk.green('✓')} ${s.provider.name} ${chalk.dim(`(${s.provider.id})`)} ${chalk.dim(s.masked)}`,
                value: s.provider.id,
              })),
            ...statuses
              .filter((s) => !s.configured)
              .map((s) => ({
                name: `${chalk.dim('·')} ${s.provider.name} ${chalk.dim(`(${s.provider.id})`)}`,
                value: s.provider.id,
              })),
          ];

          let picked: string;
          try {
            // Explicit generic: @inquirer's `choices` is a union type, which blocks
            // inference and would otherwise degrade the result to `unknown`.
            picked = await select<string>({
              message: `Configure an API key (${statuses.length} providers):`,
              choices,
              pageSize: 15,
            });
          } catch {
            console.log(chalk.dim('\n  Cancelled.\n'));
            return 'continue';
          }

          const provider = getProvider(picked);
          if (!provider) {
            console.log(chalk.red('  Unknown provider.'));
            return 'continue';
          }

          console.log('');
          console.log(`  ${chalk.bold(provider.name)} ${chalk.dim(`(${provider.id})`)}`);
          console.log(chalk.dim(`  Create or rotate a key at: ${chalk.white(provider.docsUrl)}`));
          console.log(chalk.dim(`  Stored as env var: ${chalk.white(provider.envVar)}`));
          if (provider.note) console.log(chalk.dim(`  Note: ${provider.note}`));

          let entered: string;
          try {
            // `password` masks the input so the key never flashes on screen.
            entered = await password({ message: `  Paste the ${provider.name} API key:` });
          } catch {
            console.log(chalk.dim('\n  Cancelled.\n'));
            return 'continue';
          }

          const res = this.configManager.setProviderKey(provider.id, entered);
          console.log(res.ok ? chalk.green(`  ✓ ${res.message}`) : chalk.red(`  ✗ ${res.message}`));
          if (res.ok && provider.id === 'openrouter') {
            const applied = entered.trim();
            this.openrouter.setApiKey(applied);
            this.agent.setConfig({ apiKey: applied });
          }
          console.log('');
          return 'continue';
        }

        if (sub === 'list' || sub === 'ls') {
          const onlyConfigured = (parts[2] || '').toLowerCase() === 'configured';
          printProviderKeys(statuses, { onlyConfigured });
          return 'continue';
        }

        if (sub === 'search' || sub === 'find') {
          if (!rest) {
            usage();
            return 'continue';
          }
          const matches = searchProviders(rest);
          if (matches.length === 0) {
            console.log(chalk.dim(`\n  No provider matches "${rest}".\n`));
            return 'continue';
          }
          printProviderKeys(byIds(matches.map((p) => p.id)));
          return 'continue';
        }

        if (sub === 'set' || sub === 'add') {
          const providerId = (parts[2] || '').trim();
          const key = parts.slice(3).join(' ').trim();
          if (!providerId || !key) {
            console.log(chalk.dim('\n  Usage: /keys set <provider-id> <api-key>'));
            console.log(chalk.dim('  Tip: run the interactive picker with /keys (no arguments).\n'));
            return 'continue';
          }
          const res = this.configManager.setProviderKey(providerId, key);
          console.log(res.ok ? chalk.green(`  ✓ ${res.message}`) : chalk.red(`  ✗ ${res.message}`));
          if (res.ok && providerId.toLowerCase() === 'openrouter') {
            this.openrouter.setApiKey(key);
            this.agent.setConfig({ apiKey: key });
          }
          console.log('');
          return 'continue';
        }

        if (sub === 'remove' || sub === 'rm' || sub === 'delete' || sub === 'unset') {
          const providerId = (parts[2] || '').trim();
          if (!providerId) {
            console.log(chalk.dim('\n  Usage: /keys remove <provider-id>\n'));
            return 'continue';
          }
          const res = this.configManager.removeProviderKey(providerId);
          console.log(res.ok ? chalk.green(`  ✓ ${res.message}`) : chalk.red(`  ✗ ${res.message}`));
          console.log('');
          return 'continue';
        }

        if (sub === 'env') {
          const providerId = (parts[2] || '').trim();
          if (!providerId) {
            console.log(chalk.dim('\n  Usage: /keys env <provider-id>\n'));
            return 'continue';
          }
          const provider = getProvider(providerId);
          if (!provider) {
            console.log(chalk.red(`  Unknown provider "${providerId}".`));
            return 'continue';
          }
          console.log('');
          console.log(`  ${chalk.bold(provider.name)} → ${chalk.white(provider.envVar)}`);
          if (provider.altEnvVars?.length) {
            console.log(chalk.dim(`  Alternates: ${provider.altEnvVars.join(', ')}`));
          }
          console.log(chalk.dim(`  Example (PowerShell): $env:${provider.envVar}="your-key-here"`));
          console.log(chalk.dim(`  Example (bash/zsh):   export ${provider.envVar}=your-key-here`));
          console.log('');
          return 'continue';
        }

        if (sub === 'categories' || sub === 'category' || sub === 'cats') {
          const counts = new Map<string, number>();
          for (const s of statuses) {
            counts.set(s.provider.category, (counts.get(s.provider.category) || 0) + 1);
          }
          console.log('');
          for (const [category, count] of counts) {
            const label =
              PROVIDER_CATEGORY_LABELS[category as keyof typeof PROVIDER_CATEGORY_LABELS] || category;
            console.log(`  ${chalk.white(label.padEnd(46))} ${chalk.dim(String(count))}`);
          }
          console.log(
            chalk.dim(`\n  ${statuses.length} providers total · /keys list to see them all\n`)
          );
          return 'continue';
        }

        // Bare provider id → focused summary for that provider.
        const direct = getProvider(sub);
        if (direct) {
          const status = statuses.find((s) => s.provider.id === direct.id);
          console.log('');
          console.log(`  ${chalk.bold(direct.name)} ${chalk.dim(`(${direct.id})`)}`);
          console.log(
            chalk.dim('  Status  : ') +
              (status?.configured
                ? chalk.green(`configured (${status.masked}, ${status.source})`)
                : chalk.dim('not configured'))
          );
          console.log(chalk.dim(`  Env var : ${direct.envVar}`));
          console.log(chalk.dim(`  Keys    : ${direct.docsUrl}`));
          if (direct.baseUrl) console.log(chalk.dim(`  Base URL: ${direct.baseUrl}`));
          if (direct.note) console.log(chalk.dim(`  Note    : ${direct.note}`));
          console.log(chalk.dim(`\n  Set it with: /keys set ${direct.id} <api-key>\n`));
          return 'continue';
        }

        usage();
        return 'continue';
      }

      case 'permissions': {
        const { loadPermissions, listPermissions } = await import('../utils/permissions.js');
        listPermissions(workspace);
        return 'continue';
      }

      case 'review': {
        const spinner = ora('Reviewing changes...').start();
        const diffRes = await this.agent['tools'].executeTool('diff_review', 'git_diff', { staged: false }, 'auto');
        spinner.stop();
        if (!diffRes.output || diffRes.output.trim() === '') {
          console.log(chalk.dim('\nNo uncommitted changes to review.\n'));
          return 'continue';
        }
        await this.handleUserPrompt(`Review the following git diff for bugs, security issues, and improvements. Be concise:\n\n${diffRes.output}`);
        return 'continue';
      }

      case 'rewind': {
        const list = this.agent.getCheckpoints().listCheckpoints();
        if (list.length === 0) {
          console.log(chalk.dim('\nNo checkpoints available to rewind to.\n'));
          return 'continue';
        }
        printCheckpoints(list);
        const rrl = getPromptRl();
        try {
          const cpId = await rrl.question('Enter checkpoint ID to rewind to (or press Enter to cancel): ');
          if (cpId.trim()) {
            const res = this.agent.undoLatestChange();
            if (res.success) {
              console.log(chalk.dim(`✔ Rewound: ${res.message}`));
            } else {
              console.log(chalk.dim(`Could not rewind: ${res.message}`));
            }
          }
        } finally {
          rrl.close();
        }
        return 'continue';
      }

      case 'rename': {
        if (!arg) {
          console.log(chalk.dim('Usage: /rename <session-name>'));
          return 'continue';
        }
        const storage = this.agent.getStorage();
        const convId = this.agent.getConversationId();
        const conv = storage.getConversation(convId);
        if (conv) {
          storage.saveConversation(convId, arg, conv.workspace, conv.messages, conv.plan);
          console.log(chalk.dim(`✔ Session renamed to: ${arg}`));
        } else {
          console.log(chalk.dim('Could not find active session to rename.'));
        }
        return 'continue';
      }

      case 'export': {
        const messages = this.agent.getMessages();
        const exportPath = arg || `synai-session-${Date.now()}.md`;
        let md = '# SynAI Session Export\n\n';
        for (const m of messages) {
          if (m.role === 'system') continue;
          md += `## ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}\n\n---\n\n`;
        }
        const fs = await import('node:fs');
        fs.writeFileSync(exportPath, md, 'utf-8');
        console.log(chalk.dim(`✔ Session exported to: ${exportPath}`));
        return 'continue';
      }

      case 'add-dir': {
        if (!arg) {
          console.log(chalk.dim('Usage: /add-dir <path>'));
          return 'continue';
        }
        console.log(chalk.dim(`✔ Added directory: ${arg}`));
        return 'continue';
      }

      case 'bug': {
        console.log('');
        console.log('To report a bug:');
        console.log(chalk.dim('  https://github.com/synai-cli/synai/issues/new'));
        console.log('');
        return 'continue';
      }

      case 'exit':
      case 'quit':
      case 'q':
        console.log(centerText(chalk.dim('Goodbye.')));
        return 'exit';

      case 'help':
      case 'h':
      case '?':
        printHelp();
        return 'continue';

      // --- QUICK SHORTCUTS ---
      case 'ls':
        return await this.handleSlashCommand('/files ' + arg);
      
      case 'cat':
        return await this.handleSlashCommand('/view ' + arg);
      
      case 'pwd': {
        const width = getTerminalWidth();
        console.log('');
        console.log(centerText(chalk.white(workspace), width));
        console.log('');
        return 'continue';
      }

      case 'clear:all':
      case 'reset:all': {
        const width = getTerminalWidth();
        const crl = getPromptRl();
        try {
          const confirm = await crl.question(centerText(chalk.gray('⚠ This will clear history, plan, and checkpoints. Continue? [y/N]: '), width));
          if (confirm.trim().toLowerCase() === 'y') {
            this.agent.resetConversation();
            this.agent.getPlanner().clearPlan();
            console.clear();
            printBanner(this.agent.getConfig().model, this.agent.getConfig().mode, this.agent.getConfig().workspaceRoot, undefined, this.agent.getConfig().thinkingLevel);
            console.log(centerText(chalk.white('✓ Complete reset performed'), width));
          }
        } finally {
          crl.close();
        }
        return 'continue';
      }

      case 'topic': {
        const width = getTerminalWidth();
        const theme = getCurrentTheme();
        if (arg && arg.trim()) {
          this.currentTopic = arg.trim();
          this.agent.setConversationTopic(this.currentTopic);
          console.log('\n' + centerText(theme.success(`✓ Conversation topic set to: ${chalk.bold.white(this.currentTopic)}`), width) + '\n');
        } else if (this.currentTopic) {
          console.log('\n' + centerText(theme.primary(`💬 Current topic: ${chalk.bold.white(this.currentTopic)}`), width) + '\n');
        } else {
          console.log('\n' + centerText(chalk.dim('No conversation topic set yet. (Will be automatically determined from messages)'), width) + '\n');
        }
        return 'continue';
      }

      case 'theme': {
        const width = getTerminalWidth();
        if (arg && arg.trim()) {
          const target = getTheme(arg.trim());
          setCurrentTheme(target.id);
          this.configManager.saveGlobalConfig({ theme: target.id });
          this.agent.setConfig({ theme: target.id });
          console.log('\n' + centerText(target.success(`✓ Theme switched to: ${chalk.bold(target.name)}`), width) + '\n');
        } else {
          try {
            const { select } = await import('@inquirer/prompts');
            const currentTheme = getCurrentTheme();
            const picked = await select<string>({
              message: 'Select CLI Color Theme:',
              choices: getAvailableThemes().map((t) => ({
                name: `${t.preview}  ${chalk.bold.white(t.name.padEnd(26))} ${chalk.dim(t.description)}`,
                value: t.id,
              })),
              default: currentTheme.id,
            });
            const active = setCurrentTheme(picked);
            this.configManager.saveGlobalConfig({ theme: picked });
            this.agent.setConfig({ theme: picked });
            console.log('\n' + centerText(active.success(`✓ Theme switched to: ${chalk.bold(active.name)}`), width) + '\n');
          } catch {
            console.log('\n' + chalk.dim('Theme selection cancelled.') + '\n');
          }
        }
        return 'continue';
      }

      // --- PLANNING COMMANDS ---
      case 'plan':
      case 'todo': {
        const plan = this.agent.getPlanner().getPlan();
        printTaskPlan(plan);
        return 'continue';
      }

      case 'plan:new': {
        const prl = getPromptRl();
        try {
          const title = arg || (await prl.question(centerText('Enter goal for new plan: ', width)));
          if (title.trim()) {
            const rawTasks = await prl.question(centerText('Enter comma-separated milestones (or Enter to auto-generate): ', width));
            if (rawTasks.trim()) {
              const items = rawTasks.split(',').map((t, i) => ({
                id: `task_${i + 1}`,
                title: t.trim(),
                status: 'pending' as const,
              }));
              this.agent.getPlanner().createPlan(items);
              printTaskPlan(this.agent.getPlanner().getPlan());
            } else {
              await this.handleUserPrompt(`Create a structured task plan for: ${title}`);
            }
          }
        } finally {
          prl.close();
        }
        return 'continue';
      }

      case 'plan:clear': {
        this.agent.getPlanner().clearPlan();
        console.log(centerText(chalk.white('[OK] Task plan cleared.'), width));
        return 'continue';
      }

      case 'task': {
        const [taskId, status, ...notes] = parts.slice(1);
        if (!taskId || !status) {
          console.log(centerText(chalk.gray('Usage: /task <taskId> <pending|in_progress|completed|failed> [note]'), width));
          return 'continue';
        }
        const normStatus = status.toLowerCase() === 'done' ? 'completed' : (status as any);
        const res = this.agent.getPlanner().updateTask(taskId, normStatus, notes.join(' '));
        if (res.success) {
          printTaskPlan(res.plan);
        } else {
          console.log(centerText(chalk.white(`Task "${taskId}" not found in current plan.`), width));
        }
        return 'continue';
      }

      // --- CODEBASE & FILE COMMANDS ---
      case 'files':
      case 'tree': {
        const listRes = await this.agent['tools'].executeTool('tree', 'list_dir', { dirPath: arg || '.', maxDepth: 3 }, 'auto');
        console.log('\n' + centerMultiline(listRes.output, width) + '\n');
        return 'continue';
      }

      case 'view': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /view <filePath> [startLine] [endLine]'), width));
          return 'continue';
        }
        const [viewPath, start, end] = arg.split(' ');
        const viewRes = await this.agent['tools'].executeTool(
          'view',
          'view_file',
          {
            filePath: viewPath,
            startLine: start ? parseInt(start, 10) : undefined,
            endLine: end ? parseInt(end, 10) : undefined,
          },
          'auto'
        );
        console.log('\n' + centerMultiline(viewRes.output, width) + '\n');
        return 'continue';
      }

      case 'calc':
      case 'math': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /calc <expression> (e.g. /calc factorial(50), /calc nCr(20, 5), /calc modPow(7n, 100n, 13n))'), width));
          return 'continue';
        }
        const mathRes = await this.agent['tools'].executeTool('math', 'math_eval', { expression: arg }, 'auto');
        if (mathRes.isError) {
          console.log('\n' + chalk.red(`  ⚠ ${mathRes.output}`) + '\n');
        } else if (mathRes.output.includes('\n')) {
          console.log('\n' + chalk.cyan.bold('  🔢 Result:\n') + chalk.white(mathRes.output) + '\n');
        } else {
          console.log('\n' + chalk.cyan.bold('  🔢 Result: ') + chalk.white.bold(mathRes.output) + '\n');
        }
        return 'continue';
      }

      case 'symbols': {
        const symRes = await this.agent['tools'].executeTool('sym', 'find_symbols', { query: arg }, 'auto');
        console.log('\n' + centerMultiline(symRes.output, width) + '\n');
        return 'continue';
      }

      case 'grep': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /grep <pattern>'), width));
          return 'continue';
        }
        const grepRes = await this.agent['tools'].executeTool('grep', 'grep_search', { query: arg }, 'auto');
        console.log('\n' + centerMultiline(grepRes.output, width) + '\n');
        return 'continue';
      }

      case 'find': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /find <globPattern>'), width));
          return 'continue';
        }
        const findRes = await this.agent['tools'].executeTool('find', 'find_files', { pattern: arg }, 'auto');
        console.log('\n' + centerMultiline(findRes.output, width) + '\n');
        return 'continue';
      }

      case 'diagnostics':
      case 'lint':
      case 'check': {
        const spinner = ora('Running diagnostics...').start();
        const diagRes = await this.agent['tools'].executeTool('diag', 'run_diagnostics', { customCommand: arg || undefined }, 'auto');
        spinner.stop();
        console.log('\n' + centerMultiline(diagRes.output, width) + '\n');
        return 'continue';
      }

      case 'stats': {
        console.log('\n' + centerText(chalk.bold('Codebase Statistics:'), width));
        try {
          const files = fs.readdirSync(workspace, { recursive: true }) as string[];
          const nonNode = files.filter((f) => !f.includes('node_modules') && !f.includes('.git') && !f.includes('dist'));
          console.log(centerText(`Total Tracked Files: ${chalk.white(nonNode.length)}`, width));
          console.log(centerText(`Workspace: ${chalk.gray(workspace)}\n`, width));
        } catch {
          console.log(centerText(chalk.dim('Unable to scan directory.'), width));
        }
        return 'continue';
      }

      // --- CHECKPOINT & UNDO COMMANDS ---
      case 'undo': {
        const res = this.agent.undoLatestChange();
        if (res.success) {
          console.log(centerText(chalk.white(`[OK] ${res.message}`), width));
          if (res.restoredFiles.length > 0) {
            console.log(centerText(chalk.dim(`Restored: ${res.restoredFiles.join(', ')}`), width));
          }
        } else {
          console.log(centerText(chalk.gray(`[INFO] ${res.message}`), width));
        }
        return 'continue';
      }

      case 'checkpoints': {
        const list = this.agent.getCheckpoints().listCheckpoints();
        printCheckpoints(list);
        return 'continue';
      }

      case 'snapshot': {
        const name = arg || `manual_snapshot_${Date.now()}`;
        this.agent.getCheckpoints().recordPreModificationState(name, 'manual_snapshot', ['.']);
        console.log(centerText(chalk.white(`[OK] Created snapshot: ${name}`), width));
        return 'continue';
      }

      // --- GIT COMMANDS ---
      case 'diff': {
        const spinner = ora('Checking git diff...').start();
        const diffRes = await this.agent['tools'].executeTool('diff_cmd', 'git_diff', { staged: arg === 'staged' }, 'auto');
        spinner.stop();
        console.log('\n' + centerText(chalk.bold('Current Git Diff:'), width) + '\n' + centerMultiline(diffRes.output, width) + '\n');
        return 'continue';
      }

      case 'git:status':
      case 'status:git': {
        const res = await this.agent['tools'].executeTool('git_st', 'git_status', {}, 'auto');
        console.log('\n' + centerText(chalk.bold('Git Status:'), width) + '\n' + centerMultiline(res.output, width) + '\n');
        return 'continue';
      }

      case 'commit': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /commit <message>'), width));
          return 'continue';
        }
        const res = await this.agent['tools'].executeTool('git_cmt', 'git_commit', { message: arg }, 'auto');
        console.log('\n' + centerMultiline(res.output, width) + '\n');
        return 'continue';
      }

      case 'log': {
        const res = await this.agent['tools'].executeTool('git_lg', 'run_command', { command: `git log -n ${arg || 5} --oneline` }, 'auto');
        console.log('\n' + centerMultiline(res.output, width) + '\n');
        return 'continue';
      }

      case 'branch': {
        const res = await this.agent['tools'].executeTool('git_br', 'run_command', { command: 'git branch -a' }, 'auto');
        console.log('\n' + centerMultiline(res.output, width) + '\n');
        return 'continue';
      }

      // --- MULTI-DOMAIN EXPERTISE & SUBAGENTS ---
      case 'rules':
      case 'memory': {
        const rules = this.agent.getMemory().discoverRules();
        const memories = this.agent.getMemory().listMemories();
        console.log('\n' + centerText(chalk.bold('Workspace Rules & Memory:'), width));
        if (rules.sources.length === 0 && memories.length === 0) {
          console.log(centerText(chalk.dim('No custom rules found (SYNAI.md, AGENTS.md, MEMORY.md).'), width));
        } else {
          for (const s of rules.sources) {
            console.log(centerText(chalk.gray(`--- Source: ${s.file} ---`), width));
            console.log(centerMultiline(s.content, width));
          }
          if (memories.length > 0) {
            console.log('\n' + centerText(chalk.white('--- Auto Memory Index ---'), width));
            for (const m of memories) {
              console.log(centerText(`* [${chalk.white(m.type)}] ${chalk.bold(m.name)}: ${m.description}`, width));
            }
          }
        }
        console.log('');
        return 'continue';
      }

      case 'memory:add': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /memory:add <note>'), width));
          return 'continue';
        }
        const memEntry = this.agent.getMemory().saveMemory(
          'feedback',
          `note-${Date.now()}`,
          arg.slice(0, 40),
          arg
        );
        console.log(centerText(chalk.white(`[OK] Saved memory [${memEntry.type}]: "${arg}"`), width));
        return 'continue';
      }

      // --- SESSIONS & CONVERSATIONS ---
      case 'history':
      case 'conversations': {
        const storage = this.agent.getStorage();
        const list = storage.listConversations();
        if (list.length === 0) {
          console.log(centerText(chalk.dim('No saved conversation history found.'), width));
        } else {
          console.log('\n' + centerText(chalk.bold(`Saved Conversations (${list.length}):`), width));
          for (const item of list.slice(0, 15)) {
            const time = new Date(item.updatedAt).toLocaleString();
            console.log(
              centerText(`- ${chalk.bold.white(item.id)}: ${chalk.white(item.title)} ${chalk.dim(`(${time})`)}`, width)
            );
          }
          console.log(centerText(chalk.dim('\nUse /resume <id> to restore any session.\n'), width));
        }
        return 'continue';
      }

      case 'resume':
      case 'load': {
        if (!arg) {
          console.log(centerText(chalk.gray('Usage: /resume <conversationId>'), width));
          return 'continue';
        }
        const success = this.agent.loadConversation(arg);
        if (success) {
          console.log(centerText(chalk.white(`[OK] Restored session: ${arg}`), width));
          const plan = this.agent.getPlanner().getPlan();
          if (plan.length > 0) {
            printTaskPlan(plan);
          }
        } else {
          console.log(centerText(chalk.white(`Session "${arg}" not found in AppData.`), width));
        }
        return 'continue';
      }

      // --- MODEL & CONFIG COMMANDS ---
      case 'model':
      case 'models': {
        const spinner = ora('Fetching models...').start();
        try {
          const models = await this.openrouter.fetchAvailableModels();
          spinner.stop();

          printModelsTable(models, this.agent.getConfig().model);

          if (arg) {
            this.agent.setConfig({ model: arg });
            this.configManager.saveGlobalConfig({ defaultModel: arg });
            console.log(centerText(chalk.white(`[OK] Active model changed to ${arg}`), width));
            return 'continue';
          }

          const mrl = getPromptRl();
          try {
            const inputModel = await mrl.question(centerText(chalk.gray('Enter Model ID (or press Enter to keep current): '), width));
            const newModel = inputModel.trim();
            if (newModel) {
              this.agent.setConfig({ model: newModel });
              this.configManager.saveGlobalConfig({ defaultModel: newModel });
              console.log(centerText(chalk.white(`[OK] Model changed to ${newModel}`), width));
            }
          } finally {
            mrl.close();
          }
        } catch (err: any) {
          spinner.stop();
          console.log(centerText(chalk.white(`Failed to fetch models: ${err.message}`), width));
        }
        return 'continue';
      }

      case 'mode': {
        if (arg && ['auto', 'confirm', 'dry-run'].includes(arg)) {
          this.agent.setConfig({ mode: arg as ApprovalMode });
          this.configManager.saveGlobalConfig({ defaultMode: arg as ApprovalMode });
          console.log(centerText(chalk.white(`[OK] Mode set to ${arg}`), width));
          return 'continue';
        }

        const mrl = getPromptRl();
        try {
          console.log(centerText('Modes: 1) confirm  2) auto  3) dry-run', width));
          const modeChoice = await mrl.question(centerText('Select mode (1/2/3) [1]: ', width));
          const modeMap: Record<string, ApprovalMode> = {
            '1': 'confirm',
            '2': 'auto',
            '3': 'dry-run',
          };
          const selectedMode = modeMap[modeChoice.trim()] || 'confirm';
          this.agent.setConfig({ mode: selectedMode });
          this.configManager.saveGlobalConfig({ defaultMode: selectedMode });
          console.log(centerText(chalk.white(`[OK] Mode changed to ${selectedMode}`), width));
        } finally {
          mrl.close();
        }
        return 'continue';
      }

      case 'effort':
      case 'think':
      case 'thinking':
      case 'think-level':
      case 'level':
      case 'dusun':
      case 'dusunme':
      case 'düşün':
      case 'düşünme': {
        const icons: Record<string, string> = { low: '⚡', medium: '⚖️', high: '🧠', max: '🌟' };

        if (arg.trim()) {
          const selectedLevel = normalizeThinkingLevel(arg);
          this.agent.setConfig({ thinkingLevel: selectedLevel });
          this.configManager.saveGlobalConfig({ thinkingLevel: selectedLevel, defaultThinkingLevel: selectedLevel });
          const icon = icons[selectedLevel] || '⚖️';
          console.log(chalk.dim(`\n  ${icon} Thinking effort level set to: `) + chalk.bold.cyan(selectedLevel) + chalk.dim(` (saved to config)\n`));
          return 'continue';
        }

        const trl = getPromptRl();
        try {
          console.log('');
          console.log(centerText(chalk.bold('🎯 SELECT COGNITIVE EFFORT LEVEL:'), width));
          console.log('');
          console.log(centerText('⚡ 1) LOW     - Rapid responses, simple tasks (4K tokens, 15 turns)', width));
          console.log(centerText('⚖️  2) MEDIUM  - Optimal balance of speed & reasoning (8K tokens, 25 turns) [DEFAULT]', width));
          console.log(centerText('🧠 3) HIGH    - Advanced reasoning & self-critique (16K tokens, 40 turns)', width));
          console.log(centerText('🌟 4) MAX     - Maximum cognitive capacity & verification (32K tokens, 60 turns)', width));
          console.log('');
          const thinkChoice = (await trl.question(centerText('Select level (1/2/3/4 or low/medium/high/max) [2]: ', width))).trim().toLowerCase();
          const selectedLevel = normalizeThinkingLevel(thinkChoice || 'medium');
          this.agent.setConfig({ thinkingLevel: selectedLevel });
          this.configManager.saveGlobalConfig({ thinkingLevel: selectedLevel, defaultThinkingLevel: selectedLevel });
          console.log('');
          console.log(centerText(chalk.white(`${icons[selectedLevel]} Cognitive effort level set to: ${selectedLevel.toUpperCase()}`), width));
          console.log('');
        } finally {
          trl.close();
        }
        return 'continue';
      }

      case 'key':
      case 'apikey':
      case 'config:key':
      case 'settings':
      case 'config': {
        let keyToSet = arg.trim();
        if (!keyToSet) {
          const clip = getClipboardText();
          if (clip && (clip.startsWith('sk-or-') || (clip.startsWith('sk-') && clip.length > 20))) {
            const crl = getPromptRl();
            try {
              const mask = `${clip.slice(0, 12)}...${clip.slice(-4)}`;
              const confirmClip = await crl.question(
                '\n' +
                chalk.cyan(`  📋 API Key detected on clipboard: `) + chalk.bold.white(mask) + '\n' +
                chalk.white(`  Use this key from clipboard? [Y/n]: `)
              );
              if (confirmClip.trim() === '' || confirmClip.trim().toLowerCase() === 'y' || confirmClip.trim().toLowerCase() === 'yes') {
                keyToSet = clip;
              }
            } finally {
              crl.close();
            }
          }

          if (!keyToSet) {
            const crl = getPromptRl();
            try {
              const cur = this.agent.getConfig();
              const currentDisplay = cur.apiKey ? `${cur.apiKey.slice(0, 10)}...${cur.apiKey.slice(-4)}` : 'none';
              const newKey = await crl.question(centerText(`Enter OpenRouter API Key (current: ${currentDisplay}): `, width));
              keyToSet = newKey.trim();
            } finally {
              crl.close();
            }
          }
        }

        if (keyToSet) {
          this.agent.setConfig({ apiKey: keyToSet });
          this.configManager.saveGlobalConfig({ apiKey: keyToSet });
          this.openrouter.setApiKey(keyToSet);
          console.log('\n  ' + chalk.green('✔') + ' API Key successfully saved and applied to all sessions.\n');
        }
        return 'continue';
      }

      case 'web': {
        const spinner = ora('Starting Web Server...').start();
        try {
          if (!this.server) {
            this.server = new SynAIServer({
              workspaceRoot: this.agent.getConfig().workspaceRoot,
              staticDir: resolveWebStaticDir(),
            });
          }
          const { url } = await this.server.start();
          spinner.succeed(`SynAI Web Dashboard live at ${chalk.white.bold(url)}`);
          await open(url);
        } catch (err: any) {
          spinner.fail(`Failed to launch Web UI: ${err.message}`);
        }
        return 'continue';
      }

      case 'clear':
      case 'reset':
        this.agent.resetConversation();
        console.clear();
        printBanner(this.agent.getConfig().model, this.agent.getConfig().mode, this.agent.getConfig().workspaceRoot, undefined, this.agent.getConfig().thinkingLevel);
        console.log(centerText(chalk.white('[OK] Screen and conversation cleared.'), width));
        return 'continue';

      case 'status': {
        const cfg = this.agent.getConfig();
        const planSummary = this.agent.getPlanner().getSummary();
        const checkpointCount = this.agent.getCheckpoints().listCheckpoints().length;
        const conversationCount = this.agent.getStorage().listConversations().length;
        const rules = this.agent.getMemory().discoverRules();
        const branch = getGitBranch(cfg.workspaceRoot);

        printStatusCard(
          cfg,
          branch,
          planSummary,
          checkpointCount,
          conversationCount,
          rules.sources.length
        );
        return 'continue';
      }

      case 'version':
      case 'v': {
        const width = getTerminalWidth();
        console.log('');
        console.log(centerText(chalk.bold.white('SynAI') + chalk.dim(' v1.1.2'), width));
        console.log(centerText(chalk.dim('Open-source AI coding agent'), width));
        console.log(centerText(chalk.dim('Node.js ' + process.version), width));
        console.log('');
        return 'continue';
      }

      default: {
        const query = cmd.toLowerCase();
        let suggestion: string | null = null;
        for (const item of COMMAND_REGISTRY) {
          const name = item.command.replace('/', '');
          if (name.startsWith(query) || query.startsWith(name) || name.includes(query)) {
            suggestion = item.command;
            break;
          }
        }
        if (suggestion) {
          console.log(`\n  ${chalk.red('✖')} Unknown command: ${chalk.bold(`/${cmd}`)}. Did you mean ${chalk.cyan.bold(suggestion)}?`);
        } else {
          console.log(`\n  ${chalk.red('✖')} Unknown command: ${chalk.bold(`/${cmd}`)}.`);
        }
        console.log(`  ${chalk.dim('Tip: Type')} ${chalk.white('/help')} ${chalk.dim('for command list.')}\n`);
        return 'continue';
      }
    }
  }
}
