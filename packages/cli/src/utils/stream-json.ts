export type StreamEventType = 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'error' | 'cost' | 'done';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: string;
  data: Record<string, any>;
}

export function emitStreamEvent(event: StreamEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

export function createThinkingEvent(text: string): StreamEvent {
  return { type: 'thinking', timestamp: new Date().toISOString(), data: { text } };
}

export function createTextEvent(text: string): StreamEvent {
  return { type: 'text', timestamp: new Date().toISOString(), data: { text } };
}

export function createToolUseEvent(tool: string, args: Record<string, any>): StreamEvent {
  return { type: 'tool_use', timestamp: new Date().toISOString(), data: { tool, args } };
}

export function createToolResultEvent(tool: string, output: string, isError?: boolean): StreamEvent {
  return { type: 'tool_result', timestamp: new Date().toISOString(), data: { tool, output, isError } };
}

export function createErrorEvent(message: string): StreamEvent {
  return { type: 'error', timestamp: new Date().toISOString(), data: { message } };
}

export function createCostEvent(input: number, output: number, cost: number): StreamEvent {
  return { type: 'cost', timestamp: new Date().toISOString(), data: { input, output, cost } };
}

export function createDoneEvent(response: string): StreamEvent {
  return { type: 'done', timestamp: new Date().toISOString(), data: { response } };
}
