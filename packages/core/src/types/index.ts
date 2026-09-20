export type ApprovalMode = 'auto' | 'confirm' | 'dry-run';

export type ThinkingLevel = 'low' | 'medium' | 'high' | 'max' | 'fast' | 'balanced' | 'deep' | 'genius';

export interface ThinkingLevelConfig {
  level: ThinkingLevel;
  temperature: number;
  maxTokens: number;
  maxTurns: number;
  enableReasoning: boolean;
  enableSelfCritique: boolean;
  enableMultiPath: boolean;
  description: string;
}

export interface ModelPricing {
  prompt: string;
  completion: string;
  image?: string;
  request?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: ModelPricing;
  isFree: boolean;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning?: string;
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: any;
  properties?: Record<string, any>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  tool_call_id: string;
  name: string;
  output: string;
  isError?: boolean;
  diff?: string;
  modifiedFiles?: string[];
  actionType?: 'file_read' | 'file_write' | 'file_edit' | 'command' | 'search' | 'info' | 'plan' | 'git' | 'subagent';
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  args: Record<string, any>;
  description: string;
  diff?: string;
  actionType: 'file_write' | 'file_edit' | 'command' | 'delete' | 'batch_edit' | 'git';
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  mode: ApprovalMode;
  workspaceRoot: string;
  port?: number;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  autoDiagnostics?: boolean;
  maxSelfFixAttempts?: number;
  thinkingLevel?: ThinkingLevel;
  theme?: string;
  incognito?: boolean;
  ephemeral?: boolean;
}

export interface DiagnosticIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
  source?: string;
}

export interface DiagnosticsResult {
  hasErrors: boolean;
  issues: DiagnosticIssue[];
  rawOutput: string;
  commandUsed: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  subtasks?: string[];
}

export interface TaskPlanSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed?: number;
  percent: number;
}

export interface CheckpointFileState {
  path: string;
  exists?: boolean;
  existed?: boolean;
  content?: string;
}

export interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  toolName: string;
  files: CheckpointFileState[];
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';
  file: string;
  line: number;
  snippet: string;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  children?: WorkspaceFile[];
}

export type SubagentType =
  | 'research'
  | 'coder'
  | 'tester'
  | 'legal'
  | 'conversational'
  | 'architect'
  | 'analyst'
  | 'mathematician';

export interface SubagentTask {
  id: string;
  type: SubagentType;
  role?: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
  result?: string;
  timestamp?: number;
  createdAt?: number;
  completedAt?: number;
}

export interface AgentStatusEvent {
  type: 'status';
  payload: { text: string };
}

export interface AgentTokenEvent {
  type: 'stream_token';
  payload: { token: string };
}

export interface AgentReasoningEvent {
  type: 'stream_reasoning';
  payload: { reasoning: string };
}

export interface AgentMessageStartEvent {
  type: 'message_start';
  payload: { role: string; content?: string };
}

export interface AgentMessageEndEvent {
  type: 'message_end';
  payload: { role: string; content: string; reasoning?: string };
}

export interface AgentToolStartEvent {
  type: 'tool_start';
  payload: { id: string; name: string; args: Record<string, any> };
}

export interface AgentToolExecutingEvent {
  type: 'tool_executing';
  payload: { id: string; name: string };
}

export interface AgentToolApprovalRequestEvent {
  type: 'tool_approval_request';
  payload: ApprovalRequest;
}

export interface AgentToolEndEvent {
  type: 'tool_end';
  payload: ToolExecutionResult;
}

export interface AgentPlanUpdatedEvent {
  type: 'plan_updated';
  payload: { plan: TaskItem[]; summary: TaskPlanSummary };
}

export interface AgentCheckpointRestoredEvent {
  type: 'checkpoint_restored';
  payload: { success: boolean; message: string; restoredFiles: string[] };
}

export interface AgentDiagnosticsResultEvent {
  type: 'diagnostics_result';
  payload: { issues: string };
}

export interface AgentDoneEvent {
  type: 'done';
  payload: { response: string };
}

export interface AgentErrorEvent {
  type: 'error';
  payload: { message: string };
}

export interface AgentTopicDeterminedEvent {
  type: 'topic_determined';
  payload: { topic: string; id: string };
}

export interface AgentResetDoneEvent {
  type: 'reset_done';
  payload?: Record<string, any>;
}

export type AgentEvent = (
  | AgentStatusEvent
  | AgentTokenEvent
  | AgentReasoningEvent
  | AgentMessageStartEvent
  | AgentMessageEndEvent
  | AgentToolStartEvent
  | AgentToolExecutingEvent
  | AgentToolApprovalRequestEvent
  | AgentToolEndEvent
  | AgentPlanUpdatedEvent
  | AgentCheckpointRestoredEvent
  | AgentDiagnosticsResultEvent
  | AgentDoneEvent
  | AgentErrorEvent
  | AgentTopicDeterminedEvent
  | AgentResetDoneEvent
) & { timestamp?: number };
