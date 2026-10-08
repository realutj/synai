import * as vscode from 'vscode';

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  autoApprove: boolean;
  systemPrompt?: string;
  customBaseUrl?: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoning?: (reasoningChunk: string) => void;
  signal?: AbortSignal;
}

export class SynAIAgent {
  private config: AgentConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(apiKey: string, vscodeConfig: vscode.WorkspaceConfiguration) {
    this.config = {
      apiKey,
      model: vscodeConfig.get<string>('model') || 'anthropic/claude-3.7-sonnet',
      maxTokens: vscodeConfig.get<number>('maxTokens') || 8192,
      temperature: vscodeConfig.get<number>('temperature') || 0.7,
      autoApprove: vscodeConfig.get<boolean>('autoApprove') || false,
      systemPrompt: vscodeConfig.get<string>('systemPrompt'),
      customBaseUrl: vscodeConfig.get<string>('customBaseUrl')
    };
  }

  public updateConfig(newConfig: Partial<AgentConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public setModel(model: string) {
    this.config.model = model;
  }

  public getModel(): string {
    return this.config.model;
  }

  public getBaseUrl(): string {
    if (this.config.customBaseUrl && this.config.customBaseUrl.trim()) {
      return this.config.customBaseUrl.trim().replace(/\/+$/, '');
    }
    return 'https://openrouter.ai/api/v1';
  }

  /**
   * Send a message and stream the response chunk-by-chunk.
   */
  async sendMessageStream(
    message: string,
    callbacks: StreamCallbacks
  ): Promise<{ content: string; reasoning: string }> {
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    const systemPromptText =
      this.config.systemPrompt && this.config.systemPrompt.trim()
        ? this.config.systemPrompt
        : 'You are SynAI, an elite AI coding assistant and software engineer embedded directly inside Visual Studio Code. Provide concise, clean, and idiomatic code solutions. Format code in markdown blocks with proper language identifiers. Be direct and avoid unnecessary conversational filler.';

    const messagesToSend = [
      { role: 'system', content: systemPromptText },
      ...this.conversationHistory
    ];

    const isReasoningModel =
      this.config.model.includes('r1') ||
      this.config.model.includes('o1') ||
      this.config.model.includes('o3') ||
      this.config.model.includes('thinking');

    const requestBody: any = {
      model: this.config.model,
      messages: messagesToSend,
      stream: true,
      max_tokens: this.config.maxTokens,
      temperature: isReasoningModel ? 1.0 : this.config.temperature
    };

    // OpenRouter reasoning parameter
    if (isReasoningModel) {
      requestBody.include_reasoning = true;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/synai/synai',
      'X-Title': 'SynAI VS Code Extension'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const endpoint = `${this.getBaseUrl()}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: callbacks.signal
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('Generation cancelled by user.');
      }
      throw new Error(`Connection error: ${fetchErr.message || 'Failed to reach API endpoint.'}`);
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorJson = (await response.json()) as any;
        errorDetail = errorJson?.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`SynAI API Error (${response.status}): ${errorDetail || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      while (true) {
        if (callbacks.signal?.aborted) {
          reader.cancel();
          throw new Error('Generation cancelled by user.');
        }

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
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;

              if (delta) {
                // Extract reasoning / thought
                const reasoningToken = delta.reasoning || delta.reasoning_content;
                if (reasoningToken && typeof reasoningToken === 'string') {
                  accumulatedReasoning += reasoningToken;
                  callbacks.onReasoning?.(reasoningToken);
                }

                // Extract content
                const contentToken = delta.content;
                if (contentToken && typeof contentToken === 'string') {
                  accumulatedContent += contentToken;
                  callbacks.onChunk(contentToken);
                }
              }
            } catch {
              // Ignore malformed SSE chunks
            }
          }
        }
      }
    } catch (streamErr: any) {
      if (streamErr.name === 'AbortError' || callbacks.signal?.aborted) {
        throw new Error('Generation cancelled by user.');
      }
      throw streamErr;
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: accumulatedContent
    });

    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning
    };
  }

  /**
   * Non-streaming fallback if required.
   */
  async sendMessage(message: string): Promise<string> {
    let result = '';
    await this.sendMessageStream(message, {
      onChunk: (chunk) => {
        result += chunk;
      }
    });
    return result;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }

  dispose(): void {
    this.conversationHistory = [];
  }
}
