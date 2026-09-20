/**
 * Terminal glyph support.
 *
 * Every glyph this CLI prints must either be renderable by the active terminal, or
 * be replaced by an ASCII equivalent. The reason this module exists: Windows' legacy
 * console (conhost) runs a legacy code page (CP857/CP1254 for Turkish locales,
 * CP437/CP850 elsewhere) that cannot encode characters like ✓, ✗, ─ or ⏺ — the
 * console then prints "??" instead. That is never acceptable output.
 *
 * Three layers of defense:
 *  1. `ensureUtf8Console()` switches a Windows console to UTF-8 (`chcp 65001`) at
 *     startup, which makes the full glyph set renderable in the first place.
 *  2. `supportsUnicode()` detects what the terminal can actually render; it is the
 *     single switch every glyph choice must go through.
 *  3. `toAscii()` sanitizes strings arriving from core (which cannot know which
 *     terminal is attached) before they are rendered.
 *
 * `SYNAI_ASCII=1` forces ASCII mode; `SYNAI_ASCII=0` forces Unicode.
 */

import { spawnSync } from 'node:child_process';

let detected: boolean | null = null;

function detectWindowsUtf8(): boolean {
  // Windows Terminal and the VS Code integrated terminal handle UTF-8 natively,
  // regardless of the console code page.
  if (process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode') return true;

  // Legacy conhost: switch the code page to UTF-8. If the switch succeeds the full
  // glyph set is renderable; if it fails we fall back to ASCII.
  try {
    const res = spawnSync('chcp.com', ['65001'], { windowsHide: true, encoding: 'utf8' });
    return res.status === 0 && /65001/.test(String(res.stdout || ''));
  } catch {
    return false;
  }
}

/**
 * Whether the attached terminal can render the full Unicode glyph set. Evaluated
 * once and cached; every glyph decision in the UI must go through this.
 */
export function supportsUnicode(): boolean {
  if (detected === null) {
    const override = process.env.SYNAI_ASCII;
    if (override === '1') detected = false;
    else if (override === '0') detected = true;
    else if (process.platform !== 'win32') {
      detected = process.env.TERM !== 'dumb';
    } else {
      detected = detectWindowsUtf8();
    }
  }
  return detected;
}

/**
 * Prepare the console for Unicode output. Runs the Windows code-page switch exactly
 * once, before anything is printed. No-op on other platforms and when already UTF-8.
 */
export function ensureUtf8Console(): void {
  supportsUnicode();
}

export interface SymbolSet {
  tick: string;
  cross: string;
  dot: string;
  bullet: string;
  dash: string;
  warn: string;
  arrow: string;
  ellipsis: string;
  block: string;
  spark: string;
  actionGlyph: string;
  resultGlyph: string;
  thinkingGlyph: string;
  treeMiddle: string;
  treeLast: string;
  treePipe: string;
}

const UNICODE_SET: SymbolSet = {
  tick: '✓',
  cross: '✗',
  dot: '·',
  bullet: '•',
  dash: '—',
  warn: '⚠',
  arrow: '❯',
  ellipsis: '…',
  block: '■',
  spark: '✻',
  actionGlyph: '⏺',
  resultGlyph: '⎿',
  thinkingGlyph: '∴',
  treeMiddle: '├─',
  treeLast: '└─',
  treePipe: '│',
};

const ASCII_SET: SymbolSet = {
  tick: '[OK]',
  cross: '[X]',
  dot: '-',
  bullet: '*',
  dash: '-',
  warn: '[!]',
  arrow: '>',
  ellipsis: '...',
  block: '#',
  spark: '*',
  actionGlyph: '>',
  resultGlyph: '->',
  thinkingGlyph: '*',
  treeMiddle: '|-',
  treeLast: '\\-',
  treePipe: '|',
};

/** Glyphs safe for the detected terminal. Resolve once at import. */
export const symbols: SymbolSet = supportsUnicode() ? UNICODE_SET : ASCII_SET;

/** Box-drawing characters for cli-table3, ASCII when the terminal needs it. */
export const TABLE_CHARS = supportsUnicode()
  ? {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│',
    }
  : {
      'top': '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
      'bottom': '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+',
      'left': '|', 'left-mid': '+', 'mid': '-', 'mid-mid': '+',
      'right': '|', 'right-mid': '+', 'middle': '|',
    };

/**
 * Map known UI glyphs to their ASCII equivalents, then drop anything else that the
 * terminal may not render. Used for UI chrome and status text coming from core —
 * never for assistant message content, which may legitimately contain any language.
 * Unmappable characters are dropped rather than replaced with "?", so the failure
 * mode is a missing decoration, never visible mojibake.
 */
const ASCII_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u2713\u2714]/g, '[OK]'],   // ✓ ✔
  [/[\u2717\u2718\u00d7]/g, '[X]'], // ✗ ✘ ×
  [/\u26a0\ufe0f?/g, '[!]'],      // ⚠️
  [/\u00b7/g, '-'],               // ·
  [/\u2022/g, '*'],               // •
  [/[\u2014\u2013]/g, '-'],       // — –
  [/\u2026/g, '...'],             // …
  [/\u23fa/g, '>'],               // ⏺
  [/\u23ff/g, '->'],              // ⎿
  [/\u2234/g, '*'],               // ∴
  [/\u273b/g, '*'],               // ✻
  [/\u2500|\u2502/g, '-'],        // ─ │
  [/[\u250c\u2510\u2514\u2518\u251c\u2524\u252c\u2534\u253c]/g, '+'],
  [/[\u2b50\u26a1\u2696\ud83d\udfe6-\ud83d\udfe9]/gu, ''], // ⭐ ⚡ ⚖ 🟦-🟩
  [/[\ud83c-\udbff][\udc00-\udfff]/gu, ''], // remaining emoji surrogate pairs
  [/[^\x00-\x7F]/g, ''],          // anything else unmappable
];

export function toAscii(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [pattern, replacement] of ASCII_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}