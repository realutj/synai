import chalk from 'chalk';
import { symbols } from './symbols.js';

// Re-exported so every consumer of ./ui/index.js gets the same terminal-aware
// glyphs without importing ./symbols.js directly.
export { symbols, TABLE_CHARS, toAscii, supportsUnicode, ensureUtf8Console } from './symbols.js';

export interface CLITheme {
  id: string;
  name: string;
  description: string;
  preview: string;

  spark: string;
  actionGlyph: string;
  resultGlyph: string;
  thinkingGlyph: string;
  treeMiddle: string;
  treeLast: string;
  treePipe: string;

  primary: (text: string) => string;
  secondary: (text: string) => string;
  accent: (text: string) => string;
  success: (text: string) => string;
  warning: (text: string) => string;
  error: (text: string) => string;
  info: (text: string) => string;
  dim: (text: string) => string;
  muted: (text: string) => string;
}

const sparkPreview = `${symbols.spark} `;

const baseGlyphs = {
  spark: symbols.spark,
  actionGlyph: symbols.actionGlyph,
  resultGlyph: symbols.resultGlyph,
  thinkingGlyph: symbols.thinkingGlyph,
  treeMiddle: symbols.treeMiddle,
  treeLast: symbols.treeLast,
  treePipe: symbols.treePipe,
};

export const THEMES: Record<string, CLITheme> = {
  dark: {
    id: 'dark',
    name: 'Dark (Default)',
    description: 'Dark terminal theme with amber/terracotta spark, green success, red errors',
    preview: chalk.hex('#d97757')(sparkPreview) + chalk.hex('#4ade80')('■ ') + chalk.hex('#f87171')('■'),
    ...baseGlyphs,
    primary: chalk.white,
    secondary: chalk.hex('#a1a1aa'),
    accent: chalk.hex('#d97757'),
    success: chalk.hex('#4ade80'),
    warning: chalk.hex('#fbbf24'),
    error: chalk.hex('#f87171'),
    info: chalk.hex('#60a5fa'),
    dim: chalk.dim,
    muted: chalk.gray,
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Light terminal theme with darker colors',
    preview: chalk.hex('#9b3419')(sparkPreview) + chalk.hex('#16a34a')('■ ') + chalk.hex('#dc2626')('■'),
    ...baseGlyphs,
    primary: chalk.black,
    secondary: chalk.hex('#52525b'),
    accent: chalk.hex('#9b3419'),
    success: chalk.hex('#16a34a'),
    warning: chalk.hex('#d97706'),
    error: chalk.hex('#dc2626'),
    info: chalk.hex('#2563eb'),
    dim: chalk.dim,
    muted: chalk.gray,
  },
  'dark-daltonized': {
    id: 'dark-daltonized',
    name: 'Dark Daltonized',
    description: 'Colorblind-friendly dark theme',
    preview: chalk.hex('#d97757')(sparkPreview) + chalk.hex('#3b82f6')('■ ') + chalk.hex('#f59e0b')('■'),
    ...baseGlyphs,
    primary: chalk.white,
    secondary: chalk.hex('#a1a1aa'),
    accent: chalk.hex('#d97757'),
    success: chalk.hex('#3b82f6'),
    warning: chalk.hex('#f59e0b'),
    error: chalk.hex('#d946ef'),
    info: chalk.hex('#2dd4bf'),
    dim: chalk.dim,
    muted: chalk.gray,
  },
  'light-daltonized': {
    id: 'light-daltonized',
    name: 'Light Daltonized',
    description: 'Colorblind-friendly light theme',
    preview: chalk.hex('#9b3419')(sparkPreview) + chalk.hex('#1d4ed8')('■ ') + chalk.hex('#b45309')('■'),
    ...baseGlyphs,
    primary: chalk.black,
    secondary: chalk.hex('#52525b'),
    accent: chalk.hex('#9b3419'),
    success: chalk.hex('#1d4ed8'),
    warning: chalk.hex('#b45309'),
    error: chalk.hex('#c026d3'),
    info: chalk.hex('#0f766e'),
    dim: chalk.dim,
    muted: chalk.gray,
  },
  'dark-ansi': {
    id: 'dark-ansi',
    name: 'Dark ANSI',
    description: 'Dark theme using only 16 ANSI colors',
    preview: chalk.yellow(sparkPreview) + chalk.green('■ ') + chalk.red('■'),
    ...baseGlyphs,
    primary: chalk.white,
    secondary: chalk.gray,
    accent: chalk.yellow,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    dim: chalk.dim,
    muted: chalk.gray,
  },
  'light-ansi': {
    id: 'light-ansi',
    name: 'Light ANSI',
    description: 'Light theme using only 16 ANSI colors',
    preview: chalk.yellow(sparkPreview) + chalk.green('■ ') + chalk.red('■'),
    ...baseGlyphs,
    primary: chalk.black,
    secondary: chalk.gray,
    accent: chalk.yellow,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    dim: chalk.dim,
    muted: chalk.gray,
  },
};

let currentTheme: CLITheme = THEMES['dark'];

export function getAvailableThemes(): CLITheme[] {
  return Object.values(THEMES);
}

export function getTheme(id?: string): CLITheme {
  if (!id) return currentTheme;
  const normalized = id.toLowerCase().trim();
  return THEMES[normalized] || THEMES['dark'];
}

export function setCurrentTheme(id: string): CLITheme {
  const theme = getTheme(id);
  currentTheme = theme;
  return currentTheme;
}

export function getCurrentTheme(): CLITheme {
  return currentTheme;
}
