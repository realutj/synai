import fs from 'node:fs';
import path from 'node:path';
import { getAppDataDir } from '../storage/index.js';

export interface WorkspaceRules {
  sources: { file: string; content: string }[];
  aggregated: string;
}

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

export interface MemoryEntry {
  name: string;
  type: MemoryType;
  description: string;
  content: string;
  why?: string;
  howToApply?: string;
  filePath: string;
  updatedAt: number;
}

export class MemoryEngine {
  private workspaceRoot: string;
  private memoryDir: string;
  private memoryIndexFile: string;
  private cachedRules: WorkspaceRules | null = null;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    const workspaceSlug = path.basename(this.workspaceRoot).replace(/[^a-zA-Z0-9_-]/g, '_');
    this.memoryDir = path.join(getAppDataDir(), 'memory', workspaceSlug);
    this.memoryIndexFile = path.join(this.memoryDir, 'MEMORY.md');

    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  public discoverRules(): WorkspaceRules {
    const candidateRuleFiles = [
      'SYNAI.md',
      '.synairules',
      'AGENTS.md',
    ];

    const sources: { file: string; content: string }[] = [];

    for (const ruleFile of candidateRuleFiles) {
      const fullPath = path.join(this.workspaceRoot, ruleFile);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8').trim();
          if (content) {
            sources.push({ file: ruleFile, content });
          }
        } catch {
          // Ignore unreadable rule file
        }
      }
    }

    const aggregated = sources
      .map((s) => `### Rules from ${s.file}:\n${s.content}`)
      .join('\n\n');

    this.cachedRules = { sources, aggregated };
    return this.cachedRules;
  }

  public saveMemory(
    type: MemoryType,
    name: string,
    description: string,
    content: string,
    why?: string,
    howToApply?: string
  ): MemoryEntry {
    const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const fileName = `${type}_${slug}.md`;
    const filePath = path.join(this.memoryDir, fileName);

    let body = content.trim();
    if (why) {
      body += `\n\n**Why:** ${why.trim()}`;
    }
    if (howToApply) {
      body += `\n\n**How to apply:** ${howToApply.trim()}`;
    }

    const fileContent = `---
name: ${slug}
description: ${description.trim()}
metadata:
  type: ${type}
---

${body}
`;

    fs.writeFileSync(filePath, fileContent, 'utf8');
    this.updateIndexFile();

    return {
      name: slug,
      type,
      description,
      content: body,
      why,
      howToApply,
      filePath,
      updatedAt: Date.now(),
    };
  }

  public listMemories(): MemoryEntry[] {
    if (!fs.existsSync(this.memoryDir)) return [];

    try {
      const files = fs.readdirSync(this.memoryDir);
      const entries: MemoryEntry[] = [];

      for (const f of files) {
        if (f === 'MEMORY.md' || !f.endsWith('.md')) continue;
        try {
          const fullPath = path.join(this.memoryDir, f);
          const raw = fs.readFileSync(fullPath, 'utf8');

          const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
          if (match) {
            const front = match[1];
            const body = match[2].trim();

            const nameMatch = front.match(/name:\s*(.+)/);
            const descMatch = front.match(/description:\s*(.+)/);
            const typeMatch = front.match(/type:\s*(.+)/);

            const name = nameMatch ? nameMatch[1].trim() : path.basename(f, '.md');
            const description = descMatch ? descMatch[1].trim() : '';
            const type = (typeMatch ? typeMatch[1].trim() : 'project') as MemoryType;

            entries.push({
              name,
              type,
              description,
              content: body,
              filePath: fullPath,
              updatedAt: fs.statSync(fullPath).mtimeMs,
            });
          }
        } catch {}
      }

      return entries;
    } catch {
      return [];
    }
  }

  public updateIndexFile(): void {
    const entries = this.listMemories();
    const lines = ['# Workspace Memory Index', ''];

    for (const e of entries) {
      const rel = path.basename(e.filePath);
      lines.push(`- [${e.name}](${rel}) — ${e.description} (${e.type})`);
    }

    fs.writeFileSync(this.memoryIndexFile, lines.join('\n'), 'utf8');
  }

  public getMemoryContext(): string {
    if (!fs.existsSync(this.memoryIndexFile)) {
      this.updateIndexFile();
    }

    try {
      const indexContent = fs.readFileSync(this.memoryIndexFile, 'utf8').trim();
      const memories = this.listMemories();

      if (memories.length === 0) return '';

      let context = `## Auto Memory System (${memories.length} entries)\n${indexContent}\n`;
      return context;
    } catch {
      return '';
    }
  }

  public getContextPrompt(): string {
    const rules = this.discoverRules();
    const memory = this.getMemoryContext();

    const sections: string[] = [];

    if (rules.aggregated) {
      sections.push(`## Workspace & Project Rules:\n${rules.aggregated}`);
    }

    if (memory) {
      sections.push(memory);
    }

    return sections.join('\n\n');
  }
}
