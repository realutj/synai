import fs from 'node:fs';

export function readFileSyncStrippingUtf8Bom(filePath: string): string {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}
