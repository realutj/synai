import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Brain,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Check,
  X,
  ListTodo,
  Terminal,
  Globe,
  Plus,
  FileText,
  Wrench,
  Search,
} from 'lucide-react';
import { ChatMessage, ToolCall, ApprovalRequest, TaskItem } from '../types/index.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import clsx from 'clsx';

interface ChatAreaProps {
  messages: ChatMessage[];
  isBusy: boolean;
  tasks?: TaskItem[];
  pendingApproval: ApprovalRequest | null;
  onSendMessage: (message: string) => void;
  onAbort: () => void;
  onRespondApproval: (id: string, approved: boolean) => void;
  onSelectDiff?: (diff: string, path: string) => void;
  onOpenBrowserControl?: () => void;
  modelName?: string;
  thinkingLevel?: string;
  mode?: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isBusy,
  tasks = [],
  pendingApproval,
  onSendMessage,
  onAbort,
  onRespondApproval,
  onSelectDiff,
  modelName = 'SynAI',
  thinkingLevel = 'medium',
  mode = 'confirm',
}) => {
  const [input, setInput] = useState('');
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const [showToolOutputs, setShowToolOutputs] = useState<Record<string, boolean>>({});
  const [isTodoExpanded, setIsTodoExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingApproval, tasks]);

  useEffect(() => {
    let lastEscTime = 0;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBusy) {
        const now = Date.now();
        if (now - lastEscTime <= 600) {
          onAbort();
          lastEscTime = 0;
        } else {
          lastEscTime = now;
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isBusy, onAbort]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isBusy) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleReasoning = (id: string) => {
    setShowReasoning((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleToolOutput = (id: string) => {
    setShowToolOutputs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const shortModel = modelName.split('/').pop()?.replace(':free', '') || modelName;

  const renderToolIcon = (name: string) => {
    if (name.includes('bash') || name.includes('command')) return <Terminal className="w-4 h-4" />;
    if (name.includes('file') || name.includes('write')) return <FileText className="w-4 h-4" />;
    if (name.includes('grep') || name.includes('search')) return <Search className="w-4 h-4" />;
    if (name.includes('web') || name.includes('browser')) return <Globe className="w-4 h-4" />;
    return <Wrench className="w-4 h-4" />;
  };

  const renderToolCall = (tc: ToolCall) => {
    const isExpanded = showToolOutputs[tc.id];

    return (
      <div key={tc.id} className="tool-card my-2 border border-border rounded-xl bg-synai-card overflow-hidden text-sm transition">
        <div
          onClick={() => toggleToolOutput(tc.id)}
          className="tool-card-header flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface-hover/50 transition select-none"
        >
          <div className="flex items-center gap-2">
            <div className="text-clay">
              {renderToolIcon(tc.name)}
            </div>
            <span className="font-semibold text-synai-text font-mono text-xs">{tc.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tc.status === 'executing' && (
              <span className="flex items-center gap-1 text-clay text-xs">
                <Clock className="w-3.5 h-3.5 animate-spin" /> Running
              </span>
            )}
            {tc.status === 'completed' && (
              <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Done
              </span>
            )}
            {tc.status === 'error' && (
              <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Error
              </span>
            )}
            {tc.diff && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDiff?.(tc.diff!, tc.args.filePath || 'File Edit');
                }}
                className="px-2 py-0.5 rounded bg-clay/10 text-clay hover:bg-clay/20 text-[11px] font-medium transition"
              >
                View Diff
              </button>
            )}
            <span className="text-synai-muted">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          </div>
        </div>

        {isExpanded && tc.output && (
          <div className="p-3 bg-surface border-t border-border font-mono text-xs max-h-64 overflow-y-auto whitespace-pre-wrap text-synai-secondary">
            {tc.output}
          </div>
        )}
      </div>
    );
  };

  const renderComposer = (isCentered: boolean) => {
    const hasInput = Boolean(input.trim());

    return (
      <div className={clsx("composer-glass glow-border w-full flex flex-col gap-2 rounded-2xl p-3 shadow-lg relative", isCentered ? "max-w-2xl mx-auto" : "max-w-3xl mx-auto")}>
        <textarea
          ref={textareaRef}
          rows={isCentered ? 2 : 1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message SynAI..."
          className="w-full bg-transparent text-synai-text placeholder:text-synai-muted text-base outline-none resize-none font-sans min-h-[44px] max-h-60"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Model Pill */}
            <span className="px-2 py-0.5 rounded-md bg-surface-hover/80 border border-border text-[11px] font-mono text-synai-secondary flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-clay" />
              {shortModel}
            </span>

            {/* Thinking Level Pill */}
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-[11px] font-medium text-purple-300 flex items-center gap-1">
              <Brain className="w-3 h-3 text-purple-400" />
              {thinkingLevel === 'low' || thinkingLevel === 'fast'
                ? '⚡ Low (4K)'
                : thinkingLevel === 'high' || thinkingLevel === 'deep'
                ? '🧠 High (16K)'
                : thinkingLevel === 'max' || thinkingLevel === 'genius'
                ? '🌟 Max (32K)'
                : '⚖️ Medium (8K)'}
            </span>

            {/* Mode Pill */}
            <span className="px-2 py-0.5 rounded-md bg-surface-hover/80 border border-border text-[11px] font-medium text-synai-secondary flex items-center gap-1">
              {mode === 'auto' ? '⚡ Auto' : mode === 'dry-run' ? '🔍 Dry-Run' : '🛡️ Confirm'}
            </span>

            <span className="text-[11px] text-synai-muted hidden md:inline ml-1.5">Enter to send • Shift+Enter for newline</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isBusy ? (
              <button
                onClick={onAbort}
                className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition shadow-sm"
                title="Stop generation (Esc)"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit()}
                disabled={!hasInput}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center transition",
                  hasInput ? "bg-gradient-to-r from-clay to-purple-500 text-white shadow-md cursor-pointer hover:opacity-90" : "bg-surface text-synai-muted cursor-not-allowed opacity-50"
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden font-sans bg-background">
      {tasks.length > 0 && (
        <div className="border-b border-border bg-surface/95 backdrop-blur px-4 py-2 z-10 shadow-sm">
          <div
            onClick={() => setIsTodoExpanded(!isTodoExpanded)}
            className="flex items-center justify-between cursor-pointer select-none max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-clay/10 text-clay flex items-center justify-center">
                <ListTodo className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-xs text-synai-text">
                Task Plan ({completedTasks}/{totalTasks} completed)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-1.5 bg-border rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-clay transition-all duration-500"
                  style={{ width: `${taskPercent}%` }}
                />
              </div>
              <span className="text-synai-muted">
                {isTodoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </div>
          </div>
          {isTodoExpanded && (
            <div className="mt-2 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto max-w-3xl mx-auto">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs bg-synai-card text-synai-text">
                  {task.status === 'completed' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : task.status === 'in_progress' ? (
                    <Clock className="w-3 h-3 text-clay animate-spin" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-synai-muted" />
                  )}
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto w-full">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center p-6 relative animate-fade-in">
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
              <div className="orb orb-cyan absolute top-1/4 left-1/4" />
              <div className="orb orb-purple absolute top-1/3 right-1/4" />
              <div className="orb orb-blue absolute bottom-1/4 left-1/2" />
            </div>
            
            <div className="text-center space-y-6 mb-8 w-full max-w-2xl">
              <div className="text-[80px] leading-none select-none gradient-text mb-4">✻</div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-synai-text">
                {getGreeting()}
              </h1>
              <p className="text-lg text-synai-secondary">How can I help you today?</p>
            </div>

            <div className="w-full mb-8 z-10">
              {renderComposer(true)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl z-10">
              {[
                { title: 'Help me debug this code', icon: '✨' },
                { title: 'Create a REST API', icon: '🏗' },
                { title: 'Review my code for issues', icon: '🔍' },
                { title: 'Write unit tests', icon: '📝' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(item.title)}
                  className="prompt-card p-4 rounded-xl border border-border bg-synai-card/60 backdrop-blur hover:bg-surface-hover text-left transition group flex gap-3 items-center shadow-sm"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium text-sm text-synai-text group-hover:text-clay transition">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-8 pb-32">
            {messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="message-user bg-surface-hover text-synai-text p-4 rounded-2xl rounded-tr-sm max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="message-assistant border-l-2 border-clay/50 pl-4 py-1 space-y-3 w-full max-w-[90%]">
                    <div className="flex items-center gap-2">
                      <div className="text-clay font-bold text-lg leading-none">✻</div>
                      <span className="font-semibold text-sm text-synai-text">SynAI</span>
                    </div>

                    {msg.reasoning && (
                      <div className="border border-border/60 rounded-xl bg-surface/40 overflow-hidden text-xs">
                        <button
                          onClick={() => toggleReasoning(msg.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-synai-secondary hover:text-synai-text transition"
                        >
                          <div className="flex items-center gap-2">
                            <Brain className="w-3.5 h-3.5 text-purple-500" />
                            <span className="italic font-medium">Thinking process</span>
                          </div>
                          {showReasoning[msg.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {showReasoning[msg.id] && (
                          <div className="p-3 bg-surface/50 border-t border-border/60 font-mono text-[11px] text-synai-secondary whitespace-pre-wrap italic">
                            {msg.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.content && (
                      <div className="text-sm leading-relaxed text-synai-text">
                        <MarkdownRenderer content={msg.content} />
                        {msg.isStreaming && <span className="typing-cursor inline-block w-1.5 h-4 ml-1 bg-clay align-middle animate-pulse" />}
                      </div>
                    )}

                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {msg.toolCalls.map(renderToolCall)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {isBusy && (!messages[messages.length - 1] || messages[messages.length - 1].role === 'user') && (
               <div className="message-assistant border-l-2 border-clay/50 pl-4 py-1 w-full max-w-[90%] flex items-center gap-3">
                  <div className="text-clay font-bold text-lg leading-none">✻</div>
                  <div className="thinking-dots flex items-center gap-1 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-clay/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-clay/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-clay/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
               </div>
            )}

            {pendingApproval && (
              <div className="approval-banner p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-synai-text space-y-3 mt-4 shadow-sm">
                <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Action Approval Required</span>
                </div>
                <p className="text-sm text-synai-text/90">{pendingApproval.description}</p>
                {pendingApproval.diff && (
                  <div className="p-3 rounded-lg bg-background/50 border border-border/50 font-mono text-xs max-h-48 overflow-y-auto">
                    {pendingApproval.diff}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => onRespondApproval(pendingApproval.id, true)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 transition"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => onRespondApproval(pendingApproval.id, false)}
                    className="px-4 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white font-medium text-sm flex items-center gap-2 transition"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-20 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-3xl mx-auto">
            {renderComposer(false)}
          </div>
        </div>
      )}
    </div>
  );
};
