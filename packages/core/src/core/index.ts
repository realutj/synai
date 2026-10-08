import { Agent } from "../agent/index.js";
import { SessionNotFoundError } from "../types/index.js";
import { AgentResult, getPersistedProviderApiKey } from "../compat.js";

export interface SynAICoreOptions {
  capabilities?: {
    toolExecutors?: Record<string, Function>;
    requestToolApproval?: (request: any) => Promise<{ approved: boolean; reason?: string }>;
  };
  logger?: any;
  cwd?: string;
  workspaceRoot?: string;
  toolPolicies?: any;
  backendMode?: string;
  forceLocalBackend?: boolean;
  featureFlags?: any;
  telemetry?: any;
  prepare?: Function;
  hub?: any;
  [key: string]: any;
}

export interface SessionEntry {
  id: string;
  agent: Agent;
  manifest: {
    session_id: string;
    source: string;
    created_at: string;
    cwd: string;
    workspace_root: string;
    model: string;
    provider: string;
    metadata?: Record<string, unknown>;
    title?: string;
    prompt?: string;
  };
  compactionState?: any;
  metadata?: Record<string, unknown>;
  accumulatedUsage: {
    inputTokens: number;
    outputTokens: number;
    totalCost?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  inTextStream: boolean;
  inReasoningStream: boolean;
  lastTurnResult?: AgentResult;
}

export class SynAICore {
  public readonly runtimeAddress: string = "127.0.0.1:25463";
  private sessions = new Map<string, SessionEntry>();
  private listeners = new Set<(event: any) => void>();
  private options: SynAICoreOptions;

  public featureFlags = {
    poll: async () => {},
    isEnabled: (_flag: string) => false,
  };

  public settings = {
    list: async (_input?: any) => ({ settings: [] }),
    toggle: async (_input?: any) => ({ success: true }),
  };

  public pendingPrompts = {
    update: async (input: any) => ({
      sessionId: input?.sessionId,
      prompts: [],
      prompt: input?.prompt,
      updated: true,
      removed: false,
    }),
    list: (_sessionId?: string) => [],
  };

  constructor(options: SynAICoreOptions = {}) {
    this.options = options;
    if (options.featureFlags) {
      this.featureFlags = {
        poll: async () => {
          if (typeof options.featureFlags.poll === "function") {
            await options.featureFlags.poll();
          }
        },
        isEnabled: (flag: string) => {
          if (typeof options.featureFlags.isEnabled === "function") {
            return options.featureFlags.isEnabled(flag);
          }
          return false;
        },
      };
    }
  }

  public static async create(options?: SynAICoreOptions): Promise<SynAICore> {
    return new SynAICore(options);
  }

  public subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(event: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  public async start(options: any): Promise<{
    sessionId: string;
    manifest: any;
    result?: AgentResult;
  }> {
    const sessionId =
      options?.config?.sessionId ||
      options?.sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const workspaceRoot =
      options?.config?.workspaceRoot ||
      this.options.workspaceRoot ||
      options?.config?.cwd ||
      this.options.cwd ||
      process.cwd();

    const providerId = (
      options?.config?.providerId ||
      options?.providerId ||
      "openrouter"
    ).toLowerCase();

    const apiKey =
      options?.config?.apiKey ||
      getPersistedProviderApiKey(providerId, options?.config) ||
      process.env.OPENROUTER_API_KEY ||
      (providerId === "opencode" ? "public" : "");

    let model =
      options?.config?.modelId ||
      options?.config?.model ||
      options?.model;

    if (providerId === "openai-codex") {
      if (!model || model === "openrouter/free" || model === "gpt-4o") {
        model = "gpt-5.6-luna";
      }
    } else if (!model) {
      model = "openrouter/free";
    }

    const thinkingLevel =
      options?.config?.thinkingLevel ||
      (options?.config?.thinking ? "high" : "medium");

    const mode = options?.config?.mode || "act";

    const agent = new Agent({
      workspaceRoot,
      model,
      providerId,
      apiKey,
      baseUrl: providerId === "openai-codex" ? "https://chatgpt.com/backend-api/codex" : options?.config?.baseUrl,
      thinkingLevel,
      mode,
      toolPolicies: options?.toolPolicies,
      systemPrompt: options?.config?.systemPrompt,
      temperature: options?.config?.temperature,
      maxTokens: options?.config?.maxTokens,
    });

    if (this.options.capabilities?.requestToolApproval) {
      const approvalFn = this.options.capabilities.requestToolApproval;
      agent.setApprovalHandler(async (req) => {
        try {
          const res = await approvalFn({
            toolName: req.tool,
            input: req.args,
            callId: req.id,
          });
          return res?.approved === true;
        } catch {
          return false;
        }
      });
    }

    if (options?.initialMessages && Array.isArray(options.initialMessages)) {
      agent.setMessages(options.initialMessages);
    }

    const existingSession = this.sessions.get(sessionId);
    const sessionEntry: SessionEntry = {
      id: sessionId,
      agent,
      manifest: {
        session_id: sessionId,
        source: options?.source ?? "cli",
        created_at: existingSession?.manifest?.created_at || new Date().toISOString(),
        cwd: workspaceRoot,
        workspace_root: workspaceRoot,
        model,
        provider: providerId,
        metadata: options?.metadata || options?.sessionMetadata || existingSession?.manifest?.metadata || {},
      },
      compactionState: options?.initialCompactionState ?? existingSession?.compactionState,
      metadata: options?.metadata || options?.sessionMetadata || existingSession?.metadata,
      accumulatedUsage: existingSession?.accumulatedUsage
        ? { ...existingSession.accumulatedUsage }
        : {
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
          },
      inTextStream: false,
      inReasoningStream: false,
    };

    agent.on("event", (evt: any) => {
      this.handleAgentEvent(sessionEntry, evt);
    });

    this.sessions.set(sessionId, sessionEntry);

    let result: AgentResult | undefined;
    if (options?.prompt && !options?.interactive && !options?.deferInitialSend) {
      result = await this.send({
        sessionId,
        prompt: options.prompt,
        userImages: options.userImages,
        userFiles: options.userFiles,
      });
    }

    return {
      sessionId,
      manifest: sessionEntry.manifest,
      ...(result ? { result } : {}),
    };
  }

  private handleAgentEvent(session: SessionEntry, evt: any): void {
    if (!evt || !evt.type) return;

    switch (evt.type) {
      case "stream_token": {
        if (session.inReasoningStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "reasoning",
          });
          session.inReasoningStream = false;
        }
        session.inTextStream = true;
        this.emitStructuredAgentEvent({
          type: "content_start",
          contentType: "text",
          text: evt.payload?.token ?? "",
        });
        break;
      }
      case "stream_reasoning": {
        if (session.inTextStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "text",
          });
          session.inTextStream = false;
        }
        session.inReasoningStream = true;
        this.emitStructuredAgentEvent({
          type: "content_start",
          contentType: "reasoning",
          reasoning: evt.payload?.reasoning ?? "",
        });
        break;
      }
      case "message_end": {
        if (session.inTextStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "text",
          });
          session.inTextStream = false;
        }
        if (session.inReasoningStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "reasoning",
          });
          session.inReasoningStream = false;
        }
        break;
      }
      case "tool_start": {
        if (session.inTextStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "text",
          });
          session.inTextStream = false;
        }
        if (session.inReasoningStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "reasoning",
          });
          session.inReasoningStream = false;
        }
        this.emitStructuredAgentEvent({
          type: "content_start",
          contentType: "tool",
          toolCallId: evt.payload?.id,
          toolName: evt.payload?.name,
          input: evt.payload?.args,
        });
        break;
      }
      case "tool_end": {
        this.emitStructuredAgentEvent({
          type: "content_end",
          contentType: "tool",
          toolCallId: evt.payload?.tool_call_id,
          toolName: evt.payload?.name,
          output: evt.payload?.output,
          error: evt.payload?.isError ? evt.payload?.output : undefined,
        });
        break;
      }
      case "status": {
        this.emitStructuredAgentEvent({
          type: "notice",
          displayRole: "status",
          message: evt.payload?.text ?? "",
        });
        break;
      }
      case "error": {
        if (session.inTextStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "text",
          });
          session.inTextStream = false;
        }
        if (session.inReasoningStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "reasoning",
          });
          session.inReasoningStream = false;
        }
        this.emitStructuredAgentEvent({
          type: "error",
          error: new Error(evt.payload?.message || "Unknown error"),
          recoverable: false,
        });
        break;
      }
      case "done": {
        if (session.inTextStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "text",
          });
          session.inTextStream = false;
        }
        if (session.inReasoningStream) {
          this.emitStructuredAgentEvent({
            type: "content_end",
            contentType: "reasoning",
          });
          session.inReasoningStream = false;
        }
        this.emitStructuredAgentEvent({
          type: "done",
          finishReason: "completed",
          iterations: 1,
          text: evt.payload?.response ?? "",
          usage: session.accumulatedUsage,
        });
        break;
      }
    }
  }

  private emitStructuredAgentEvent(event: any): void {
    this.broadcast({
      type: "agent_event",
      payload: { event },
    });
    this.broadcast(event);
  }

  public async send(options: {
    sessionId: string;
    prompt?: string;
    mode?: string;
    delivery?: string;
    userImages?: any[];
    userFiles?: any[];
    [key: string]: any;
  }): Promise<AgentResult> {
    const session = this.sessions.get(options.sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session not found: ${options.sessionId}`);
    }

    this.emitStructuredAgentEvent({ type: "iteration_start" });

    const startTime = performance.now();
    let promptWithContext = options.prompt || "";
    if (options.userFiles && options.userFiles.length > 0) {
      promptWithContext += `\n\n[Attached Files]:\n${options.userFiles.map((f: any) => `- ${typeof f === "string" ? f : f.path || f.name}`).join("\n")}`;
    }

    try {
      const responseText = await session.agent.chat(promptWithContext);
      const durationMs = Math.round(performance.now() - startTime);

      const estimatedInput = Math.ceil(promptWithContext.length / 4);
      const estimatedOutput = Math.ceil((responseText || "").length / 4);

      session.accumulatedUsage.inputTokens += estimatedInput;
      session.accumulatedUsage.outputTokens += estimatedOutput;

      const usage = {
        inputTokens: estimatedInput,
        outputTokens: estimatedOutput,
        totalCost: 0,
      };

      this.emitStructuredAgentEvent({
        type: "usage",
        usage,
      });

      this.emitStructuredAgentEvent({ type: "iteration_end" });

      const result: AgentResult = {
        finishReason: "completed",
        iterations: 1,
        usage: {
          inputTokens: estimatedInput,
          outputTokens: estimatedOutput,
          totalCost: 0,
        },
        durationMs,
        text: responseText,
        model: session.manifest.model,
        messages: session.agent.getMessages?.() || [],
      };

      session.lastTurnResult = result;
      return result;
    } catch (err: any) {
      this.emitStructuredAgentEvent({ type: "iteration_end" });
      const durationMs = Math.round(performance.now() - startTime);
      const result: AgentResult = {
        finishReason: "error",
        iterations: 1,
        usage: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
        durationMs,
        text: err?.message || "Execution error",
        model: session.manifest.model,
        messages: session.agent.getMessages?.() || [],
      };
      session.lastTurnResult = result;
      throw err;
    }
  }

  public async stop(sessionId?: string): Promise<void> {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      session?.agent.abort();
    } else {
      for (const session of this.sessions.values()) {
        session.agent.abort();
      }
    }
  }

  public async abort(sessionId?: string, _reason?: any): Promise<void> {
    await this.stop(sessionId);
  }

  public async dispose(_reason?: string): Promise<void> {
    for (const session of this.sessions.values()) {
      session.agent.abort();
    }
    this.sessions.clear();
    this.listeners.clear();
  }

  public async readMessages(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.agent.getMessages().map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: Date.now(),
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    }));
  }

  public async readSessionCompactionState(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    return session?.compactionState ?? null;
  }

  public async updateSessionCompactionState(
    sessionId: string,
    state: any,
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.compactionState = state;
    }
    return state;
  }

  public async updateSessionConnection(
    sessionId: string,
    update: any,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (update?.modelId) {
      session.manifest.model = update.modelId;
      session.agent.setConfig({ model: update.modelId });
    }
    if (update?.providerId) {
      session.manifest.provider = update.providerId;
      session.agent.setConfig({ providerId: update.providerId });
    }
    if (update?.apiKey) {
      session.agent.setConfig({ apiKey: update.apiKey });
    }
  }

  public async updateSessionModel(
    sessionId: string,
    modelId: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.manifest.model = modelId;
    session.agent.setConfig({ model: modelId });
  }

  public async get(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return {
      manifest: session.manifest,
      ...session.manifest,
    };
  }

  public async list(limit = 50, _options?: any): Promise<any[]> {
    const results: any[] = [];
    for (const session of this.sessions.values()) {
      results.push({
        manifest: session.manifest,
        ...session.manifest,
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  public async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  public async update(
    sessionId: string,
    updates: {
      prompt?: string | null;
      metadata?: Record<string, unknown> | null;
      title?: string | null;
    },
  ): Promise<{ updated: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { updated: false };
    if (updates.prompt !== undefined) {
      session.manifest.prompt = updates.prompt ?? undefined;
    }
    if (updates.metadata !== undefined) {
      session.manifest.metadata = {
        ...session.manifest.metadata,
        ...(updates.metadata ?? {}),
      };
    }
    if (updates.title !== undefined) {
      session.manifest.title = updates.title ?? undefined;
    }
    return { updated: true };
  }

  public async getAccumulatedUsage(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    const usage = session?.accumulatedUsage ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
    };
    return {
      usage,
      aggregateUsage: usage,
    };
  }

  public async restore(options: any): Promise<any> {
    const sessionId = options?.sessionId || `restored_${Date.now()}`;
    return await this.start({ ...options, sessionId });
  }

  public async ingestHookEvent(_payload: any): Promise<void> {
    // Hook event ingestion
  }
}
