import chalk from 'chalk';
import Table from 'cli-table3';
import {
  AgentConfig,
  ModelInfo,
  ApprovalMode,
  ToolExecutionResult,
  ApprovalRequest,
  TaskItem,
  Checkpoint,
  SymbolInfo,
  ProviderKeyStatus,
} from '@synai-code/core';
import { symbols, TABLE_CHARS, toAscii } from './symbols.js';
import { renderProgressBar } from './animation.js';
import { handleSigint } from '../utils/sigint.js';
import { getCurrentTheme, setCurrentTheme, getTheme, getAvailableThemes, CLITheme } from './theme.js';
export * from './theme.js';
export * from './onboarding.js';
export * from './apiKeyPrompt.js';

// Theme previews contain '■' swatches, which legacy Windows code pages cannot
// encode ("??"). Replace them with the terminal-safe block glyph; in Unicode mode
// this is a no-op because symbols.block is the same character.
for (const theme of getAvailableThemes()) {
  theme.preview = theme.preview.replace(/\u25a0/g, symbols.block);
}

export const SYNAI_CYAN = chalk.hex('#38bdf8');
export const SYNAI_AMBER = chalk.hex('#F59E0B');

export function getTerminalWidth(): number {
  return Math.max(20, process.stdout.columns || 80);
}

export function getTerminalHeight(): number {
  return Math.max(10, process.stdout.rows || 24);
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[\d+;?\d*m/g, '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function centerText(text: string, width: number = getTerminalWidth()): string {
  const visualLength = stripAnsi(text).length;
  if (visualLength >= width) return text;
  const pad = Math.max(0, Math.floor((width - visualLength) / 2));
  return ' '.repeat(pad) + text;
}

export function centerMultiline(text: string, width: number = getTerminalWidth()): string {
  return text
    .split('\n')
    .map((line) => centerText(line, width))
    .join('\n');
}

export const isModernTerminal = Boolean(
  process.platform !== 'win32' ||
  process.env.WT_SESSION ||
  process.env.VSCODE_PID ||
  process.env.TERM_PROGRAM
);

export const SYMBOLS = {
  check: isModernTerminal ? '✔' : '√',
  cross: isModernTerminal ? '✖' : '×',
  prompt: '>',
  arrow: '>',
  bullet: '•',
  lightning: '⚡',
  sparkle: '✢',
};

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return '...' + str.slice(-(maxLen - 3));
}

/**
 * SynAI Code Banner
 */
export function printBanner(model: string, mode: ApprovalMode, workspace: string, branch?: string | null, thinkingLevel?: string): void {
  const shortModel = model.split('/').pop()?.replace(':free', '') || model;
  const isFree = model.includes(':free');
  const modelBadge = isFree ? `${shortModel} (free)` : shortModel;
  const branchStr = branch ? branch : 'main';
  const modeName = mode === 'auto' ? 'auto' : mode === 'confirm' ? 'default (manual)' : 'dry-run';
  const thinkStr = thinkingLevel || 'medium';
  const width = getTerminalWidth();
  const theme = getCurrentTheme();
  const spark = theme.spark || (process.platform === 'win32' ? '*' : '✻');

  const leftCol1 = `Model: ${modelBadge}`;
  const leftCol2 = `cwd: ${workspace.replace(process.env.HOME || '~', '~')}`;
  const leftCol3 = `Git: ${branchStr}`;
  const leftCol4 = `Mode: ${modeName} │ Effort: ${thinkStr}`;
  
  const rightCol1 = `/help for commands`;
  const rightCol2 = `/status for info`;
  const rightCol3 = `Shift+Tab for modes`;
  const rightCol4 = `/think for effort`;
  
  const boxWidth = Math.min(width - 2, 70); 
  const innerWidth = boxWidth - 4; 
  
  const makeLine = (left: string, right: string) => {
    const space = innerWidth - stripAnsi(left).length - stripAnsi(right).length;
    return `│ ${left}${space > 0 ? ' '.repeat(space) : ''}${right} │`;
  };

  const titleText = ` ${theme.accent(spark)} Welcome to SynAI! (v1.1.2) `;
  const titleLen = stripAnsi(titleText).length;
  const remainingBorder = Math.max(0, boxWidth - 2 - titleLen);
  const top = `┌${titleText}${'─'.repeat(remainingBorder)}┐`;
  const bottom = `└${'─'.repeat(boxWidth - 2)}┘`;

  console.log(top);
  console.log(`│${' '.repeat(boxWidth - 2)}│`);
  console.log(makeLine(leftCol1, rightCol1));
  console.log(makeLine(leftCol2, rightCol2));
  console.log(makeLine(leftCol3, rightCol3));
  console.log(makeLine(leftCol4, rightCol4));
  console.log(bottom);
}

/**
 * Workspace Safety Check
 */
export async function promptWorkspaceTrust(workspace: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return true;
  }

  console.log('');
  console.log(chalk.hex('#F59E0B')('Accessing workspace:'));
  console.log('');
  console.log(chalk.hex('#FACC15')(workspace));
  console.log('');
  console.log('Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source project, or work from your team). If not, take a moment to review what\'s in this folder first.');
  console.log('');
  console.log("SynAI'll be able to read, edit, and execute files here.");
  console.log('');
  console.log(chalk.dim.cyan('Security guide'));
  console.log('');

  const choices = [
    'No, exit',
    'Yes, I trust this folder',
  ];
  let selectedIndex = 1;

  function renderChoices() {
    for (let i = 0; i < choices.length; i++) {
      if (i === selectedIndex) {
        console.log(chalk.cyan(`> ${choices[i]}`));
      } else {
        console.log(`  ${choices[i]}`);
      }
    }
    console.log('');
    console.log(chalk.dim('Enter to confirm · Esc to cancel'));
  }

  renderChoices();

  return new Promise<boolean>((resolve) => {
    const wasRaw = process.stdin.isRaw;
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    } catch {}

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(wasRaw || false);
      } catch {}
    };

    const rerender = () => {
      process.stdout.write('\x1B[4A\r');
      renderChoices();
    };

    const onData = (chunk: Buffer) => {
      const s = chunk.toString();
      if (s === '\r' || s === '\n') {
        cleanup();
        console.log('');
        resolve(selectedIndex === 1);
        return;
      }
      if (chunk.length === 1 && chunk[0] === 0x1b) {
        cleanup();
        console.log('');
        resolve(false);
        return;
      }
      if (chunk.length === 1 && chunk[0] === 0x03) {
        handleSigint(
          () => {
            console.log('\n' + chalk.dim('(Press Ctrl+C again to exit)'));
          },
          () => {
            cleanup();
          }
        );
        return;
      }
      if (s === '\u001b[A' || s === 'k') {
        if (selectedIndex > 0) {
          selectedIndex--;
          rerender();
        }
        return;
      }
      if (s === '\u001b[B' || s === 'j') {
        if (selectedIndex < choices.length - 1) {
          selectedIndex++;
          rerender();
        }
        return;
      }
      if (s === '1') {
        selectedIndex = 0;
        rerender();
      } else if (s === '2') {
        selectedIndex = 1;
        rerender();
      }
    };

    process.stdin.on('data', onData);
  });
}

/**
 * SynAI Code Header with AI Determined Topic and Right-Aligned Effort Badge
 */
export function renderSynAIPromptHeader(thinkingLevel: string = 'medium', width: number = getTerminalWidth(), topic?: string): void {
  console.log(chalk.dim('─'.repeat(Math.max(10, width))));
}

/**
 * SynAI Code Status Footer below Prompt
 */
export function renderSynAIPromptFooter(mode: ApprovalMode): string {
  return '';
}

export function formatToolSummary(res: ToolExecutionResult): string {
  const name = res.name;
  const theme = getCurrentTheme();
  const isWin = process.platform === 'win32';
  const actionG = theme.actionGlyph || (isWin ? '●' : '⏺');
  const resultG = theme.resultGlyph || (isWin ? '└─' : '⎿');

  if (res.isError) {
    const shortErr = (res.output.split('\n')[0] || 'Unknown error').slice(0, 80);
    return `${chalk.red(actionG)} Failed ${name}\n  ${chalk.dim(resultG)} ${chalk.red(shortErr)}`;
  }

  const target = res.modifiedFiles?.[0] || '';
  const lines = res.output.split('\n').length;
  
  if (['view_file', 'Read', 'read_file'].includes(name)) {
    return `${chalk.green(actionG)} Read ${target || 'file'} (${lines} lines)`;
  }

  if (['grep_search', 'Grep'].includes(name)) {
    return `${chalk.green(actionG)} Searched "${target || 'pattern'}" across workspace\n  ${chalk.dim(resultG)} Found ${lines} matches`;
  }

  if (['find_files', 'Glob'].includes(name)) {
    return `${chalk.green(actionG)} Found files matching ${target || 'pattern'} (${lines} results)`;
  }

  if (['write_file', 'Write'].includes(name)) {
    return `${chalk.green(actionG)} Wrote ${target || 'file'} (+${lines} lines)\n  ${chalk.dim(resultG)} Created file successfully`;
  }

  if (['edit_file', 'Edit'].includes(name)) {
    return `${chalk.green(actionG)} Edited ${target || 'file'}\n  ${chalk.dim(resultG)} Applied changes successfully`;
  }

  if (['run_command', 'Bash'].includes(name)) {
    return `${chalk.green(actionG)} Ran bash command: ${target || 'command'}\n  ${chalk.dim(resultG)} Process exited with code 0`;
  }

  if (['web_search', 'WebSearch'].includes(name)) {
    return `${chalk.green(actionG)} Web search: ${target || 'query'}`;
  }

  if (['read_url_content', 'web_fetch', 'WebFetch'].includes(name)) {
    return `${chalk.green(actionG)} Fetched web content: ${target || 'url'}`;
  }

  return `${chalk.green(actionG)} Executed ${name}\n  ${chalk.dim(resultG)} Completed`;
}

/**
 * SynAI Minimalist Approval Prompt
 */
export function printApprovalPrompt(req: ApprovalRequest): void {
  console.log('');
  console.log(`SynAI wants to ${req.description}:`);
  
  if (req.diff) {
    console.log('');
    const diffLines = req.diff.split('\n').slice(0, 18);
    for (const l of diffLines) {
      if (l.startsWith('+') && !l.startsWith('+++')) {
        console.log(chalk.green(`  ${l}`));
      } else if (l.startsWith('-') && !l.startsWith('---')) {
        console.log(chalk.red(`  ${l}`));
      } else if (l.startsWith('@@')) {
        console.log(chalk.cyan(`  ${l}`));
      } else {
        console.log(chalk.dim(`  ${l}`));
      }
    }
    if (req.diff.split('\n').length > 18) {
      console.log(chalk.dim(`  ... (${req.diff.split('\n').length - 18} more lines, press 'd' for full diff)`));
    }
  }

  console.log('');
  console.log(`  ${chalk.bold('[y] Accept')}  ${chalk.bold('[n] Reject')}  ${chalk.bold('[a] Always allow')}  ${chalk.bold('[d] Full diff')}`);
  console.log(`> _`);
}

export function printActiveTodoBar(tasks: TaskItem[]): void {
  if (tasks.length === 0) return;
  const width = getTerminalWidth();

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barLen = width < 70 ? 8 : 12;
  const progressBar = renderProgressBar(percent, barLen);

  console.log('');
  console.log(`${chalk.dim(`Tasks (${completed}/${total})`)} ${progressBar}`);

  for (const t of tasks.slice(0, 3)) {
    let icon = chalk.gray('o');
    let title = chalk.white(t.title);

    if (t.status === 'completed') {
      icon = chalk.white('[done]');
      title = chalk.strikethrough.gray(t.title);
    } else if (t.status === 'in_progress') {
      icon = chalk.gray('[..]');
      title = chalk.white(t.title);
    } else if (t.status === 'failed') {
      icon = chalk.white('[x]');
      title = chalk.white(t.title);
    }

    const maxTitleLen = Math.max(20, width - 15);
    console.log(`  ${icon} ${chalk.dim(t.id)}: ${truncateString(stripAnsi(title), maxTitleLen)}`);
  }
  if (tasks.length > 3) {
    console.log(chalk.dim(`  ... +${tasks.length - 3} more tasks (/plan)`));
  }
  console.log('');
}

export function printTaskPlan(tasks: TaskItem[]): void {
  const width = getTerminalWidth();
  if (tasks.length === 0) {
    console.log(chalk.dim('No active task plan.'));
    return;
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barLen = width < 70 ? 10 : 16;
  const progressBar = renderProgressBar(percent, barLen);

  console.log('');
  console.log(`${chalk.bold('Task Plan')} ${chalk.dim(`(${completed}/${total})`)} ${progressBar}`);
  console.log(chalk.dim('─'.repeat(Math.min(width, 50))));

  for (const t of tasks) {
    let icon = chalk.gray('o');
    let title = chalk.white(t.title);

    if (t.status === 'completed') {
      icon = chalk.white('[done]');
      title = chalk.strikethrough.gray(t.title);
    } else if (t.status === 'in_progress') {
      icon = chalk.gray('[..]');
      title = chalk.white(t.title);
    } else if (t.status === 'failed') {
      icon = chalk.white('[x]');
      title = chalk.white(t.title);
    }

    console.log(`  ${icon} ${chalk.dim(t.id)}: ${title}`);
    if (t.description) {
      console.log(`     ${chalk.dim(t.description)}`);
    }
  }
  console.log('');
}

/**
 * Responsive Models Table
 */
export function printModelsTable(models: ModelInfo[], currentModel: string): void {
  const width = getTerminalWidth();
  const availableWidth = Math.max(36, Math.min(width - 4, 96));
  
  const modelColWidth = Math.max(16, availableWidth - 28);
  
  const table = new Table({
    head: [
      chalk.dim(''),
      chalk.dim('Model'),
      chalk.dim('Context'),
      chalk.dim('Type'),
    ],
    colWidths: [4, modelColWidth, 10, 8],
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    },
    style: { 'padding-left': 1, 'padding-right': 1, head: [], border: ['dim'] }
  });

  const theme = getCurrentTheme();
  for (const m of models) {
    const isCurrent = m.id === currentModel;
    const marker = isCurrent ? theme.primary('>') : chalk.dim(' ');
    const displayId = m.id.length > modelColWidth - 2 
      ? m.id.slice(0, modelColWidth - 5) + '...' 
      : m.id;
    const modelId = isCurrent ? chalk.bold.white(displayId) : chalk.white(displayId);
    const ctx = `${Math.round(m.context_length / 1024)}k`;
    const pricing = m.isFree ? chalk.green('Free') : chalk.dim('Paid');

    table.push([marker, modelId, ctx, pricing]);
  }

  console.log('\n' + table.toString() + '\n');
}

export function printCheckpoints(checkpoints: Checkpoint[]): void {
  if (checkpoints.length === 0) {
    console.log(chalk.dim('No checkpoints recorded.'));
    return;
  }

  console.log('\n' + chalk.bold('Checkpoints Timeline:'));
  for (const cp of checkpoints) {
    const time = new Date(cp.timestamp).toLocaleTimeString();
    console.log(
      `  - ${chalk.dim(time)} - ${chalk.white(cp.description)} (${chalk.dim(`${cp.files.length} files`)}) [ID: ${chalk.dim(cp.id)}]`
    );
  }
  console.log('');
}

/**
 * Responsive Symbols Table
 */
export function printSymbolsTable(symbols: SymbolInfo[]): void {
  const width = getTerminalWidth();
  if (symbols.length === 0) {
    console.log(chalk.dim('No symbols found matching query.'));
    return;
  }

  const availableWidth = Math.max(38, width - 6);

  if (width < 80) {
    const kindWidth = 8;
    const symbolWidth = Math.max(12, Math.floor((availableWidth - 14) * 0.45));
    const locWidth = Math.max(12, availableWidth - kindWidth - symbolWidth - 6);
    
    const table = new Table({
      head: [chalk.dim('Kind'), chalk.dim('Symbol'), chalk.dim('Location')],
      colWidths: [kindWidth, symbolWidth, locWidth],
      style: { head: [], border: ['dim'] }
    });
    
    for (const s of symbols.slice(0, 20)) {
      table.push([
        chalk.dim(s.kind.slice(0, 6).toUpperCase()),
        chalk.white(truncateString(s.name, symbolWidth - 2)),
        chalk.dim(truncateString(`${s.file}:${s.line}`, locWidth - 2)),
      ]);
    }
    console.log('\n' + table.toString() + '\n');
  } else {
    const kindWidth = 10;
    const symbolWidth = Math.max(16, Math.floor((availableWidth - 16) * 0.3));
    const locWidth = Math.max(18, Math.floor((availableWidth - 16) * 0.35));
    const snippetWidth = Math.max(14, availableWidth - kindWidth - symbolWidth - locWidth - 8);
    
    const table = new Table({
      head: [chalk.dim('Kind'), chalk.dim('Symbol'), chalk.dim('Location'), chalk.dim('Snippet')],
      colWidths: [kindWidth, symbolWidth, locWidth, snippetWidth],
      style: { head: [], border: ['dim'] }
    });
    
    for (const s of symbols.slice(0, 25)) {
      table.push([
        chalk.dim(s.kind.toUpperCase()),
        chalk.white(truncateString(s.name, symbolWidth - 2)),
        chalk.dim(truncateString(`${s.file}:${s.line}`, locWidth - 2)),
        chalk.dim(truncateString(s.snippet.replace(/\s+/g, ' '), snippetWidth - 2)),
      ]);
    }
    console.log('\n' + table.toString() + '\n');
  }
}

/**
 * Responsive SynAI-style Help Menu
 */
/**
 * Render the `/keys` provider table.
 *
 * Configured providers are ticked, and the Source column separates a key you saved
 * through SynAI (`saved`) from one that merely happens to exist in your shell
 * environment (`env`) — so it's obvious why a provider already works without you
 * ever configuring it.
 */
export function printProviderKeys(
  statuses: ProviderKeyStatus[],
  options: { onlyConfigured?: boolean } = {}
): void {
  const theme = getCurrentTheme();
  const width = getTerminalWidth();
  const availableWidth = Math.max(40, Math.min(width - 4, 100));
  const rows = options.onlyConfigured ? statuses.filter((s) => s.configured) : statuses;

  // Narrow terminals drop the ID/Source columns rather than wrapping into mush.
  const narrow = availableWidth < 78;
  const cols = narrow ? ['', 'Provider', 'Key'] : ['', 'Provider', 'ID', 'Key', 'Source'];
  const markWidth = 3;
  const idWidth = narrow ? 0 : 20;
  const keyWidth = 16;
  const srcWidth = narrow ? 0 : 8;
  const nameWidth = Math.max(
    16,
    availableWidth - (markWidth + idWidth + keyWidth + srcWidth)
  );

  const table = new Table({
    head: cols.map((c) => chalk.dim(c)),
    colWidths: narrow
      ? [markWidth, nameWidth, keyWidth]
      : [markWidth, nameWidth, idWidth, keyWidth, srcWidth],
    chars: TABLE_CHARS,
    style: { 'padding-left': 1, 'padding-right': 1, head: [], border: ['dim'] }
  });

  for (const status of rows) {
    const mark = status.configured ? chalk.green(symbols.tick) : chalk.dim(symbols.dot);
    const name = status.configured
      ? chalk.white(status.provider.name)
      : chalk.dim(status.provider.name);
    const key = status.configured ? chalk.white(status.masked) : chalk.dim(symbols.dash);
    const source = status.configured
      ? status.source === 'stored'
        ? theme.primary('saved')
        : chalk.dim('env')
      : '';

    const row: string[] = [mark, name];
    if (!narrow) row.push(chalk.dim(status.provider.id));
    row.push(key);
    if (!narrow) row.push(source);
    table.push(row);
  }

  const configuredCount = statuses.filter((s) => s.configured).length;
  console.log('\n' + table.toString());
  console.log(
    chalk.dim(
      `  ${configuredCount}/${statuses.length} providers configured - ` +
        `set one with ${chalk.white('/keys set <id> <key>')} | docs: ${chalk.white('/keys docs <id>')}`
    ) + '\n'
  );
}

export function printHelp(): void {
  const width = getTerminalWidth();
  const theme = getCurrentTheme();
  console.log('');
  console.log(`${theme.primary('SynAI')} ${chalk.dim('Command Reference')}`);
  console.log(chalk.dim('─'.repeat(Math.min(width, 65))));
  console.log('');

  const sections = [
    {
      title: 'Navigation & Search',
      commands: [
        ['/files [path]', 'Browse workspace file tree'],
        ['/view <file>', 'View file content'],
        ['/grep <pattern>', 'Regex search across files'],
        ['/find <glob>', 'Find files by pattern'],
        ['/symbols [query]', 'Extract code symbols'],
        ['/diagnostics', 'Run compiler/linter checks'],
      ],
    },
    {
      title: 'Version Control',
      commands: [
        ['/diff [staged]', 'View git diff'],
        ['/review', 'Review current changes for issues'],
        ['/commit <msg>', 'Commit changes'],
        ['/log [n]', 'View commit history'],
        ['/branch', 'List branches'],
      ],
    },
    {
      title: 'Context & Memory',
      commands: [
        ['/compact [focus]', 'Compress conversation history'],
        ['/tokens, /context', 'Show context window usage & token count'],
        ['/cost', 'Show session cost & token usage'],
        ['/memory', 'View project memory & SYNAI.md'],
        ['/init', 'Generate/update SYNAI.md'],
      ],
    },
    {
      title: 'History & Undo',
      commands: [
        ['/rewind', 'Interactive checkpoint time machine'],
        ['/undo', 'Revert latest changes'],
        ['/checkpoints', 'View saved checkpoints'],
        ['/history', 'List saved sessions'],
        ['/resume <id>', 'Resume past session'],
        ['/rename <name>', 'Name current session'],
        ['/export [path]', 'Export conversation transcript'],
      ],
    },
    {
      title: 'Planning & Tasks',
      commands: [
        ['/plan [task]', 'Plan mode — research without modifying'],
        ['/plan:new <goal>', 'Create structured task plan'],
        ['/plan:clear', 'Clear active plan'],
        ['/task <id> <status>', 'Update task status'],
      ],
    },
    {
      title: 'AI & Configuration',
      commands: [
        ['/model [id]', 'Switch AI model'],
        ['/mode [mode]', 'Permission mode (default|acceptEdits|plan|auto)'],
        ['/think, /effort [lvl]', 'Set thinking effort (low|medium|high|max)'],
        ['/calc, /math <expr>', 'Evaluate high-precision math (BigInt, nCr, gcd, modPow, asciiPlot)'],
        ['/incognito, /ephemeral', 'Toggle private session (zero disk storage)'],
        ['/permissions', 'View/manage tool permission rules'],
        ['/config', 'View/edit configuration'],
        ['/keys [set|list|search]', 'API keys for 80+ providers (OpenAI, Anthropic, Groq, …)'],
        ['/theme', 'Switch color theme'],
        ['/web', 'Launch web dashboard'],
      ],
    },
    {
      title: 'Web & Research',
      commands: [
        ['/browser <task>', 'Autonomous web browsing'],
        ['/search <query>', 'Web search'],
        ['/research <query>', 'Deep codebase & web research'],
      ],
    },
    {
      title: 'Session',
      commands: [
        ['/clear', 'Clear conversation history'],
        ['/status', 'System status overview'],
        ['/doctor', 'Check config, API keys, git and environment health'],
        ['/help, ?', 'Show this help'],
        ['/bug', 'Report a bug'],
        ['/exit', 'Exit session'],
      ],
    },
  ];

  const cmdWidth = width < 75 ? 22 : 28;

  for (const section of sections) {
    console.log(chalk.bold(section.title));
    for (const [cmd, desc] of section.commands) {
      console.log(`  ${chalk.white(cmd.padEnd(cmdWidth))} ${chalk.dim(desc)}`);
    }
    console.log('');
  }
}

/**
 * Responsive SynAI-style Status Card
 */
export function printStatusCard(
  config: AgentConfig,
  branch: string | null,
  planSummary: { completed: number; total: number; percent: number },
  checkpointCount: number,
  conversationCount: number,
  rulesCount: number
): void {
  const shortModel = config.model.split('/').pop()?.replace(':free', '') || config.model;
  const isFree = config.model.includes(':free');
  const modelStatus = isFree ? `${shortModel} (Free)` : `${shortModel} (Paid)`;
  const apiStatus = config.apiKey ? '✓ Configured' : '⚠ Missing API Key';
  const modeStatus = config.mode === 'confirm' ? 'confirm (manual)' : config.mode;
  const workspaceStr = (config.workspaceRoot || '').replace(process.env.HOME || '~', '~');
  const branchStr = branch || 'none';
  const theme = getCurrentTheme();
  const spark = theme.spark || (process.platform === 'win32' ? '*' : '✻');

  console.log('');
  console.log(`${theme.accent(spark)} SynAI Status`);
  console.log(chalk.dim('───────────────────────────────────'));
  console.log(`  Model:       ${modelStatus}`);
  console.log(`  API:         ${apiStatus}`);
  console.log(`  Mode:        ${modeStatus}`);
  console.log(`  Thinking:    ${config.thinkingLevel || 'medium'}`);
  if (config.incognito || config.ephemeral) {
    console.log(`  Privacy:     ${chalk.magenta('🕵️ Incognito (Zero disk trace)')}`);
  }
  console.log(`  Workspace:   ${workspaceStr}`);
  console.log(`  Git:         ${branchStr}`);
  console.log(chalk.dim('───────────────────────────────────'));
  console.log(`  Tasks:       ${planSummary.completed}/${planSummary.total} completed`);
  console.log(`  Checkpoints: ${checkpointCount} saved`);
  console.log(`  Sessions:    ${conversationCount} conversations`);
  console.log('');
}

export function formatTurnFooter(durationMs: number, tokens: number): string {
  const seconds = (durationMs / 1000).toFixed(1);
  const formattedTokens = new Intl.NumberFormat().format(tokens);
  return chalk.dim(`Done in ${seconds}s • ${formattedTokens} tokens`);
}
