import { EventEmitter } from 'node:events';
import {
  Message,
  AgentConfig,
  AgentEvent,
  ApprovalRequest,
  ToolExecutionResult,
  ToolCall,
  TaskItem,
  ThinkingLevel,
} from '../types/index.js';
import { OpenRouterClient } from '../openrouter/index.js';
import { ToolRegistry } from '../tools/registry.js';
import { generateSystemPrompt } from '../prompts/index.js';
import { TaskPlanner } from '../planner/index.js';
import { CheckpointManager } from '../checkpoint/index.js';
import { MemoryEngine } from '../memory/index.js';
import { SubagentOrchestrator } from '../subagents/index.js';
import { StorageManager, generateIntelligentTitle } from '../storage/index.js';
import { applyThinkingLevel, getThinkingLevelPromptAddition, normalizeThinkingLevel, getThinkingLevelIcon } from '../thinking/index.js';

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

/**
 * Best-effort repair of tool-call argument JSON that a model emitted slightly wrong.
 *
 * Weaker/free models truncate mid-stream, wrap JSON in markdown fences, leave
 * trailing commas, or use single quotes — all of which `JSON.parse` rejects
 * outright. Rejecting them forces a whole extra model round-trip; salvaging the
 * common cases lets the turn proceed. Returns the repaired JSON *string* only
 * when it is now parseable, otherwise `null` (never a guess).
 */
export function repairToolCallArguments(raw: string | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;

  // Unwrap a markdown code fence if the model wrapped the object in one.
  const fenced = text.match(/^```(?:json|tool_call)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  // Drop trailing commas before a closing brace/bracket (invalid strict JSON).
  text = text.replace(/,\s*([}\]])/g, '$1');

  // Single-quoted keys/strings: only rewrite when there are no double quotes to
  // clash with, so already-valid content is never corrupted.
  if (!text.includes('"') && text.includes("'")) {
    text = text.replace(/'/g, '"');
  }

  text = balanceJsonDelimiters(text);

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return text;
    return null;
  } catch {
    return null;
  }
}

/**
 * Append any delimiters left open by a truncated stream (`{"a": 1` -> `{"a": 1}`).
 * String contents are tracked so braces/brackets inside string values are ignored.
 */
function balanceJsonDelimiters(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let out = text;
  while (stack.length > 0) {
    out += stack.pop() === '{' ? '}' : ']';
  }
  return out;
}

/**
 * Parse a tool call's raw JSON argument string. Pure and side-effect free so it can
 * be unit-tested directly, without spinning up an Agent or hitting the network.
 * An empty/undefined string is treated as "no arguments" (`{}`), not a failure —
 * many zero-arg tools are called this way. Anything else that is not valid JSON is
 * first run through `repairToolCallArguments`; only if that also fails is the call
 * reported via `failed: true` so the caller can refuse to execute against garbage.
 */
export function parseToolCallArguments(raw: string | undefined): {
  args: Record<string, any>;
  failed: boolean;
  repaired?: boolean;
} {
  try {
    return { args: JSON.parse(raw || '{}'), failed: false };
  } catch {
    const repairedRaw = repairToolCallArguments(raw);
    if (repairedRaw !== null) {
      try {
        return { args: JSON.parse(repairedRaw), failed: false, repaired: true };
      } catch {
        // Fall through to the hard failure below.
      }
    }
    return { args: { raw }, failed: true };
  }
}

export class Agent extends EventEmitter {
  private config: AgentConfig;
  private client: OpenRouterClient;
  private tools: ToolRegistry;
  private planner: TaskPlanner;
  private checkpoints: CheckpointManager;
  private memory: MemoryEngine;
  private subagents: SubagentOrchestrator;
  private storage: StorageManager;
  private conversationId: string;
  private conversationTopic: string = '';
  private messages: Message[] = [];
  private approvalHandler?: ApprovalHandler;
  private isBusy: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    super();
    this.config = {
      autoDiagnostics: true,
      maxSelfFixAttempts: 3,
      thinkingLevel: 'medium',
      ...config,
    };
    this.client = new OpenRouterClient(config.apiKey);
    this.planner = new TaskPlanner();
    this.checkpoints = new CheckpointManager(config.workspaceRoot);
    this.memory = new MemoryEngine(config.workspaceRoot);
    this.subagents = new SubagentOrchestrator(this.config);
    this.storage = new StorageManager();
    this.conversationId = `conv_${Date.now()}`;

    this.tools = new ToolRegistry(
      config.workspaceRoot,
      this.planner,
      this.checkpoints,
      this.subagents
    );

    this.resetConversation();
    
    // Advanced intelligence initialization
    const thinkingLevel = normalizeThinkingLevel(this.config.thinkingLevel);
    this.emitEvent({
      type: 'status',
      payload: { 
        text: `SynAI agent ready - effort level: ${thinkingLevel.toUpperCase()}` 
      },
    });
  }

  public setApprovalHandler(handler: ApprovalHandler): void {
    this.approvalHandler = handler;
  }

  public setConfig(partial: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.apiKey !== undefined) {
      this.client.setApiKey(partial.apiKey);
    }
    if (partial.workspaceRoot !== undefined) {
      this.checkpoints = new CheckpointManager(partial.workspaceRoot);
      this.memory = new MemoryEngine(partial.workspaceRoot);
      this.tools = new ToolRegistry(
        partial.workspaceRoot,
        this.planner,
        this.checkpoints,
        this.subagents
      );
    }
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Replace the conversation history wholesale — used by /compact and similar
   * housekeeping operations. Always keeps the original system prompt message in
   * place if the caller's replacement omits one, since dropping it would strip
   * the agent of its operating instructions entirely.
   */
  public setMessages(messages: Message[]): void {
    if (messages.length > 0 && messages[0].role === 'system') {
      this.messages = [...messages];
    } else {
      const existingSystemMsg = this.messages.find((m) => m.role === 'system');
      this.messages = existingSystemMsg ? [existingSystemMsg, ...messages] : [...messages];
    }
  }

  /**
   * Emergency context safety valve. This is deliberately dumber than the CLI's
   * `/compact` (no structured file/command extraction) — it exists purely to stop
   * a very long autonomous session from blowing past the model's context window
   * and erroring out mid-task. It keeps the system prompt, the very first user
   * message (the original task/goal), and a recent tail, and collapses everything
   * else into one marker message. Users who want a nicer, more detailed summary
   * should reach for `/compact` explicitly before this ever needs to fire.
   */
  private autoCompactIfNeeded(): void {
    const AUTO_COMPACT_CHAR_THRESHOLD = 500_000; // ~125K tokens at a 4 chars/token estimate
    const KEEP_RECENT = 16;

    let totalChars = 0;
    for (const m of this.messages) {
      totalChars += (m.content || '').length;
      if (m.tool_calls) totalChars += JSON.stringify(m.tool_calls).length;
    }
    if (totalChars < AUTO_COMPACT_CHAR_THRESHOLD || this.messages.length <= KEEP_RECENT + 2) return;

    const systemMsg = this.messages[0]?.role === 'system' ? this.messages[0] : undefined;
    const rest = systemMsg ? this.messages.slice(1) : this.messages;
    const firstUserMsg = rest.find((m) => m.role === 'user');
    const recent = rest.slice(-KEEP_RECENT);
    const droppedCount = rest.length - recent.length - (firstUserMsg ? 1 : 0);

    if (droppedCount <= 0) return;

    const marker: Message = {
      role: 'system',
      content:
        `[Auto-compacted ${droppedCount} earlier messages — this session ran long enough to approach the context limit. ` +
        `The original request and the most recent ${KEEP_RECENT} messages are preserved below; earlier tool output and ` +
        `intermediate steps were dropped. Re-inspect files or re-run commands if you need their exact prior output rather ` +
        `than assuming it.]`,
    };

    const rebuilt: Message[] = [];
    if (systemMsg) rebuilt.push(systemMsg);
    if (firstUserMsg) rebuilt.push(firstUserMsg);
    rebuilt.push(marker, ...recent);

    this.messages = rebuilt;
    this.emitEvent({
      type: 'status',
      payload: { text: `⚠️ Auto-compacted conversation (${droppedCount} messages) to stay within context limits.` },
    });
  }

  public getPlanner(): TaskPlanner {
    return this.planner;
  }

  public getCheckpoints(): CheckpointManager {
    return this.checkpoints;
  }

  public getMemory(): MemoryEngine {
    return this.memory;
  }

  public getSubagents(): SubagentOrchestrator {
    return this.subagents;
  }

  public undoLatestChange(): { success: boolean; message: string; restoredFiles: string[] } {
    const result = this.checkpoints.undoLatest();
    if (result.success) {
      this.emitEvent({
        type: 'checkpoint_restored',
        payload: result,
      });
    }
    return result;
  }

  public getStorage(): StorageManager {
    return this.storage;
  }

  public getConversationId(): string {
    return this.conversationId;
  }

  public getConversationTopic(): string {
    return this.conversationTopic;
  }

  public setConversationTopic(topic: string): void {
    this.conversationTopic = topic;
    this.emitEvent({
      type: 'topic_determined',
      payload: { topic, id: this.conversationId },
    });
    if (!this.config.incognito && !this.config.ephemeral) {
      this.storage.saveConversation(
        this.conversationId,
        topic,
        this.config.workspaceRoot,
        this.messages,
        this.planner.getPlan()
      );
    }
  }

  public loadConversation(id: string): boolean {
    const conv = this.storage.getConversation(id);
    if (!conv) return false;
    this.conversationId = conv.id;
    this.conversationTopic = conv.title || '';
    this.messages = conv.messages;
    if (conv.plan) {
      this.planner.createPlan(conv.plan);
    }
    return true;
  }

  public resetConversation(): void {
    this.conversationId = `conv_${Date.now()}`;
    this.conversationTopic = '';
    const contextPrompt = this.memory.getContextPrompt();
    const thinkingLevel = normalizeThinkingLevel(this.config.thinkingLevel);
    const thinkingAddition = getThinkingLevelPromptAddition(thinkingLevel);
    const sysPrompt = generateSystemPrompt(
      this.config.workspaceRoot,
      this.config.systemPrompt,
      contextPrompt + thinkingAddition
    );
    this.messages = [{ role: 'system', content: sysPrompt }];
    this.planner.clearPlan();
  }

  public emitEvent(event: AgentEvent): void {
    event.timestamp = event.timestamp || Date.now();
    this.emit('event', event);
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isBusy = false;
    this.emitEvent({ type: 'status', payload: { text: 'Turn aborted by user.' } });
  }

  public async chat(userInput: string): Promise<string> {
    if (this.isBusy) {
      throw new Error('Agent is already processing a task. Please wait or abort.');
    }

    const trimmedInput = userInput.trim();
    if (trimmedInput.startsWith('/')) {
      const parts = trimmedInput.slice(1).split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const arg = parts.slice(1).join(' ').trim().toLowerCase();

      if (['think', 'effort', 'thinking', 'dusun', 'düşün', 'dusunme'].includes(cmd)) {
        if (arg) {
          const level = normalizeThinkingLevel(arg);
          this.setConfig({ thinkingLevel: level });
          const icons: Record<string, string> = { low: '⚡', medium: '⚖️', high: '🧠', max: '🌟' };
          const details: Record<string, string> = {
            low: '4K tokens, 15 turns',
            medium: '8K tokens, 25 turns',
            high: '16K tokens, 40 turns',
            max: '32K tokens, 60 turns',
          };
          const icon = icons[level] || '⚖️';
          const msg = `${icon} Thinking effort level set to: **${level.toUpperCase()}** (${details[level]})`;
          this.emitEvent({ type: 'message_start', payload: { role: 'user', content: userInput } });
          this.emitEvent({ type: 'stream_token', payload: { token: msg } });
          this.emitEvent({ type: 'message_end', payload: { role: 'assistant', content: msg } });
          return msg;
        } else {
          const current = normalizeThinkingLevel(this.config.thinkingLevel);
          const msg = `Current cognitive effort level: **${current.toUpperCase()}**.\n\nOptions: \`low\`, \`medium\`, \`high\`, \`max\`.\nExample: \`/think high\``;
          this.emitEvent({ type: 'message_start', payload: { role: 'user', content: userInput } });
          this.emitEvent({ type: 'stream_token', payload: { token: msg } });
          this.emitEvent({ type: 'message_end', payload: { role: 'assistant', content: msg } });
          return msg;
        }
      } else if (['clear', 'reset', 'temizle'].includes(cmd)) {
        this.resetConversation();
        const msg = 'Session and conversation history successfully cleared.';
        this.emitEvent({ type: 'message_start', payload: { role: 'user', content: userInput } });
        this.emitEvent({ type: 'stream_token', payload: { token: msg } });
        this.emitEvent({ type: 'message_end', payload: { role: 'assistant', content: msg } });
        this.emitEvent({ type: 'reset_done' });
        return msg;
      } else if (['mode', 'izin'].includes(cmd)) {
        if (['auto', 'confirm', 'dry-run'].includes(arg)) {
          this.setConfig({ mode: arg as any });
          const msg = `Execution mode set to: **${arg.toUpperCase()}**`;
          this.emitEvent({ type: 'message_start', payload: { role: 'user', content: userInput } });
          this.emitEvent({ type: 'stream_token', payload: { token: msg } });
          this.emitEvent({ type: 'message_end', payload: { role: 'assistant', content: msg } });
          return msg;
        }
      }
    }

    const apiKey = (this.config.apiKey || process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      const errorMsg = 'OpenRouter API Key tanımlı değil. İlerlemek için geçerli bir API anahtarı girmelisiniz.';
      this.emitEvent({
        type: 'error',
        payload: { message: errorMsg },
      });
      throw new Error(errorMsg);
    }

    this.isBusy = true;
    this.abortController = new AbortController();

    try {
      // Re-inject fresh rules and workspace context into system prompt
      const contextPrompt = this.memory.getContextPrompt();
      const thinkingLevel = normalizeThinkingLevel(this.config.thinkingLevel);
      const thinkingAddition = getThinkingLevelPromptAddition(thinkingLevel);
      const sysPrompt = generateSystemPrompt(
        this.config.workspaceRoot,
        this.config.systemPrompt,
        contextPrompt + thinkingAddition
      );

      if (this.messages.length === 0 || this.messages[0].role !== 'system') {
        this.messages = [{ role: 'system', content: sysPrompt }];
      } else {
        this.messages[0].content = sysPrompt;
      }

      this.messages.push({ role: 'user', content: userInput });
      this.emitEvent({ type: 'message_start', payload: { role: 'user', content: userInput } });

      // Automatically determine or refine conversation topic
      const userMessageCount = this.messages.filter((m) => m.role === 'user').length;
      if (!this.conversationTopic || userMessageCount <= 2 || this.conversationTopic === 'Coding Session') {
        const detectedTopic = generateIntelligentTitle(userInput);
        if (detectedTopic && detectedTopic !== 'Coding Session') {
          this.conversationTopic = detectedTopic;
          this.emitEvent({
            type: 'topic_determined',
            payload: { topic: detectedTopic, id: this.conversationId },
          });
        }
      }

      // Apply thinking level to max turns
      const thinkingConfig = applyThinkingLevel(thinkingLevel, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
      const MAX_TURNS = thinkingConfig.maxTurns;
      // Bound on how many times the automatic post-edit repair loop may re-prompt the
      // model with fresh diagnostics output. Without this, a model that cannot fix the
      // same error keeps getting re-prompted and silently eats the whole turn budget.
      const MAX_SELF_FIX = Math.max(0, this.config.maxSelfFixAttempts ?? 3);
      let selfFixAttempts = 0;
      let turnCount = 0;
      let finalAssistantResponse = '';
      let hadFileEdits = false;
      let finishedNaturally = false;

      while (turnCount < MAX_TURNS) {
        turnCount++;

        this.autoCompactIfNeeded();

        let turnContent = '';
        let turnReasoning = '';

        this.emitEvent({
          type: 'status',
          payload: { text: `Thinking with model ${this.config.model}... (step ${turnCount})` },
        });

        const isSimpleGreeting = /^(merhaba|selam|selamlar|merhabalar|günaydın|iyi günler|iyi akşamlar|hi|hello|hey|yo)[\s!.,:)]*$/i.test(userInput.trim());
        const toolsToSend = isSimpleGreeting ? [] : this.tools.getDefinitions();
        const maxTokensToSend = isSimpleGreeting ? 128 : thinkingConfig.maxTokens;

        const result = await this.client.chatStream(
          this.config.model,
          this.messages,
          toolsToSend,
          {
            onToken: (token) => {
              turnContent += token;
              this.emitEvent({ type: 'stream_token', payload: { token } });
            },
            onReasoning: (reasoning) => {
              turnReasoning += reasoning;
              this.emitEvent({ type: 'stream_reasoning', payload: { reasoning } });
            },
          },
          {
            temperature: thinkingConfig.temperature,
            maxTokens: maxTokensToSend,
            signal: this.abortController?.signal,
          }
        );

        const assistantMsg: Message = {
          role: 'assistant',
          content: result.content,
          reasoning: result.reasoning || undefined,
        };

        if (result.toolCalls.length > 0) {
          assistantMsg.tool_calls = result.toolCalls;
        }

        this.messages.push(assistantMsg);
        this.emitEvent({
          type: 'message_end',
          payload: { role: 'assistant', content: result.content, reasoning: result.reasoning },
        });

        finalAssistantResponse = result.content;

        // If no tool calls were requested in this turn, the model has produced its final answer.
        if (result.toolCalls.length === 0) {
          // Self-Healing Phase: If files were modified and auto-diagnostics is enabled, run
          // verification. Bounded by `maxSelfFixAttempts` so a model that keeps failing to
          // fix the same error can't quietly burn the remaining turn budget on repair loops.
          if (hadFileEdits && this.config.autoDiagnostics && turnCount < MAX_TURNS) {
            hadFileEdits = false; // reset flag

            if (selfFixAttempts >= MAX_SELF_FIX) {
              this.emitEvent({
                type: 'status',
                payload: {
                  text: `Automatic self-repair stopped after ${MAX_SELF_FIX} attempt(s) — remaining diagnostics errors are reported instead of retried.`,
                },
              });
              finalAssistantResponse =
                (finalAssistantResponse || '') +
                `\n\n---\n⚠️ Automated verification still reports errors after ${MAX_SELF_FIX} self-repair attempt(s). ` +
                `Stopping to avoid an endless fix loop — raise the effort level (\`/think max\`) or ask me to continue and I'll take another pass.`;
              finishedNaturally = true;
              break;
            }

            this.emitEvent({
              type: 'status',
              payload: { text: 'Running automated diagnostics & compiler verification...' },
            });

            try {
              const diagRes = await this.tools.executeTool(
                `diag_check_${Date.now()}`,
                'run_diagnostics',
                {},
                'auto'
              );

              if (
                diagRes.isError &&
                !diagRes.output.includes('No project configuration found') &&
                !diagRes.output.includes('No type checker configured')
              ) {
                selfFixAttempts++;
                this.emitEvent({
                  type: 'diagnostics_result',
                  payload: { issues: diagRes.output },
                });

                this.messages.push({
                  role: 'user',
                  content: `[Automated Verification Notice] (attempt ${selfFixAttempts}/${MAX_SELF_FIX}): Compiler / diagnostics verification detected errors after your edits:\n\n${diagRes.output}\n\nPlease analyze the root cause and surgically fix these errors now to ensure zero regressions.`,
                });
                continue; // Trigger self-healing loop turn
              }
            } catch {
              // Ignore diagnostic errors if tools not available
            }
          }
          finishedNaturally = true;
          break;
        }

        // Process all tool calls requested in this turn
        for (const toolCall of result.toolCalls) {
          const toolName = toolCall.function.name;
          const {
            args: parsedArgs,
            failed: argsParseFailed,
            repaired: argsRepaired,
          } = parseToolCallArguments(toolCall.function.arguments);

          this.emitEvent({
            type: 'tool_start',
            payload: { id: toolCall.id, name: toolName, args: parsedArgs },
          });

          // The model's JSON was malformed but we salvaged a valid parse (truncated
          // braces, trailing commas, code fences, …). Surface it so the recovery is
          // visible rather than silent, then proceed normally.
          if (argsRepaired) {
            this.emitEvent({
              type: 'status',
              payload: {
                text: `Recovered malformed JSON arguments for "${toolName}" and continued.`,
              },
            });
          }

          // Malformed tool-call arguments: don't execute against garbage input.
          // Give the model a precise, actionable error so it can retry with valid JSON
          // instead of silently running with a `{ raw }` placeholder it never expects.
          if (argsParseFailed) {
            const malformedResult: ToolExecutionResult = {
              tool_call_id: toolCall.id,
              name: toolName,
              output: `[INVALID_ARGUMENTS]: The arguments for "${toolName}" were not valid JSON and the call was not executed:\n\n${toolCall.function.arguments}\n\nRe-issue this tool call with well-formed JSON arguments matching its schema.`,
              isError: true,
            };
            this.emitEvent({ type: 'tool_end', payload: malformedResult });
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: malformedResult.output,
            });
            continue;
          }

          // Check approval requirement
          let approved = true;
          if (this.tools.requiresApproval(toolName, this.config.mode, parsedArgs)) {
            const approvalReq = this.tools.createApprovalRequest(
              toolCall.id,
              toolName,
              parsedArgs
            );

            this.emitEvent({
              type: 'tool_approval_request',
              payload: approvalReq,
            });

            if (this.approvalHandler) {
              approved = await this.approvalHandler(approvalReq);
            } else {
              approved = true;
            }
          }

          let toolExecResult: ToolExecutionResult;

          if (!approved) {
            toolExecResult = {
              tool_call_id: toolCall.id,
              name: toolName,
              output: `[USER_REJECTION]: The user explicitly denied permission to execute "${toolName}" with arguments: ${JSON.stringify(parsedArgs)}.

CRITICAL DIRECTIVE: DO NOT re-attempt or re-ask for this exact same tool call.
You MUST adjust your strategy now:
1) Find an alternative approach, different tool, or non-destructive solution to achieve the goal.
2) If no alternative exists, inform the user why this was needed and ask for their preference.`,
              isError: true,
            };
          } else {
            this.emitEvent({
              type: 'tool_executing',
              payload: { id: toolCall.id, name: toolName },
            });

            if (['write_file', 'edit_file', 'batch_edit'].includes(toolName)) {
              hadFileEdits = true;
            }

            toolExecResult = await this.tools.executeTool(
              toolCall.id,
              toolName,
              parsedArgs,
              this.config.mode
            );

            // Plan updates
            if (toolName === 'create_plan' || toolName === 'update_task') {
              this.emitEvent({
                type: 'plan_updated',
                payload: {
                  plan: this.planner.getPlan(),
                  summary: this.planner.getSummary(),
                },
              });
            }
          }

          this.emitEvent({
            type: 'tool_end',
            payload: toolExecResult,
          });

          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolExecResult.output,
          });
        }
      }

      // If we exhausted the turn budget mid-task (still issuing tool calls, never
      // reached a final text-only answer), say so explicitly instead of silently
      // returning whatever partial text the last turn happened to contain.
      if (!finishedNaturally) {
        const limitNotice =
          `\n\n---\n⚠️ Reached the ${MAX_TURNS}-turn limit for effort level "${thinkingLevel}" before finishing. ` +
          `Increase the thinking effort (\`/think high\` or \`/think max\`) or ask me to continue and I'll resume from here.`;
        finalAssistantResponse = (finalAssistantResponse || '(no final text response — still mid-task)') + limitNotice;
        this.emitEvent({
          type: 'status',
          payload: { text: `Turn limit (${MAX_TURNS}) reached before task completion.` },
        });
      }

      // Auto-save conversation to AppData (bypassed in incognito / ephemeral mode)
      if (!this.config.incognito && !this.config.ephemeral) {
        try {
          const title = this.conversationTopic || generateIntelligentTitle(userInput);
          this.storage.saveConversation(
            this.conversationId,
            title,
            this.config.workspaceRoot,
            this.messages,
            this.planner.getPlan()
          );
        } catch {}
      }

      this.emitEvent({ type: 'done', payload: { response: finalAssistantResponse } });
      return finalAssistantResponse;
    } catch (err: any) {
      // A cancelled turn is a deliberate user action, not a failure — report it as
      // an abort rather than a scary "error" event, and don't retry anything.
      if (err?.name === 'AbortError' || this.abortController?.signal.aborted) {
        const abortMsg = 'Operation cancelled by the user.';
        this.emitEvent({ type: 'status', payload: { text: abortMsg } });
        return `[Aborted] ${abortMsg}`;
      }
      this.emitEvent({ type: 'error', payload: { message: err.message || 'Unknown error occurred' } });
      // Don't re-throw — return the error message so the REPL stays alive
      return `[Error] ${err.message || 'Unknown error'}`;
    } finally {
      this.isBusy = false;
      this.abortController = null;
    }
  }
}
