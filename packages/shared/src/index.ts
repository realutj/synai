/**
 * @synai/shared
 * 
 * Shared types, schemas and utilities for the SynAI ecosystem
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
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
