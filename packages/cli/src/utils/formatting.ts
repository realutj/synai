/**
 * Formatting utilities for SynAI CLI output
 */

import chalk from 'chalk';

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  
  return `${size} ${units[i]}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Wrap text to specified width
 */
export function wordWrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length > width) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Create a visual separator line
 */
export function separator(char: string = '-', width: number = 45): string {
  return chalk.dim(char.repeat(width));
}

/**
 * Format success message
 */
export function success(message: string): string {
  return chalk.white('[OK] ') + chalk.white(message);
}

/**
 * Format error message
 */
export function error(message: string): string {
  return chalk.white('[X] ') + chalk.white(message);
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return chalk.gray('[!] ') + chalk.gray(message);
}

/**
 * Format info message
 */
export function info(message: string): string {
  return chalk.white('[i] ') + chalk.white(message);
}

/**
 * Format code block
 */
export function codeBlock(code: string, _language?: string): string {
  const lines = code.split('\n');
  const formatted = lines.map((line, i) => {
    const lineNum = chalk.dim(`${(i + 1).toString().padStart(3)} | `);
    return lineNum + chalk.white(line);
  });
  
  return formatted.join('\n');
}

/**
 * Create a badge
 */
export function badge(text: string, color: 'green' | 'yellow' | 'red' | 'cyan' = 'cyan'): string {
  const colors = {
    green: chalk.white,
    yellow: chalk.gray,
    red: chalk.white,
    cyan: chalk.white,
  };
  
  return colors[color](`[${text}]`);
}

/**
 * Format list item
 */
export function listItem(text: string, icon: string = '*'): string {
  return chalk.dim(icon) + ' ' + chalk.white(text);
}

/**
 * Create a table row
 */
export function tableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => {
    const width = widths[i] || 20;
    return col.padEnd(width).slice(0, width);
  }).join(' | ');
}

/**
 * Highlight syntax in code
 */
export function highlightSyntax(code: string): string {
  // Simple syntax highlighting
  return code
    .replace(/\b(const|let|var|function|class|import|export|return|if|else|for|while)\b/g, 
      match => chalk.white(match))
    .replace(/\b(true|false|null|undefined)\b/g, 
      match => chalk.gray(match))
    .replace(/'([^']*)'/g, 
      match => chalk.white(match))
    .replace(/"([^"]*)"/g, 
      match => chalk.white(match))
    .replace(/\/\/.*/g, 
      match => chalk.dim(match))
    .replace(/\b\d+\b/g, 
      match => chalk.white(match));
}
