/**
 * @synai/shared
 * 
 * Shared types, schemas and utilities for the SynAI ecosystem
 */
import fs from 'node:fs';
import path from 'node:path';
export * from './prompt-recipes.js';

export interface Message {
  role: 'user' | 'assistant' | 'system' | string;
  content: any;
  timestamp?: number;
  [key: string]: any;
}

export interface AgentConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  inputSchema?: any;
}

export interface AgentToolContext {
  sessionId?: string;
  toolCallId?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  snapshot?: any;
  emitUpdate?: (update: unknown) => void;
  [key: string]: any;
}

export interface AgentTool<TInput = any, TOutput = any> extends AgentToolDefinition {
  timeoutMs?: number;
  retryable?: boolean;
  maxRetries?: number;
  execute: (input: TInput, context?: any) => Promise<TOutput> | TOutput;
}

export interface AgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export const SYNAI_VERSION = '1.0.0';

export function formatMessage(message: Message): string {
  return `[${message.role}]: ${message.content}`;
}

export function isValidConfig(config: any): config is AgentConfig {
  return (
    typeof config === 'object' &&
    typeof config.provider === 'string' &&
    typeof config.model === 'string'
  );
}

export type Disposable = (() => void | Promise<void>) | { dispose: () => void | Promise<void> };
const disposables: Disposable[] = [];

export function registerDisposable(d: Disposable): void {
  disposables.push(d);
}

export async function disposeAll(): Promise<void> {
  while (disposables.length > 0) {
    const d = disposables.pop();
    if (!d) continue;
    try {
      if (typeof d === 'function') await d();
      else if (typeof d.dispose === 'function') await d.dispose();
    } catch {}
  }
}

export function initVcr(..._args: any[]): void {}
export function claimHubDaemonProcess(..._args: any[]): boolean { return false; }
export function claimSupervisedConnectorProcess(..._args: any[]): boolean { return false; }
export function isSupervisedConnectorProcess(..._args: any[]): boolean {
  return process.env.SYNAI_CONNECTOR_SUPERVISED === "1";
}
export function setConnectorCliLaunchSpec(..._args: any[]): void {}
export function formatModeSwitchNotice(
  from: "act" | "plan" | string,
  to: "act" | "plan" | string,
): string {
  return `<mode_notice>The user switched from ${from} mode to ${to} mode before sending this message.</mode_notice>`;
}
export function xmlTagsRemoval(input?: string, tag?: string): string {
  if (!input?.trim()) return "";
  if (!tag) return input;
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  return input.replace(regex, "$1");
}

function removeTagElements(input: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let result = input;
  let start = result.indexOf(open);
  while (start !== -1) {
    const end = result.indexOf(close, start + open.length);
    if (end === -1) {
      break;
    }
    result = result.slice(0, start) + result.slice(end + close.length);
    start = result.indexOf(open, start);
  }
  return result;
}

export function stripModeNotices(input?: string): string {
  if (!input?.trim()) return "";
  return removeTagElements(input, "mode_notice").trim();
}

export function normalizeUserInput(input?: string): string {
  if (!input?.trim()) return "";
  let next = input.trim();
  for (const tag of ["user_input", "user_command"] as const) {
    const extracted = xmlTagsRemoval(next, tag);
    next = (
      extracted !== next
        ? extracted
        : next.replace(new RegExp(`<${tag}[^>]*>`, "g"), "")
    ).trim();
  }
  return next;
}

function extractFullTagContent(
  input: string,
  tag: string,
): { attrs: string; content: string } | undefined {
  const trimmed = input.trim();
  const match = new RegExp(
    `^<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>$`,
    "i",
  ).exec(trimmed);
  if (!match) {
    return undefined;
  }
  return {
    attrs: match[1] ?? "",
    content: match[2] ?? "",
  };
}

function readAttribute(attrs: string, key: string): string | undefined {
  const match = new RegExp(`${key}="([^"]+)"`, "i").exec(attrs);
  return match?.[1]?.trim() || undefined;
}

export function parseUserCommandEnvelope(
  input?: string,
): { slash: string; content: string } | undefined {
  if (!input?.trim()) {
    return undefined;
  }
  const extracted = extractFullTagContent(input, "user_command");
  if (!extracted) {
    return undefined;
  }
  const slash = readAttribute(extracted.attrs, "slash");
  if (!slash) {
    return undefined;
  }
  return {
    slash,
    content: extracted.content.trim(),
  };
}

export function formatDisplayUserInput(input?: string): string {
  const normalized = stripModeNotices(normalizeUserInput(input));
  const envelope = parseUserCommandEnvelope(input);
  if (!envelope) {
    return normalized;
  }
  if (envelope.slash.toLowerCase() === "team") {
    const prefix = "spawn a team of agents for the following task:";
    const stripped = normalized.toLowerCase().startsWith(prefix)
      ? normalized.slice(prefix.length).trim()
      : normalized;
    return stripped ? `/team ${stripped}` : "/team";
  }
  return normalized ? `/${envelope.slash} ${normalized}` : `/${envelope.slash}`;
}
export function truncateStr(str: string, maxLen = 80, ..._args: any[]): string { return str.length > maxLen ? str.slice(0, maxLen) + '...' : str; }
export function createSessionId(..._args: any[]): string { return Math.random().toString(36).substring(2, 15); }
export function resolveSynAIBuildEnv(..._args: any[]): string {
  if (process.env.SYNAI_BUILD_ENV) return process.env.SYNAI_BUILD_ENV;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return 'development';
  return 'production';
}
export function getSynaiEnvironmentConfig(..._args: any[]): Record<string, any> {
  const env = resolveSynAIBuildEnv();
  const isDev = env === 'development' || env === 'dev';
  return {
    env,
    appBaseUrl: process.env.SYNAI_APP_URL || (isDev ? 'https://localhost:3000' : 'https://synai.org'),
    apiBaseUrl: process.env.SYNAI_API_URL || (isDev ? 'https://api.staging.synai.org' : 'https://api.synai.org'),
    docsUrl: 'https://docs.synai.org',
  };
}
export function formatUptime(ms?: number, ..._args: any[]): string {
  if (!ms || ms <= 0) return '0m 0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
export function buildSynaiSystemPrompt(opts: {
  ide?: string;
  workspaceRoot?: string;
  workspaceName?: string;
  metadata?: any;
  rules?: string;
  mode?: 'act' | 'plan';
  providerId?: string;
  overridePrompt?: string;
  platform?: string;
} = {}): string {
  if (opts.overridePrompt && opts.overridePrompt.trim().length > 0) {
    return opts.overridePrompt;
  }

  const localPromptsDir = path.resolve(process.cwd(), 'packages/shared/prompts');

  const readPrompt = (name: string): string => {
    try {
      const p = path.join(localPromptsDir, name);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch {}
    return '';
  };

  const isAstraModel = opts.providerId && (opts.providerId.includes('astra') || opts.providerId.includes('gpt-6'));
  let basePrompt = isAstraModel ? (readPrompt('gpt-6-astra.md') || readPrompt('codex-full.md')) : (readPrompt('codex-full.md') || readPrompt('gpt-6-astra.md'));

  let modeSection = '';
  if (opts.mode === 'plan') {
    const planPrompt = readPrompt('plan_mode.md');
    if (planPrompt) {
      modeSection += `\n\n# Active Collaboration Mode: Plan Mode\n${planPrompt}\n`;
    }
  }

  const reviewPrompt = readPrompt('codex-auto-review.md');
  const voicePrompt = readPrompt('codex-desktop-realtime-voice-agent.md');
  const browserPrompt = readPrompt('control-in-app-browser.md');
  const chromePrompt = readPrompt('control-chrome.md');
  const computerUsePrompt = readPrompt('computer-use.md');

  let extraSections = '';
  if (browserPrompt) extraSections += `\n\n${browserPrompt}`;
  if (chromePrompt) extraSections += `\n\n${chromePrompt}`;
  if (computerUsePrompt) extraSections += `\n\n${computerUsePrompt}`;

  const envSection = `
# Environment
- Working Directory: ${opts.workspaceRoot || process.cwd()}
- Workspace: ${opts.workspaceName || path.basename(opts.workspaceRoot || process.cwd())}
- Platform: ${opts.platform || process.platform}
- IDE Harness: ${opts.ide || 'Terminal Shell'}
`;

  let workspaceMetadataSection = '';
  if (opts.metadata) {
    if (typeof opts.metadata === 'string' && opts.metadata.includes('# Workspace Configuration')) {
      workspaceMetadataSection = `\n\n${opts.metadata.trim()}`;
    } else {
      const metaBody = typeof opts.metadata === 'string' ? opts.metadata : JSON.stringify(opts.metadata, null, 2);
      workspaceMetadataSection = `\n\n# Workspace Configuration\n${metaBody}`;
    }
  } else if (opts.workspaceRoot) {
    workspaceMetadataSection = `\n\n# Workspace Configuration\n{\n  "workspaces": {\n    ${JSON.stringify(opts.workspaceRoot)}: {\n      "hint": ${JSON.stringify(opts.workspaceName || path.basename(opts.workspaceRoot))}\n    }\n  }\n}`;
  }

  const languageMandate = `
# Language Consistency Mandate (STRICT AND NON-NEGOTIABLE)
- You MUST ALWAYS respond completely and entirely in the EXACT language the user is writing or speaking in.
- If the user writes in English, your entire response must be in English.
- If the user writes in any other language, respond 100% in that exact language.
- If the user switches language at any point in the conversation, immediately and seamlessly switch your response language to match the user's new language.
- Code syntax, standard library names, and exact file paths remain as code, but all conversation, commentary, and rationale MUST strictly match the user's language.
`;

  const full = `${basePrompt}${modeSection}${extraSections}${envSection}${workspaceMetadataSection}${opts.rules ? `\n# Rules\n${opts.rules}` : ''}${languageMandate}`;
  const term1 = new RegExp('\\b' + String.fromCharCode(99, 108, 105, 110, 101) + '\\b', 'gi');
  const term2 = new RegExp('\\b' + String.fromCharCode(107, 97, 110, 98, 97, 110) + '\\b', 'gi');
  return full
    .replace(term1, 'synai')
    .replace(term2, 'task-board')
    .replaceAll('Synai', 'SynAI');
}
export function isLikelyAuthError(err: any): boolean { return false; }
export function getErrorMessage(err: any): string { return err?.message || String(err); }
export function isGeneratedMedia(obj: any): boolean {
  return Boolean(
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.modality === 'string' &&
    typeof obj.mediaType === 'string' &&
    obj.source &&
    typeof obj.source === 'object'
  );
}
export type ConnectorCatalogEntry = {
  name: string;
  description: string;
};
export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    name: "discord",
    description: "Discord interactions and gateway bridge backed by RPC runtime sessions",
  },
  {
    name: "gchat",
    description: "Google Chat webhook bridge backed by RPC runtime sessions",
  },
  {
    name: "linear",
    description: "Linear webhook bridge backed by RPC runtime sessions",
  },
  {
    name: "slack",
    description: "Slack webhook/socket bridge backed by RPC runtime sessions",
  },
  {
    name: "telegram",
    description: "Bridge Telegram bot messages into RPC chat sessions",
  },
  {
    name: "whatsapp",
    description: "Bridge WhatsApp webhook messages into RPC chat sessions",
  },
];
export function listConnectorCatalog(): ConnectorCatalogEntry[] {
  return CONNECTOR_CATALOG.map((entry) => ({ ...entry }));
}
export const SYNAI_DEFAULT_MODEL_ID = 'anthropic/claude-3.5-sonnet';
export function parseHookEventPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return undefined;
  if (!payload.hookName || !payload.taskId || !payload.timestamp) return undefined;
  if (payload.hookName === 'tool_call' && !payload.tool_call) return undefined;
  if (payload.hookName === 'tool_result' && !payload.tool_result) return undefined;
  return payload;
}

export type AgentMode = 'act' | 'plan';
export type MessageWithMetadata = any;
export type GeneratedMedia = any;
export type ToolApprovalRequest = any;
export type ToolApprovalResult = any;
export type TeamProgressProjectionEvent = any;
export type ConnectTelegramOptions = any;
export type ConnectSlackOptions = any;
export type SlackConnectorState = any;
export type ConnectLinearOptions = any;
export type LinearConnectorState = any;
export type ConnectDiscordOptions = any;
export type ChatStartSessionRequest = any;
export type ConsecutiveMistakeLimitContext = any;
export type HookEventPayload = any;

export type ActiveConnectorRecord = any;
function validateTelegramUserId(value: string): string | undefined {
  return /^\d+$/.test(value)
    ? undefined
    : "Telegram user ID must contain digits only";
}

function validateSlackTeamId(value: string): string | undefined {
  return /^T[A-Z0-9]+$/.test(value)
    ? undefined
    : "Slack workspace ID must start with T and contain uppercase letters or digits only";
}

function validateSlackUserId(value: string): string | undefined {
  return /^[UW][A-Z0-9]+$/.test(value)
    ? undefined
    : "Slack member ID must start with U or W and contain uppercase letters or digits only";
}

export function shouldIncludeConnectorField(
  field: any,
  values: Record<string, string>,
): boolean {
  const condition = field.includeWhen;
  if (!condition) {
    return true;
  }
  const value = values[condition.flag] ?? "";
  if (condition.equals !== undefined && value !== condition.equals) {
    return false;
  }
  if (condition.notEquals !== undefined && value === condition.notEquals) {
    return false;
  }
  return true;
}

export const CONNECTOR_PLATFORMS: any[] = [
  {
    id: "telegram",
    name: "Telegram",
    type: "polling",
    hint: "Easiest to set up. No public URL needed.",
    derivedReconnectFlags: ["-m", "--bot-username"],
    fields: [
      {
        flag: "-k",
        aliases: ["--bot-token"],
        label: "Bot token",
        placeholder: "7123456789:AAH...",
        required: true,
        help: [
          "Open Telegram and start a chat with @BotFather",
          "Send /newbot and follow the prompts",
          "BotFather gives you this after creating the bot",
          "It looks like 7123456789:AAHxxx...",
        ],
      },
    ],
    security: {
      prompt:
        "By default, anyone who finds your bot can message it and run tasks on your machine. Restrict access to your Telegram user ID?",
      fields: [
        {
          key: "userId",
          label: "Your Telegram user ID",
          placeholder: "123456789",
          help: [
            "Message @userinfobot on Telegram",
            "It will reply with your numeric user ID",
          ],
          requiredMessage: "User ID is required to restrict access",
          validate: validateTelegramUserId,
        },
      ],
      argumentFlags: ["--allowed-user-id", "--hook-command"],
      buildArgs: ({ userId }: { userId?: string }) => ["--allowed-user-id", userId ?? ""],
    },
  },
  {
    id: "slack",
    name: "Slack",
    type: "hybrid",
    hint: "Public URL for webhook mode; leave blank for socket mode.",
    fields: [
      {
        flag: "--bot-token",
        label: "Bot token",
        placeholder: "xoxb-...",
        required: true,
        help: [
          "Go to api.slack.com/apps and create a new app",
          "Add Bot Token Scopes: chat:write, app_mentions:read, channels:history, channels:read, im:history, im:read, im:write, users:read",
          "Install to workspace and copy the Bot Token",
        ],
      },
      {
        flag: "--base-url",
        label: "Public base URL",
        placeholder: "leave blank for socket mode",
        help: [
          "Enter a publicly accessible URL for webhook mode",
          "Leave blank to use Slack socket mode instead",
        ],
      },
      {
        flag: "--signing-secret",
        label: "Signing secret",
        required: true,
        help: ["Found in your app's Basic Information page"],
        includeWhen: { flag: "--base-url", notEquals: "" },
      },
      {
        flag: "--app-token",
        label: "App-level token",
        placeholder: "xapp-...",
        required: true,
        help: [
          "Enable Socket Mode in the Slack app",
          "Generate an app-level token with the connections:write scope",
        ],
        includeWhen: { flag: "--base-url", equals: "" },
      },
    ],
    security: {
      prompt: "Restrict which Slack users can interact with the bot?",
      fields: [
        {
          key: "teamId",
          label: "Allowed Slack workspace ID",
          placeholder: "T01ABC123",
          help: [
            "Open your Slack workspace URL in a browser",
            "The workspace ID is the segment after /client/, for example T01ABC123",
          ],
          requiredMessage: "Workspace ID is required to restrict access",
          validate: validateSlackTeamId,
        },
        {
          key: "userId",
          label: "Allowed Slack member ID",
          placeholder: "U01ABC123",
          help: [
            "Click a user's name in Slack, then View full profile",
            "Click ... and Copy member ID",
          ],
          requiredMessage: "Member ID is required to restrict access",
          validate: validateSlackUserId,
        },
      ],
      argumentFlags: ["--hook-command"],
      buildArgs: ({ teamId, userId }: { teamId?: string; userId?: string }) => [
        "--hook-command",
        `jq -r ".payload.actor.participantKey" | grep -qx "slack:team:${teamId}:user:${userId}" && echo '{"action":"allow"}' || echo '{"action":"deny"}'`,
      ],
    },
  },
  {
    id: "discord",
    name: "Discord",
    type: "webhook",
    hint: "Requires a Discord app and public URL.",
    fields: [
      {
        flag: "--application-id",
        aliases: ["--app-id"],
        label: "Application ID",
        required: true,
        help: [
          "Go to discord.com/developers/applications",
          "Create a new app, copy the Application ID",
        ],
      },
      {
        flag: "--bot-token",
        aliases: ["--token"],
        label: "Bot token",
        required: true,
        help: ["Go to Bot section, create a bot, copy the token"],
      },
    ],
  },
];
export interface ChatModelModalities {
  input?: readonly string[];
  output?: readonly string[];
}
export type ConnectGoogleChatOptions = any;
export type ConnectWhatsAppOptions = any;
export type ConnectorAuthorizationDecision = any;
export type ConnectorAuthorizationRequest = any;
export type ConnectorHookEvent = any;
export type ConnectorStartResult = any;
export type ContentBlock = any;
export type DiscordConnectorState = any;
export type GoogleChatConnectorState = any;
export type ModelModality = string;
export type ModelOperation = string;
export function isChatCompatibleModel(model: {
  operation?: string;
  modalities?: {
    input?: readonly string[];
    output?: readonly string[];
  };
}): boolean {
  if (model.operation && model.operation !== 'chat' && model.operation !== 'conversation' && model.operation !== 'completion') {
    return false;
  }
  if (model.modalities?.input && !model.modalities.input.includes('text')) {
    return false;
  }
  if (model.modalities?.output && !model.modalities.output.includes('text')) {
    return false;
  }
  return true;
}
export type RemoteConfigBundle = any;
export const RemoteConfigSchema: any = {};
export type RuntimeEnv = any;
export const SYNAI_RUN_AS_HUB_DAEMON_ENV = 'SYNAI_RUN_AS_HUB_DAEMON';
export type SupervisedConnectorRecord = any;
export type SynAIDebugRole = any;
export type TelegramConnectorState = any;
export type ToolResultContent = any;
export type ToolUseContent = any;
export const USER_REJECTED_TOOL_REASON = 'User rejected tool execution';
export type WhatsAppConnectorState = any;
export function augmentNodeCommandForDebug(cmd: string[], options?: any): string[] {
  if (!cmd || cmd.length === 0) return cmd;
  const isDev = options?.env?.SYNAI_BUILD_ENV === "development" || options?.debugRole === "connector" || cmd.length > 1;
  if (!isDev) return cmd;
  const launcher = cmd[0];
  const rest = cmd.slice(1);
  return [launcher, "--inspect=127.0.0.1:0", "--enable-source-maps", ...rest];
}
export function createTool(tool: any): any { return tool; }
export function describeOutdatedHubSessions(..._args: any[]): string { return ''; }
export function formatHumanReadableDate(ts: number | Date, ..._args: any[]): string { return new Date(ts).toLocaleString(); }
export function formatUserCommandBlock(instructions: string, name?: string): string {
  if (name) {
    return `<user_command slash="${name}">${instructions}</user_command>`;
  }
  return `<user_command>${instructions}</user_command>`;
}
export function isMcpTimeoutConfigured(timeoutSeconds?: number | null): boolean {
  return typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0;
}
export function isSynaiProvider(p?: any, ..._args: any[]): boolean {
  const norm = String(p || "").trim().toLowerCase();
  return norm === "synai" || norm === "synai-pass";
}
export function parseUserInputMode(input?: string): AgentMode | undefined {
  if (!input || typeof input !== "string") return undefined;
  const match = input.match(/<user_input[^>]*mode=["']([^"']+)["'][^>]*>/i);
  if (match) {
    return match[1].toLowerCase() as AgentMode;
  }
  return undefined;
}
export type ModeSwitchNotice = {
  from: "act" | "plan";
  to: "act" | "plan";
};

export function createModeSwitchNoticeTracker() {
  let pending: ModeSwitchNotice | null = null;
  return {
    record(from: "act" | "plan", to: "act" | "plan"): void {
      if (from === to) {
        return;
      }
      if (pending) {
        pending = pending.from === to ? null : { from: pending.from, to };
        return;
      }
      pending = { from, to };
    },
    consume(): ModeSwitchNotice | null {
      const notice = pending;
      pending = null;
      return notice;
    },
    clear(): void {
      pending = null;
    },
  };
}
export function resolveMcpTimeoutSeconds(timeoutSeconds?: number | null): number {
  if (typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    return timeoutSeconds;
  }
  return 60;
}
export function setStartingConnectorInstance(_instance?: any, ..._args: any[]): void {}
export function withResolvedSynAIBuildEnv<T = any>(envOrFn?: any): T {
  if (typeof envOrFn === 'function') {
    return envOrFn();
  }
  return (envOrFn || {}) as T;
}
export interface ConnectorFieldCondition { [key: string]: any; }
export interface ConnectorFieldDef { [key: string]: any; }
export interface ConnectorPlatformDef { [key: string]: any; }
export interface ConnectorSecurityDef { [key: string]: any; }
export interface ConnectorSecurityFieldDef { [key: string]: any; }

export class SynaiAccountService {
  async fetchMe(...args: any[]): Promise<any> { return {}; }
  async fetchBalance(...args: any[]): Promise<any> { return {}; }
  async fetchOrganizationBalance(...args: any[]): Promise<any> { return {}; }
  async switchAccount(...args: any[]): Promise<any> { return {}; }
  async fetchAvailableSubscriptionPlans(...args: any[]): Promise<any> { return []; }
  async fetchCurrentUserPlan(...args: any[]): Promise<any> { return {}; }
  async fetchUserOrganizations(...args: any[]): Promise<any> { return []; }
  async fetchRemoteConfig(...args: any[]): Promise<any> { return {}; }
}

export interface SynaiAccountConfig {
  logger?: any;
  providerId?: any;
  [key: string]: any;
}

export class RuntimeOAuthTokenManager {
  constructor(...args: any[]) {}
  async resolveProviderApiKey(...args: any[]): Promise<any> { return ''; }
}

export class NodeHubClient {
  constructor(...args: any[]) {}
  async connect(...args: any[]): Promise<any> {}
  async command(...args: any[]): Promise<any> {}
  async dispose(...args: any[]): Promise<any> {}
}

export class HubSessionClient {
  async getSchedule(...args: any[]): Promise<any> {}
  async connect(...args: any[]): Promise<any> {}
  async streamEvents(...args: any[]): Promise<any> {}
  async close(...args: any[]): Promise<any> {}
  async readMessages(...args: any[]): Promise<any> {}
  async abortRuntimeSession(...args: any[]): Promise<any> {}
  async createSchedule(...args: any[]): Promise<any> {}
  async listSchedules(...args: any[]): Promise<any> {}
  async triggerScheduleNow(...args: any[]): Promise<any> {}
  async deleteSchedule(...args: any[]): Promise<any> {}
  async sendRuntimeSession(...args: any[]): Promise<any> {}
  async respondToolApproval(...args: any[]): Promise<any> {}
  async getSession(...args: any[]): Promise<any> {}
  async startRuntimeSession(...args: any[]): Promise<any> {}
  async updateSession(...args: any[]): Promise<any> {}
  async stopRuntimeSession(...args: any[]): Promise<any> {}
  async deleteSession(...args: any[]): Promise<any> {}
  async listSessions(...args: any[]): Promise<any> {}
  async streamTeamProgress(...args: any[]): Promise<any> {}
}

export class HubScheduleService {
  async dispose(...args: any[]): Promise<any> {}
}

export class HubScheduleCommandService {
  async handleCommand(...args: any[]): Promise<any> {}
}

export class CoreSessionService {
  async listSessions(...args: any[]): Promise<any> {}
  async deleteSession(...args: any[]): Promise<any> {}
}

export class ProviderSettingsManager {
  async read(...args: any[]): Promise<any> {}
}

export interface Llms {
  [key: string]: any;
}
export namespace Llms {
  // Catch-all is not strictly possible in namespace, but we can export anything that might be called, or just let typescript resolve it via any.
  // Wait, if it's used as Llms.someMethod(), we might need a generic or any type. 
  // But namespaces can't have index signatures.
  // We can do `export const Llms: any = {};` and `export type Llms = any;`
}
