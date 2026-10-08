import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface PersonalizationProfile {
  name?: string;
  role?: string;
  language?: string;
  tone?: 'concise' | 'detailed' | 'friendly' | 'formal' | 'direct' | 'mentor' | string;
  techStack?: string[];
  codingStyle?: string;
  customInstructions?: string;
}

const DEFAULT_PROFILE: PersonalizationProfile = {
  language: 'English',
  tone: 'concise',
};

function getHomeDir(): string {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

function getGlobalPersonaPath(): string {
  const customDir = process.env.SYNAI_DIR;
  if (customDir && customDir.trim().length > 0) {
    return path.join(customDir.trim(), 'persona.json');
  }
  return path.join(getHomeDir(), '.synai', 'persona.json');
}

function getWorkspacePersonaPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.synai', 'persona.json');
}

/**
 * Load and merge user personalization profile (workspace overrides global)
 */
export function getPersonalizationProfile(workspaceRoot?: string): PersonalizationProfile {
  let profile: PersonalizationProfile = { ...DEFAULT_PROFILE };

  // 1. Global config
  const globalPath = getGlobalPersonaPath();
  try {
    if (fs.existsSync(globalPath)) {
      const content = fs.readFileSync(globalPath, 'utf8');
      const parsed = JSON.parse(content);
      profile = { ...profile, ...parsed };
    }
  } catch {
    // Ignore parse error and keep defaults
  }

  // 2. Workspace override
  if (workspaceRoot) {
    const wsPath = getWorkspacePersonaPath(workspaceRoot);
    try {
      if (fs.existsSync(wsPath)) {
        const content = fs.readFileSync(wsPath, 'utf8');
        const parsed = JSON.parse(content);
        profile = { ...profile, ...parsed };
      }
    } catch {
      // Ignore workspace read error
    }
  }

  return profile;
}

/**
 * Save personalization profile
 */
export function savePersonalizationProfile(
  updates: Partial<PersonalizationProfile>,
  workspaceRoot?: string
): PersonalizationProfile {
  const targetPath = workspaceRoot
    ? getWorkspacePersonaPath(workspaceRoot)
    : getGlobalPersonaPath();

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: PersonalizationProfile = {};
  try {
    if (fs.existsSync(targetPath)) {
      existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }
  } catch {
    existing = {};
  }

  const next: PersonalizationProfile = {
    ...existing,
    ...updates,
  };

  fs.writeFileSync(targetPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/**
 * Reset personalization profile to defaults
 */
export function resetPersonalizationProfile(workspaceRoot?: string): void {
  const targetPath = workspaceRoot
    ? getWorkspacePersonaPath(workspaceRoot)
    : getGlobalPersonaPath();

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

/**
 * Format personalization settings as markdown for system prompt injection
 */
export function formatPersonalizationPrompt(profile: PersonalizationProfile): string {
  const parts: string[] = [];

  if (profile.name) {
    parts.push(`- User's Preferred Name: ${profile.name}`);
  }
  if (profile.role) {
    parts.push(`- User's Role / Background: ${profile.role}`);
  }
  if (profile.language) {
    parts.push(`- Preferred Response Language: ${profile.language}`);
  }
  if (profile.tone) {
    parts.push(`- Preferred Communication Tone: ${profile.tone}`);
  }
  if (profile.techStack && profile.techStack.length > 0) {
    parts.push(`- Preferred Tech Stack: ${profile.techStack.join(', ')}`);
  }
  if (profile.codingStyle) {
    parts.push(`- Coding Style Preferences: ${profile.codingStyle}`);
  }
  if (profile.customInstructions && profile.customInstructions.trim().length > 0) {
    parts.push(`- Specific User Directives:\n  ${profile.customInstructions.trim()}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `# User Personalization & Preferences\n${parts.join('\n')}\n`;
}
