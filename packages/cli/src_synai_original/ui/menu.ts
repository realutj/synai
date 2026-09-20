/**
 * Menu module — deprecated in modern CLI design.
 * Interactive palette menu has been replaced by slash commands.
 * This file is kept as a stub for backward compatibility.
 */

import { Agent, ConfigManager, OpenRouterClient, SynAIServer } from '@synai-code/core';

export interface MenuContext {
  agent: Agent;
  configManager: ConfigManager;
  openrouter: OpenRouterClient;
  server: SynAIServer | null;
  setServer: (server: SynAIServer) => void;
  handleUserPrompt: (prompt: string) => Promise<void>;
  handleSlashCommand: (cmd: string) => Promise<'continue' | 'exit'>;
}

export async function showInteractiveMenu(_ctx: MenuContext): Promise<'continue' | 'exit'> {
  // Deprecated — slash commands are the primary interface now
  console.log('\nUse /help to see available commands.\n');
  return 'continue';
}
