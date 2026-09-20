export type ApprovalMode = 'auto' | 'confirm' | 'dry-run';

export interface ModelPricing {
  prompt: string;
  completion: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: ModelPricing;
  isFree: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'pending_approval' | 'executing' | 'completed' | 'rejected' | 'error';
  output?: string;
  diff?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  args: Record<string, any>;
  description: string;
  diff?: string;
  actionType: 'file_write' | 'file_edit' | 'command' | 'delete' | 'batch_edit' | 'git';
}

export type ThinkingLevel = 'low' | 'medium' | 'high' | 'max' | 'fast' | 'balanced' | 'deep' | 'genius';

export interface AgentConfig {
  apiKey?: string;
  model: string;
  mode: ApprovalMode;
  workspaceRoot: string;
  systemPrompt?: string;
  port?: number;
  thinkingLevel?: ThinkingLevel;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  children?: WorkspaceFile[];
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string;
  subtasks?: string[];
}

export interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  toolName: string;
  files: { path: string; exists: boolean }[];
}

export interface WorkspaceRules {
  sources: { file: string; content: string }[];
  consolidated: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  messageCount: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  messages: any[];
  plan?: TaskItem[];
}
