import fs from 'node:fs';
import path from 'node:path';
import { generateDiff } from './diff_utils.js';

export interface FileToolResult {
  output: string;
  isError?: boolean;
  diff?: string;
  modifiedFiles?: string[];
  actionType: 'file_read' | 'file_write' | 'file_edit' | 'search' | 'info';
}

export class UnsafePathError extends Error {
  constructor(targetPath: string) {
    super(`Path "${targetPath}" resolves outside the workspace root and was blocked for safety.`);
    this.name = 'UnsafePathError';
  }
}

/**
 * Resolves a (possibly relative) path against the workspace root and guarantees
 * the result stays inside it. Prevents path traversal (e.g. "../../etc/passwd")
 * or absolute paths from escaping the sandboxed workspace.
 */
export function resolveSafePath(workspaceRoot: string, targetPath: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Invalid path provided.');
  }

  const trimmed = targetPath.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('ftp://')
  ) {
    throw new Error(
      `"${targetPath}" is a web URL, not a local file. Use web_fetch to inspect web pages or web_search to find information online.`
    );
  }

  const root = path.resolve(workspaceRoot);
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(root, targetPath);

  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new UnsafePathError(targetPath);
  }

  return resolved;
}

export function viewFile(
  workspaceRoot: string,
  filePath: string,
  startLine?: number,
  endLine?: number
): FileToolResult {
  // Defaults mirror Claude Code's Read tool: without an explicit range, show a
  // bounded window rather than dumping an entire multi-thousand-line or minified
  // file into the model's context. Very long individual lines (minified bundles,
  // data dumps) are also capped per-line so one line can't blow the budget alone.
  const DEFAULT_LINE_WINDOW = 2000;
  const MAX_LINE_LENGTH = 2000;

  try {
    const fullPath = resolveSafePath(workspaceRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        output: `Error: File not found: ${filePath}`,
        isError: true,
        actionType: 'file_read',
      };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        output: `Error: Path is a directory, not a file: ${filePath}. Use list_dir instead.`,
        isError: true,
        actionType: 'file_read',
      };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    const start = Math.max(1, startLine || 1);
    const noRangeRequested = !startLine && !endLine;
    const end = Math.min(
      totalLines,
      endLine || (noRangeRequested ? Math.min(totalLines, start - 1 + DEFAULT_LINE_WINDOW) : totalLines)
    );

    if (start > totalLines) {
      return {
        output: `File has only ${totalLines} lines. Requested startLine is ${start}.`,
        actionType: 'file_read',
      };
    }

    const sliced = lines.slice(start - 1, end);
    const formatted = sliced
      .map((line, idx) => {
        const truncated =
          line.length > MAX_LINE_LENGTH
            ? `${line.slice(0, MAX_LINE_LENGTH)}… [line truncated, ${line.length} chars total]`
            : line;
        return `${(start + idx).toString().padStart(5, ' ')} | ${truncated}`;
      })
      .join('\n');

    const truncationNotice =
      end < totalLines
        ? `\n\n[Showing lines ${start}-${end} of ${totalLines}. Pass startLine/endLine to view more.]`
        : '';

    return {
      output: `File: ${path.relative(workspaceRoot, fullPath)} (Lines ${start}-${end} of ${totalLines})\n\n${formatted}${truncationNotice}`,
      actionType: 'file_read',
    };
  } catch (err: any) {
    return {
      output: `Error reading file ${filePath}: ${err.message}`,
      isError: true,
      actionType: 'file_read',
    };
  }
}

/**
 * Basic syntax sanity checker for common file types
 */
function checkSyntaxSanity(filePath: string, content: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    try {
      JSON.parse(content);
    } catch (e: any) {
      return `[Syntax Notice]: JSON syntax error: ${e.message}`;
    }
  } else if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
    let braces = 0;
    let brackets = 0;
    let parens = 0;
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const next = content[i + 1];

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inSingle) {
        if (char === '\\') i++;
        else if (char === "'") inSingle = false;
        continue;
      }
      if (inDouble) {
        if (char === '\\') i++;
        else if (char === '"') inDouble = false;
        continue;
      }
      if (inBacktick) {
        if (char === '\\') i++;
        else if (char === '`') inBacktick = false;
        continue;
      }

      if (char === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      if (char === "'") inSingle = true;
      else if (char === '"') inDouble = true;
      else if (char === '`') inBacktick = true;
      else if (char === '{') braces++;
      else if (char === '}') braces--;
      else if (char === '[') brackets++;
      else if (char === ']') brackets--;
      else if (char === '(') parens++;
      else if (char === ')') parens--;
    }

    if (braces !== 0 || brackets !== 0 || parens !== 0) {
      return `[Syntax Warning]: Possible unclosed delimiters in ${path.basename(filePath)} (braces: ${braces}, brackets: ${brackets}, parens: ${parens}).`;
    }
  } else if (ext === '.py') {
    let parens = 0;
    let brackets = 0;
    let braces = 0;
    let inSingle = false;
    let inDouble = false;
    let inTripleSingle = false;
    let inTripleDouble = false;
    const lines = content.split('\n');
    let hasTabs = false;
    let hasSpaces = false;

    for (const l of lines) {
      if (/^\t+/.test(l)) hasTabs = true;
      if (/^ {2,}/.test(l)) hasSpaces = true;
    }

    if (hasTabs && hasSpaces) {
      return `[Syntax Warning]: Inconsistent indentation detected in ${path.basename(filePath)}: mixed tabs and spaces.`;
    }

    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      const next = content[i + 1];
      const next2 = content[i + 2];

      if (c === '#' && !inSingle && !inDouble && !inTripleSingle && !inTripleDouble) {
        while (i < content.length && content[i] !== '\n') i++;
        continue;
      }
      if (c === "'" && next === "'" && next2 === "'") {
        inTripleSingle = !inTripleSingle;
        i += 2;
        continue;
      }
      if (c === '"' && next === '"' && next2 === '"') {
        inTripleDouble = !inTripleDouble;
        i += 2;
        continue;
      }
      if (inTripleSingle || inTripleDouble) continue;

      if (c === "'" && content[i - 1] !== '\\') inSingle = !inSingle;
      else if (c === '"' && content[i - 1] !== '\\') inDouble = !inDouble;

      if (!inSingle && !inDouble) {
        if (c === '(') parens++;
        else if (c === ')') parens--;
        else if (c === '[') brackets++;
        else if (c === ']') brackets--;
        else if (c === '{') braces++;
        else if (c === '}') braces--;
      }
    }

    if (parens !== 0 || brackets !== 0 || braces !== 0) {
      return `[Syntax Warning]: Possible unclosed delimiters in ${path.basename(filePath)} (parens: ${parens}, brackets: ${brackets}, braces: ${braces}).`;
    }
  }
  return null;
}

/**
 * 5-tier fuzzy find and replace engine
 */
export function performFuzzyReplacement(
  originalContent: string,
  targetContent: string,
  replacementContent: string,
  allowMultiple: boolean
): { success: boolean; newContent?: string; strategyUsed?: string; error?: string; closestMatchSnippet?: string } {
  if (!targetContent || targetContent.length === 0) {
    return {
      success: false,
      error: 'targetContent cannot be empty — provide the exact text to find and replace (use write_file if you mean to replace the whole file).',
    };
  }
  if (targetContent === replacementContent) {
    return {
      success: false,
      error: 'targetContent and replacementContent are identical — this edit would be a no-op. Did you mean to change something?',
    };
  }

  // Strategy 1: Exact match
  if (originalContent.includes(targetContent)) {
    const occurrences = originalContent.split(targetContent).length - 1;
    if (occurrences > 1 && !allowMultiple) {
      return {
        success: false,
        error: `Found ${occurrences} exact occurrences of target content. Set allowMultiple to true or provide more unique context lines.`,
      };
    }
    const newContent = allowMultiple
      ? originalContent.replaceAll(targetContent, replacementContent)
      : originalContent.replace(targetContent, replacementContent);
    return { success: true, newContent, strategyUsed: 'exact' };
  }

  // Strategy 2: Line endings normalization (\r\n <-> \n)
  const normOriginal = originalContent.replace(/\r\n/g, '\n');
  const normTarget = targetContent.replace(/\r\n/g, '\n');
  const normReplacement = replacementContent.replace(/\r\n/g, '\n');

  if (normOriginal.includes(normTarget)) {
    const occurrences = normOriginal.split(normTarget).length - 1;
    if (occurrences > 1 && !allowMultiple) {
      return {
        success: false,
        error: `Found ${occurrences} occurrences after line-ending normalization. Provide more context lines.`,
      };
    }
    const replaced = allowMultiple
      ? normOriginal.replaceAll(normTarget, normReplacement)
      : normOriginal.replace(normTarget, normReplacement);
    // Preserve CRLF if original had CRLF
    const finalContent = originalContent.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
    return { success: true, newContent: finalContent, strategyUsed: 'normalized_line_endings' };
  }

  // Strategy 3: Indentation-flexible line matching
  const origLines = normOriginal.split('\n');
  const targetLines = normTarget.split('\n');
  const replLines = normReplacement.split('\n');

  // Search for line window where trimmed lines match
  const matches: { start: number; end: number; baseIndent: string }[] = [];
  for (let i = 0; i <= origLines.length - targetLines.length; i++) {
    let allMatch = true;
    for (let j = 0; j < targetLines.length; j++) {
      if (origLines[i + j].trim() !== targetLines[j].trim()) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      const matchStartLine = origLines[i];
      const matchIndent = matchStartLine.match(/^(\s*)/)?.[1] || '';
      matches.push({ start: i, end: i + targetLines.length, baseIndent: matchIndent });
    }
  }

  if (matches.length > 0) {
    if (matches.length > 1 && !allowMultiple) {
      return {
        success: false,
        error: `Found ${matches.length} matches with flexible indentation. Provide more surrounding context lines, or set allowMultiple to true to replace all of them.`,
      };
    }

    // Apply to every match when allowMultiple is set (previously this silently
    // only ever touched the first match even when the caller asked for all of
    // them — a real correctness bug for multi-site refactors). Apply from the
    // bottom up so earlier line indices stay valid as later ones are rewritten.
    const matchesToApply = allowMultiple ? matches : [matches[0]];
    const targetIndent = targetLines[0].match(/^(\s*)/)?.[1] || '';
    let newLines = [...origLines];

    for (let m = matchesToApply.length - 1; m >= 0; m--) {
      const targetMatch = matchesToApply[m];
      const adaptedReplLines = replLines.map((line) => {
        if (line.trim().length === 0) return '';
        const lineIndent = line.match(/^(\s*)/)?.[1] || '';
        if (lineIndent.startsWith(targetIndent)) {
          const extraIndent = lineIndent.slice(targetIndent.length);
          return targetMatch.baseIndent + extraIndent + line.trim();
        }
        return targetMatch.baseIndent + line.trim();
      });
      newLines = [...newLines.slice(0, targetMatch.start), ...adaptedReplLines, ...newLines.slice(targetMatch.end)];
    }

    const replaced = newLines.join('\n');
    const finalContent = originalContent.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
    return { success: true, newContent: finalContent, strategyUsed: 'indentation_flexible' };
  }

  // Strategy 4: Anchor matching (first and last line match for blocks >= 3 lines)
  if (targetLines.length >= 3) {
    const head = targetLines[0].trim();
    const tail = targetLines[targetLines.length - 1].trim();

    const anchorMatches: { start: number; end: number }[] = [];
    for (let i = 0; i < origLines.length; i++) {
      if (origLines[i].trim() === head) {
        for (let j = i + 1; j < Math.min(origLines.length, i + targetLines.length + 5); j++) {
          if (origLines[j].trim() === tail) {
            anchorMatches.push({ start: i, end: j + 1 });
            break;
          }
        }
      }
    }

    if (anchorMatches.length === 1 || (anchorMatches.length > 1 && allowMultiple)) {
      let newLines = [...origLines];
      for (let m = anchorMatches.length - 1; m >= 0; m--) {
        const match = anchorMatches[m];
        newLines = [...newLines.slice(0, match.start), ...replLines, ...newLines.slice(match.end)];
      }
      const replaced = newLines.join('\n');
      const finalContent = originalContent.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
      return { success: true, newContent: finalContent, strategyUsed: 'anchor_matching' };
    }

    if (anchorMatches.length > 1 && !allowMultiple) {
      return {
        success: false,
        error: `Found ${anchorMatches.length} blocks matching the first/last line via anchor matching. Provide more unique surrounding context, or set allowMultiple to true to replace all of them.`,
      };
    }
  }

  // Find closest candidate snippet for diagnostic feedback
  let bestSimilarity = 0;
  let bestLineIndex = 0;
  for (let i = 0; i < origLines.length; i++) {
    const origTrim = origLines[i].trim();
    const targetFirstTrim = targetLines[0].trim();
    if (origTrim.includes(targetFirstTrim) || targetFirstTrim.includes(origTrim)) {
      bestLineIndex = i;
      bestSimilarity = 1;
      break;
    }
  }

  const snippetStart = Math.max(0, bestLineIndex - 2);
  const snippetEnd = Math.min(origLines.length, bestLineIndex + 5);
  const snippet = origLines
    .slice(snippetStart, snippetEnd)
    .map((l, idx) => `${snippetStart + idx + 1}: ${l}`)
    .join('\n');

  return {
    success: false,
    error: `Target content to replace was not found. Verify exact characters and surrounding context lines.`,
    closestMatchSnippet: snippet,
  };
}

/**
 * Write `content` to `targetPath` without ever leaving a truncated file behind.
 *
 * A bare writeFileSync can be interrupted mid-write (crash, Ctrl+C, full disk,
 * power loss) and corrupt the file — for an agent that means a broken workspace the
 * next run has to repair. Instead we write to a temp file in the *same directory*
 * (same filesystem, so the rename is atomic where the OS supports it) and rename it
 * over the target. Any failure before the rename leaves the original file untouched.
 */
function writeAtomically(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.synai-tmp-${process.pid}-${Date.now()}`
  );
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      fs.renameSync(tmpPath, targetPath);
      return;
    } catch {
      // Windows can refuse a rename over an existing file in rare cases (AV,
      // permissions). Falling back to a direct write beats failing the whole edit
      // over a platform quirk.
      fs.writeFileSync(targetPath, content, 'utf8');
      return;
    }
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // Best-effort cleanup; a leftover temp file is harmless.
    }
  }
}

export function writeFile(
  workspaceRoot: string,
  filePath: string,
  content: string,
  dryRun: boolean = false
): FileToolResult {
  try {
    const fullPath = resolveSafePath(workspaceRoot, filePath);
    const oldContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
    const diff = generateDiff(filePath, oldContent, content);

    const syntaxNotice = checkSyntaxSanity(filePath, content);

    if (!dryRun) {
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      writeAtomically(fullPath, content);
    }

    const relPath = path.relative(workspaceRoot, fullPath);
    const actionDesc = oldContent ? 'Overwrote' : 'Created';
    const dryRunTag = dryRun ? ' [DRY-RUN - No changes written]' : '';
    let outputMsg = `Successfully ${actionDesc.toLowerCase()} ${relPath}${dryRunTag} (+${diff.addedLines}, -${diff.removedLines} lines)`;
    if (syntaxNotice) {
      outputMsg += `\n${syntaxNotice}`;
    }

    return {
      output: outputMsg,
      diff: diff.patch,
      modifiedFiles: [relPath],
      actionType: 'file_write',
    };
  } catch (err: any) {
    return {
      output: `Error writing file ${filePath}: ${err.message}`,
      isError: true,
      actionType: 'file_write',
    };
  }
}

export function editFile(
  workspaceRoot: string,
  filePath: string,
  targetContent: string,
  replacementContent: string,
  allowMultiple: boolean = false,
  dryRun: boolean = false
): FileToolResult {
  try {
    const fullPath = resolveSafePath(workspaceRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        output: `Error: Cannot edit non-existent file: ${filePath}`,
        isError: true,
        actionType: 'file_edit',
      };
    }

    const originalContent = fs.readFileSync(fullPath, 'utf8');

    const result = performFuzzyReplacement(originalContent, targetContent, replacementContent, allowMultiple);

    if (!result.success || !result.newContent) {
      let errDetail = `Error: ${result.error || 'Failed to apply edit.'}`;
      if (result.closestMatchSnippet) {
        errDetail += `\n\nClosest match found in ${filePath} near line:\n${result.closestMatchSnippet}\n\nPlease update targetContent to match these exact lines.`;
      }
      return {
        output: errDetail,
        isError: true,
        actionType: 'file_edit',
      };
    }

    const newContent = result.newContent;
    const diff = generateDiff(filePath, originalContent, newContent);
    const syntaxNotice = checkSyntaxSanity(filePath, newContent);

    if (!dryRun) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
    }

    const relPath = path.relative(workspaceRoot, fullPath);
    const dryRunTag = dryRun ? ' [DRY-RUN - No changes written]' : '';
    const stratTag = result.strategyUsed && result.strategyUsed !== 'exact' ? ` (${result.strategyUsed})` : '';

    let outputMsg = `Successfully edited ${relPath}${dryRunTag}${stratTag} (+${diff.addedLines}, -${diff.removedLines} lines)`;
    if (syntaxNotice) {
      outputMsg += `\n${syntaxNotice}`;
    }

    return {
      output: outputMsg,
      diff: diff.patch,
      modifiedFiles: [relPath],
      actionType: 'file_edit',
    };
  } catch (err: any) {
    return {
      output: `Error editing file ${filePath}: ${err.message}`,
      isError: true,
      actionType: 'file_edit',
    };
  }
}

export function listDir(
  workspaceRoot: string,
  dirPath: string = '.',
  maxDepth: number = 2
): FileToolResult {
  try {
    const fullPath = resolveSafePath(workspaceRoot, dirPath);
    if (!fs.existsSync(fullPath)) {
      return {
        output: `Error: Directory not found: ${dirPath}`,
        isError: true,
        actionType: 'info',
      };
    }

    const entries: string[] = [];
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.gemini', '.next', '.vscode']);

    function scan(current: string, depth: number, prefix: string) {
      if (depth > maxDepth) return;
      const list = fs.readdirSync(current, { withFileTypes: true });
      for (const item of list) {
        if (ignoreDirs.has(item.name)) continue;
        const itemRel = path.relative(workspaceRoot, path.join(current, item.name));
        if (item.isDirectory()) {
          entries.push(`${prefix}📁 ${item.name}/`);
          scan(path.join(current, item.name), depth + 1, prefix + '  ');
        } else {
          entries.push(`${prefix}📄 ${item.name}`);
        }
      }
    }

    scan(fullPath, 1, '');
    const relRoot = path.relative(workspaceRoot, fullPath) || '.';
    return {
      output: `Directory structure of ${relRoot}:\n${entries.length > 0 ? entries.join('\n') : '(empty directory)'}`,
      actionType: 'info',
    };
  } catch (err: any) {
    return {
      output: `Error listing directory ${dirPath}: ${err.message}`,
      isError: true,
      actionType: 'info',
    };
  }
}

export function grepSearch(
  workspaceRoot: string,
  query: string,
  searchPath: string = '.',
  isRegex: boolean = false,
  caseInsensitive: boolean = true
): FileToolResult {
  try {
    if (!query || !query.trim()) {
      return {
        output: 'Error: Search query cannot be empty.',
        isError: true,
        actionType: 'search',
      };
    }

    const fullSearchPath = resolveSafePath(workspaceRoot, searchPath);
    if (!fs.existsSync(fullSearchPath)) {
      return {
        output: `Search path does not exist: ${searchPath}`,
        isError: true,
        actionType: 'search',
      };
    }

    const results: string[] = [];
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.gemini', '.synai', 'screenshots', 'coverage', 'tmp']);
    const binaryExts = new Set(['.zip', '.tar', '.gz', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.exe', '.dll', '.bin', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.map', '.lock', '.webp']);

    const regexFlags = `${caseInsensitive ? 'i' : ''}g`;
    let regex: RegExp;
    try {
      regex = isRegex ? new RegExp(query, regexFlags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), regexFlags);
    } catch (e: any) {
      return {
        output: `Invalid regular expression: ${e.message}`,
        isError: true,
        actionType: 'search',
      };
    }

    const stat = fs.statSync(fullSearchPath);
    if (!stat.isDirectory()) {
      // Single file search
      try {
        const ext = path.extname(fullSearchPath).toLowerCase();
        if (binaryExts.has(ext)) {
          return { output: `Cannot search binary file: ${searchPath}`, actionType: 'search' };
        }
        const content = fs.readFileSync(fullSearchPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const rel = path.relative(workspaceRoot, fullSearchPath);
            results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            if (results.length >= 40) break;
          }
          regex.lastIndex = 0;
        }
      } catch (err: any) {
        return { output: `Error reading file ${searchPath}: ${err.message}`, isError: true, actionType: 'search' };
      }
    } else {
      let filesScanned = 0;
      const visited = new Set<string>();

      function scan(dir: string, depth: number = 0) {
        if (results.length >= 40 || filesScanned >= 1000 || depth > 8) return;
        let realDir = dir;
        try { realDir = fs.realpathSync(dir); } catch {}
        if (visited.has(realDir)) return;
        visited.add(realDir);

        let list: fs.Dirent[] = [];
        try {
          list = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const item of list) {
          if (results.length >= 40 || filesScanned >= 1000) break;
          if (ignoreDirs.has(item.name)) continue;
          const currentPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            scan(currentPath, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (binaryExts.has(ext)) continue;

            filesScanned++;
            try {
              const fileStat = fs.statSync(currentPath);
              if (fileStat.size > 512 * 1024) continue; // Skip files larger than 512 KB

              const content = fs.readFileSync(currentPath, 'utf8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const rel = path.relative(workspaceRoot, currentPath);
                  results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
                  if (results.length >= 40) break;
                }
                regex.lastIndex = 0;
              }
            } catch {
              // Ignore unreadable files
            }
          }
        }
      }

      scan(fullSearchPath);
    }

    return {
      output: results.length > 0
        ? `Found ${results.length} matches for "${query}":\n\n${results.join('\n')}`
        : `No matches found for "${query}" in ${searchPath}`,
      actionType: 'search',
    };
  } catch (err: any) {
    return {
      output: `Error searching query "${query}": ${err.message}`,
      isError: true,
      actionType: 'search',
    };
  }
}

/**
 * Converts a glob pattern (`*`, `**`, `?`, `[abc]`, `{a,b,c}`) into a RegExp
 * that matches against a forward-slash-normalized relative path.
 */
function globToRegExp(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // `**` matches across directory separators (including zero segments)
        let j = i + 2;
        if (pattern[j] === '/') j++;
        re += '.*';
        i = j - 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const close = pattern.indexOf('}', i);
      if (close === -1) {
        re += '\\{';
      } else {
        const options = pattern
          .slice(i + 1, close)
          .split(',')
          .map((opt) => opt.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*'));
        re += `(?:${options.join('|')})`;
        i = close;
      }
    } else if (c === '[') {
      const close = pattern.indexOf(']', i);
      if (close === -1) {
        re += '\\[';
      } else {
        re += pattern.slice(i, close + 1);
        i = close;
      }
    } else if ('.+^$()|\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

const GLOB_META = /[*?{}[\]]/;

export function findFiles(
  workspaceRoot: string,
  pattern: string,
  maxResults: number = 30
): FileToolResult {
  try {
    const results: string[] = [];
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.gemini']);

    const isGlob = GLOB_META.test(pattern);
    // A bare pattern without a "/" and without a leading "**/" is matched against the
    // basename anywhere in the tree (e.g. "*.test.ts"), mirroring common Glob-tool ergonomics.
    const normalizedPattern = isGlob && !pattern.includes('/') ? `**/${pattern}` : pattern;
    const globRegex = isGlob ? globToRegExp(normalizedPattern) : null;
    const substringPattern = pattern.replace(/^\*\*\//, '').replace(/^\*/, '').toLowerCase();

    function scan(dir: string) {
      if (results.length >= maxResults) return;
      let list: fs.Dirent[];
      try {
        list = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of list) {
        if (ignoreDirs.has(item.name)) continue;
        const currentPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          scan(currentPath);
        } else {
          const rel = path.relative(workspaceRoot, currentPath).split(path.sep).join('/');
          const matched = globRegex
            ? globRegex.test(rel)
            : rel.toLowerCase().includes(substringPattern) || item.name.toLowerCase().includes(substringPattern);
          if (matched) {
            results.push(rel);
            if (results.length >= maxResults) return;
          }
        }
      }
    }

    scan(workspaceRoot);

    return {
      output: results.length > 0
        ? `Found ${results.length} files matching "${pattern}":\n${results.map((r) => `📄 ${r}`).join('\n')}`
        : `No files found matching pattern "${pattern}"`,
      actionType: 'search',
    };
  } catch (err: any) {
    return {
      output: `Error finding files for pattern "${pattern}": ${err.message}`,
      isError: true,
      actionType: 'search',
    };
  }
}
