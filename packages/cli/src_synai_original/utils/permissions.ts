import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface PermissionRule {
  type: 'allow' | 'deny';
  tool: string;  // e.g., 'Bash', 'Edit', 'Read'
  pattern?: string;  // e.g., 'npm test', 'src/**'
}

export interface PermissionSettings {
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
}

export function loadPermissions(workspaceRoot: string): PermissionSettings {
  const settings: PermissionSettings = { allowRules: [], denyRules: [] };
  const globalPath = path.join(workspaceRoot, '.synai', 'settings.json');
  const localPath = path.join(workspaceRoot, '.synai', 'settings.local.json');

  for (const filePath of [globalPath, localPath]) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.allowRules && Array.isArray(parsed.allowRules)) {
          settings.allowRules.push(...parsed.allowRules);
        }
        if (parsed.denyRules && Array.isArray(parsed.denyRules)) {
          settings.denyRules.push(...parsed.denyRules);
        }
      } catch (e) {
        // ignore errors
      }
    }
  }
  return settings;
}

export function savePermissionRule(workspaceRoot: string, rule: PermissionRule): void {
  const synaiDir = path.join(workspaceRoot, '.synai');
  if (!fs.existsSync(synaiDir)) {
    fs.mkdirSync(synaiDir, { recursive: true });
  }
  const localPath = path.join(synaiDir, 'settings.local.json');
  let currentSettings: any = { allowRules: [], denyRules: [] };
  if (fs.existsSync(localPath)) {
    try {
      currentSettings = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      if (!currentSettings.allowRules) currentSettings.allowRules = [];
      if (!currentSettings.denyRules) currentSettings.denyRules = [];
    } catch (e) {}
  }

  if (rule.type === 'allow') {
    currentSettings.allowRules.push(rule);
  } else {
    currentSettings.denyRules.push(rule);
  }

  fs.writeFileSync(localPath, JSON.stringify(currentSettings, null, 2), 'utf-8');
}

export function checkPermission(settings: PermissionSettings, toolName: string, args: Record<string, any>): 'allow' | 'deny' | 'ask' {
  // Check deny rules first
  for (const rule of settings.denyRules) {
    if (rule.tool === toolName) {
      if (!rule.pattern) return 'deny';
      if (args.command && typeof args.command === 'string' && args.command.includes(rule.pattern)) return 'deny';
      if (args.path && typeof args.path === 'string' && args.path.includes(rule.pattern)) return 'deny';
    }
  }

  // Check allow rules
  for (const rule of settings.allowRules) {
    if (rule.tool === toolName) {
      if (!rule.pattern) return 'allow';
      if (args.command && typeof args.command === 'string' && args.command.includes(rule.pattern)) return 'allow';
      if (args.path && typeof args.path === 'string' && args.path.includes(rule.pattern)) return 'allow';
    }
  }

  return 'ask';
}

export function formatPermissionRule(rule: PermissionRule): string {
  if (rule.pattern) {
    return `${rule.tool}(${rule.pattern})`;
  }
  return rule.tool;
}

export function parsePermissionPattern(pattern: string): PermissionRule {
  const match = pattern.match(/^([A-Za-z]+)\((.*)\)$/);
  if (match) {
    return { type: 'allow', tool: match[1], pattern: match[2] };
  }
  return { type: 'allow', tool: pattern };
}

export function listPermissions(workspaceRoot: string): void {
  const settings = loadPermissions(workspaceRoot);
  console.log('Allow Rules:');
  for (const rule of settings.allowRules) {
    console.log(`  - ${formatPermissionRule(rule)}`);
  }
  console.log('Deny Rules:');
  for (const rule of settings.denyRules) {
    console.log(`  - ${formatPermissionRule(rule)}`);
  }
}
