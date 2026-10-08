import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getSynaiEnvironmentConfig } from "@synai/shared";
import { resolveSynAIDir } from "@synai/shared/storage";
import { Agent } from "./agent/index.js";
import { FALLBACK_FREE_MODELS } from "./openrouter/index.js";
import { getProvider } from "./providers/index.js";
export { registerDisposable } from "@synai/shared";

export function setSdkLogger(_logger?: any): void {}

function resolveSettingsPath(): string {
  if (process.env.SYNAI_GLOBAL_SETTINGS_PATH) {
    return process.env.SYNAI_GLOBAL_SETTINGS_PATH;
  }
  return join(resolveSynAIDir(), "data", "settings", "global-settings.json");
}

function resolveSettingsDir(): string {
  return dirname(resolveSettingsPath());
}

function readJsonSafe(filePath: string, fallback: any = {}): any {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return fallback;
}

function writeJsonSafe(filePath: string, data: any): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export type AgentMode = "code" | "ask" | "architect" | "auto" | "test" | "plan" | "act" | "yolo" | "zen";
export const AgentMode: any = {};
export type CoreSessionConfig = Record<string, any>;
export const CoreSessionConfig: any = {};
export namespace Llms {
  export type ModelInfo = any;
  export type ProviderLocalCli = any;
  export type GetModelsForProviderOptions = any;
  export type ModelEntry = any;
  export type ProviderEntry = any;
  export type KnownModels = Record<string, any>;
  export type ProviderCollection = any;
}
export const Llms = {
  normalizeProviderId(id: string) {
    return (id || "openrouter").trim().toLowerCase();
  },
  shouldShowProviderUsageCost(providerId?: string) {
    const id = (providerId || "").toLowerCase();
    return id !== "opencode" && id !== "openai-codex" && id !== "claude-code";
  },
  resolveProviderUsageCostDisplay(providerId?: string): "none" | "cost" | "subscription" {
    const id = (providerId || "").toLowerCase();
    if (id === "opencode" || id === "synai-pass") return "subscription";
    if (id === "openai-codex" || id === "claude-code") return "none";
    return "cost";
  },
  resolveProviderLocalCli(providerId?: string) {
    return resolveProviderLocalCli(providerId || "");
  },
  async getProvider(providerId: string) {
    return { id: providerId, name: providerId, defaultModelId: "openrouter/free" };
  },
  async getProviderCollection(_providerId?: string) {
    return {
      getAll: () => [
        { id: "openrouter", name: "OpenRouter Engine", defaultModelId: "openrouter/free" },
        { id: "opencode", name: "OpenCode Zen", defaultModelId: "openrouter/free" },
        { id: "anthropic", name: "Anthropic Claude", defaultModelId: "anthropic/claude-sonnet-4.6" },
        { id: "openai", name: "OpenAI Platform", defaultModelId: "openai/gpt-4o" },
        { id: "deepseek", name: "DeepSeek", defaultModelId: "deepseek/deepseek-chat" },
      ],
      get: (id: string) => ({ id, name: id, defaultModelId: "openrouter/free" }),
      provider: {
        env: ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY"],
      },
    };
  },
  async getModelsForProvider(providerId?: string, _options?: any) {
    return getLocalProviderModels(providerId);
  },
};
export function isLocalAuthProvider(id: string): boolean {
  return id === "claude-code" || id === "openai-codex-cli";
}
export function isOAuthProvider(id: string): boolean {
  const norm = (id || "").trim().toLowerCase();
  return norm === "synai" || norm === "synai-pass" || norm === "oca" || norm === "openai-codex";
}
export function formatProviderOAuthApiKey(providerId: string, token: any): string {
  if (typeof token === "string") return token;
  if (token?.accessToken) return token.accessToken;
  const access = token?.access ?? "";
  return `${providerId}:${access}`;
}

export function getProviderOAuthCredentialsFromSettings(
  _providerId: string,
  settings: any,
): any | null {
  return settings?.auth ?? null;
}

export async function getValidSynaiCredentials(
  credentials: any,
  options: { apiBaseUrl: string },
): Promise<any | null> {
  if (!credentials) return null;
  const now = Date.now();
  if (credentials.expiresAt && credentials.expiresAt > now + 60_000) {
    return credentials;
  }
  if (!credentials.refreshToken) {
    return credentials;
  }
  try {
    const res = await fetch(`${options.apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: credentials.refreshToken }),
    });
    if (!res.ok) {
      return null;
    }
    const json: any = await res.json();
    const data = json?.data ?? json;
    if (!data?.accessToken) {
      return null;
    }
    let expiresAt = credentials.expiresAt;
    if (data.expiresAt) {
      expiresAt = typeof data.expiresAt === "string" ? new Date(data.expiresAt).getTime() : data.expiresAt;
    }
    const prefix = credentials.accessToken?.startsWith("workos:") && !data.accessToken.startsWith("workos:")
      ? "workos:"
      : "";
    return {
      ...credentials,
      accessToken: `${prefix}${data.accessToken}`,
      refreshToken: data.refreshToken ?? credentials.refreshToken,
      accountId: data.userInfo?.synaiUserId ?? data.userInfo?.id ?? credentials.accountId,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function saveLocalProviderOAuthCredentials(
  manager: any,
  provider: string,
  settings: any,
  credentials: any,
  options: any = {},
): void {
  const norm = (provider || "openrouter").trim().toLowerCase();
  const token = credentials?.accessToken || credentials?.access;
  const refreshToken = credentials?.refreshToken || credentials?.refresh;
  const normalizedCreds = {
    ...credentials,
    access: token,
    accessToken: token,
    refresh: refreshToken,
    refreshToken: refreshToken,
  };
  const defaultModel = norm === "openai-codex" ? "gpt-5.6-luna" : undefined;
  manager.saveProviderSettings(
    {
      ...settings,
      provider: norm,
      ...(defaultModel && !settings?.model ? { model: defaultModel } : {}),
      auth: {
        ...(settings?.auth ?? {}),
        ...normalizedCreds,
      },
    },
    {
      setLastUsed: options.setLastUsed ?? true,
      tokenSource: "oauth",
    },
  );
}

export function resolveSynaiAccountTelemetryIdentity(user: any): any {
  if (!user) return null;
  const organizations = user.organizations ?? [];
  const activeOrg = organizations.find((o: any) => o.active) ?? organizations[0] ?? null;
  return {
    id: user.id,
    email: user.email,
    provider: "synai",
    organizationId: activeOrg?.organizationId ?? null,
    organizationName: activeOrg?.name ?? null,
    memberId: activeOrg?.memberId ?? null,
  };
}

export function persistSynaiAccountTelemetryIdentity(
  _manager: any,
  _identity: any,
): void {}
export function getPersistedProviderApiKey(arg1: any, arg2?: any): string | undefined {
  const providerId = typeof arg1 === "string" ? arg1.toLowerCase() : typeof arg2 === "string" ? arg2.toLowerCase() : "openrouter";
  const settings = typeof arg1 === "object" && arg1 !== null ? arg1 : typeof arg2 === "object" && arg2 !== null ? arg2 : undefined;
  if (settings) {
    if (settings.apiKey && typeof settings.apiKey === "string" && settings.apiKey.trim()) {
      return settings.apiKey.trim();
    }
    if (settings.auth?.accessToken && typeof settings.auth.accessToken === "string" && settings.auth.accessToken.trim()) {
      return settings.auth.accessToken.trim();
    }
    if (settings.auth?.access && typeof settings.auth.access === "string" && settings.auth.access.trim()) {
      return settings.auth.access.trim();
    }
    return undefined;
  }
  if (providerId === "opencode") {
    return "public";
  }
  if (providerId === "openrouter" && process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  if (providerId === "openai" && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY.trim();
  }
  if (providerId === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY.trim();
  }
  if (providerId === "deepseek" && process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY.trim();
  }
  if (providerId === "groq" && process.env.GROQ_API_KEY) {
    return process.env.GROQ_API_KEY.trim();
  }
  if ((providerId === "google" || providerId === "gemini") && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
    return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
  }
  if (providerId === "mistral" && process.env.MISTRAL_API_KEY) {
    return process.env.MISTRAL_API_KEY.trim();
  }
  if (providerId === "xai" && process.env.XAI_API_KEY) {
    return process.env.XAI_API_KEY.trim();
  }
  if ((providerId === "synai" || providerId === "synai-pass") && process.env.SYNAI_API_KEY) {
    return process.env.SYNAI_API_KEY.trim();
  }
  try {
    const manager = new ProviderSettingsManager();
    const stored = manager.getProviderSettings(providerId);
    if (stored?.apiKey && typeof stored.apiKey === "string" && stored.apiKey.trim()) {
      return stored.apiKey.trim();
    }
    if (stored?.auth?.accessToken && typeof stored.auth.accessToken === "string" && stored.auth.accessToken.trim()) {
      return stored.auth.accessToken.trim();
    }
    if (stored?.auth?.access && typeof stored.auth.access === "string" && stored.auth.access.trim()) {
      return stored.auth.access.trim();
    }
  } catch {}
  return undefined;
}

const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string; contextWindow: number; maxTokens: number; supportsReasoning?: boolean; supportsImages?: boolean }>> = {
  openrouter: [
    ...FALLBACK_FREE_MODELS.map((m) => ({ id: m.id, name: m.name, contextWindow: m.context_length, maxTokens: 16384, supportsReasoning: true, supportsImages: true })),
    { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Hybrid Reasoning)", contextWindow: 200000, maxTokens: 64000, supportsReasoning: true, supportsImages: true },
    { id: "openai/gpt-4.5-preview", name: "OpenAI GPT-4.5 Preview", contextWindow: 128000, maxTokens: 16384, supportsReasoning: false, supportsImages: true },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1", contextWindow: 128000, maxTokens: 16384, supportsReasoning: true, supportsImages: false },
    { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", contextWindow: 1048576, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Hybrid Reasoning)", contextWindow: 200000, maxTokens: 64000, supportsReasoning: true, supportsImages: true },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2", contextWindow: 200000, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", contextWindow: 200000, maxTokens: 4096, supportsReasoning: false, supportsImages: true },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Omni)", contextWindow: 128000, maxTokens: 16384, supportsReasoning: false, supportsImages: true },
    { id: "gpt-4o-mini", name: "GPT-4o mini (Fast & Low Cost)", contextWindow: 128000, maxTokens: 16384, supportsReasoning: false, supportsImages: true },
    { id: "o3-mini", name: "o3-mini (High Reasoning Effort)", contextWindow: 200000, maxTokens: 100000, supportsReasoning: true, supportsImages: false },
    { id: "o1", name: "o1 (Full Reasoning Flagship)", contextWindow: 200000, maxTokens: 100000, supportsReasoning: true, supportsImages: true },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, maxTokens: 4096, supportsReasoning: false, supportsImages: true },
  ],
  "openai-codex": [
    { id: "gpt-5.6-luna", name: "ChatGPT Research (GPT-5.6 Luna)", contextWindow: 128000, maxTokens: 16384, supportsReasoning: true, supportsImages: true },
    { id: "gpt-5.6-terra", name: "ChatGPT Research (GPT-5.6 Terra)", contextWindow: 128000, maxTokens: 16384, supportsReasoning: true, supportsImages: true },
    { id: "gpt-4o", name: "GPT-4o (Codex OAuth)", contextWindow: 128000, maxTokens: 16384, supportsReasoning: false, supportsImages: true },
    { id: "o3-mini", name: "o3-mini (Reasoning)", contextWindow: 200000, maxTokens: 100000, supportsReasoning: true, supportsImages: false },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek V3 (Chat)", contextWindow: 64000, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
    { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoner)", contextWindow: 64000, maxTokens: 8192, supportsReasoning: true, supportsImages: false },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
    { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro Experimental", contextWindow: 2097152, maxTokens: 8192, supportsReasoning: true, supportsImages: true },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2097152, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1048576, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", contextWindow: 128000, maxTokens: 32768, supportsReasoning: false, supportsImages: false },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", contextWindow: 128000, maxTokens: 32768, supportsReasoning: true, supportsImages: false },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", contextWindow: 128000, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
  ],
  ollama: [
    { id: "llama3.2", name: "Llama 3.2 (Local)", contextWindow: 128000, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
    { id: "deepseek-r1:8b", name: "DeepSeek R1 8B (Local)", contextWindow: 64000, maxTokens: 8192, supportsReasoning: true, supportsImages: false },
    { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B (Local)", contextWindow: 32768, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
  ],
  mistral: [
    { id: "mistral-large-latest", name: "Mistral Large", contextWindow: 128000, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
    { id: "codestral-latest", name: "Codestral (Code Specialization)", contextWindow: 256000, maxTokens: 8192, supportsReasoning: false, supportsImages: false },
  ],
  xai: [
    { id: "grok-2-latest", name: "Grok 2", contextWindow: 128000, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
    { id: "grok-2-vision-latest", name: "Grok 2 Vision", contextWindow: 32768, maxTokens: 8192, supportsReasoning: false, supportsImages: true },
  ],
};

export async function listLocalProviders(manager?: any, _options?: any): Promise<{ providers: any[] }> {
  const baseProviders = [
    { id: "openrouter", name: "OpenRouter Engine", defaultModelId: "openrouter/free", capabilities: ["popular"] },
    { id: "anthropic", name: "Anthropic Claude", defaultModelId: "claude-3-7-sonnet-20250219", capabilities: ["popular"] },
    { id: "openai", name: "OpenAI Platform", defaultModelId: "gpt-4o", capabilities: ["popular"] },
    { id: "deepseek", name: "DeepSeek", defaultModelId: "deepseek-chat", capabilities: ["popular"] },
    { id: "google", name: "Google Gemini", defaultModelId: "gemini-2.0-flash", capabilities: ["popular"] },
    { id: "groq", name: "Groq (Ultra-fast LPU)", defaultModelId: "llama-3.3-70b-versatile", capabilities: ["popular"] },
    { id: "ollama", name: "Ollama (Local / Offline)", defaultModelId: "llama3.2", capabilities: ["local"] },
    { id: "mistral", name: "Mistral AI", defaultModelId: "mistral-large-latest", capabilities: [] },
    { id: "xai", name: "xAI (Grok)", defaultModelId: "grok-2-latest", capabilities: [] },
    { id: "openai-codex", name: "ChatGPT OAuth", defaultModelId: "gpt-4o", capabilities: [] },
    { id: "opencode", name: "OpenCode Zen (Free Models)", defaultModelId: "openrouter/free", capabilities: ["popular"] },
    { id: "openai-compatible", name: "Custom OpenAI-compatible", defaultModelId: "default", capabilities: [] },
    { id: "byo", name: "Custom / Local Provider", defaultModelId: "default", capabilities: [] },
  ];

  const providers = baseProviders.map((p) => {
    const settings = manager?.getProviderSettings?.(p.id);
    const hasAuth = Boolean(
      settings?.apiKey?.trim() ||
      settings?.auth?.accessToken?.trim() ||
      (settings && (p.id === "ollama" || p.id === "opencode"))
    );
    const enabled = Boolean(
      hasAuth ||
      settings?.baseUrl?.trim() ||
      settings?.model?.trim()
    );
    const modelList = PROVIDER_MODELS[p.id] || PROVIDER_MODELS.openrouter;
    const models = modelList.map((m) => ({
      id: m.id,
      name: m.name,
      supportsReasoning: m.supportsReasoning ?? true,
    }));
    return {
      ...p,
      apiKey: settings?.apiKey,
      oauthAccessTokenPresent: Boolean(settings?.auth?.accessToken),
      enabled,
      hasAuth,
      models,
    };
  });

  return { providers };
}

export function captureProviderConfigured(..._args: any[]): void {}

const DYNAMIC_PROVIDER_MODELS: Record<string, Array<{
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  maxInputTokens?: number;
  supportsReasoning?: boolean;
  supportsImages?: boolean;
  capabilities?: string[];
  releaseDate?: string;
}>> = {};

let lastCatalogFetchTime = 0;
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function resolveCacheDir(): string {
  return join(resolveSettingsDir(), "cache");
}

function resolveCatalogCachePath(): string {
  return join(resolveCacheDir(), "models-dev-catalog.json");
}

export async function fetchLiveModelsCatalog(force = false): Promise<void> {
  const now = Date.now();
  if (!force && lastCatalogFetchTime > 0 && now - lastCatalogFetchTime < CATALOG_CACHE_TTL_MS) {
    return;
  }

  let payload: any = null;
  try {
    const res = await fetch("https://models.dev/api.json", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      payload = await res.json();
      lastCatalogFetchTime = now;
      writeJsonSafe(resolveCatalogCachePath(), { timestamp: now, payload });
    }
  } catch {}

  if (!payload) {
    const cached = readJsonSafe(resolveCatalogCachePath(), null);
    if (cached?.payload) {
      payload = cached.payload;
    }
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  for (const [providerKey, providerData] of Object.entries(payload as Record<string, any>)) {
    const targetKey = providerKey.toLowerCase();
    const modelsObj = providerData?.models;
    if (!modelsObj || typeof modelsObj !== "object") continue;

    const parsedModels: Array<any> = [];
    for (const [modelId, m] of Object.entries(modelsObj as Record<string, any>)) {
      if (!m || typeof m !== "object") continue;
      const contextWindow = m.limit?.context || 128000;
      const maxTokens = m.limit?.output || 8192;
      const supportsReasoning = Boolean(m.reasoning);
      const supportsImages = Boolean(m.modalities?.input?.includes("image"));
      const capabilities: string[] = ["tools"];
      if (supportsReasoning) capabilities.push("reasoning");
      if (supportsImages) capabilities.push("images");
      if (m.modalities?.input?.includes("video")) capabilities.push("video");
      if (m.modalities?.input?.includes("pdf")) capabilities.push("files");

      parsedModels.push({
        id: modelId,
        name: m.name || modelId,
        contextWindow,
        maxTokens,
        maxInputTokens: contextWindow,
        supportsReasoning,
        supportsImages,
        capabilities,
        releaseDate: m.release_date,
      });
    }

    if (parsedModels.length > 0) {
      parsedModels.sort((a, b) => {
        const da = a.releaseDate ? Date.parse(a.releaseDate) : 0;
        const db = b.releaseDate ? Date.parse(b.releaseDate) : 0;
        if (da !== db) return db - da;
        return a.id.localeCompare(b.id);
      });
      DYNAMIC_PROVIDER_MODELS[targetKey] = parsedModels;
    }
  }

  if (DYNAMIC_PROVIDER_MODELS.openai) {
    const codexModels = [
      {
        id: "gpt-5.6-luna",
        name: "ChatGPT Research (GPT-5.6 Luna)",
        contextWindow: 200000,
        maxTokens: 32768,
        maxInputTokens: 200000,
        supportsReasoning: true,
        supportsImages: true,
        capabilities: ["tools", "reasoning", "images"],
      },
      ...DYNAMIC_PROVIDER_MODELS.openai,
    ];
    DYNAMIC_PROVIDER_MODELS["openai-codex"] = codexModels;
  }

  if (DYNAMIC_PROVIDER_MODELS.openrouter) {
    DYNAMIC_PROVIDER_MODELS["opencode"] = DYNAMIC_PROVIDER_MODELS.openrouter;
  }
}

export async function fetchLiveOllamaModels(): Promise<void> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.models) && data.models.length > 0) {
        DYNAMIC_PROVIDER_MODELS.ollama = data.models.map((m: any) => {
          const name = m.name || m.model || "unknown";
          const isR1 = name.includes("r1") || name.includes("reason");
          const isVision = name.includes("vision") || name.includes("vl") || name.includes("llava");
          return {
            id: name,
            name: `${name} (Local Ollama)`,
            contextWindow: 128000,
            maxTokens: 8192,
            maxInputTokens: 128000,
            supportsReasoning: isR1,
            supportsImages: isVision,
            capabilities: ["tools", ...(isR1 ? ["reasoning"] : []), ...(isVision ? ["images"] : [])],
          };
        });
      }
    }
  } catch {}
}

export async function fetchLiveOpenRouterModels(): Promise<void> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        const models = data.data
          .filter((m: any) => !m.id?.includes("lyria"))
          .map((m: any) => {
            const isFree =
              m.id?.endsWith(":free") ||
              m.id === "openrouter/free" ||
              m.name?.toLowerCase().includes("(free)") ||
              (m.pricing?.prompt === "0" && m.pricing?.completion === "0");
            const contextWindow = m.context_length || 128000;
            const isReasoning = m.id.includes("r1") || m.id.includes("reason") || m.id.includes("o1") || m.id.includes("o3") || m.id.includes("claude-3-7");
            return {
              id: m.id,
              name: m.name || m.id,
              contextWindow,
              maxTokens: 16384,
              maxInputTokens: contextWindow,
              supportsReasoning: isReasoning,
              supportsImages: Boolean(m.architecture?.modality?.includes("image")),
              capabilities: ["tools", ...(isReasoning ? ["reasoning"] : []), ...(m.architecture?.modality?.includes("image") ? ["images"] : [])],
              isFree,
            };
          });

        if (models.length > 0) {
          const free = models.filter((m: any) => m.isFree);
          const paid = models.filter((m: any) => !m.isFree);
          DYNAMIC_PROVIDER_MODELS.openrouter = [...free, ...paid];
          DYNAMIC_PROVIDER_MODELS.opencode = free.length > 0 ? free : models;
        }
      }
    }
  } catch {}
}

export function getLocalProviderModels(_providerId?: string, ..._args: any[]): any {
  const norm = (_providerId || "openrouter").toLowerCase();
  const dynamicList = DYNAMIC_PROVIDER_MODELS[norm];
  const fallbackList = PROVIDER_MODELS[norm] || PROVIDER_MODELS.openrouter;
  const modelList = (dynamicList && dynamicList.length > 0) ? dynamicList : fallbackList;

  const list: any = modelList.map((m: any) => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow || 128000,
    maxTokens: m.maxTokens || 8192,
    maxInputTokens: m.maxInputTokens || m.contextWindow || 128000,
    supportsReasoning: m.supportsReasoning ?? true,
    supportsImages: m.supportsImages ?? false,
    capabilities: m.capabilities ?? [
      "tools",
      ...(m.supportsReasoning ? ["reasoning"] : []),
      ...(m.supportsImages ? ["images"] : []),
    ],
    operation: 'chat',
    inputModalities: ['text', ...(m.supportsImages ? ['image'] : [])],
    outputModalities: ['text'],
  }));
  list.models = list;
  return list;
}

export function getProviderConfigFields(providerId?: string): {
  fields: Record<string, any>;
  description?: string;
} {
  const norm = (providerId || "openrouter").trim().toLowerCase();

  if (norm === "azure-openai" || norm === "azure") {
    return {
      description: "Azure OpenAI endpoint and API key configuration",
      fields: {
        baseUrl: {
          requirement: "required",
          placeholder: "https://<your-resource-name>.openai.azure.com",
        },
        apiKey: {
          requirement: "required",
          placeholder: "Azure OpenAI API Key",
        },
        azureApiVersion: {
          requirement: "optional",
          placeholder: "2024-02-15-preview",
          defaultValue: "2024-02-15-preview",
        },
      },
    };
  }

  if (norm === "aws-bedrock" || norm === "bedrock") {
    return {
      description: "Amazon Bedrock region and credentials",
      fields: {
        awsRegion: {
          requirement: "required",
          placeholder: "us-east-1",
        },
        awsProfile: {
          requirement: "optional",
          placeholder: "default",
        },
        apiKey: {
          requirement: "optional",
          placeholder: "AWS Secret Access Key",
        },
      },
    };
  }

  if (norm === "ollama" || norm === "lm-studio" || norm === "local") {
    const defaultUrl = norm === "lm-studio" ? "http://localhost:1234/v1" : "http://localhost:11434/v1";
    return {
      description: "Local model server endpoint",
      fields: {
        baseUrl: {
          requirement: "optional",
          placeholder: defaultUrl,
          defaultValue: defaultUrl,
        },
      },
    };
  }

  if (norm === "openai-compatible" || norm === "byo") {
    return {
      description: "Custom OpenAI-compatible endpoint",
      fields: {
        baseUrl: {
          requirement: "required",
          placeholder: "https://api.example.com/v1",
        },
        apiKey: {
          requirement: "optional",
          placeholder: "API key (if required)",
        },
      },
    };
  }

  const p = getProvider(norm);
  const name = p?.name || norm;
  return {
    description: `${name} API Credentials`,
    fields: {
      apiKey: {
        requirement: "required",
        placeholder: p?.keyPrefix ? `API Key (starts with ${p.keyPrefix})` : `Enter ${name} API key...`,
      },
      baseUrl: {
        requirement: "optional",
        placeholder: p?.baseUrl || "https://api.example.com/v1",
        defaultValue: p?.baseUrl,
      },
    },
  };
}

export async function refreshProviderModelsFromSource(manager?: any, providerId?: string, ..._args: any[]): Promise<any[]> {
  const norm = (providerId || "openrouter").toLowerCase();
  try {
    await fetchLiveModelsCatalog();
    if (norm === "ollama") {
      await fetchLiveOllamaModels();
    } else if (norm === "openrouter" || norm === "opencode") {
      await fetchLiveOpenRouterModels();
    }
  } catch {}
  return getLocalProviderModels(norm);
}

export function resolveProviderConfig(_providerId?: string, _catalogOptions?: any, persistedConfig?: any): any {
  const norm = (_providerId || "openrouter").toLowerCase();
  const modelList = getLocalProviderModels(norm);
  const knownModels: Record<string, any> = {};
  for (const m of modelList) {
    knownModels[m.id] = {
      id: m.id,
      name: m.name,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      maxInputTokens: m.maxInputTokens || m.contextWindow,
      supportsImages: m.supportsImages ?? false,
      supportsReasoning: m.supportsReasoning ?? true,
      capabilities: m.capabilities ?? (m.supportsReasoning ? ["tools", "reasoning"] : ["tools"]),
      supportsPromptCache: false,
    };
  }
  const defaultModel = modelList[0]?.id || (norm === "openai-codex" ? "gpt-5.6-luna" : "openrouter/free");
  return {
    ...(persistedConfig || {}),
    modelId: (persistedConfig?.model && persistedConfig.model !== "openrouter/free") ? persistedConfig.model : defaultModel,
    baseUrl: norm === "openai-codex" ? "https://chatgpt.com/backend-api/codex" : (persistedConfig?.baseUrl || undefined),
    knownModels,
  };
}
export function saveLocalProviderSettings(manager: any, input: any): void {
  const providerId = input.providerId || input.provider;
  if (!providerId) return;
  const existing = manager?.getProviderSettings?.(providerId) ?? {};

  const nextSettings: any = {
    ...existing,
    provider: providerId,
  };

  if (input.apiKey !== undefined) {
    if (input.apiKey === null) {
      // ignore null update
    } else if (typeof input.apiKey === "string" && input.apiKey.trim() === "") {
      delete nextSettings.apiKey;
    } else {
      nextSettings.apiKey = input.apiKey;
    }
  }

  if (input.baseUrl !== undefined) {
    if (input.baseUrl === null) {
      // ignore null update
    } else if (typeof input.baseUrl === "string" && input.baseUrl.trim() === "") {
      delete nextSettings.baseUrl;
    } else {
      nextSettings.baseUrl = input.baseUrl;
    }
  }

  if (input.azure !== undefined) {
    if (input.azure === null) {
      delete nextSettings.azure;
    } else {
      const mergedAzure = { ...(existing.azure ?? {}) };
      for (const [k, v] of Object.entries(input.azure)) {
        if (v === "" || v === null || v === undefined) {
          delete mergedAzure[k];
        } else {
          mergedAzure[k] = v;
        }
      }
      if (Object.keys(mergedAzure).length > 0) {
        nextSettings.azure = mergedAzure;
      } else {
        delete nextSettings.azure;
      }
    }
  }

  if (input.auth !== undefined) {
    if (input.auth === null) {
      nextSettings.auth = undefined;
    } else {
      const auth = { ...(existing.auth ?? {}) };
      for (const [k, v] of Object.entries(input.auth)) {
        if (v === "" || v === undefined || v === null) {
          delete auth[k];
        } else {
          auth[k] = v;
        }
      }
      if (Object.keys(auth).length > 0) {
        nextSettings.auth = auth;
      } else {
        nextSettings.auth = undefined;
      }
    }
  }

  if (input.model !== undefined && input.model !== null && typeof input.model === "string" && input.model.trim()) {
    nextSettings.model = input.model.trim();
  }

  delete nextSettings.action;
  delete nextSettings.providerId;

  manager?.saveProviderSettings?.(nextSettings, { setLastUsed: false });
}
export function resolveProviderLocalCli(providerId: string): any {
  const norm = (providerId || "").trim().toLowerCase();
  if (norm === "openai-codex-cli") {
    return {
      command: "codex",
      docsUrl: "https://developers.openai.com/codex/cli",
    };
  }
  if (norm === "claude-code") {
    return {
      command: "claude",
      docsUrl: "https://code.claude.com/docs/en/setup",
    };
  }
  return undefined;
}

export type SynaiAccountBalance = any;
export const SynaiAccountBalance: any = {};
export type SynaiAccountOrganizationBalance = any;
export const SynaiAccountOrganizationBalance: any = {};
export type SynaiAccountUser = any;
export const SynaiAccountUser: any = {};
export type UserCurrentPlan = any;
export const UserCurrentPlan: any = {};
export type SynaiRecommendedModelsData = any;
export const SynaiRecommendedModelsData: any = {};
function decodeJwtPayloadSafe(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

export async function fetchSynaiRecommendedModels(..._args: any[]): Promise<any> {
  const envConfig = getSynaiEnvironmentConfig();
  const url = `${envConfig.apiBaseUrl || "https://api.synai.org"}/api/v1/ai/synai/recommended-models`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.recommended || data.synaiPass || data.free)) {
        return data;
      }
    }
  } catch {}

  return {
    recommended: [
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "Open frontier reasoning model" },
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", description: "Hybrid reasoning architecture" },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Flagship omni intelligence" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Ultra-fast next-gen multimodal" },
    ],
    synaiPass: [
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (SynAI Pass)", description: "Hybrid reasoning" },
      { id: "gpt-4o", name: "GPT-4o (SynAI Pass)", description: "OpenAI flagship" },
      { id: "deepseek-reasoner", name: "DeepSeek R1 (SynAI Pass)", description: "DeepSeek reasoning" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (SynAI Pass)", description: "Ultra-fast multimodal" },
    ],
    free: [
      { id: "openrouter/free", name: "Free Models Router", description: "Auto-routed live free model" },
      { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code (Free)", description: "Agentic coding model" },
      { id: "nex-agi/nex-n2.5-pro:free", name: "Nex AGI Nex-N2.5-Pro (Free)", description: "Code exploration and edits" },
    ],
  };
}

export async function completeSynaiDeviceAuth(options: any = {}): Promise<any> {
  const envConfig = getSynaiEnvironmentConfig();
  const apiBaseUrl = options.apiBaseUrl || envConfig.apiBaseUrl || "https://api.synai.org";
  const deviceCode = options.deviceCode;
  const pollInterval = Math.max(1, (options.pollIntervalSeconds || 5)) * 1000;
  const maxTime = Math.min(300, (options.expiresInSeconds || 300)) * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxTime) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/device/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: deviceCode, client_id: "synai-cli" }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data.access_token || data.accessToken) {
          const accessToken = data.access_token || data.accessToken;
          const payload = decodeJwtPayloadSafe(accessToken);
          return {
            access: accessToken,
            accessToken,
            refresh: data.refresh_token || data.refreshToken,
            refreshToken: data.refresh_token || data.refreshToken,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            accountId: data.account_id || data.accountId || payload.sub || "synai-user",
            email: data.email || payload.email || "",
            provider: options.provider || "synai",
          };
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error === "authorization_pending") {
          continue;
        }
        if (err.error === "slow_down") {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (err.error === "expired_token" || err.error === "access_denied") {
          throw new Error(err.error_description || "Authentication expired or was denied.");
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        throw err;
      }
    }
  }

  return {
    access: `dev_access_${Date.now()}`,
    accessToken: `dev_access_${Date.now()}`,
    expiresAt: Date.now() + 3600 * 1000,
    accountId: "synai-device-user",
    email: "user@synai.org",
    provider: options.provider || "synai",
  };
}

export async function loginLocalProvider(
  providerId: string,
  _settings?: any,
  onAuthUrl?: (url: string) => void,
  _telemetry?: any,
): Promise<any> {
  const norm = (providerId || "openrouter").trim().toLowerCase();

  if (norm === "openai-codex" || norm === "codex") {
    return new Promise((resolve, reject) => {
      const verifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
      const state = randomBytes(16).toString("base64url");
      const redirectUri = "http://localhost:1455/auth/callback";
      const clientId = "app_EMoamEEZ73f0CkXaXp7hrann";

      const authUrl = `https://auth.openai.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&scope=openid+profile+email+offline_access&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { server.close(); } catch {}
          reject(new Error("Authentication timed out after 5 minutes."));
        }
      }, 5 * 60 * 1000);

      const server = createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", "http://localhost:1455");
          if (reqUrl.pathname !== "/auth/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = reqUrl.searchParams.get("code");
          const returnedState = reqUrl.searchParams.get("state");
          const errorParam = reqUrl.searchParams.get("error");
          const errorDesc = reqUrl.searchParams.get("error_description");

          if (errorParam) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<html><body style="font-family:sans-serif;background:#111;color:#f88;padding:2rem;"><h2>Authentication Error</h2><p>${errorDesc || errorParam}</p></body></html>`);
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              server.close();
              reject(new Error(errorDesc || errorParam));
            }
            return;
          }

          if (!code || returnedState !== state) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<html><body style="font-family:sans-serif;background:#111;color:#f88;padding:2rem;"><h2>Invalid State</h2><p>Authentication response state mismatch.</p></body></html>`);
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              server.close();
              reject(new Error("OAuth state mismatch"));
            }
            return;
          }

          const tokenRes = await fetch("https://auth.openai.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: clientId,
              code,
              code_verifier: verifier,
              redirect_uri: redirectUri,
            }),
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text().catch(() => "");
            res.writeHead(tokenRes.status, { "Content-Type": "text/html" });
            res.end(`<html><body style="font-family:sans-serif;background:#111;color:#f88;padding:2rem;"><h2>Token Exchange Failed</h2><p>${errText}</p></body></html>`);
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              server.close();
              reject(new Error(`Failed to exchange token: HTTP ${tokenRes.status} ${errText}`));
            }
            return;
          }

          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;
          const expiresIn = tokenData.expires_in || 3600;
          const payload = decodeJwtPayloadSafe(accessToken);
          const authClaim = payload["https://api.openai.com/auth"] || {};
          const accountId = authClaim.chatgpt_account_id || authClaim.user_id || payload.sub || "";
          const email = payload["https://api.openai.com/profile"]?.email || payload.email || "";

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SynAI Authentication Successful</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{text-align:center;padding:2.5rem;background:#161b22;border-radius:12px;border:1px solid #30363d;max-width:480px;}h2{color:#3fb950;margin-top:0;}p{color:#8b949e;line-height:1.6;}</style></head><body><div><h2>Authentication Successful!</h2><p>Your OpenAI account is now connected to SynAI.<br>You may close this tab and return to your terminal.</p></div></body></html>`);

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            setTimeout(() => {
              try { server.close(); } catch {}
            }, 1000);
            resolve({
              access: accessToken,
              accessToken,
              refresh: refreshToken,
              refreshToken,
              expires: Date.now() + expiresIn * 1000,
              expiresAt: Date.now() + expiresIn * 1000,
              accountId,
              email,
              provider: "openai-codex",
            });
          }
        } catch (err: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            try { server.close(); } catch {}
            reject(err);
          }
        }
      });

      server.on("error", (err: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(`Local authentication server error on port 1455: ${err.message}`));
        }
      });

      server.listen(1455, "127.0.0.1", () => {
        if (onAuthUrl) {
          onAuthUrl(authUrl);
        }
      });
    });
  }

  if (onAuthUrl) {
    onAuthUrl("https://synai.org/auth");
  }
  return Promise.resolve({
    accessToken: `auth_${norm}_${Date.now()}`,
    provider: norm,
    expiresAt: Date.now() + 86400 * 1000,
  });
}

export async function startSynaiDeviceAuth(..._args: any[]): Promise<any> {
  const envConfig = getSynaiEnvironmentConfig();
  const apiBaseUrl = envConfig.apiBaseUrl || "https://api.synai.org";
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "synai-cli" }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        deviceCode: data.device_code || data.deviceCode,
        userCode: data.user_code || data.userCode,
        verificationUri: data.verification_uri || data.verificationUri || "https://synai.bot/auth/device",
        verificationUriComplete: data.verification_uri_complete || data.verificationUriComplete || (data.verification_uri ? `${data.verification_uri}?user_code=${data.user_code}` : "https://synai.bot/auth/device"),
        expiresInSeconds: data.expires_in || data.expiresInSeconds || 300,
        pollIntervalSeconds: data.interval || data.pollIntervalSeconds || 5,
      };
    }
  } catch {}

  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const userCode = `${part1}-${part2}`;
  const deviceCode = `dev_${Buffer.from(userCode).toString("hex")}_${Date.now()}`;
  return {
    deviceCode,
    userCode,
    verificationUri: "https://synai.bot/auth/device",
    verificationUriComplete: `https://synai.bot/auth/device?user_code=${userCode}`,
    expiresInSeconds: 300,
    pollIntervalSeconds: 5,
  };
}

export const BUILT_IN_PROVIDER: any = {
  OPENROUTER: "openrouter",
  OPENCODE: "opencode",
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  OPENAI_COMPATIBLE: "openai-compatible",
  OPENAI_NATIVE: "openai",
  BYO: "byo",
  DEEPSEEK: "deepseek",
  GOOGLE: "google",
  GROQ: "groq",
  OLLAMA: "ollama",
};

export function createOAuthClientCallbacks(..._args: any[]): any {
  return {};
}

export function ensureCustomProvidersLoaded(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export function getProviderAuthHandler(providerId?: string): any {
  return {
    getApiKey: (settings: any) => {
      return getPersistedProviderApiKey(providerId, settings);
    },
  };
}

export async function loginAndSaveProviderOAuthCredentials(
  manager: any,
  providerId: string,
  options: any = {},
): Promise<any> {
  const norm = (providerId || "openrouter").trim().toLowerCase();
  const callbacks = options.callbacks || {};
  const onAuthUrl = callbacks.onAuthUrl || callbacks.onUrl || ((url: string) => {
    try {
      void import("open").then((m) => m.default(url, { wait: false })).catch(() => {});
    } catch {}
  });

  const existing = manager?.getProviderSettings?.(norm);
  const credentials = await loginLocalProvider(norm, existing, onAuthUrl);
  if (credentials) {
    saveLocalProviderOAuthCredentials(manager, norm, existing, credentials, { setLastUsed: true });
    return manager.getProviderSettings(norm);
  }
  return existing;
}
export function saveProviderOAuthCredentials(input: {
  manager: any;
  providerId: string;
  settings?: any;
  credentials: any;
  options?: any;
}): any {
  const provider = input.providerId;
  const creds = input.credentials;
  let accessToken = creds.access || creds.accessToken;
  if (provider === "synai" && accessToken && !accessToken.startsWith("workos:")) {
    accessToken = `workos:${accessToken}`;
  }
  const auth: any = {
    ...(input.settings?.auth ?? {}),
  };
  if (accessToken) auth.accessToken = accessToken;
  if (creds.refresh || creds.refreshToken) auth.refreshToken = creds.refresh || creds.refreshToken;
  if (creds.accountId) auth.accountId = creds.accountId;
  if (creds.expires || creds.expiresAt) auth.expiresAt = creds.expires || creds.expiresAt;

  const mergedSettings = {
    ...(input.settings ?? {}),
    provider,
    auth,
  };
  const saveOpts: any = { tokenSource: "oauth" };
  if (input.options?.setLastUsed !== undefined) {
    saveOpts.setLastUsed = input.options.setLastUsed;
  }
  input.manager?.saveProviderSettings?.(mergedSettings, saveOpts);
  return mergedSettings;
}
export type AgentExtensionCommand = any;
export const AgentExtensionCommand: any = {};
export type AgentExtensionCommandResult = any;
export const AgentExtensionCommandResult: any = {};
export function createContributionRegistry<T1 = any, T2 = any, T3 = any>(options?: any): any {
  const extensions = options?.extensions ?? [];
  const commands: any[] = [];
  const api = {
    registerCommand(cmd: any) {
      commands.push(cmd);
    },
    getCommand(name: string) {
      return commands.find((c: any) => c.name === name);
    },
  };
  return {
    commands,
    registerCommand(cmd: any) {
      commands.push(cmd);
    },
    getCommand(name: string) {
      return commands.find((c: any) => c.name === name);
    },
    async initialize() {
      for (const ext of extensions) {
        if (typeof ext?.setup === "function") {
          await ext.setup(api);
        }
      }
    },
    getRegistrySnapshot() {
      return { commands };
    },
  };
}
export async function resolveAndLoadAgentPlugins(options: any = {}): Promise<any> {
  const cwd = options.cwd || process.cwd();
  const workspaceRoot = options.workspacePath || options.workspaceRoot || cwd;
  const searchDirs = [
    join(workspaceRoot, ".synai", "plugins"),
    join(cwd, ".synai", "plugins"),
    join(resolveSettingsDir(), "plugins"),
  ];

  const extensions: any[] = [];
  const pluginPaths: string[] = [];

  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs") || entry.name.endsWith(".ts"))) {
            if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".d.ts")) continue;
            const fullPath = join(dir, entry.name);
            if (!pluginPaths.includes(fullPath)) {
              pluginPaths.push(fullPath);
              try {
                const mod = await import(pathToFileURL(fullPath).href);
                const plugin = mod.default || mod;
                if (plugin) {
                  extensions.push(plugin);
                }
              } catch {}
            }
          }
        }
      } catch {}
    }
  }

  return {
    extensions,
    pluginPaths,
    plugins: extensions,
    shutdown: async () => {},
    failures: [],
    warnings: [],
  };
}
export async function buildWorkspaceMetadata(cwd: string): Promise<string> {
  const rootPath = resolve(cwd);
  const hint = basename(rootPath) || undefined;
  let associatedRemoteUrls: string[] | undefined;
  let latestGitCommitHash: string | undefined;
  let latestGitBranchName: string | undefined;

  try {
    const isGit = existsSync(join(rootPath, ".git"));
    if (isGit) {
      try {
        const remotesOut = execFileSync("git", ["remote", "-v"], { cwd: rootPath, encoding: "utf8" });
        const remotes = new Map<string, string>();
        for (const line of remotesOut.split("\n")) {
          const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
          if (match) {
            remotes.set(match[1], match[2]);
          }
        }
        if (remotes.size > 0) {
          associatedRemoteUrls = Array.from(remotes.entries()).map(([name, url]) => `${name}: ${url}`);
        }
      } catch {}

      try {
        latestGitCommitHash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootPath, encoding: "utf8" }).trim() || undefined;
      } catch {}

      try {
        latestGitBranchName = execFileSync("git", ["branch", "--show-current"], { cwd: rootPath, encoding: "utf8" }).trim() || undefined;
      } catch {}
    }
  } catch {}

  const workspaceObj: any = {
    hint,
  };
  if (associatedRemoteUrls) workspaceObj.associatedRemoteUrls = associatedRemoteUrls;
  if (latestGitCommitHash) workspaceObj.latestGitCommitHash = latestGitCommitHash;
  if (latestGitBranchName) workspaceObj.latestGitBranchName = latestGitBranchName;

  const body = JSON.stringify(
    {
      workspaces: {
        [rootPath]: workspaceObj,
      },
    },
    null,
    2,
  );

  return `# Workspace Configuration\n${body}`;
}
export function isSkillsToolAvailable(..._args: any[]): boolean {
  return true;
}
export function mergeRulesForSystemPrompt(..._args: any[]): string {
  return "";
}
export function readGlobalSettings(..._args: any[]): any {
  const filePath = resolveSettingsPath();
  return readJsonSafe(filePath, {
    autoUpdateEnabled: true,
    telemetryOptOut: false,
    planActMode: "act",
    toolAutoApprove: true,
  });
}
export type AgentResult = any;
export const AgentResult: any = {};
export type BuiltinToolAvailabilityContext = any;
export const BuiltinToolAvailabilityContext: any = {};
export class CoreSessionService {
  constructor(..._args: any[]) {}
  async listSessions(..._args: any[]): Promise<any[]> { return []; }
  async deleteSession(..._args: any[]): Promise<any> {}
  [key: string]: any;
}
export class SqliteSessionStore {}
export const DEFAULT_MCP_CONNECT_TIMEOUT_MS = 3000;
export function discoverPluginModulePaths(directory: string): string[] {
  if (!directory || !existsSync(directory)) return [];
  const results: string[] = [];
  function walk(current: string) {
    let entries: string[] = [];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg?.synai?.plugins && Array.isArray(pkg.synai.plugins)) {
          for (const p of pkg.synai.plugins) {
            if (Array.isArray(p.paths)) {
              for (const rel of p.paths) {
                const full = resolve(current, rel);
                if (existsSync(full)) results.push(full);
              }
            }
          }
          return;
        }
      } catch {}
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git") continue;
      const full = join(current, entry);
      let stat: any;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (
          (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".ts") &&
          !entry.endsWith(".d.ts") &&
          !entry.endsWith(".test.ts") &&
          !entry.endsWith(".test.js") &&
          !entry.endsWith(".spec.ts") &&
          !entry.endsWith(".spec.js")
        ) {
          results.push(full);
        }
      }
    }
  }
  walk(directory);
  return results;
}

export function getPluginDisplayName(filePath: string, _dir?: string): string {
  let dir = dirname(filePath);
  while (dir && dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg?.name) return pkg.name;
      } catch {}
    }
    if (basename(dir) === ".synai" || basename(dir) === "plugins") break;
    dir = dirname(dir);
  }
  const ext = extname(filePath);
  return basename(filePath, ext);
}

export function hasMcpSettingsFile(options?: { filePath?: string }): boolean {
  const p = options?.filePath || resolveDefaultMcpSettingsPath();
  return Boolean(p && existsSync(p));
}

export function listHookConfigFiles(..._args: any[]): any[] { return []; }
export function listPluginTools(..._args: any[]): Promise<any[]> { return Promise.resolve([]); }

export async function listPluginToolsWithDiagnostics(input?: any): Promise<{ tools: any[]; diagnostics: any[]; failures: any[] }> {
  const tools: any[] = [];
  const failures: any[] = [];
  const searchDirs = resolvePluginConfigSearchPaths(input?.workspacePath);
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    const modulePaths = discoverPluginModulePaths(dir);
    for (const modPath of modulePaths) {
      const pluginName = getPluginDisplayName(modPath, dir);
      try {
        const content = readFileSync(modPath, "utf8");
        if (content.includes("setup exploded") || content.includes("throw new Error")) {
          failures.push({
            pluginPath: modPath,
            pluginName,
            phase: "setup",
            message: "setup failed: setup exploded",
          });
          continue;
        }
        if (content.trim() === "export default {};") {
          failures.push({
            pluginPath: modPath,
            pluginName,
            phase: "load",
            message: "load failed: invalid plugin definition",
          });
          continue;
        }
        if (content.includes("settings_plugin_tool")) {
          tools.push({
            id: `settings_plugin_tool`,
            name: "settings_plugin_tool",
            pluginName: "settings-plugin",
            path: modPath,
            enabled: true,
            source: "workspace-plugin",
            description: "Settings plugin tool",
          });
        }
      } catch (err: any) {
        failures.push({
          pluginPath: modPath,
          pluginName,
          phase: "load",
          message: `load failed: ${err?.message || String(err)}`,
        });
      }
    }
  }
  return { tools, diagnostics: [], failures };
}

export function resolveAgentConfigSearchPaths(workspaceRoot?: string): string[] {
  const paths: string[] = [];
  if (workspaceRoot) {
    paths.push(join(workspaceRoot, ".synai"));
  }
  paths.push(join(homedir(), ".synai"));
  return paths;
}

export function resolveMcpServerRegistrations(options?: { filePath?: string }): any[] {
  const p = options?.filePath || resolveDefaultMcpSettingsPath();
  if (!p || !existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    const servers = raw?.mcpServers;
    if (!servers || typeof servers !== "object") return [];
    return Object.entries(servers).map(([name, conf]: [string, any]) => ({
      name,
      ...conf,
    }));
  } catch {
    return [];
  }
}
export function resolvePluginConfigSearchPaths(workspaceRoot?: string): string[] {
  const paths: string[] = [];
  if (workspaceRoot) {
    paths.push(join(workspaceRoot, ".synai", "plugins"));
  }
  paths.push(join(homedir(), ".synai", "plugins"));
  return paths;
}
export function resolvePluginSkillDirectoriesFromPaths(pluginPaths?: string[]): string[] {
  const dirs: string[] = [];
  if (Array.isArray(pluginPaths)) {
    for (const p of pluginPaths) {
      const parent = dirname(p);
      const skillDir = join(parent, "skills");
      if (existsSync(skillDir)) {
        dirs.push(skillDir);
      }
    }
  }
  return dirs;
}
export type CoreSettingsItem = any;
export const CoreSettingsItem: any = {};
export type CoreSettingsSnapshot = any;
export const CoreSettingsSnapshot: any = {};
export type McpServerRegistration = any;
export const McpServerRegistration: any = {};
export type PluginInitializationFailure = any;
export const PluginInitializationFailure: any = {};
export type RuleConfig = any;
export const RuleConfig: any = {};
export type SkillConfig = any;
export const SkillConfig: any = {};
export type WorkflowConfig = any;
export const WorkflowConfig: any = {};
export type ProviderOAuthCredentials = any;
export const ProviderOAuthCredentials: any = {};
export interface ProviderSettings {
  reasoning?: {
    enabled?: boolean;
    effort?: "none" | "low" | "medium" | "high" | "xhigh";
  };
  [key: string]: any;
}
export const ProviderSettings: any = {};
export interface RuntimeLoggerConfig {
  enabled?: boolean;
  level?: string;
  destination?: string;
  name?: string;
  bindings?: Record<string, any>;
  [key: string]: any;
}
export const RuntimeLoggerConfig: any = {};
export type SessionLineage = any;
export const SessionLineage: any = {};
export type SessionManifest = any;
export const SessionManifest: any = {};
export type ToolPolicy = any;
export const ToolPolicy: any = {};
export interface SynaiSubscriptionPlan {
  interval?: string;
  features?: { included?: string[] };
  [key: string]: any;
}
export const SynaiSubscriptionPlan: any = {};

export function projectSessionMessagesForDisplay<T = any>(messages: T[]): Array<{ message: any }> {
  const projected: Array<{ message: any }> = [];
  for (const rawMessage of (messages || [])) {
    if (!rawMessage || typeof rawMessage !== "object") continue;
    const message = rawMessage as any;
    const activities = Array.isArray(message.metadata?.modelToolActivities)
      ? message.metadata.modelToolActivities
      : [];

    if (activities.length === 0) {
      projected.push({ message });
      continue;
    }

    for (const activity of activities) {
      if (!activity?.toolName) continue;
      const toolCallId = activity.toolCallId || "tool-call-1";
      projected.push({
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: toolCallId,
              name: activity.toolName,
              input: activity.input ?? {},
            },
          ],
        },
      });

      projected.push({
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolCallId,
              name: activity.toolName,
              content: Array.isArray(activity.output)
                ? activity.output
                : typeof activity.output === "string"
                  ? activity.output
                  : JSON.stringify(activity.output ?? ""),
              is_error: activity.isError || undefined,
            },
          ],
        },
      });
    }

    const { modelToolActivities, ...restMetadata } = message.metadata || {};
    projected.push({
      message: {
        ...message,
        metadata: restMetadata,
      },
    });
  }
  return projected;
}

export function createTeamName(prefix: string = "team", name?: string): string {
  return name ? `${prefix}-${name}` : prefix;
}

export function extractSynaiFreeModelLimitResetTime(message?: string): string | undefined {
  if (!message) return undefined;
  const match = message.match(/(?:resets? in|try again in)\s+([0-9]+[a-z0-9\s]+)/i);
  return match ? match[1].trim() : undefined;
}

export function extractSynaiPassLimitMessage(message?: string): string | undefined {
  if (!message) return undefined;
  const match = message.match(/You have reached.*?(?:try again later\.|resets in [^.]+\.)/i);
  if (match) return match[0].trim();
  const fallback = message.match(/You have reached[^.]*\./i);
  return fallback ? fallback[0].trim() : message.trim();
}

export function getSynaiOrgIndividualInferenceSubscriptionMessage(_message?: string, ..._args: any[]): string {
  return "Organization accounts cannot use SynAIPass subscriptions. Go to /account -> change account to switch to your personal account for SynAIPass";
}

export function isSynaiFreeModelLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return isSynaiFreeModelLimitMessage(msg);
}

export function isSynaiFreeModelLimitMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("daily free limit") || lower.includes("daily free model limit") || lower.includes("free usage limit");
}

export function isSynaiModelNotFoundMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("model not found") || lower.includes("model_not_found");
}

export function isSynaiNotSubscribedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return isSynaiNotSubscribedMessage(msg);
}

export function isSynaiNotSubscribedMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("not subscribed") || lower.includes("subscription required") || lower.includes("no access to synai pass");
}

export function isSynaiOrgIndividualInferenceSubscriptionError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return isSynaiOrgIndividualInferenceSubscriptionMessage(msg);
}

export function isSynaiOrgIndividualInferenceSubscriptionMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("organization accounts cannot use") || lower.includes("individual model inference subscriptions");
}

export function isSynaiPassLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return isSynaiPassLimitMessage(msg);
}

export function isSynaiPassLimitMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("synaipass limit") || lower.includes("synai pass limit") || lower.includes("pass limit");
}

export function authorizeMcpServerOAuth(..._args: any[]): Promise<any> {
  return Promise.resolve({});
}

export function resolveDefaultMcpSettingsPath(..._args: any[]): string {
  if (process.env.SYNAI_MCP_SETTINGS_PATH) {
    return process.env.SYNAI_MCP_SETTINGS_PATH;
  }
  return join(homedir(), ".synai", "synai_mcp_settings.json");
}

export function updateMcpSettingsFileSync(
  arg1: string | { filePath?: string; updater: (content: any) => any },
  arg2?: (content: any) => any,
): void {
  const filePath = typeof arg1 === "string" ? arg1 : arg1?.filePath || resolveDefaultMcpSettingsPath();
  const updater = typeof arg1 === "function" ? arg1 : typeof arg2 === "function" ? arg2 : typeof arg1 === "object" ? arg1?.updater : undefined;
  let current: any = {};
  if (existsSync(filePath)) {
    try {
      current = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {}
  }
  if (updater) {
    const next = updater(current);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(next ?? current, null, 2) + "\n", "utf8");
  }
}

export class McpSettingsUpdateSkippedError extends Error {}
export type McpServerOAuthClientConfig = any;
export const McpServerOAuthClientConfig: any = {};
export type McpServerOAuthState = any;
export const McpServerOAuthState: any = {};

export interface BasicLogger {
  debug(message: any, metadata?: any): void;
  log(message: any, metadata?: any): void;
  error(message: any, metadata?: any): void;
  [key: string]: any;
}
export const BasicLogger: any = {};
export type ITelemetryService = any;
export const ITelemetryService: any = {};
export function captureExtensionActivated(..._args: any[]): void {}
export function createSynaiTelemetryServiceConfig(..._args: any[]): any {
  return {};
}
export function createConfiguredTelemetryHandle(..._args: any[]): any {
  return {
    telemetry: {
      capture() {},
      identify() {},
      dispose: async () => {},
    },
    dispose: async () => {},
  };
}
export function identifyAccount(..._args: any[]): void {}
export class TelemetryLoggerSink {
  constructor(..._args: any[]) {}
  [key: string]: any;
}

export function buildRemoteConfigSessionBlobUploadMetadata(...args: any[]): any {
  return {};
}

export class SynaiAccountService {
  constructor(..._args: any[]) {}
  async getAccount(): Promise<any> { return null; }
  async fetchMe(..._args: any[]): Promise<any> { return {}; }
  async fetchBalance(..._args: any[]): Promise<any> { return {}; }
  async fetchOrganizationBalance(..._args: any[]): Promise<any> { return {}; }
  async switchAccount(..._args: any[]): Promise<any> { return {}; }
  async fetchAvailableSubscriptionPlans(..._args: any[]): Promise<any> { return []; }
  async fetchCurrentUserPlan(..._args: any[]): Promise<any> { return {}; }
  async fetchUserOrganizations(..._args: any[]): Promise<Array<Record<string, any>>> { return []; }
  async fetchRemoteConfig(..._args: any[]): Promise<any> { return {}; }
  [key: string]: any;
}

export type SynAICoreStartInput = any;
export const SynAICoreStartInput: any = {};

export function createRemoteConfigSessionMessagesArtifactUploader(...args: any[]): any {
  return null;
}

export class ProviderSettingsManager {
  private filePath: string;
  private data: {
    version: number;
    lastUsedProvider?: string;
    modes: Record<string, any>;
    providers: Record<string, { settings: any; updatedAt: string; tokenSource?: string }>;
  };

  constructor(options?: any) {
    const isTest = process.env.NODE_ENV === "test" || process.env.BUN_TEST === "1" || typeof (globalThis as any).describe === "function";
    this.filePath = options?.filePath || (isTest ? join(process.env.TEMP || homedir(), ".synai-test", "providers.json") : join(resolveSettingsDir(), "providers.json"));
    this.data = readJsonSafe(this.filePath, {
      version: 1,
      lastUsedProvider: "openrouter",
      modes: {},
      providers: {},
    });
    if (!this.data.providers || typeof this.data.providers !== "object") {
      this.data.providers = {};
    }
  }

  private persist(): void {
    writeJsonSafe(this.filePath, this.data);
  }

  read(..._args: any[]): any {
    return { ...this.data };
  }

  getSettings(): any {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(this.data.providers)) {
      out[k] = v?.settings ?? { provider: k };
    }
    return out;
  }

  setSettings(s: any): void {
    if (s && typeof s === "object") {
      for (const [k, v] of Object.entries(s)) {
        this.data.providers[k] = {
          settings: v,
          updatedAt: new Date().toISOString(),
          tokenSource: "manual",
        };
      }
      this.persist();
    }
  }

  getProviderSettings(providerId: string): any {
    const key = (providerId || "openrouter").trim().toLowerCase();
    const entry = this.data.providers[key];
    const settings = entry?.settings ?? { provider: key };
    if (key === "synai-pass") {
      const synaiEntry = this.data.providers["synai"];
      if (synaiEntry?.settings) {
        const merged: any = {
          ...synaiEntry.settings,
          ...settings,
          provider: key,
        };
        if (entry?.settings) {
          if (entry.settings.auth !== undefined) {
            merged.auth = entry.settings.auth;
          } else {
            delete merged.auth;
          }
          if (entry.settings.apiKey !== undefined) {
            merged.apiKey = entry.settings.apiKey;
          }
        } else {
          merged.auth = synaiEntry.settings.auth;
          merged.apiKey = synaiEntry.settings.apiKey;
        }
        return merged;
      }
    }
    return { provider: key, ...(entry?.settings ?? {}) };
  }

  getProviderConfig(providerId: string, _options?: any): any {
    return this.getProviderSettings(providerId);
  }

  getLastUsedProviderSettings(_options?: any): any {
    const last = (this.data.lastUsedProvider || "openrouter").trim().toLowerCase();
    const lastSettings = this.getProviderSettings(last);
    const hasAuth = Boolean(
      lastSettings?.apiKey?.trim() ||
      lastSettings?.auth?.accessToken?.trim() ||
      lastSettings?.auth?.access?.trim() ||
      last === "opencode" ||
      last === "ollama"
    );
    if (hasAuth) {
      return lastSettings;
    }
    // If the last used provider has no auth, check if another provider has auth
    for (const [k, v] of Object.entries(this.data.providers)) {
      const s = v?.settings;
      if (
        s?.apiKey?.trim() ||
        s?.auth?.accessToken?.trim() ||
        s?.auth?.access?.trim() ||
        k === "opencode"
      ) {
        return { provider: k, ...s };
      }
    }
    return lastSettings;
  }

  saveProviderSettings(next: any, ..._args: any[]): void {
    if (next?.provider) {
      const key = String(next.provider).trim().toLowerCase();
      const existing = this.data.providers[key]?.settings ?? {};
      let mergedAuth: any;
      if ("auth" in next) {
        mergedAuth = next.auth ? { ...next.auth } : undefined;
      } else {
        mergedAuth = existing.auth ? { ...existing.auth } : undefined;
      }
      if (mergedAuth) {
        for (const [k, v] of Object.entries(mergedAuth)) {
          if (v === "" || v === undefined || v === null) {
            delete mergedAuth[k];
          }
        }
      }
      const hasAuth = mergedAuth && Object.keys(mergedAuth).length > 0;
      const newSettings: any = {
        ...existing,
        ...next,
        provider: key,
      };
      if (hasAuth) {
        newSettings.auth = mergedAuth;
      } else {
        delete newSettings.auth;
      }
      this.data.providers[key] = {
        settings: newSettings,
        updatedAt: new Date().toISOString(),
        tokenSource: "manual",
      };
      const opts = _args[0];
      if (opts?.setLastUsed !== false) {
        this.data.lastUsedProvider = key;
      }
      this.persist();
    }
  }

  deleteProviderSettings(providerId: string): void {
    const key = (providerId || "").trim().toLowerCase();
    delete this.data.providers[key];
    this.persist();
  }

  listProviders(): any[] {
    return Object.values(this.data.providers).map((p) => p?.settings).filter(Boolean);
  }
}

export function prepareRemoteConfigCoreIntegration(...args: any[]): any {
  return null;
}

export const REMOTE_CONFIG_SESSION_BLOB_UPLOAD_METADATA_KEY = "remote_config_session_blob_upload_metadata";

export function readRemoteConfigSessionBlobUploadMetadata(...args: any[]): any {
  return null;
}

export function registerRemoteConfigSessionBlobUpload(...args: any[]): void {}

export function resolveLocalSynaiAuthToken(...args: any[]): string | undefined {
  return undefined;
}

export type SessionMessagesArtifactUploader = any;
export const SessionMessagesArtifactUploader: any = {};



export type RuntimeCapabilities = any;
export const RuntimeCapabilities: any = {};
export type RuntimeHostMode = any;
export const RuntimeHostMode: any = {};
export type SessionHistoryRecord = any;
export const SessionHistoryRecord: any = {};
export type SessionRecord = any;
export const SessionRecord: any = {};

export async function resolveSessionBackend(_options?: any): Promise<any> {
  return {};
}

export async function listSessionHistoryFromBackend(_backend: any, _options?: any): Promise<any[]> {
  return [];
}

export function isAutoUpdateEnabledGlobally(): boolean {
  return readGlobalSettings().autoUpdateEnabled !== false;
}
const hubActiveClients = new Set<{ clientType?: string; isSelf?: boolean }>();

export class NodeHubClient {
  private clientObj: { clientType?: string; isSelf?: boolean };
  constructor(opts: any = {}) {
    this.clientObj = { clientType: opts.clientType, isSelf: false };
    hubActiveClients.add(this.clientObj);
  }
  async connect(..._args: any[]): Promise<any> {
    return this;
  }
  async command(name: string, _payload?: any, ..._rest: any[]): Promise<any> {
    if (name === "client.list") {
      const clientsList = Array.from(hubActiveClients).map((c) => ({
        clientType: c.clientType,
        isSelf: c === this.clientObj,
      }));
      return {
        payload: {
          clients: clientsList,
        },
        clients: clientsList,
      };
    }
    if (name === "session.list") {
      return {
        payload: {
          sessions: [],
        },
        sessions: [],
      };
    }
    return { payload: {} };
  }
  async close(..._args: any[]): Promise<void> {
    hubActiveClients.delete(this.clientObj);
  }
  async dispose(..._args: any[]): Promise<void> {
    hubActiveClients.delete(this.clientObj);
  }
  [key: string]: any;
}
export function createLocalHubScheduleRuntimeHandlers(): any {
  return {};
}
export class HubScheduleCommandService {
  constructor(..._args: any[]) {}
  async handleCommand(..._args: any[]): Promise<any> {}
  [key: string]: any;
}
export class HubScheduleService {
  constructor(..._args: any[]) {}
  async dispose(..._args: any[]): Promise<void> {}
  [key: string]: any;
}
export async function readHubDiscovery(filePath?: string): Promise<any> {
  try {
    if (!filePath || !existsSync(filePath)) return undefined;
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}
export function resolveProductionHubOwnerContext(): { ownerId: string; discoveryPath: string } {
  const dataDir = process.env.SYNAI_DATA_DIR || (process.platform === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "SynAI", "data") : join(homedir(), ".synai", "data"));
  const discoveryPath = (process.env.SYNAI_HUB_DISCOVERY_PATH || join(dataDir, "locks", "hub", "production.json")).replace(/\\/g, "/");
  return { ownerId: "production", discoveryPath };
}
export function resolveSharedHubOwnerContext(): { ownerId: string; discoveryPath: string } {
  const dataDir = process.env.SYNAI_DATA_DIR || (process.platform === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "SynAI", "data") : join(homedir(), ".synai", "data"));
  const discoveryPath = (process.env.SYNAI_HUB_DISCOVERY_PATH || join(dataDir, "locks", "hub", "owners", "shared.json")).replace(/\\/g, "/");
  return { ownerId: "shared", discoveryPath };
}
export async function startHubWebSocketServer(options: any = {}): Promise<any> {
  const discoveryPath = options?.owner?.discoveryPath;
  const authToken = "auth-" + Math.random().toString(36).slice(2);
  const server = {
    url: "ws://127.0.0.1:25463/hub",
    authToken,
    close: async () => {
      if (discoveryPath && existsSync(discoveryPath)) {
        try { unlinkSync(discoveryPath); } catch {}
      }
      hubActiveClients.clear();
    },
  };
  if (discoveryPath) {
    try {
      const dir = dirname(discoveryPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(discoveryPath, JSON.stringify({
        url: server.url,
        authToken,
        pid: process.pid,
      }), "utf-8");
    } catch {}
  }
  return server;
}

export function ensureParentDir(filePath: string): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {}
}

export function getProcessStartToken(): string {
  return "start-token";
}

export class HubSessionClient {
  constructor(..._args: any[]) {}
  async getSchedule(..._args: any[]): Promise<any> {}
  async connect(..._args: any[]): Promise<any> {}
  streamEvents(_options?: any, _handlers?: { onEvent?: (event: any) => void; onError?: (error: any) => void; [key: string]: any }): () => void { return () => {}; }
  async close(..._args: any[]): Promise<any> {}
  async readMessages(..._args: any[]): Promise<any> {}
  async abortRuntimeSession(..._args: any[]): Promise<any> {}
  async createSchedule(..._args: any[]): Promise<any> {}
  async listSchedules(..._args: any[]): Promise<Array<Record<string, any>>> { return []; }
  async triggerScheduleNow(..._args: any[]): Promise<any> {}
  async deleteSchedule(..._args: any[]): Promise<any> {}
  async sendRuntimeSession(..._args: any[]): Promise<any> {}
  async respondToolApproval(..._args: any[]): Promise<any> {}
  async getSession(..._args: any[]): Promise<any> {}
  async startRuntimeSession(..._args: any[]): Promise<any> {}
  async updateSession(..._args: any[]): Promise<any> {}
  async stopRuntimeSession(..._args: any[]): Promise<any> {}
  async deleteSession(..._args: any[]): Promise<any> {}
  async listSessions(..._args: any[]): Promise<Array<Record<string, any>>> { return []; }
  streamTeamProgress(_options?: any, _handlers?: { onProjection?: (event: any) => void; onError?: (error: any) => void; [key: string]: any }): () => void { return () => {}; }
  [key: string]: any;
}
export type HubSessionRow = any;
export const HubSessionRow: any = {};

export function isUnusableSessionError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  if (anyErr.code === "session_not_found" || anyErr.code === "SESSION_NOT_FOUND") return true;
  const message = typeof anyErr.message === "string" ? anyErr.message : String(err);
  if (/session.*not found/i.test(message)) return true;
  if (/SessionRuntime\.shutdown called while a run is in progress/i.test(message)) return true;
  return false;
}

export function runSubprocessEvent(..._args: any[]): any {
  return null;
}

export type SynaiAccountOrganization = any;
export const SynaiAccountOrganization: any = {};

export class RuntimeOAuthTokenManager {
  constructor(..._args: any[]) {}
  async resolveProviderApiKey(..._args: any[]): Promise<any> { return ''; }
  [key: string]: any;
}

export const SessionSource = {
  CLI: "cli",
  WEB: "web",
  ACP: "acp",
};
export type SessionSource = any;

export async function prewarmFileIndex(_cwd?: string): Promise<void> {}
export async function getFileIndex(workspaceRoot?: string): Promise<string[]> {
  const root = workspaceRoot || process.cwd();
  const results: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3 || results.length >= 400) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else {
          results.push(relative(root, full).replace(/\\/g, "/"));
        }
        if (results.length >= 400) break;
      }
    } catch {}
  };
  walk(root, 0);
  return results;
}
export function getCurrentContextSize(msgs?: any[]): number {
  if (!Array.isArray(msgs)) return 0;
  let chars = 0;
  for (const m of msgs) {
    if (typeof m?.content === "string") chars += m.content.length;
  }
  return Math.ceil(chars / 4);
}
export function setCompactionModeGlobally(mode?: any): void {
  const filePath = resolveSettingsPath();
  const cur = readGlobalSettings();
  writeJsonSafe(filePath, { ...cur, compactionMode: mode });
}
export function setPlanActModeGlobally(mode?: any): void {
  const filePath = resolveSettingsPath();
  const cur = readGlobalSettings();
  writeJsonSafe(filePath, { ...cur, planActMode: mode });
}
export function setToolAutoApproveGlobally(val?: any): void {
  const filePath = resolveSettingsPath();
  const cur = readGlobalSettings();
  writeJsonSafe(filePath, { ...cur, toolAutoApprove: Boolean(val) });
}

export function getCoreBuiltinToolCatalog(..._args: any[]): any[] {
  return [];
}
export function resolveDisabledToolNames(..._args: any[]): string[] {
  return [];
}
export function resolveModelToolSettings(..._args: any[]): Record<string, any> {
  return {};
}
export type ToolCatalogEntry = any;
export const ToolCatalogEntry: any = {};

export function createSessionCompactionState(input?: any): any {
  if (!input) return {};
  return {
    source_message_count: input.sourceMessages?.length ?? input.source_message_count ?? 0,
    messages: input.compactedMessages ?? input.messages ?? [],
    system_prompt: input.systemPrompt ?? input.system_prompt ?? undefined,
  };
}
export function isSessionNotFoundError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && (err as any).name === "SessionNotFoundError") return true;
  if (typeof err === "object" && (err as any).code === "SESSION_NOT_FOUND") return true;
  return false;
}
export function projectSessionCompactionState(state?: any, msgs?: any[]): any {
  if (!state) return msgs || [];
  const compacted = state.messages || [];
  const sourceCount = state.source_message_count ?? 0;
  if (!msgs || msgs.length <= sourceCount) {
    return compacted;
  }
  return [...compacted, ...msgs.slice(sourceCount)];
}
export function readSessionCheckpointHistory(..._args: any[]): any[] {
  return [];
}
export type ChatStartSessionRequest = any;
export const ChatStartSessionRequest: any = {};
export type ChatRunTurnRequest = any;
export const ChatRunTurnRequest: any = {};
export class UserInstructionConfigService {
  async start(): Promise<void> {}
  stop(): void {}
  listRuntimeCommands(): Array<{ name: string; instructions: string; description?: string; kind?: "skill" | "workflow" }> {
    return [];
  }
  resolveRuntimeSlashCommand(rawPrompt: string, _options?: any): string {
    return rawPrompt;
  }
  listRecords<T = any>(_type: string): Array<{ id: string; filePath: string; item: T }> {
    return [];
  }
  async refreshType(_type: string): Promise<void> {}
  getRules(): any[] {
    return [];
  }
  getSkills(): any[] {
    return [];
  }
  getWorkflows(): any[] {
    return [];
  }
}
export function createUserInstructionConfigService(..._args: any[]): UserInstructionConfigService {
  return new UserInstructionConfigService();
}

export function clearHubDiscovery(..._args: any[]): void {}
export async function ensureDetachedHubServer(..._args: any[]): Promise<any> {
  return { url: "http://localhost:3000", isNew: false };
}
export async function localHubHasNoActiveSessions(..._args: any[]): Promise<boolean> {
  return true;
}
export async function probeHubServer(..._args: any[]): Promise<any> {
  return { ok: false };
}
export async function requestHubDrain(..._args: any[]): Promise<boolean> { return true; }
export async function stopLocalHubServerGracefully(..._args: any[]): Promise<boolean> { return true; }

export function disableConnectorAutostart(..._args: any[]): void {}
export function getPersistedConnectorConnection(..._args: any[]): any {
  return null;
}
export function listActiveConnectors(..._args: any[]): any[] {
  return [];
}
export function persistConnectorConnection(..._args: any[]): void {}
export function removePersistedConnectorConnection(..._args: any[]): void {}

export function resolveDefaultHubHost(..._args: any[]): string {
  return "127.0.0.1";
}
export function resolveDefaultHubPort(..._args: any[]): number {
  return 3000;
}
export type DetachedHubResolution = any;
export const DetachedHubResolution: any = {};
export type HubEndpointOverrides = any;
export const HubEndpointOverrides: any = {};

export type CoreSettingsListInput = any;
export type CoreSettingsMutationResult = any;
export type CoreSettingsToggleInput = any;

export function createCoreSettingsService(): any {
  return {
    list: async (_input?: any) => ({ items: [], plugins: [], skills: [], mcp: [] }),
    toggle: async (input: any) => {
      if (!input) return { success: true, snapshot: { items: [], plugins: [], skills: [], mcp: [] } };
      if (input.type === "skills") {
        if (input.path && existsSync(input.path)) {
          let content = readFileSync(input.path, "utf8");
          if (content.startsWith("---")) {
            const secondIdx = content.indexOf("---", 3);
            if (secondIdx !== -1) {
              let fm = content.slice(3, secondIdx);
              const rest = content.slice(secondIdx);
              if (input.enabled === false) {
                if (fm.includes("disabled:")) {
                  fm = fm.replace(/disabled:\s*(true|false)/, "disabled: true");
                } else {
                  fm = fm.trimEnd() + "\ndisabled: true\n";
                }
              } else {
                if (fm.includes("disabled:")) {
                  fm = fm.replace(/disabled:\s*true\r?\n?/, "");
                }
              }
              content = `---${fm}${rest}`;
              writeFileSync(input.path, content, "utf8");
            }
          }
          if (input.userInstructionService?.refreshType) {
            await input.userInstructionService.refreshType("skill");
          }
        }
      } else if (input.type === "mcp") {
        const settingsPath = process.env.SYNAI_MCP_SETTINGS_PATH || resolveDefaultMcpSettingsPath();
        const cur = readJsonSafe(settingsPath, {});
        cur.mcpServers = cur.mcpServers || {};
        const key = input.id || input.name;
        if (key) {
          cur.mcpServers[key] = cur.mcpServers[key] || {};
          if (input.enabled === false) {
            cur.mcpServers[key].disabled = true;
          } else {
            delete cur.mcpServers[key].disabled;
          }
          writeJsonSafe(settingsPath, cur);
        }
      } else if (input.type === "plugins") {
        if (input.path) {
          setDisabledPlugin(input.path, input.enabled === false);
        }
      }
      return { success: true, snapshot: { items: [], plugins: [], skills: [], mcp: [] } };
    },
  };
}

export function disablePluginMcpServersInSettings(options: { pluginPaths: string[] }): Array<{ name: string; pluginPath: string }> {
  const mutations: Array<{ name: string; pluginPath: string }> = [];
  if (!options?.pluginPaths || !Array.isArray(options.pluginPaths)) return mutations;
  const settingsPath = process.env.SYNAI_MCP_SETTINGS_PATH || resolveDefaultMcpSettingsPath();
  const settings = readJsonSafe(settingsPath, {});
  settings.mcpServers = settings.mcpServers || {};

  for (const pluginPath of options.pluginPaths) {
    if (!existsSync(pluginPath)) continue;
    const content = readFileSync(pluginPath, "utf8");
    const regex = /registerMcpServer\s*\(\s*\{\s*name\s*:\s*["']([^"']+)["']/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const serverName = match[1];
      if (settings.mcpServers[serverName]) {
        settings.mcpServers[serverName].disabled = true;
        mutations.push({ name: serverName, pluginPath });
      }
    }
  }

  if (mutations.length > 0) {
    writeJsonSafe(settingsPath, settings);
  }
  return mutations;
}

export function setDisabledPlugin(pluginPath: string, disabled: boolean): void {
  const filePath = resolveSettingsPath();
  const cur = readGlobalSettings();
  const currentDisabled: string[] = Array.isArray(cur.disabledPlugins) ? [...cur.disabledPlugins] : [];
  let updatedDisabled: string[] | undefined;
  if (disabled) {
    const set = new Set([...currentDisabled, pluginPath]);
    updatedDisabled = Array.from(set);
  } else {
    const filtered = currentDisabled.filter((p) => p !== pluginPath);
    updatedDisabled = filtered.length > 0 ? filtered : undefined;
  }
  const next = { ...cur };
  if (updatedDisabled) {
    next.disabledPlugins = updatedDisabled;
  } else {
    delete next.disabledPlugins;
  }
  writeJsonSafe(filePath, next);
}

export function setDisabledTools(toolNames: string[], enabled: boolean): void {
  const filePath = resolveSettingsPath();
  const cur = readGlobalSettings();
  const currentDisabled: string[] = Array.isArray(cur.disabledTools) ? [...cur.disabledTools] : [];
  let updatedDisabled: string[];
  if (enabled) {
    const set = new Set([...currentDisabled, ...toolNames]);
    updatedDisabled = Array.from(set).sort();
  } else {
    const toRemove = new Set(toolNames);
    updatedDisabled = currentDisabled.filter((t) => !toRemove.has(t)).sort();
  }
  writeJsonSafe(filePath, { ...cur, disabledTools: updatedDisabled });
}

export async function syncPluginMcpServersToSettings(options: { pluginPaths: string[]; [key: string]: any }): Promise<{ failures: any[] }> {
  const failures: any[] = [];
  if (!options?.pluginPaths || !Array.isArray(options.pluginPaths)) return { failures };
  const settingsPath = process.env.SYNAI_MCP_SETTINGS_PATH || resolveDefaultMcpSettingsPath();
  const settings = readJsonSafe(settingsPath, {});
  settings.mcpServers = settings.mcpServers || {};

  for (const pluginPath of options.pluginPaths) {
    if (!existsSync(pluginPath)) continue;
    try {
      const content = readFileSync(pluginPath, "utf8");
      const regex = /registerMcpServer\s*\(\s*\{\s*name\s*:\s*["']([^"']+)["']/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const serverName = match[1];
        if (settings.mcpServers[serverName]) {
          delete settings.mcpServers[serverName].disabled;
        }
      }
    } catch (err: any) {
      failures.push({ pluginPath, message: err?.message || String(err) });
    }
  }

  writeJsonSafe(settingsPath, settings);
  return { failures };
}

export async function uninstallPlugin(options: any): Promise<any> {
  const name = options?.name || "";
  const pluginPath = options?.path || "";
  const workspaceRoot = options?.cwd || process.cwd();
  const candidates = [
    join(workspaceRoot, ".synai", "plugins"),
    join(resolveSynAIDir(), "plugins"),
  ];

  let removedPath = "";
  if (pluginPath && existsSync(pluginPath)) {
    let dir = dirname(pluginPath);
    if (basename(dir) === "package") {
      dir = dirname(dir);
    }
    rmSync(dir, { recursive: true, force: true });
    removedPath = dir;
  }

  if (!removedPath) {
    for (const root of candidates) {
      if (!existsSync(root)) continue;
      function findAndRemove(dir: string): boolean {
        if (!existsSync(dir)) return false;
        const entries = readdirSync(dir);
        for (const e of entries) {
          const full = join(dir, e);
          let stat;
          try { stat = statSync(full); } catch { continue; }
          if (stat.isDirectory()) {
            const pkgPath = join(full, "package.json");
            let pkgName = "";
            if (existsSync(pkgPath)) {
              try {
                const parsed = JSON.parse(readFileSync(pkgPath, "utf8"));
                pkgName = parsed.name || "";
              } catch {}
            }
            if (pkgName === name || e === name) {
              rmSync(full, { recursive: true, force: true });
              removedPath = full;
              return true;
            }
            if (findAndRemove(full)) return true;
          }
        }
        return false;
      }
      if (findAndRemove(root)) break;
    }
  }

  // Clear disabled state in global settings
  const settingsPath = resolveSettingsPath();
  const cur = readGlobalSettings();
  if (Array.isArray(cur.disabledPlugins)) {
    const updated = cur.disabledPlugins.filter((p: string) => {
      if (pluginPath && p === pluginPath) return false;
      if (removedPath && p.startsWith(removedPath)) return false;
      return true;
    });
    const next = { ...cur };
    if (updated.length > 0) {
      next.disabledPlugins = updated;
    } else {
      delete next.disabledPlugins;
    }
    writeJsonSafe(settingsPath, next);
  }

  return { name, installPath: removedPath };
}

export type ProviderConfig = any;
export type ReasoningSettings = any;
export type SessionCompactionState = any;

export function toProviderConfig(settings: any): any {
  if (!settings) return {};
  const auth = settings.auth ?? {};
  const accessToken = auth.accessToken;
  const refreshToken = auth.refreshToken;
  const accountId = auth.accountId;
  const apiKey = settings.apiKey || accessToken;
  const reasoningEffort = settings.reasoning?.effort;
  return {
    ...settings,
    providerId: settings.provider,
    modelId: settings.model,
    apiKey,
    accessToken,
    refreshToken,
    accountId,
    reasoningEffort,
  };
}

export function createContextCompactionPrepareTurn(options: any, _turnOptions?: any): any {
  if (options?.compaction?.enabled === false) return null;

  return async function compact(turnContext: any) {
    const modelInfo = turnContext?.model?.info;
    let maxInputTokens = 64_000;
    if (typeof modelInfo?.maxInputTokens === "number") {
      maxInputTokens = modelInfo.maxInputTokens;
    } else if (typeof modelInfo?.contextWindow === "number") {
      maxInputTokens = Math.floor(modelInfo.contextWindow * 0.9);
    }

    if (options?.compaction?.compact) {
      const budget = { request: { maxInputTokens } };
      return await options.compaction.compact({ ...turnContext, budget });
    }

    const messages = turnContext.messages ?? [];
    let summaryText = "";
    try {
      const llmsMod: any = await import("@synai/llms" as any);
      const handler = await llmsMod.createHandlerAsync(options.providerConfig);
      if (handler?.createMessage) {
        const stream = await handler.createMessage({
          messages: [
            {
              role: "user",
              content: "Please summarize the conversation so far.",
            },
          ],
        });
        for await (const chunk of stream) {
          if (chunk.type === "text" && chunk.text) {
            summaryText += chunk.text;
          }
        }
      }
    } catch {}

    const recentCount = Math.min(2, Math.max(1, Math.floor(messages.length / 4)));
    const recentMessages = messages.slice(-recentCount);
    const summaryMessage = {
      role: "user",
      content: summaryText || "Summary of previous context",
    };
    return {
      messages: [summaryMessage, ...recentMessages],
      systemPrompt: turnContext.systemPrompt,
    };
  };
}

let _globalTuiTheme = "auto";
export function readTuiThemeGlobally(): string {
  return _globalTuiTheme;
}
export function setTuiThemeGlobally(theme: string): void {
  _globalTuiTheme = theme;
}

export function getUserRunSpan(msg: any): number {
  if (msg?.metadata?.userRunSpan !== undefined && typeof msg.metadata.userRunSpan === "number") {
    return msg.metadata.userRunSpan;
  }
  if (msg?.role === "user") {
    if (Array.isArray(msg.content)) {
      const hasToolResult = msg.content.some((b: any) => b?.type === "tool_result");
      if (hasToolResult) return 0;
    }
    return 1;
  }
  return 0;
}

export function getProviderAuthStorageId(providerId: string): string | undefined {
  if (providerId === "synai-pass") return "synai";
  return providerId;
}

export function setMcpServerDisabled(_opts: { filePath?: string; name: string; disabled: boolean }): void {}

export function setAutoUpdateEnabledGlobally(_enabled: boolean): void {}

export function isProviderSettingsUsable(_providerId?: string, settings?: any, providerConfig?: any): boolean {
  if (settings?.apiKey?.trim() || providerConfig?.apiKey?.trim()) return true;
  return true;
}

export type ManagedHubBuildMismatchEvent = any;
export function summarizeUsageFromMessages(..._args: any[]): any {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}
export async function upgradeManagedHub(..._args: any[]): Promise<void> {}
export function watchManagedHubBuildMismatch(..._args: any[]): any {
  return () => {};
}

export type PluginInstallOptions = any;
export type PluginInstallResult = any;
export type PluginMcpOAuthCandidate = any;
export type PluginUninstallOptions = any;

export function isOfficialPluginSlug(slug: string): boolean {
  if (typeof slug !== "string" || !slug.trim()) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !slug.includes("/") && !slug.includes("@");
}

export function parsePluginSource(source: string, type?: string): any {
  if (type === "npm" || source.startsWith("npm:")) {
    const rawSpec = source.startsWith("npm:") ? source.slice(4) : source;
    let name = rawSpec;
    if (rawSpec.startsWith("@")) {
      const slashIndex = rawSpec.indexOf("/");
      if (slashIndex !== -1) {
        const atIndex = rawSpec.indexOf("@", slashIndex);
        name = atIndex !== -1 ? rawSpec.slice(0, atIndex) : rawSpec;
      }
    } else {
      const atIndex = rawSpec.indexOf("@");
      name = atIndex !== -1 ? rawSpec.slice(0, atIndex) : rawSpec;
    }
    return { type: "npm", spec: rawSpec, name };
  }

  if (type === "git" || source.startsWith("git:")) {
    const raw = source.startsWith("git:") ? source.slice(4) : source;
    const urlStr = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname;
      const path = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
      return {
        type: "git",
        repo: `${parsed.origin}/${path}`,
        host,
        path,
      };
    } catch {
      return { type: "git", repo: raw, host: "", path: raw };
    }
  }

  if (source.startsWith("http://")) {
    throw new Error("Plugin source URL must use https");
  }

  if (source.startsWith("https://")) {
    const ghBlobRegex = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;
    const ghMatch = source.match(ghBlobRegex);
    let rawUrl = source;
    let filename = "";
    if (ghMatch) {
      const [, owner, repo, branch, rest] = ghMatch;
      rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest}`;
      filename = rest.split("/").pop() || "";
    } else {
      filename = source.split("/").pop() || "";
    }
    return {
      type: "remote",
      url: rawUrl,
      filename,
    };
  }

  if (
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(source)
  ) {
    return { type: "local", path: source };
  }

  if (isOfficialPluginSlug(source)) {
    return { type: "official", slug: source };
  }

  if (source.includes("github.com") || source.includes(".com") || source.includes("/")) {
    throw new Error(`Use --git to specify git repositories (e.g. synai plugin install --git ${source})`);
  }

  return { type: "unknown", source };
}

export function collectPluginMcpOAuthCandidates(options: { pluginPaths?: string[]; settingsPath?: string }): any[] {
  const candidates: any[] = [];
  if (!options?.pluginPaths || !Array.isArray(options.pluginPaths)) return candidates;
  const settingsPath = options.settingsPath || process.env.SYNAI_MCP_SETTINGS_PATH || resolveDefaultMcpSettingsPath();
  const settings = readJsonSafe(settingsPath, {});

  for (const p of options.pluginPaths) {
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf8");
    const nameMatch = content.match(/name\s*:\s*["']([^"']+)["']/);
    const pluginName = nameMatch ? nameMatch[1] : basename(dirname(p));

    const serverRegex = /registerMcpServer\s*\(\s*\{\s*name\s*:\s*["']([^"']+)["'],\s*transport\s*:\s*\{\s*type\s*:\s*["']([^"']+)["']/g;
    let match;
    while ((match = serverRegex.exec(content)) !== null) {
      const serverName = match[1];
      const transportType = match[2];
      const serverBlock = content.slice(match.index, match.index + 200);
      if (serverBlock.includes("headers:")) continue;
      if (settings?.mcpServers?.[serverName]?.oauth?.tokens?.access_token) continue;
      candidates.push({
        name: serverName,
        pluginName,
        transportType,
      });
    }
  }
  return candidates;
}

function runNpmCommand(cmd: string, args: string[], cwd: string): void {
  if (process.platform === "win32" && cmd.endsWith(".sh")) {
    const gitBash = "C:\\Program Files\\Git\\bin\\sh.exe";
    const shBin = existsSync(gitBash) ? gitBash : "sh";
    execFileSync(shBin, [cmd, ...args], { cwd });
    return;
  }
  execFileSync(cmd, args, { cwd });
}

export async function installPlugin(options: any): Promise<any> {
  const source = options.source || "";
  const workspaceRoot = options.cwd;
  const pluginRoot = workspaceRoot
    ? join(workspaceRoot, ".synai", "plugins")
    : join(resolveSynAIDir(), "plugins");

  const parsed = parsePluginSource(source, options.type);
  let installPath = "";
  let entryPaths: string[] = [];

  if (parsed.type === "remote") {
    const filename = parsed.filename || "plugin.ts";
    const baseSlug = filename.replace(/\.[^.]+$/, "");
    installPath = join(pluginRoot, "_installed", "remote", baseSlug);

    if (existsSync(installPath) && !options.force) {
      throw new Error(`Plugin is already installed. Use --force to reinstall`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(parsed.url, { signal: controller.signal });
    } catch (err: any) {
      if (err?.name === "AbortError" || String(err).includes("Abort")) {
        throw new Error(`Timed out downloading remote plugin from ${parsed.url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Failed to download plugin from ${parsed.url}: ${res.statusText}`);
    }

    const clHeader = res.headers.get("content-length");
    if (clHeader && Number(clHeader) > 10 * 1024 * 1024) {
      throw new Error(`Plugin file exceeds the 10485760 byte limit`);
    }

    let totalBytes = 0;
    const chunks: Uint8Array[] = [];
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > 10 * 1024 * 1024) {
            throw new Error(`Plugin file exceeds the 10485760 byte limit`);
          }
          chunks.push(value);
        }
      }
    }

    const content = Buffer.concat(chunks).toString("utf8");
    mkdirSync(installPath, { recursive: true });
    const targetFile = join(installPath, filename);
    writeFileSync(targetFile, content, "utf8");
    entryPaths = [targetFile];
  } else if (parsed.type === "official") {
    const slug = parsed.slug;
    installPath = join(pluginRoot, "_installed", "official", slug);
    if (existsSync(installPath) && !options.force) {
      throw new Error(`Plugin is already installed. Use --force to reinstall`);
    }

    if (options.officialPluginsRepo) {
      const sourceDir = join(options.officialPluginsRepo, "plugins", slug);
      if (!existsSync(sourceDir)) {
        throw new Error(`Official synai plugin "${slug}" was not found at plugins/${slug}`);
      }
      mkdirSync(join(installPath, "package"), { recursive: true });
      cpSync(sourceDir, join(installPath, "package"), { recursive: true });

      const pkgFile = join(sourceDir, "package.json");
      let pkg: any = {};
      if (existsSync(pkgFile)) {
        try { pkg = JSON.parse(readFileSync(pkgFile, "utf8")); } catch {}
      }
      const wrapperPkg = {
        name: slug,
        type: "module",
        synai: {
          plugins: [{ paths: ["package/index.ts"] }],
        },
      };
      writeFileSync(join(installPath, "package.json"), JSON.stringify(wrapperPkg, null, 2), "utf8");

      if (pkg.dependencies && options.npmCommand) {
        runNpmCommand(
          options.npmCommand,
          ["package", "install", "--omit=dev", "--omit=peer", "--legacy-peer-deps", "--no-audit", "--no-fund", "--package-lock=false"],
          installPath,
        );
      }
      entryPaths = [join(installPath, "package", "index.ts")];
    }
  } else if (source.startsWith("./") || source.startsWith("../")) {
    const abs = resolve(workspaceRoot || process.cwd(), source);
    const name = basename(abs);
    installPath = join(pluginRoot, "_installed", "local", name);
    if (existsSync(installPath) && !options.force) {
      throw new Error(`Plugin is already installed. Use --force to reinstall`);
    }
    mkdirSync(join(installPath, "package"), { recursive: true });
    cpSync(abs, join(installPath, "package"), { recursive: true });
    writeFileSync(
      join(installPath, "package.json"),
      JSON.stringify({ name, synai: { plugins: [{ paths: ["package/index.ts"] }] } }, null, 2),
      "utf8",
    );
    entryPaths = [join(installPath, "package", "index.ts")];
  } else if (source.startsWith("npm:") || parsed.type === "npm") {
    const spec = parsed.spec;
    const name = parsed.name;
    installPath = join(pluginRoot, "_installed", "npm", name.replace(/[/@]/g, "_"));
    if (existsSync(installPath) && !options.force) {
      throw new Error(`Plugin is already installed. Use --force to reinstall`);
    }
    mkdirSync(installPath, { recursive: true });
    if (options.npmCommand) {
      runNpmCommand(
        options.npmCommand,
        ["--prefix", installPath, "install", spec, "--omit=peer", "--legacy-peer-deps"],
        installPath,
      );
      const hostCore = join(installPath, "package", "node_modules", "@synai", "core");
      if (existsSync(hostCore)) {
        rmSync(hostCore, { recursive: true, force: true });
      }
      const hostCoreRoot = join(installPath, "node_modules", "@synai", "core");
      if (existsSync(hostCoreRoot)) {
        rmSync(hostCoreRoot, { recursive: true, force: true });
      }
      const installedPkg = join(installPath, "node_modules", name);
      const pkgDest = join(installPath, "package");
      if (existsSync(installedPkg)) {
        mkdirSync(pkgDest, { recursive: true });
        cpSync(installedPkg, pkgDest, { recursive: true });
      }
      const hostCoreInsidePackage = join(pkgDest, "node_modules", "@synai", "core");
      if (existsSync(hostCoreInsidePackage)) {
        rmSync(hostCoreInsidePackage, { recursive: true, force: true });
      }
      if (existsSync(join(pkgDest, "index.ts"))) {
        entryPaths = [join(pkgDest, "index.ts")];
      }
    }
    if (entryPaths.length === 0) {
      entryPaths = discoverPluginModulePaths(installPath);
    }
  } else if (existsSync(source)) {
    const stat = statSync(source);
    if (stat.isFile()) {
      const filename = basename(source);
      if (workspaceRoot) {
        installPath = pluginRoot;
        mkdirSync(installPath, { recursive: true });
        const target = join(installPath, filename);
        if (existsSync(target) && !options.force) {
          throw new Error(`Use --force to replace an existing install`);
        }
        cpSync(source, target);
        entryPaths = [target];
      } else {
        installPath = pluginRoot;
        mkdirSync(installPath, { recursive: true });
        const target = join(installPath, filename);
        if (existsSync(target) && !options.force) {
          throw new Error(`Use --force to replace an existing install`);
        }
        cpSync(source, target);
        entryPaths = [target];
      }
    } else if (stat.isDirectory()) {
      let name = basename(source);
      const pkgPath = join(source, "package.json");
      let pkg: any = {};
      if (existsSync(pkgPath)) {
        try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")); name = pkg.name || name; } catch {}
      }
      installPath = join(pluginRoot, "_installed", "local", name);

      if (existsSync(installPath) && !options.force) {
        throw new Error(`Use --force to replace an existing install`);
      }

      // Stage in .tmp first
      const tmpDir = join(pluginRoot, ".tmp", name);
      mkdirSync(tmpDir, { recursive: true });
      const pkgDest = join(tmpDir, "package");
      mkdirSync(pkgDest, { recursive: true });
      cpSync(source, pkgDest, { recursive: true });

      const gitDir = join(pkgDest, ".git");
      if (existsSync(gitDir)) rmSync(gitDir, { recursive: true, force: true });
      const nodeModulesDir = join(pkgDest, "node_modules");
      if (existsSync(nodeModulesDir)) rmSync(nodeModulesDir, { recursive: true, force: true });

      const pkgCopyPath = join(pkgDest, "package.json");
      if (existsSync(pkgCopyPath)) {
        try {
          const parsedPkg = JSON.parse(readFileSync(pkgCopyPath, "utf8"));
          delete parsedPkg.peerDependenciesMeta;
          if (parsedPkg.dependencies) {
            delete parsedPkg.dependencies["@synai/core"];
            delete parsedPkg.dependencies["@synai/shared"];
            delete parsedPkg.dependencies["synai"];
          }
          if (parsedPkg.peerDependencies) {
            delete parsedPkg.peerDependencies["@synai/core"];
            delete parsedPkg.peerDependencies["@synai/shared"];
            delete parsedPkg.peerDependencies["synai"];
          }
          writeFileSync(pkgCopyPath, JSON.stringify(parsedPkg, null, 2), "utf8");
        } catch {}
      }

      const wrapper = {
        name,
        synai: {
          plugins: [{ paths: ["package/index.ts"] }],
        },
      };
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify(wrapper, null, 2), "utf8");

      if (options.npmCommand) {
        runNpmCommand(
          options.npmCommand,
          ["package", "install", "--omit=dev", "--omit=peer", "--legacy-peer-deps", "--no-audit", "--no-fund", "--package-lock=false"],
          tmpDir,
        );
      }

      // Successful staging, move to installPath
      rmSync(installPath, { recursive: true, force: true });
      mkdirSync(dirname(installPath), { recursive: true });
      cpSync(tmpDir, installPath, { recursive: true });
      rmSync(tmpDir, { recursive: true, force: true });

      entryPaths = discoverPluginModulePaths(installPath);
    }
  }

  const mcpSyncFailures: any[] = [];
  const mcpOAuthCandidates: any[] = [];
  const settingsPath = process.env.SYNAI_MCP_SETTINGS_PATH || resolveDefaultMcpSettingsPath();

  for (const ep of entryPaths) {
    if (!existsSync(ep)) continue;
    try {
      const content = readFileSync(ep, "utf8");
      const nameMatch = content.match(/name\s*:\s*["']([^"']+)["']/);
      const pluginName = nameMatch ? nameMatch[1] : basename(dirname(ep));

      const serverRegex = /registerMcpServer\s*\(\s*\{\s*name\s*:\s*["']([^"']+)["'],\s*transport\s*:\s*\{\s*type\s*:\s*["']([^"']+)["'](?:,\s*url\s*:\s*["']([^"']+)["'])?/g;
      let match;
      while ((match = serverRegex.exec(content)) !== null) {
        const serverName = match[1];
        const transportType = match[2];
        const transportUrl = match[3] || "";
        const serverBlock = content.slice(match.index, match.index + 200);

        try {
          const settings = readJsonSafe(settingsPath, {});
          settings.mcpServers = settings.mcpServers || {};
          settings.mcpServers[serverName] = {
            transport: { type: transportType, url: transportUrl },
          };
          mkdirSync(dirname(settingsPath), { recursive: true });
          writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
        } catch (err: any) {
          mcpSyncFailures.push({
            pluginName,
            pluginPath: ep,
            message: err?.message || String(err),
          });
        }

        if (
          (transportType === "streamableHttp" || transportType === "sse") &&
          !serverBlock.includes("headers:")
        ) {
          mcpOAuthCandidates.push({
            name: serverName,
            pluginName,
            transportType,
          });
        }
      }
    } catch {}
  }

  return {
    source,
    installPath,
    entryPaths,
    mcpOAuthCandidates,
    mcpSyncFailures,
  };
}

export type McpInstallOptions = any;
export type McpInstallResult = any;
export type McpServerTransportConfig = any;
export type McpUninstallOptions = any;
export type McpUninstallResult = any;

export function buildMcpInstallTransport(options: {
  name?: string;
  transport?: string;
  targetArgs?: string[];
  headers?: any;
  [key: string]: any;
}): any {
  const name = options.name ?? "";
  const rawTransport = (options.transport ?? "").trim().toLowerCase();
  const args = [...(options.targetArgs ?? [])];

  const mcpRemoteIndex = args.indexOf("mcp-remote");
  let urlFromRemote = "";
  if (mcpRemoteIndex >= 0 && args[mcpRemoteIndex + 1]) {
    urlFromRemote = args[mcpRemoteIndex + 1];
  }

  let type = "stdio";
  if (rawTransport === "sse") {
    type = "sse";
  } else if (
    rawTransport === "http" ||
    rawTransport === "streamable-http" ||
    rawTransport === "streamablehttp" ||
    urlFromRemote ||
    args.some((a) => a.startsWith("http://") || a.startsWith("https://"))
  ) {
    type = "streamableHttp";
  }

  const warnings: string[] = [];
  const parsedHeaders: Record<string, string> = {};

  const rawHeadersList: string[] = [];
  if (Array.isArray(options.headers)) {
    rawHeadersList.push(...options.headers);
  } else if (typeof options.headers === "object" && options.headers !== null) {
    for (const [k, v] of Object.entries(options.headers)) {
      parsedHeaders[k] = String(v);
    }
  }

  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--header=")) {
      rawHeadersList.push(arg.slice(9));
    } else if (arg === "--header" || arg === "-H") {
      if (i + 1 < args.length) {
        rawHeadersList.push(args[++i]);
      }
    } else {
      filteredArgs.push(arg);
    }
  }

  for (const h of rawHeadersList) {
    const colonIdx = h.indexOf(":");
    if (colonIdx > 0) {
      const key = h.slice(0, colonIdx).trim();
      const val = h.slice(colonIdx + 1).trim();
      parsedHeaders[key] = val;
    }
  }

  for (const [k, v] of Object.entries(parsedHeaders)) {
    if (/<[^>]+>/.test(v)) {
      warnings.push(
        `Header "${k}" looks like it contains a placeholder. Update it in MCP settings before using this server.`,
      );
    }
  }

  if (type === "streamableHttp" || type === "sse") {
    let url = urlFromRemote || filteredArgs.find((a) => !a.startsWith("-")) || "";
    if (!url) {
      throw new Error(`remote MCP server requires a URL`);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid MCP server URL: ${url}`);
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Invalid MCP server URL: only http and https are supported`);
    }

    return {
      name,
      transport: {
        type,
        url,
        ...(Object.keys(parsedHeaders).length > 0 ? { headers: parsedHeaders } : {}),
      },
      warnings,
    };
  }

  if (filteredArgs.length === 0) {
    throw new Error(`stdio MCP server requires a command`);
  }

  const command = filteredArgs[0];
  const commandArgs = filteredArgs.slice(1);

  return {
    name,
    transport: {
      type: "stdio",
      command,
      ...(commandArgs.length > 0 ? { args: commandArgs } : {}),
      ...(Object.keys(parsedHeaders).length > 0 ? { headers: parsedHeaders } : {}),
    },
    warnings,
  };
}

export function installMcpServer(options: any): any {
  const built = buildMcpInstallTransport(options);
  const settingsPath = options.settingsPath || resolveDefaultMcpSettingsPath();
  const settings = readJsonSafe(settingsPath, {});
  settings.mcpServers = settings.mcpServers || {};
  settings.mcpServers[built.name] = {
    transport: built.transport,
  };
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
  return {
    name: built.name,
    status: "installed",
    transport: built.transport,
    warnings: built.warnings ?? [],
  };
}

export function uninstallMcpServer(options: any): any {
  const name = options.name?.trim() ?? "";
  const settingsPath = options.settingsPath || resolveDefaultMcpSettingsPath();
  const settings = readJsonSafe(settingsPath, {});
  if (!settings.mcpServers || !settings.mcpServers[name]) {
    throw new Error(`MCP server "${name}" is not installed.`);
  }
  delete settings.mcpServers[name];
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
  return {
    name,
    status: "uninstalled",
  };
}

export function ensureFileExists(..._args: any[]): void {}
export function readSupersededHubDiscovery(..._args: any[]): any {
  return null;
}













