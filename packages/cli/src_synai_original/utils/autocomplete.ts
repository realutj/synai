import fs from 'node:fs';
import path from 'node:path';

/**
 * Command autocomplete and suggestion utilities for SynAI CLI
 */

export interface CommandSuggestion {
  command: string;
  description: string;
  aliases: string[];
}

export const COMMAND_REGISTRY: CommandSuggestion[] = [
  // Planning
  { command: '/plan', description: 'View task roadmap', aliases: ['/todo', '/tasks'] },
  
  // Files & Navigation
  { command: '/files', description: 'Browse workspace', aliases: ['/tree', '/ls'] },
  { command: '/view', description: 'View file content', aliases: ['/cat', '/read'] },
  { command: '/grep', description: 'Search codebase', aliases: ['/search-code'] },
  { command: '/find', description: 'Find files', aliases: ['/glob'] },
  { command: '/symbols', description: 'Extract symbols', aliases: ['/sym'] },
  { command: '/diagnostics', description: 'Run diagnostics', aliases: ['/lint', '/check'] },
  { command: '/rename', description: 'Rename file or directory', aliases: [] },
  { command: '/add-dir', description: 'Create directory', aliases: [] },
  { command: '/vim', description: 'Edit file in vim', aliases: [] },
  
  // Git
  { command: '/diff', description: 'View git diff', aliases: [] },
  { command: '/commit', description: 'Commit changes', aliases: [] },
  { command: '/log', description: 'Git log', aliases: [] },
  { command: '/branch', description: 'List branches', aliases: [] },
  
  // History
  { command: '/undo', description: 'Revert changes', aliases: ['/rollback'] },
  { command: '/checkpoints', description: 'View checkpoints', aliases: [] },
  { command: '/snapshot', description: 'Create checkpoint', aliases: [] },
  { command: '/history', description: 'List sessions', aliases: ['/conversations'] },
  { command: '/resume', description: 'Resume session', aliases: ['/load'] },
  { command: '/rewind', description: 'Rewind conversation', aliases: [] },
  { command: '/export', description: 'Export conversation', aliases: [] },
  
  // AI & Models
  { command: '/topic', description: 'View or set AI conversation topic', aliases: [] },
  { command: '/theme', description: 'Select or switch CLI color theme', aliases: ['/themes', '/color'] },
  { command: '/model', description: 'Switch model', aliases: ['/models', '/m'] },
  { command: '/think', description: 'Set cognitive effort level (low, medium, high, max)', aliases: ['/effort', '/thinking', '/dusun', '/dusunme'] },
  { command: '/effort', description: 'Set effort/thinking level (low, medium, high, max)', aliases: ['/think', '/thinking', '/dusun'] },
  { command: '/calc', description: 'Evaluate math expressions & plots', aliases: ['/math'] },
  { command: '/search', description: 'Web search', aliases: [] },
  { command: '/review', description: 'Review changes', aliases: [] },
  { command: '/bug', description: 'Report a bug or diagnose issue', aliases: [] },
  
  // Config & Session State
  { command: '/keys', description: 'Manage API keys for 80+ providers', aliases: ['/apikey', '/apikeys', '/providers'] },
  { command: '/config', description: 'View and change settings', aliases: ['/cfg', '/settings'] },
  { command: '/incognito', description: 'Toggle private incognito session (zero disk trace)', aliases: ['/ephemeral', '/private'] },
  { command: '/browser', description: 'Search web or read URL content as Markdown', aliases: [] },
  { command: '/memory', description: 'Show rules', aliases: ['/rules'] },
  { command: '/web', description: 'Launch web UI', aliases: [] },
  { command: '/status', description: 'System status', aliases: [] },
  { command: '/doctor', description: 'Diagnose config, keys, git and environment', aliases: ['/diag-env'] },
  { command: '/compact', description: 'Compact conversation', aliases: [] },
  { command: '/context', description: 'View context usage', aliases: ['/tokens'] },
  { command: '/tokens', description: 'Show tokens and context window usage', aliases: ['/context'] },
  { command: '/cost', description: 'View cost summary', aliases: [] },
  { command: '/permissions', description: 'Manage permissions', aliases: [] },
  
  // Session
  { command: '/clear', description: 'Clear screen', aliases: ['/reset'] },
  { command: '/help', description: 'Show help', aliases: ['/h', '/?'] },
  { command: '/exit', description: 'Exit SynAI', aliases: ['/quit', '/q'] },
  { command: '/version', description: 'Show version', aliases: ['/v'] }
];

/**
 * Find command suggestions based on partial input
 */
export function getCommandSuggestions(partial: string): CommandSuggestion[] {
  const normalized = partial.toLowerCase().trim();
  
  if (!normalized.startsWith('/')) {
    return [];
  }
  
  const searchTerm = normalized.slice(1);
  
  return COMMAND_REGISTRY.filter(cmd => {
    const commandMatch = cmd.command.toLowerCase().slice(1).startsWith(searchTerm);
    const aliasMatch = cmd.aliases.some(alias => 
      alias.toLowerCase().slice(1).startsWith(searchTerm)
    );
    return commandMatch || aliasMatch;
  }).slice(0, 5); // Limit to 5 suggestions
}

/**
 * Resolve command alias to actual command
 */
export function resolveCommandAlias(input: string): string {
  const normalized = input.toLowerCase().trim();
  
  for (const cmd of COMMAND_REGISTRY) {
    if (cmd.aliases.includes(normalized)) {
      return cmd.command;
    }
  }
  
  return input;
}

/**
 * Check if input is a valid command
 */
export function isValidCommand(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  
  return COMMAND_REGISTRY.some(cmd => 
    cmd.command.toLowerCase() === normalized ||
    cmd.aliases.includes(normalized)
  );
}

/**
 * Get command description
 */
export function getCommandDescription(command: string): string | undefined {
  const normalized = command.toLowerCase().trim();
  
  const found = COMMAND_REGISTRY.find(cmd =>
    cmd.command.toLowerCase() === normalized ||
    cmd.aliases.includes(normalized)
  );
  
  return found?.description;
}

/**
 * Creates a tab completer for node readline
 */
export function createReadlineCompleter(workspaceRoot: string) {
  return function completer(line: string): [string[], string] {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('/')) {
      // Complete slash commands
      const search = trimmed.toLowerCase();
      const allCmds: string[] = [];
      for (const item of COMMAND_REGISTRY) {
        allCmds.push(item.command);
        allCmds.push(...item.aliases);
      }
      const unique = Array.from(new Set(allCmds));
      const hits = unique.filter((c) => c.toLowerCase().startsWith(search));
      return [hits.length > 0 ? hits : unique, line];
    }

    // Complete file paths if user typed a command with argument (like /view or /files)
    const parts = line.split(' ');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      try {
        const dir = path.dirname(lastPart) === '.' ? workspaceRoot : path.resolve(workspaceRoot, path.dirname(lastPart));
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          const files = fs.readdirSync(dir);
          const base = path.basename(lastPart);
          const hits = files
            .filter((f) => !f.startsWith('.') && f !== 'node_modules' && f !== 'dist')
            .filter((f) => f.toLowerCase().startsWith(base.toLowerCase()))
            .map((f) => {
              const prefix = path.dirname(lastPart) === '.' ? '' : path.dirname(lastPart) + path.sep;
              return parts.slice(0, -1).join(' ') + ' ' + prefix + f;
            });
          if (hits.length > 0) {
            return [hits, line];
          }
        }
      } catch {}
    }

    return [[], line];
  };
}
