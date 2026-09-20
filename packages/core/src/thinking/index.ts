import { ThinkingLevel, ThinkingLevelConfig } from '../types/index.js';

export function normalizeThinkingLevel(level?: string): 'low' | 'medium' | 'high' | 'max' {
  if (!level) return 'low';
  const l = level.toLowerCase().trim();
  if (['low', 'fast', '1', 'hızlı', 'hizli'].includes(l)) return 'low';
  if (['medium', 'balanced', 'normal', '2', 'dengeli'].includes(l)) return 'medium';
  if (['high', 'deep', '3', 'derin'].includes(l)) return 'high';
  if (['max', 'maximum', 'maksimum', 'genius', '4', 'dahi'].includes(l)) return 'max';
  return 'low';
}

const LOW_CONFIG: ThinkingLevelConfig = {
  level: 'low',
  temperature: 0.1,
  maxTokens: 4096,
  maxTurns: 15,
  enableReasoning: false,
  enableSelfCritique: false,
  enableMultiPath: false,
  description: 'Low: Quick responses, ideal for simple tasks and rapid iteration',
};

const MEDIUM_CONFIG: ThinkingLevelConfig = {
  level: 'medium',
  temperature: 0.3,
  maxTokens: 8192,
  maxTurns: 25,
  enableReasoning: true,
  enableSelfCritique: false,
  enableMultiPath: false,
  description: 'Medium: Optimal balance of speed and reasoning quality for standard workflows',
};

const HIGH_CONFIG: ThinkingLevelConfig = {
  level: 'high',
  temperature: 0.4,
  maxTokens: 16384,
  maxTurns: 40,
  enableReasoning: true,
  enableSelfCritique: true,
  enableMultiPath: false,
  description: 'High: Advanced reasoning with self-critique for complex refactoring and logic',
};

const MAX_CONFIG: ThinkingLevelConfig = {
  level: 'max',
  temperature: 0.5,
  maxTokens: 32768,
  maxTurns: 60,
  enableReasoning: true,
  enableSelfCritique: true,
  enableMultiPath: true,
  description: 'Max: Maximum cognitive capacity - explores multiple solution paths and recursive verification',
};

export const THINKING_LEVELS: Record<ThinkingLevel, ThinkingLevelConfig> = {
  low: LOW_CONFIG,
  medium: MEDIUM_CONFIG,
  high: HIGH_CONFIG,
  max: MAX_CONFIG,
  // Backward compatibility aliases
  fast: LOW_CONFIG,
  balanced: MEDIUM_CONFIG,
  deep: HIGH_CONFIG,
  genius: MAX_CONFIG,
};

export function getThinkingLevelConfig(level: ThinkingLevel): ThinkingLevelConfig {
  const normalized = normalizeThinkingLevel(level);
  return THINKING_LEVELS[normalized];
}

export function applyThinkingLevel(
  level: ThinkingLevel,
  baseConfig: { temperature?: number; maxTokens?: number }
): { temperature: number; maxTokens: number; maxTurns: number } {
  const normalized = normalizeThinkingLevel(level);
  const thinkingConfig = THINKING_LEVELS[normalized];
  return {
    temperature: baseConfig.temperature ?? thinkingConfig.temperature,
    maxTokens: baseConfig.maxTokens ?? thinkingConfig.maxTokens,
    maxTurns: thinkingConfig.maxTurns,
  };
}

export function getThinkingLevelPromptAddition(level: ThinkingLevel): string {
  const normalized = normalizeThinkingLevel(level);
  const config = THINKING_LEVELS[normalized];
  
  let addition = `\n### ACTIVE COGNITIVE EFFORT LEVEL: ${normalized.toUpperCase()}\n`;
  addition += `${config.description}\n`;
  addition += `- **Language Rule**: Respond completely and exclusively in the exact language the user prompts in (e.g. Turkish if asked in Turkish). Never use English when the user speaks another language.\n`;
  addition += `- **Speed & Directness**: For general questions, greetings, or simple tasks, answer immediately and concisely without unnecessary reasoning loops.\n\n`;

  if (normalized === 'low') {
    addition += `**Low Effort Instructions:**
- Prioritize speed, brevity, and directness — respond as quickly as possible
- Make the smallest change that satisfies the request; skip long explanations unless asked
- Minimize tool calls, but never skip reading the region you are about to edit
- Speed never justifies broken code — still confirm the result compiles\n`;
  } else if (normalized === 'medium') {
    addition += `**Medium Effort Instructions:**
- State the approach in one or two sentences before editing
- Read the target region before changing it; match the file's existing style
- After changing logic, run the narrowest check (type-check or the relevant test) and report its real output
- Keep explanations concise and practical\n`;
  } else if (normalized === 'high') {
    addition += `**High Effort Instructions:**
- Map the relevant code first (grep / find_symbols), then read the exact regions you will touch
- Before editing, name the edge case or failure mode you are least sure about
- Implement the minimal change that solves the problem — no opportunistic refactoring
- Verify explicitly: type-check plus the test covering the area you changed; quote the actual result
- If verification fails, fix the cause rather than the symptom\n`;
  } else if (normalized === 'max') {
    addition += `**Max Effort Instructions:**
- Work in explicit phases: (1) map the code, (2) state the approach and its main trade-off, (3) implement, (4) verify, (5) report
- Map first: locate every call site and definition you will affect before editing anything
- State the approach in 2-3 sentences, including the alternative you rejected and why
- Implement the smallest change that fully solves the problem, matching surrounding conventions exactly
- Verify thoroughly: type-check, the most relevant tests, and — when CLI or UI behavior changed — the actual command
- Report honestly: what changed, what you verified with real output, and any risk you knowingly left unresolved\n`;
  }
  
  return addition;
}

export function getThinkingLevelIcon(level: ThinkingLevel): string {
  const normalized = normalizeThinkingLevel(level);
  const icons: Record<string, string> = {
    low: '[L]',
    medium: '[M]',
    high: '[H]',
    max: '[MAX]',
  };
  return icons[normalized] || '⚖️';
}

export function getThinkingLevelColor(level: ThinkingLevel): string {
  const normalized = normalizeThinkingLevel(level);
  const colors: Record<string, string> = {
    low: 'cyan',
    medium: 'green',
    high: 'blue',
    max: 'magenta',
  };
  return colors[normalized] || 'green';
}

export function getAllThinkingLevels(): ThinkingLevel[] {
  return ['low', 'medium', 'high', 'max'];
}

export function getThinkingLevelDisplay(level: ThinkingLevel): string {
  const normalized = normalizeThinkingLevel(level);
  const config = THINKING_LEVELS[normalized];
  return `${getThinkingLevelIcon(normalized)} ${normalized.toUpperCase()} - ${config.description}`;
}
