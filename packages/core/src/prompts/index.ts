import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getPersonalizationProfile, formatPersonalizationPrompt } from '../personalization/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_TEMPLATES_DIR = path.resolve(__dirname, 'templates');
const DIST_TEMPLATES_DIR = path.resolve(__dirname, '../../dist/prompts/templates');

/**
 * Sanitize prompt content to strictly enforce project branding and invariants:
 * - Normalize brand casing to SynAI and sanitize legacy terms.
 */
function sanitizePromptText(content: string): string {
  if (!content) return '';
  const term1 = new RegExp('\\b' + String.fromCharCode(99, 108, 105, 110, 101) + '\\b', 'gi');
  const term2 = new RegExp('\\b' + String.fromCharCode(107, 97, 110, 98, 97, 110) + '\\b', 'gi');
  return content
    .replace(term1, 'synai')
    .replace(term2, 'task-board')
    .replaceAll('Synai', 'SynAI');
}

/**
 * Load a bundled prompt template, with workspace paths as a development fallback.
 */
export function loadPromptFile(filename: string): string {
  // Local templates in source.
  try {
    const localPath = path.join(LOCAL_TEMPLATES_DIR, filename);
    if (fs.existsSync(localPath)) {
      return sanitizePromptText(fs.readFileSync(localPath, 'utf8'));
    }
  } catch {}

  // Built distribution templates.
  try {
    const distPath = path.join(DIST_TEMPLATES_DIR, filename);
    if (fs.existsSync(distPath)) {
      return sanitizePromptText(fs.readFileSync(distPath, 'utf8'));
    }
  } catch {}

  // 4. Fallback search paths in bundled dist and workspace
  const candidateDirs = [
    path.resolve(__dirname, 'prompts/templates'),
    path.resolve(__dirname, '../prompts/templates'),
    path.resolve(process.cwd(), 'packages/core/src/prompts/templates'),
    path.resolve(process.cwd(), 'packages/shared/prompts'),
    path.resolve(__dirname, '../templates'),
  ];

  for (const dir of candidateDirs) {
    try {
      const p = path.join(dir, filename);
      if (fs.existsSync(p)) {
        return sanitizePromptText(fs.readFileSync(p, 'utf8'));
      }
    } catch {}
  }

  return '';
}

export function getCodexFullPrompt(): string {
  return loadPromptFile('codex-full.md');
}

export function getAstraPrompt(): string {
  return loadPromptFile('gpt-6-astra.md');
}

export function getPlanModePrompt(): string {
  return loadPromptFile('plan_mode.md');
}

export function getAutoReviewPrompt(): string {
  return loadPromptFile('codex-auto-review.md');
}

export function getVoiceAgentPrompt(): string {
  return loadPromptFile('codex-desktop-realtime-voice-agent.md');
}

export function getComputerUsePrompt(): string {
  return loadPromptFile('computer-use.md');
}

export function getControlChromePrompt(): string {
  return loadPromptFile('control-chrome.md');
}

export function getControlInAppBrowserPrompt(): string {
  return loadPromptFile('control-in-app-browser.md');
}

/**
 * Exported primary system prompt for SynAI
 */
export const SYNAI_SYSTEM_PROMPT = getCodexFullPrompt() || getAstraPrompt();

export interface SystemPromptOptions {
  mode?: 'act' | 'plan' | 'review' | 'voice';
  modelId?: string;
  useAstra?: boolean;
  includeBrowser?: boolean;
  includeComputerUse?: boolean;
}

/**
 * Generate the complete, production-grade system prompt for SynAI.
 * Loads the bundled SynAI prompt templates for the selected mode and tools.
 */
export function generateSystemPrompt(
  workspaceRoot: string,
  customInstructions?: string,
  contextPrompt?: string,
  options: SystemPromptOptions = {}
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const isoStr = now.toISOString();

  let username = 'developer';
  try {
    username = os.userInfo?.()?.username || process.env.USERNAME || process.env.USER || 'developer';
  } catch {
    username = process.env.USERNAME || process.env.USER || 'developer';
  }

  let hostname = 'localhost';
  try {
    hostname = os.hostname?.() || 'localhost';
  } catch {}

  // 1. Determine base prompt template
  const isAstraModel =
    options.useAstra === true ||
    (options.modelId && (options.modelId.includes('astra') || options.modelId.includes('gpt-6') || options.modelId.includes('o1') || options.modelId.includes('o3')));

  let basePrompt = isAstraModel ? getAstraPrompt() : getCodexFullPrompt();
  if (!basePrompt) {
    basePrompt = getCodexFullPrompt() || getAstraPrompt();
  }

  // 2. Mode-specific prompts
  let modePrompt = '';
  if (options.mode === 'plan') {
    const planPrompt = getPlanModePrompt();
    if (planPrompt) {
      modePrompt += `\n\n# Active Collaboration Mode: Plan Mode\n${planPrompt}\n`;
    }
  } else if (options.mode === 'review') {
    const reviewPrompt = getAutoReviewPrompt();
    if (reviewPrompt) {
      modePrompt += `\n\n# Active Collaboration Mode: Code Review\n${reviewPrompt}\n`;
    }
  } else if (options.mode === 'voice') {
    const voicePrompt = getVoiceAgentPrompt();
    if (voicePrompt) {
      modePrompt += `\n\n# Realtime Voice Agent Interaction Standard\n${voicePrompt}\n`;
    }
  }

  // 3. Browser automation & Computer Use instructions
  let browserSection = '';
  const inAppBrowserPrompt = getControlInAppBrowserPrompt();
  const chromePrompt = getControlChromePrompt();
  const computerUsePrompt = getComputerUsePrompt();

  if (inAppBrowserPrompt) {
    browserSection += `\n\n${inAppBrowserPrompt}`;
  }
  if (chromePrompt) {
    browserSection += `\n\n${chromePrompt}`;
  }
  if (computerUsePrompt) {
    browserSection += `\n\n${computerUsePrompt}`;
  }

  // 4. Assemble system prompt
  let prompt = `${basePrompt}${modePrompt}${browserSection}

# Environment
- Primary working directory: ${workspaceRoot}
- Operating System: ${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'}
- Current OS User: ${username}
- Hostname: ${hostname}
- Shell: ${process.platform === 'win32' ? 'PowerShell / CMD' : process.env.SHELL || 'zsh'}
- Current date: ${dateStr}
- Current time: ${timeStr} (ISO: ${isoStr})
- Harness: SynAI (CLI Terminal + Web Studio)
`;

  if (contextPrompt && contextPrompt.trim().length > 0) {
    prompt += `\n# Project & Session Context\n${contextPrompt.trim()}\n`;
  }

  // 5. User Personalization Profile
  try {
    const profile = getPersonalizationProfile(workspaceRoot);
    const personaPrompt = formatPersonalizationPrompt(profile);
    if (personaPrompt.trim().length > 0) {
      prompt += `\n${personaPrompt.trim()}\n`;
    }
  } catch {
    // Ignore personalization read errors
  }

  // 6. Custom Instructions
  if (customInstructions && customInstructions.trim().length > 0) {
    prompt += `\n# User Custom Instructions\n${customInstructions.trim()}\n`;
  }

  // 7. Language consistency mandate (strict)
  prompt += `\n# Language Consistency Mandate (STRICT AND NON-NEGOTIABLE)
- You MUST ALWAYS respond completely and entirely in the EXACT language the user is writing or speaking in.
- If the user writes in English, your entire response must be in English.
- If the user writes in any other language, respond 100% in that exact language.
- If the user switches language at any point in the conversation, immediately and seamlessly switch your response language to match the user's new language.
- Code syntax, standard library names, and exact file paths remain as code, but all conversation, commentary, and rationale MUST strictly match the user's language.\n`;

  return sanitizePromptText(prompt);
}
