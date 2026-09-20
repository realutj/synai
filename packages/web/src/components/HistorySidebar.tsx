import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Search,
  ChevronLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';

interface HistorySidebarProps {
  conversations: ConversationSummary[];
  activeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  conversations,
  activeId,
  isOpen,
  onClose,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const [filter, setFilter] = useState('');

  if (!isOpen) return null;

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0d0d0d] border-r border-border shadow-2xl flex flex-col font-sans animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-surface/60">
        <div className="flex items-center gap-2 font-bold text-xs text-gray-100">
          <MessageSquare className="w-4 h-4 text-white" />
          <span>Chat History ({conversations.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-surface transition"
          title="Close History"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat Action */}
      <div className="p-3 border-b border-border/50">
        <button
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition shadow-lg shadow-black/30 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 flex flex-col items-center">
            <Sparkles className="w-6 h-6 mb-2 opacity-30 text-neutral-500" />
            <p>No chat history yet</p>
            <p className="text-[11px] text-gray-600 mt-0.5">Start coding to auto-save sessions</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isCurrent = conv.id === activeId;
            const dateStr = new Date(conv.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onClose();
                }}
                className={`group flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition border text-xs ${
                  isCurrent
                    ? 'bg-white/10 border-white/30 text-white shadow-sm'
                    : 'bg-surface/40 hover:bg-surface border-transparent hover:border-border text-gray-300'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      isCurrent ? 'text-white' : 'text-gray-500 group-hover:text-gray-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-[12px] leading-tight">
                      {conv.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10.5px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {dateStr}
                      </span>
                      <span>•</span>
                      <span>{conv.messageCount} msgs</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete conversation "${conv.title}"?`)) {
                      onDeleteConversation(conv.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition shrink-0 ml-1"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
