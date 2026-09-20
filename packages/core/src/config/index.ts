import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';
import { AgentConfig, ApprovalMode, ThinkingLevel } from '../types/index.js';
import { getAppDataDir } from '../storage/index.js';
import { normalizeThinkingLevel } from '../thinking/index.js';
import { getProvider, listProviders, maskApiKey, type ProviderInfo } from '../providers/index.js';

dotenv.config();

export const DEFAULT_FREE_MODEL = 'cohere/north-mini-code:free';
export const DEFAULT_APPROVAL_MODE: ApprovalMode = 'confirm';
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'low';
export const DEFAULT_PORT = 4242;
export const DEFAULT_THEME = 'dark';

/**
 * Snapshot of one provider's key state. Shared between core and the CLI/web so the
 * "is this configured?" rules live in exactly one place.
 */
export interface ProviderKeyStatus {
  provider: ProviderInfo;
  configured: boolean;
  source: 'stored' | 'env' | 'none';
  masked: string;
}

export interface SynAIStoredConfig {
  apiKey?: string;
  /**
   * Per-provider API keys, keyed by `ProviderInfo.id` (e.g. `{ openai: 'sk-…' }`).
   * Kept separate from the legacy `apiKey` field so existing OpenRouter setups keep
   * working untouched while every other provider gets its own slot.
   */
  providerKeys?: Record<string, string>;
  defaultModel?: string;
  defaultMode?: ApprovalMode;
  defaultThinkingLevel?: ThinkingLevel;
  thinkingLevel?: ThinkingLevel;
  systemPrompt?: string;
  port?: number;
  trustedWorkspaces?: string[];
  theme?: string;
  hasConfigured?: boolean;
}

export class ConfigManager {
  private workspaceRoot: string;
  private appDataConfigPath: string;
  private legacyGlobalConfigPath: string;
  private localConfigPath: string;
  private currentConfig: AgentConfig;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    const appData = getAppDataDir();
    this.appDataConfigPath = path.join(appData, 'config.json');
    this.legacyGlobalConfigPath = path.join(os.homedir(), '.synairc');
    this.localConfigPath = path.join(this.workspaceRoot, '.synai.json');

    this.currentConfig = this.loadConfig(this.workspaceRoot);
  }

  public getConfig(): AgentConfig {
    return { ...this.currentConfig };
  }

  public updateConfig(partial: Partial<AgentConfig>): AgentConfig {
    this.currentConfig = {
      ...this.currentConfig,
      ...partial,
    };
    return this.currentConfig;
  }

  private ensureGitignored(entry: string): void {
    try {
      const gitDir = path.join(this.workspaceRoot, '.git');
      if (!fs.existsSync(gitDir)) return; // Only bother inside an actual git repo

      const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
      const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
      const alreadyIgnored = existing
        .split('\n')
        .some((line) => {
          const t = line.trim();
          return t === entry || t === `/${entry}` || t === `${entry}*`;
        });

      if (!alreadyIgnored) {
        const separator = existing && !existing.endsWith('\n') ? '\n' : '';
        fs.writeFileSync(
          gitignorePath,
          `${existing}${separator}\n# Added by SynAI: keep local secrets (OPENROUTER_API_KEY) out of version control\n${entry}\n`,
          'utf8'
        );
      }
    } catch {
      // Best-effort only — never block config saving on this
    }
  }

  private ensureEnvGitignored(): void {
    this.ensureGitignored('.env');
  }

  private writeSecretFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf8');
    try {
      // Restrict to owner read/write only — this file may contain an API key
      fs.chmodSync(filePath, 0o600);
    } catch {
      // Not fatal (e.g. unsupported on some filesystems) — the file is still written
    }
  }

  public syncToEnvFile(apiKey?: string, model?: string, mode?: string): void {
    try {
      const envPath = path.join(this.workspaceRoot, '.env');
      let content = '';
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
      }

      if (apiKey !== undefined) {
        process.env.OPENROUTER_API_KEY = apiKey;
        if (/^OPENROUTER_API_KEY=/m.test(content)) {
          content = content.replace(/^OPENROUTER_API_KEY=.*$/m, `OPENROUTER_API_KEY=${apiKey}`);
        } else {
          content = content ? `${content.trim()}\nOPENROUTER_API_KEY=${apiKey}\n` : `OPENROUTER_API_KEY=${apiKey}\n`;
        }
      }

      if (model !== undefined) {
        process.env.OPENROUTER_DEFAULT_MODEL = model;
        if (/^OPENROUTER_DEFAULT_MODEL=/m.test(content)) {
          content = content.replace(/^OPENROUTER_DEFAULT_MODEL=.*$/m, `OPENROUTER_DEFAULT_MODEL=${model}`);
        } else {
          content = content ? `${content.trim()}\nOPENROUTER_DEFAULT_MODEL=${model}\n` : `OPENROUTER_DEFAULT_MODEL=${model}\n`;
        }
      }

      if (mode !== undefined) {
        process.env.SYNAI_APPROVAL_MODE = mode;
        if (/^SYNAI_APPROVAL_MODE=/m.test(content)) {
          content = content.replace(/^SYNAI_APPROVAL_MODE=.*$/m, `SYNAI_APPROVAL_MODE=${mode}`);
        } else {
          content = content ? `${content.trim()}\nSYNAI_APPROVAL_MODE=${mode}\n` : `SYNAI_APPROVAL_MODE=${mode}\n`;
        }
      }

      this.writeSecretFile(envPath, content);
      if (apiKey !== undefined) {
        this.ensureEnvGitignored();
      }
    } catch (err) {
      console.error('Failed to sync config to .env:', err);
    }
  }

  public saveGlobalConfig(data: SynAIStoredConfig): void {
    try {
      const existing = this.loadJsonFile(this.appDataConfigPath);
      const merged = { ...existing, ...data };
      this.writeSecretFile(this.appDataConfigPath, JSON.stringify(merged, null, 2));

      // Also sync to legacy path for compatibility
      try {
        this.writeSecretFile(this.legacyGlobalConfigPath, JSON.stringify(merged, null, 2));
      } catch {}

      if (data.apiKey !== undefined) {
        this.currentConfig.apiKey = data.apiKey;
        process.env.OPENROUTER_API_KEY = data.apiKey;
      }
      if (data.defaultModel) {
        this.currentConfig.model = data.defaultModel;
        process.env.OPENROUTER_DEFAULT_MODEL = data.defaultModel;
      }
      if (data.defaultMode) {
        this.currentConfig.mode = data.defaultMode;
        process.env.SYNAI_APPROVAL_MODE = data.defaultMode;
      }
      if (data.port) this.currentConfig.port = data.port;
      if (data.theme) {
        this.currentConfig.theme = data.theme;
        process.env.SYNAI_THEME = data.theme;
      }

      // Sync to workspace .env file so CLI sessions pick it up instantly
      this.syncToEnvFile(data.apiKey, data.defaultModel, data.defaultMode);
    } catch (err) {
      console.error('Failed to save global config to AppData:', err);
    }
  }

  public saveLocalConfig(data: SynAIStoredConfig): void {
    try {
      const existing = this.loadJsonFile(this.localConfigPath);
      const merged = { ...existing, ...data };
      this.writeSecretFile(this.localConfigPath, JSON.stringify(merged, null, 2));

      if (data.apiKey !== undefined) {
        this.currentConfig.apiKey = data.apiKey;
        process.env.OPENROUTER_API_KEY = data.apiKey;
      }
      if (data.defaultModel) {
        this.currentConfig.model = data.defaultModel;
        process.env.OPENROUTER_DEFAULT_MODEL = data.defaultModel;
      }
      if (data.defaultMode) {
        this.currentConfig.mode = data.defaultMode;
        process.env.SYNAI_APPROVAL_MODE = data.defaultMode;
      }
      if (data.port) this.currentConfig.port = data.port;
      if (data.theme) {
        this.currentConfig.theme = data.theme;
        process.env.SYNAI_THEME = data.theme;
      }

      // Sync to workspace .env file
      this.syncToEnvFile(data.apiKey, data.defaultModel, data.defaultMode);
      if (data.apiKey !== undefined) {
        this.ensureGitignored('.synai.json');
      }
    } catch (err) {
      console.error('Failed to save local config:', err);
    }
  }

  // ── Multi-provider API keys ────────────────────────────────────────────────
  //
  // Storage model: provider keys live in the global (AppData) config under
  // `providerKeys`, mirroring how the single legacy OpenRouter key behaves and
  // keeping secrets out of the workspace by default. Precedence is deliberately
  // "stored wins over ambient env", so a key the user explicitly saved via `/keys`
  // is never silently shadowed by a stale shell variable.

  private providerKeys(): Record<string, string> {
    const stored = this.loadJsonFile(this.appDataConfigPath).providerKeys;
    return stored && typeof stored === 'object' ? { ...stored } : {};
  }

  /**
   * Resolve the effective key for a provider: stored value first, then the process
   * env, then any documented alternate env var. Returns undefined when unset.
   */
  public getProviderKey(providerId: string): string | undefined {
    const provider = getProvider(providerId);
    if (!provider) return undefined;

    const stored = (this.providerKeys()[provider.id] || '').trim();
    if (stored) return stored;

    const fromEnv = (process.env[provider.envVar] || '').trim();
    if (fromEnv) return fromEnv;

    for (const alt of provider.altEnvVars || []) {
      const value = (process.env[alt] || '').trim();
      if (value) return value;
    }

    // Legacy compatibility: an OpenRouter key saved before multi-provider support
    // lives in the top-level `apiKey` field, so keep honouring it.
    if (provider.id === 'openrouter') {
      const legacy = (this.loadJsonFile(this.appDataConfigPath).apiKey || '').trim();
      if (legacy) return legacy;
    }

    return undefined;
  }

  /** True when a usable key exists for the provider, from any source. */
  public hasProviderKey(providerId: string): boolean {
    return !!this.getProviderKey(providerId);
  }

  /**
   * Persist a provider key. The secret is stored (never logged), exported to the
   * current process so the running session picks it up immediately, and mirrored
   * into the workspace `.env` (gitignored) for future shells.
   */
  public setProviderKey(
    providerId: string,
    key: string
  ): { ok: boolean; message: string; provider?: ProviderInfo } {
    const provider = getProvider(providerId);
    if (!provider) {
      return { ok: false, message: `Unknown provider "${providerId}". Run /keys list for valid ids.` };
    }

    const trimmed = (key || '').trim();
    if (!trimmed) {
      return { ok: false, message: 'Empty key — nothing was saved.', provider };
    }

    const existing = this.providerKeys();
    existing[provider.id] = trimmed;
    this.saveGlobalConfig({ providerKeys: existing });

    process.env[provider.envVar] = trimmed;
    if (provider.id === 'openrouter') {
      // Keep the legacy field in sync so existing code paths keep working.
      this.saveGlobalConfig({ apiKey: trimmed });
    }

    this.syncProviderKeyToEnvFile(provider, trimmed);
    return { ok: true, message: `Saved ${provider.name} key (${maskApiKey(trimmed)}).`, provider };
  }

  /** Remove a stored provider key. Ambient env vars are intentionally left alone. */
  public removeProviderKey(
    providerId: string
  ): { ok: boolean; message: string; provider?: ProviderInfo } {
    const provider = getProvider(providerId);
    if (!provider) {
      return { ok: false, message: `Unknown provider "${providerId}".` };
    }

    const existing = this.providerKeys();
    const storedKey = existing[provider.id];
    if (storedKey === undefined) {
      return { ok: false, message: `No stored key for ${provider.name}.`, provider };
    }

    delete existing[provider.id];
    this.saveGlobalConfig({ providerKeys: existing });

    // If the process env currently holds the exact key we just removed, it was put
    // there by setProviderKey — clear it so the removal takes effect immediately.
    // An env var exported by the user's shell holds a different value and is left
    // strictly alone.
    if (process.env[provider.envVar] === storedKey) {
      delete process.env[provider.envVar];
    }

    return { ok: true, message: `Removed stored ${provider.name} key.`, provider };
  }

  /**
   * Status of every registered provider, for the `/keys` table. Providers whose key
   * came from the environment are included too, so users can see *why* something
   * already works instead of re-entering a key they don't need to.
   */
  public listProviderKeyStatus(): ProviderKeyStatus[] {
    const stored = this.providerKeys();
    return listProviders().map((provider) => {
      const storedKey = (stored[provider.id] || '').trim();
      if (storedKey) {
        return {
          provider,
          configured: true,
          source: 'stored' as const,
          masked: maskApiKey(storedKey),
        };
      }

      const envKey = (
        process.env[provider.envVar] ||
        (provider.altEnvVars || []).map((name) => process.env[name]).find(Boolean) ||
        ''
      ).trim();
      if (envKey) {
        return { provider, configured: true, source: 'env' as const, masked: maskApiKey(envKey) };
      }

      // The pre-multi-provider OpenRouter key lives in the legacy `apiKey` field.
      if (provider.id === 'openrouter') {
        const legacy = (this.loadJsonFile(this.appDataConfigPath).apiKey || '').trim();
        if (legacy) {
          return {
            provider,
            configured: true,
            source: 'stored' as const,
            masked: maskApiKey(legacy),
          };
        }
      }

      return { provider, configured: false, source: 'none' as const, masked: '—' };
    });
  }

  /** Ids of providers that currently have a usable key (stored or from env). */
  public getConfiguredProviderIds(): string[] {
    return this.listProviderKeyStatus()
      .filter((status) => status.configured)
      .map((status) => status.provider.id);
  }

  /**
   * Write/update a single `<ENV_VAR>=<key>` line in the workspace `.env` and make
   * sure that file stays out of git. Deliberately separate from `syncToEnvFile`
   * (which is OpenRouter-shaped) so other providers need no special-casing there.
   */
  public syncProviderKeyToEnvFile(provider: ProviderInfo, key: string): void {
    try {
      const envPath = path.join(this.workspaceRoot, '.env');
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const line = `${provider.envVar}=${key}`;
      const pattern = new RegExp(`^${provider.envVar}=.*$`, 'm');

      if (pattern.test(content)) {
        content = content.replace(pattern, line);
      } else {
        content = content ? `${content.replace(/\s+$/, '')}\n${line}\n` : `${line}\n`;
      }

      this.writeSecretFile(envPath, content);
      this.ensureEnvGitignored();
    } catch {
      // Best-effort only: the key is already persisted in the global config.
    }
  }

  private loadConfig(workspaceRoot: string): AgentConfig {
    const appDataConfig = this.loadJsonFile(this.appDataConfigPath);
    const legacyGlobalConfig = this.loadJsonFile(this.legacyGlobalConfigPath);
    const localConfig = this.loadJsonFile(this.localConfigPath);

    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      localConfig.apiKey ||
      appDataConfig.apiKey ||
      legacyGlobalConfig.apiKey ||
      '';

    const model =
      process.env.OPENROUTER_DEFAULT_MODEL ||
      localConfig.defaultModel ||
      appDataConfig.defaultModel ||
      legacyGlobalConfig.defaultModel ||
      DEFAULT_FREE_MODEL;

    const mode = (
      process.env.SYNAI_APPROVAL_MODE ||
      localConfig.defaultMode ||
      appDataConfig.defaultMode ||
      legacyGlobalConfig.defaultMode ||
      DEFAULT_APPROVAL_MODE
    ) as ApprovalMode;

    const port = Number(
      process.env.SYNAI_PORT ||
      localConfig.port ||
      appDataConfig.port ||
      legacyGlobalConfig.port ||
      DEFAULT_PORT
    );

    const theme =
      process.env.SYNAI_THEME ||
      localConfig.theme ||
      appDataConfig.theme ||
      legacyGlobalConfig.theme ||
      DEFAULT_THEME;

    const rawThinkingLevel = (
      process.env.SYNAI_THINKING_LEVEL ||
      process.env.SYNAI_EFFORT ||
      localConfig.defaultThinkingLevel ||
      localConfig.thinkingLevel ||
      appDataConfig.defaultThinkingLevel ||
      appDataConfig.thinkingLevel ||
      legacyGlobalConfig.defaultThinkingLevel ||
      legacyGlobalConfig.thinkingLevel ||
      DEFAULT_THINKING_LEVEL
    ) as ThinkingLevel;
    const thinkingLevel = normalizeThinkingLevel(rawThinkingLevel);

    return {
      apiKey,
      model,
      mode,
      workspaceRoot: path.resolve(workspaceRoot),
      port,
      temperature: 0.3, // Increased for more creative problem-solving
      maxTokens: 16384, // Doubled for deeper reasoning chains
      theme,
      thinkingLevel,
    };
  }

  public isFirstRun(): boolean {
    const appDataConfig = this.loadJsonFile(this.appDataConfigPath);
    const legacyGlobalConfig = this.loadJsonFile(this.legacyGlobalConfigPath);
    const localConfig = this.loadJsonFile(this.localConfigPath);

    if (appDataConfig.hasConfigured || legacyGlobalConfig.hasConfigured || localConfig.hasConfigured) {
      return false;
    }

    // If any config file exists and has non-empty apiKey or theme or defaultModel, consider not first run
    if (appDataConfig.apiKey || appDataConfig.theme || appDataConfig.defaultModel) return false;
    if (legacyGlobalConfig.apiKey || legacyGlobalConfig.theme) return false;
    if (localConfig.apiKey || localConfig.theme) return false;

    return true;
  }

  public markConfigured(): void {
    this.saveGlobalConfig({ hasConfigured: true });
  }

  private loadJsonFile(filePath: string): SynAIStoredConfig {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  public isWorkspaceTrusted(workspacePath: string = this.workspaceRoot): boolean {
    try {
      const stored = this.loadJsonFile(this.appDataConfigPath);
      const list: string[] = stored.trustedWorkspaces || [];
      const normalized = path.resolve(workspacePath).toLowerCase();
      return list.some((p) => path.resolve(p).toLowerCase() === normalized);
    } catch {
      return false;
    }
  }

  public trustWorkspace(workspacePath: string = this.workspaceRoot): void {
    try {
      const stored = this.loadJsonFile(this.appDataConfigPath);
      const list: string[] = stored.trustedWorkspaces || [];
      const normalized = path.resolve(workspacePath);
      if (!list.some((p) => path.resolve(p).toLowerCase() === normalized.toLowerCase())) {
        list.push(normalized);
      }
      this.saveGlobalConfig({ trustedWorkspaces: list });
    } catch {}
  }
}
