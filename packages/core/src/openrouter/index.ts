import { ModelInfo, Message, ToolDefinition, ToolCall } from '../types/index.js';

// NOTE ON MAINTENANCE: OpenRouter's free-tier model roster rotates on the order of
// weeks, not years — free promos end, providers deprecate slugs, new ones launch.
// A hardcoded list here WILL go stale; that is expected and fine, because it is only
// ever consulted as a last-resort fallback when the live `/models` fetch below fails
// (offline, rate-limited, auth hiccup). `openrouter/free` is listed FIRST and is the
// real safety net: it's OpenRouter's own meta-router that always resolves to whatever
// free model is currently live, so it can't go stale the way a specific slug can. If
// you're refreshing this list, verify each id against https://openrouter.ai/models
// (filter: prompt pricing = 0) before merging — don't assume a name here still exists.
export const FALLBACK_FREE_MODELS: ModelInfo[] = [
  {
    id: 'openrouter/free',
    name: 'Free Models Router',
    description: 'Auto-routed meta model that always selects a currently-live free model. Safest default when the model list can\'t be fetched.',
    context_length: 200000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere: North Mini Code (free)',
    description: 'Premier agentic coding model optimized for code generation, bug fixing, and tool use.',
    context_length: 256000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'poolside/laguna-xs.2:free',
    name: 'Poolside: Laguna XS.2 (free)',
    description: 'Efficient coding agent model, 128K context, tool calling and reasoning support.',
    context_length: 131072,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nex-agi/nex-n2.5-pro:free',
    name: 'Nex AGI: Nex-N2.5-Pro (free)',
    description: 'Agentic model designed to explore codebases, implement multi-file edits, and verify outcomes.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nex-agi/nex-n2.5-mini:free',
    name: 'Nex AGI: Nex-N2.5-Mini (free)',
    description: 'Lightweight agentic model specialized for fast iteration and tool execution.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning (free)',
    description: 'High-throughput open MoE model with 1,000,000 token context for large-scale analysis.',
    context_length: 1000000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'NVIDIA: Nemotron 3 Ultra (free)',
    description: 'Frontier reasoning and orchestration model (550B MoE) with 1M context length.',
    context_length: 1000000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA: Nemotron 3 Super (free)',
    description: '120B hybrid MoE model activating 12B parameters for complex multi-agent reasoning.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA: Nemotron 3 Nano Omni (free)',
    description: '30B-A3B open multimodal perception and deep reasoning sub-agent model.',
    context_length: 256000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety:free',
    name: 'NVIDIA: Nemotron 3.5 Content Safety (free)',
    description: 'Precision safety guardrail model moderating inputs and outputs.',
    context_length: 128000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B (free)',
    description: 'Google DeepMind 30.7B dense multimodal model with 256K context and reasoning mode.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B (free)',
    description: 'Instruction-tuned MoE model from Google DeepMind activating 3.8B per token.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'inclusionai/ling-3.0-flash-vl:free',
    name: 'inclusionAI: Ling 3.0 Flash VL (free)',
    description: 'Multimodal MoE model with native visual perception and advanced reasoning.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'inclusionai/ling-3.0-flash-sante:free',
    name: 'inclusionAI: Ling 3.0 Flash Sante (free)',
    description: 'Domain-specific medical and scientific literature MoE model.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'inclusionai/ling-3.0-flash-fin:free',
    name: 'inclusionAI: Ling 3.0 Flash Fin (free)',
    description: 'Specialized financial and quantitative reasoning MoE model.',
    context_length: 262144,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'thinkingmachines/inkling:free',
    name: 'Thinking Machines: Inkling (free)',
    description: 'General-purpose reasoning, coding, and agentic tool-use MoE with 1M context.',
    context_length: 1048576,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'thinkingmachines/inkling-small:free',
    name: 'Thinking Machines: Inkling Small (free)',
    description: 'Efficient 1M-context multimodal MoE model for reasoning and coding.',
    context_length: 1048576,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots Studio: Dots3-Note Preview (free)',
    description: 'Open-weight MoE model with 512k context designed for long-document understanding.',
    context_length: 512000,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'LiquidAI: LFM2.5-2.6B (free)',
    description: 'Compact reasoning model for data extraction, RAG, and fast pipelines.',
    context_length: 65536,
    pricing: { prompt: '0', completion: '0' },
    isFree: true,
  },
];

/**
 * Options for a streaming chat completion request.
 */
export interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Caller-supplied cancellation signal. Wired all the way down to `fetch`, so
   * aborting actually tears down the in-flight HTTP request instead of merely
   * flipping a local flag the network layer never sees.
   */
  signal?: AbortSignal;
  /**
   * Number of *additional* attempts after a transient failure (default 3, i.e.
   * up to 4 total tries). Only rate limits (429) and 5xx/network errors are
   * retried — a 400/401/403 is a malformed request or bad key and would fail
   * identically on every retry, so it fails fast.
   */
  maxRetries?: number;
}

/**
 * Whether an HTTP status represents a *transient* condition worth retrying.
 * 429 (rate limit) plus the 5xx family are the standard "try again" signals;
 * everything else in the 4xx range is a caller-side error that retrying cannot fix.
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 409 || status === 425 || status === 429) return true;
  return status >= 500 && status <= 599;
}

/**
 * Parse a `Retry-After` header (delta-seconds or an HTTP date) into milliseconds,
 * clamped to a sane ceiling so a hostile/buggy server can't stall us for hours.
 */
export function parseRetryAfterMs(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.min(Math.max(0, dateMs - Date.now()), 30_000);
  return undefined;
}

/**
 * Exponential backoff with jitter. Jitter matters here: when several turns fail
 * at once (a shared rate limit), retrying at exactly the same computed instant
 * just re-collides — spreading the retries avoids a thundering herd.
 * `retryAfterMs` (server-provided) always wins when it is larger.
 */
export function computeBackoffDelay(attempt: number, retryAfterMs?: number): number {
  const base = Math.min(8_000, 500 * 2 ** attempt);
  const jitter = Math.random() * 250;
  return Math.max(base + jitter, retryAfterMs ?? 0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onReasoning?: (reasoning: string) => void;
  onToolCallStart?: (toolCall: Partial<ToolCall>) => void;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public async fetchAvailableModels(): Promise<ModelInfo[]> {
    const headers: Record<string, string> = {
      'HTTP-Referer': 'https://github.com/synai/synai',
      'X-Title': 'SynAI Coding Assistant',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // One short retry before giving up: a lot of "failures" here are a single
    // transient blip (rate limit, cold start), not a real outage, and falling
    // back to the static list unnecessarily just means staler model data.
    let res: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${this.baseUrl}/models`, { method: 'GET', headers });
        if (res.ok) break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        if (attempt === 1) {
          console.warn('Network error fetching OpenRouter models, using fallbacks:', err);
          return FALLBACK_FREE_MODELS;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    try {
      if (!res || !res.ok) {
        console.warn(`OpenRouter models API returned ${res?.status}, using curated fallback models.`);
        return FALLBACK_FREE_MODELS;
      }

      const data = (await res.json()) as { data: any[] };
      if (!data || !Array.isArray(data.data)) {
        return FALLBACK_FREE_MODELS;
      }

      const models: ModelInfo[] = data.data
        .filter((m: any) => {
          // Exclude audio/music models like Lyria from coding assistant
          if (m.id?.includes('lyria')) return false;
          return true;
        })
        .map((m: any) => {
          const isFree =
            m.id?.endsWith(':free') ||
            m.id === 'openrouter/free' ||
            m.name?.toLowerCase().includes('(free)') ||
            (m.pricing?.prompt === '0' && m.pricing?.completion === '0') ||
            (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);

          return {
            id: m.id,
            name: m.name || m.id,
            description: m.description || '',
            context_length: m.context_length || 32768,
            pricing: {
              prompt: m.pricing?.prompt || '0',
              completion: m.pricing?.completion || '0',
              image: m.pricing?.image,
              request: m.pricing?.request,
            },
            isFree,
            architecture: m.architecture,
            top_provider: m.top_provider,
          };
        });

      // Curate and sort models:
      // Free models are prioritized, but if an API key is provided, also include top premium models!
      const freeModels = models.filter((m) => m.isFree);
      const paidModels = models.filter((m) => !m.isFree);

      const priorityOrder = [
        'north-mini-code',
        'laguna-s',
        'laguna-xs',
        'nex-n2.5-pro',
        'nex-n2.5-mini',
        'nemotron-3.5-lightning',
        'nemotron-3-ultra',
        'nemotron-3-super',
        'nemotron-3-nano',
        'gemma-4-31b',
        'gemma-4-26b',
        'inkling',
        'openrouter/free',
        'coder',
      ];

      const scoreModel = (m: ModelInfo): number => {
        const lower = m.id.toLowerCase();
        const priorityIndex = priorityOrder.findIndex((p) => lower.includes(p));
        return priorityIndex === -1 ? 999 : priorityIndex;
      };

      freeModels.sort((a, b) => scoreModel(a) - scoreModel(b));
      paidModels.sort((a, b) => scoreModel(a) - scoreModel(b));

      if (this.apiKey) {
        // When authenticated, provide top free models followed by top premium models
        const combined = [...freeModels, ...paidModels.slice(0, 40)];
        return combined.length > 0 ? combined : FALLBACK_FREE_MODELS;
      }

      return freeModels.length > 0 ? freeModels : FALLBACK_FREE_MODELS;
    } catch (err) {
      console.warn('Network error fetching OpenRouter models, using fallbacks:', err);
      return FALLBACK_FREE_MODELS;
    }
  }

  public async chatStream(
    model: string,
    messages: Message[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks = {},
    options: StreamOptions = {}
  ): Promise<{ content: string; reasoning: string; toolCalls: ToolCall[] }> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error('OpenRouter API Key girmeden ilerletilemez. Lütfen geçerli bir OpenRouter API anahtarı tanımlayın.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/synai/synai',
      'X-Title': 'SynAI Coding Assistant',
      'Authorization': `Bearer ${this.apiKey.trim()}`,
    };

    // Format tools for standard function calling schema
    const formattedTools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Format messages
    const formattedMessages = messages.map((m) => {
      const msgObj: any = {
        role: m.role,
        content: m.content || '',
      };
      if (m.tool_calls) {
        msgObj.tool_calls = m.tool_calls;
      }
      if (m.tool_call_id) {
        msgObj.tool_call_id = m.tool_call_id;
      }
      if (m.name) {
        msgObj.name = m.name;
      }
      return msgObj;
    });

    const requestBody: any = {
      model,
      messages: formattedMessages,
      stream: true,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 8192,
    };

    if (formattedTools.length > 0) {
      requestBody.tools = formattedTools;
      requestBody.tool_choice = 'auto';
    }

    const maxRetries = Math.max(0, options.maxRetries ?? 3);
    let res: Response | undefined;
    let lastNetworkError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: options.signal,
        });
      } catch (err: any) {
        // A user-initiated abort must surface immediately: retrying it would just
        // fight the cancellation the user explicitly asked for.
        if (err?.name === 'AbortError') throw err;
        lastNetworkError = err;
        if (attempt < maxRetries) {
          await delay(computeBackoffDelay(attempt));
          continue;
        }
        throw new Error(
          `OpenRouter request failed after ${attempt + 1} attempt(s): ${err?.message || err}`
        );
      }

      if (res.ok) break;

      const errorText = await res.text().catch(() => '');
      let parsedError: any;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { error: { message: errorText } };
      }
      const apiMessage =
        parsedError.error?.message || errorText || res.statusText || `HTTP ${res.status}`;

      // Auto-recovery for HTTP 400 errors (e.g. "Provider returned error", "tools not supported")
      if (res.status === 400) {
        // 1. Try without tools parameter if model does not support function calling
        if (requestBody.tools) {
          delete requestBody.tools;
          delete requestBody.tool_choice;
          try {
            const retryRes = await fetch(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody),
              signal: options.signal,
            });
            if (retryRes.ok) {
              res = retryRes;
              break;
            }
          } catch {}
        }

        // 2. Fallback to reliable default model if current model failed
        if (model !== 'cohere/north-mini-code:free') {
          try {
            requestBody.model = 'cohere/north-mini-code:free';
            if (formattedTools.length > 0) {
              requestBody.tools = formattedTools;
              requestBody.tool_choice = 'auto';
            }
            const fallbackRes = await fetch(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody),
              signal: options.signal,
            });
            if (fallbackRes.ok) {
              res = fallbackRes;
              break;
            }
          } catch {}
        }
      }

      throw new Error(`OpenRouter API Error (${res.status}): ${apiMessage}`);
    }

    if (!res || !res.ok) {
      throw new Error(
        `OpenRouter API Error: ${lastNetworkError?.message || 'no response received'}`
      );
    }

    if (!res.body) {
      throw new Error('No response stream returned by OpenRouter API');
    }

    let fullContent = '';
    let fullReasoning = '';
    const activeToolCallsMap: Map<number, { id: string; name: string; args: string }> = new Map();

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // Handle reasoning / thinking delta (DeepSeek R1 / Gemini Thinking)
            if (delta.reasoning) {
              fullReasoning += delta.reasoning;
              callbacks.onReasoning?.(delta.reasoning);
            }

            // Handle content token
            if (delta.content) {
              fullContent += delta.content;
              callbacks.onToken?.(delta.content);
            }

            // Handle standard tool calls
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0;
                if (!activeToolCallsMap.has(index)) {
                  activeToolCallsMap.set(index, {
                    id: tc.id || `call_${Date.now()}_${index}`,
                    name: tc.function?.name || '',
                    args: tc.function?.arguments || '',
                  });
                } else {
                  const existing = activeToolCallsMap.get(index)!;
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name += tc.function.name;
                  if (tc.function?.arguments) existing.args += tc.function.arguments;
                }
              }
            }
          } catch {
            // Ignore partial or unparseable chunks
          }
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(activeToolCallsMap.values()).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: tc.args,
      },
    }));

    // Fallback: If no standard tool_calls returned but content has formatted JSON tool tags (e.g. ```tool_call ... ``` or <tool_call>...</tool_call>)
    if (toolCalls.length === 0) {
      const extracted = this.extractFallbackToolCalls(fullContent);
      if (extracted.length > 0) {
        toolCalls.push(...extracted);
      }
    }

    return {
      content: fullContent,
      reasoning: fullReasoning,
      toolCalls,
    };
  }

  private extractFallbackToolCalls(content: string): ToolCall[] {
    const tools: ToolCall[] = [];

    // Check for ```tool_call { "name": "...", "arguments": { ... } } ```
    const codeBlockRegex = /```(?:json|tool_call)?\s*(\{\s*"tool"[\s\S]*?\})\s*```/g;
    let match;
    let idx = 0;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool || parsed.name) {
          tools.push({
            id: `fallback_${Date.now()}_${idx++}`,
            type: 'function',
            function: {
              name: parsed.tool || parsed.name,
              arguments: JSON.stringify(parsed.arguments || parsed.args || parsed.parameters || {}),
            },
          });
        }
      } catch {
        // Not a tool call JSON
      }
    }

    // Check for <tool_call name="...">...</tool_call>
    const xmlRegex = /<tool_call(?:\s+name=["']([^"']+)["'])?>([\s\S]*?)<\/tool_call>/g;
    while ((match = xmlRegex.exec(content)) !== null) {
      try {
        const toolName = match[1];
        const inner = match[2].trim();
        let args = {};
        try {
          args = JSON.parse(inner);
        } catch {
          args = { content: inner };
        }
        if (toolName) {
          tools.push({
            id: `fallback_${Date.now()}_${idx++}`,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify(args),
            },
          });
        }
      } catch {
        // Skip
      }
    }

    return tools;
  }
}
