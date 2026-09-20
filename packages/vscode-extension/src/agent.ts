import * as vscode from 'vscode';
import axios from 'axios';

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  autoApprove: boolean;
}

export class SynAIAgent {
  private config: AgentConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(apiKey: string, vscodeConfig: vscode.WorkspaceConfiguration) {
    this.config = {
      apiKey,
      model: vscodeConfig.get<string>('model') || 'anthropic/claude-3.5-sonnet',
      maxTokens: vscodeConfig.get<number>('maxTokens') || 4096,
      temperature: vscodeConfig.get<number>('temperature') || 0.7,
      autoApprove: vscodeConfig.get<boolean>('autoApprove') || false
    };
  }

  async sendMessage(message: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: this.config.model,
          messages: this.conversationHistory,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/synai/synai',
            'X-Title': 'SynAI VS Code Extension'
          }
        }
      );

      const assistantMessage = response.data.choices[0].message.content;
      
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new Error(`SynAI Error: ${errorMessage}`);
    }
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
