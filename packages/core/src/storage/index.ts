import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Message, TaskItem } from '../types/index.js';

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  messageCount: number;
  messages: Message[];
  plan?: TaskItem[];
}

export function getAppDataDir(): string {
  const platform = process.platform;
  let baseDir: string;

  if (platform === 'win32') {
    baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    baseDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  const synaiDir = path.join(baseDir, 'synai');
  if (!fs.existsSync(synaiDir)) {
    fs.mkdirSync(synaiDir, { recursive: true });
  }

  return synaiDir;
}

export function generateIntelligentTitle(userPrompt: string): string {
  if (!userPrompt || !userPrompt.trim()) return 'New Coding Session';

  const lower = userPrompt.toLowerCase();

  // 1. Simple greetings & conversational openers
  if (/^(hi|hello|hey|good morning|good afternoon|howdy|how are you|whats up)/i.test(lower)) {
    return 'General Introduction & Greeting';
  }

  // 2. Legal / Contract topics
  if (/(contract|nda|legal|lawyer|attorney|compliance|lawsuit|governance)/i.test(lower)) {
    if (/(terminate|breach)/i.test(lower)) return 'Contract Termination Analysis';
    if (/(nda|confidential)/i.test(lower)) return 'NDA & Confidentiality Review';
    if (/(petition|notice)/i.test(lower)) return 'Formal Legal Drafting';
    if (/(crime|fraud)/i.test(lower)) return 'Penal Law & Compliance';
    if (/(merger|incorporation|governance)/i.test(lower)) return 'Corporate Governance';
    return 'Legal Advisory & Contract Review';
  }

  // 3. Technical & Engineering topics
  if (/(fastapi|express|nest|django|flask|spring|actix)/i.test(lower)) {
    const fw = lower.match(/(fastapi|express|nest|django|flask|spring|actix)/i)?.[0] || 'Backend';
    return `${fw.toUpperCase()} API Development`;
  }
  if (/(docker|container|kubernetes|k8s|devops|ci\/cd|pipeline)/i.test(lower)) {
    return 'DevOps & Container Architecture';
  }
  if (/(postgres|mysql|sqlite|mongo|prisma|typeorm|database|sql)/i.test(lower)) {
    return 'Database Design & Queries';
  }
  if (/(auth|jwt|oauth|login|signup|password|security)/i.test(lower)) {
    return 'Authentication & Security';
  }
  if (/(react|vue|svelte|next|tailwind|css|frontend|ui)/i.test(lower)) {
    return 'Frontend & UI Architecture';
  }
  if (/(test|jest|vitest|playwright|cypress|mock)/i.test(lower)) {
    return 'Automated Test Suite';
  }
  if (/(bug|error|crash|fix|resolve|exception)/i.test(lower)) {
    return 'Bug Investigation & Resolution';
  }
  if (/(refactor|clean code|architecture|rewrite)/i.test(lower)) {
    return 'Codebase Refactoring & Architecture';
  }

  // 4. Conversation & Strategy
  if (/(philosophy|life|book|chat|idea)/i.test(lower)) {
    return 'Deep Conversation & Ideation';
  }
  if (/(startup|business|invest|pitch|saas|pricing)/i.test(lower)) {
    return 'Startup Strategy & Business Plan';
  }

  // 5. Fallback clean word extraction
  const cleaned = userPrompt
    .replace(/^(\s*(\/|\#|\!|\?|\>)\s*)+/, '')
    .replace(/^(can you|please|could you|help me|i want to|create a|make a|build a|write a|fix|add)\s+/i, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
  if (!words || words.length < 3) return 'Coding Session';

  return words.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export class StorageManager {
  private appDataDir: string;
  private conversationsDir: string;

  constructor() {
    this.appDataDir = getAppDataDir();
    this.conversationsDir = path.join(this.appDataDir, 'conversations');
    if (!fs.existsSync(this.conversationsDir)) {
      fs.mkdirSync(this.conversationsDir, { recursive: true });
    }
  }

  public getAppDataPath(...subpaths: string[]): string {
    return path.join(this.appDataDir, ...subpaths);
  }

  public saveConversation(
    id: string,
    title: string | undefined,
    workspace: string,
    messages: Message[],
    plan?: TaskItem[]
  ): StoredConversation {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    const now = Date.now();

    let createdAt = now;
    let finalTitle = title;

    if (fs.existsSync(filePath)) {
      try {
        const existing: StoredConversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        createdAt = existing.createdAt || now;
        if (!finalTitle && existing.title) {
          finalTitle = existing.title;
        }
      } catch {}
    }

    if (!finalTitle || finalTitle === 'Session' || finalTitle === 'Untitled Session') {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      finalTitle = firstUserMsg ? generateIntelligentTitle(firstUserMsg.content) : 'Coding Session';
    }

    const conversation: StoredConversation = {
      id,
      title: finalTitle,
      createdAt,
      updatedAt: now,
      workspace,
      messageCount: messages.length,
      messages,
      plan,
    };

    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf8');
    return conversation;
  }

  public getConversation(id: string): StoredConversation | null {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  public listConversations(): {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    workspace: string;
    messageCount: number;
  }[] {
    if (!fs.existsSync(this.conversationsDir)) return [];

    try {
      const files = fs.readdirSync(this.conversationsDir);
      const list: {
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
        workspace: string;
        messageCount: number;
      }[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = fs.readFileSync(path.join(this.conversationsDir, file), 'utf8');
          const parsed: StoredConversation = JSON.parse(content);
          list.push({
            id: parsed.id,
            title: parsed.title || 'Untitled Session',
            createdAt: parsed.createdAt || 0,
            updatedAt: parsed.updatedAt || 0,
            workspace: parsed.workspace || '',
            messageCount: parsed.messageCount || parsed.messages?.length || 0,
          });
        } catch {}
      }

      list.sort((a, b) => b.updatedAt - a.updatedAt);
      return list;
    } catch {
      return [];
    }
  }

  public renameConversation(id: string, newTitle: string): boolean {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;

    try {
      const conv: StoredConversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      conv.title = newTitle;
      conv.updatedAt = Date.now();
      fs.writeFileSync(filePath, JSON.stringify(conv, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  public deleteConversation(id: string): boolean {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
