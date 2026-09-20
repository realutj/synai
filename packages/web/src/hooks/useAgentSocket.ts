import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChatMessage,
  AgentConfig,
  ModelInfo,
  WorkspaceFile,
  ApprovalRequest,
  ToolCall,
  TaskItem,
  Checkpoint,
  WorkspaceRules,
  ConversationSummary,
  StoredConversation,
} from '../types/index.js';

export function useAgentSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [plan, setPlan] = useState<TaskItem[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [rules, setRules] = useState<WorkspaceRules | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState<string>('Ready');

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = window.location.port === '3000'
      ? `${protocol}//localhost:4242/ws`
      : `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatusText('Connected');
      ws.send(JSON.stringify({ type: 'get_files' }));
      ws.send(JSON.stringify({ type: 'get_plan' }));
      ws.send(JSON.stringify({ type: 'get_rules' }));
      ws.send(JSON.stringify({ type: 'list_conversations' }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatusText('Disconnected. Reconnecting...');
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };
  }, []);

  const handleServerMessage = (data: any) => {
    switch (data.type) {
      case 'config':
        setConfig(data.payload);
        break;

      case 'models':
        setModels(data.payload || []);
        break;

      case 'file_tree':
        setFiles(data.payload || []);
        break;

      case 'plan_state':
        setPlan(data.payload || []);
        break;

      case 'checkpoints_state':
        setCheckpoints(data.payload || []);
        break;

      case 'rules_state':
        setRules(data.payload || null);
        break;

      case 'conversations_list':
        setConversations(data.payload || []);
        break;

      case 'conversation_loaded': {
        const conv: StoredConversation = data.payload;
        setActiveConversationId(conv.id);
        setCurrentTopic(conv.title || '');
        const mappedMessages: ChatMessage[] = (conv.messages || [])
          .filter((m: any) => m.role !== 'system')
          .map((m: any, idx: number) => ({
            id: `msg_${idx}_${Date.now()}`,
            role: m.role,
            content: m.content || '',
            reasoning: m.reasoning,
            timestamp: Date.now(),
            isStreaming: false,
          }));
        setMessages(mappedMessages);
        setPlan(conv.plan || []);
        setStatusText('Session loaded');
        break;
      }

      case 'new_conversation_started':
        setActiveConversationId(data.payload?.id || `conv_${Date.now()}`);
        setCurrentTopic('');
        setMessages([]);
        setPlan([]);
        setStatusText('New Session');
        wsRef.current?.send(JSON.stringify({ type: 'list_conversations' }));
        break;

      case 'approval_required':
        setPendingApproval(data.payload);
        break;

      case 'undo_result':
        setStatusText(data.payload?.message || 'Reverted');
        break;

      case 'reset_done':
        setMessages([]);
        setPlan([]);
        setStatusText('Ready');
        break;

      case 'agent_event':
        handleAgentEvent(data.event);
        break;
    }
  };

  const handleAgentEvent = (ev: any) => {
    switch (ev.type) {
      case 'topic_determined':
        setCurrentTopic(ev.payload.topic);
        break;

      case 'status':
        setStatusText(ev.payload.text);
        break;

      case 'message_start': {
        const { role, content } = ev.payload;
        const newMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role,
          content: content || '',
          timestamp: Date.now(),
          isStreaming: role === 'assistant',
        };
        setMessages((prev) => [...prev, newMsg]);
        break;
      }

      case 'stream_token': {
        const token = ev.payload.token;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1] };
          if (last.role === 'assistant') {
            last.content += token;
            return [...prev.slice(0, -1), last];
          }
          return prev;
        });
        break;
      }

      case 'stream_reasoning': {
        const reasoning = ev.payload.reasoning;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1] };
          if (last.role === 'assistant') {
            last.reasoning = (last.reasoning || '') + reasoning;
            return [...prev.slice(0, -1), last];
          }
          return prev;
        });
        break;
      }

      case 'message_end': {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1], isStreaming: false };
          return [...prev.slice(0, -1), last];
        });
        // Auto refresh conversations list to update title
        wsRef.current?.send(JSON.stringify({ type: 'list_conversations' }));
        break;
      }

      case 'plan_updated':
        setPlan(ev.payload.plan || []);
        break;

      case 'tool_start': {
        const { id, name, args } = ev.payload;
        const newToolCall: ToolCall = {
          id,
          name,
          args,
          status: 'executing',
        };

        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1] };
          if (last.role === 'assistant') {
            const existing = last.toolCalls || [];
            last.toolCalls = [...existing, newToolCall];
            return [...prev.slice(0, -1), last];
          }
          return prev;
        });
        break;
      }

      case 'tool_approval_request': {
        setPendingApproval(ev.payload);
        break;
      }

      case 'tool_executing': {
        setPendingApproval(null);
        break;
      }

      case 'tool_end': {
        const res = ev.payload;
        setPendingApproval(null);
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1] };
          if (last.role === 'assistant' && last.toolCalls) {
            last.toolCalls = last.toolCalls.map((tc) =>
              tc.id === res.tool_call_id
                ? {
                    ...tc,
                    status: res.isError ? 'error' : 'completed',
                    output: res.output,
                    diff: res.diff,
                    isError: res.isError,
                  }
                : tc
            );
            return [...prev.slice(0, -1), last];
          }
          return prev;
        });

        // Refresh files and checkpoints
        if (['write_file', 'edit_file', 'batch_edit'].includes(res.name)) {
          wsRef.current?.send(JSON.stringify({ type: 'get_files' }));
        }
        break;
      }

      case 'done':
        setIsBusy(false);
        setStatusText('Ready');
        wsRef.current?.send(JSON.stringify({ type: 'list_conversations' }));
        break;

      case 'error':
        setIsBusy(false);
        setStatusText(`Error: ${ev.payload.message}`);
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = (message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setIsBusy(true);
    setStatusText('Thinking...');
    wsRef.current.send(JSON.stringify({ type: 'chat', payload: { message } }));
  };

  const abort = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'abort' }));
    setIsBusy(false);
    setStatusText('Aborted');
  };

  const reset = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'new_conversation' }));
  };

  const newConversation = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'new_conversation' }));
  };

  const loadConversation = (id: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'load_conversation', payload: { id } }));
  };

  const deleteConversation = (id: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'delete_conversation', payload: { id } }));
  };

  const refreshConversations = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'list_conversations' }));
  };

  const triggerUndo = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'undo' }));
  };

  const respondApproval = (id: string, approved: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setPendingApproval(null);
    wsRef.current.send(
      JSON.stringify({
        type: 'approval_response',
        payload: { id, approved },
      })
    );
  };

  const updateConfig = (partial: Partial<AgentConfig>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'update_config', payload: partial }));
  };

  const refreshFiles = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'get_files' }));
  };

  return {
    isConnected,
    isBusy,
    statusText,
    messages,
    config,
    models,
    files,
    plan,
    checkpoints,
    rules,
    conversations,
    activeConversationId,
    currentTopic,
    pendingApproval,
    sendMessage,
    abort,
    reset,
    newConversation,
    loadConversation,
    deleteConversation,
    refreshConversations,
    triggerUndo,
    respondApproval,
    updateConfig,
    refreshFiles,
  };
}
