import fs from 'node:fs';
import path from 'node:path';
import { SymbolInfo } from '../types/index.js';

export function findSymbolsInWorkspace(
  workspaceRoot: string,
  query?: string,
  targetExts: string[] = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go']
): { symbols: SymbolInfo[]; summary: string } {
  const symbols: SymbolInfo[] = [];
  const ignore = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.gemini']);

  function scan(dir: string) {
    if (symbols.length >= 60) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (ignore.has(item.name)) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          scan(full);
        } else {
          const ext = path.extname(item.name).toLowerCase();
          if (targetExts.includes(ext)) {
            extractFileSymbols(workspaceRoot, full, symbols, query);
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  scan(workspaceRoot);

  const formatted = symbols.map(
    (s) => `[${s.kind.toUpperCase()}] ${s.name} -> ${s.file}:${s.line}\n  ${s.snippet}`
  );

  return {
    symbols,
    summary:
      symbols.length > 0
        ? `Found ${symbols.length} code symbols:\n\n${formatted.join('\n\n')}`
        : `No symbols found matching query: ${query || '*'}.`,
  };
}

function extractFileSymbols(
  workspaceRoot: string,
  filePath: string,
  results: SymbolInfo[],
  query?: string
) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const rel = path.relative(workspaceRoot, filePath);

    const patterns = [
      { regex: /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/, kind: 'function' },
      { regex: /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/, kind: 'class' },
      { regex: /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/, kind: 'interface' },
      { regex: /(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=/, kind: 'type' },
      { regex: /(?:export\s+)?const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/, kind: 'function' },
      { regex: /(?:export\s+)?const\s+([a-zA-Z0-9_$]+)\s*=\s*\{/, kind: 'variable' },
      { regex: /def\s+([a-zA-Z0-9_$]+)\s*\(/, kind: 'function' }, // Python
      { regex: /fn\s+([a-zA-Z0-9_$]+)\s*\(/, kind: 'function' }, // Rust
    ];

    for (let i = 0; i < lines.length; i++) {
      if (results.length >= 60) break;
      const line = lines[i];

      for (const p of patterns) {
        const match = p.regex.exec(line);
        if (match) {
          const name = match[1];
          if (!query || name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              name,
              kind: p.kind as any,
              file: rel,
              line: i + 1,
              snippet: line.trim().slice(0, 100),
            });
            break;
          }
        }
      }
    }
  } catch {
    // Ignore error
  }
}
