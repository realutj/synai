import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  FolderTree,
  Globe,
  Settings,
  Trash2,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';
import clsx from 'clsx';

interface SynAISidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  conversations: ConversationSummary[];
  activeId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  isFilesOpen: boolean;
  onToggleFiles: () => void;
  isArtifactsOpen: boolean;
  onToggleArtifacts: () => void;
  onOpenBrowserControl: () => void;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const getRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const SynAISidebar: React.FC<SynAISidebarProps> = ({
  isCollapsed,
  onNewChat,
  conversations,
  activeId,
  onSelectConversation,
  onDeleteConversation,
  isFilesOpen,
  onToggleFiles,
  onOpenBrowserControl,
  onOpenSettings,
  theme,
  onToggleTheme,
}) => {
  const [filter, setFilter] = useState('');
  
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside 
      className={clsx(
        "sidebar-glass flex flex-col justify-between shrink-0 select-none z-30 font-sans transition-all duration-300 h-full overflow-hidden",
        isCollapsed ? "w-[56px] items-center px-1" : "w-[280px]"
      )}
    >
      {/* Top section */}
      <div className={clsx("flex flex-col gap-2 p-3 w-full", isCollapsed && "items-center px-0")}>
        <button
          onClick={onNewChat}
          className={clsx(
            "btn-primary flex items-center justify-center transition-all shrink-0",
            isCollapsed ? "w-10 h-10 rounded-full p-0" : "w-full py-2 px-3 rounded-xl gap-2"
          )}
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium text-sm">New Chat</span>}
        </button>

        {!isCollapsed && (
          <div className="flex flex-col gap-1 mt-2 w-full">
            <button
              onClick={onToggleFiles}
              className={clsx(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isFilesOpen
                  ? "bg-[var(--bg-hover)] text-clay"
                  : "text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)]"
              )}
            >
              <FolderTree className="w-4 h-4 mr-2" />
              Files
            </button>
            <button
              onClick={onOpenBrowserControl}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
            >
              <Globe className="w-4 h-4 mr-2" />
              Browser
            </button>
          </div>
        )}

        {isCollapsed && (
          <div className="flex flex-col items-center gap-2 mt-2 w-full">
            <button
              onClick={onToggleFiles}
              className={clsx(
                "p-2 rounded-lg transition-all",
                isFilesOpen ? "bg-[var(--bg-hover)] text-clay" : "text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)]"
              )}
              title="Files"
            >
              <FolderTree className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenBrowserControl}
              className="p-2 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
              title="Browser"
            >
              <Globe className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Middle: Recents */}
      <div className={clsx("flex-1 min-h-0 flex flex-col w-full", isCollapsed ? "items-center py-2" : "px-3 pt-2")}>
        {!isCollapsed && (
          <>
            <div className="text-[11px] font-semibold text-synai-muted uppercase tracking-wider mb-2 px-1">
              Recents
            </div>
            
            {conversations.length > 5 && (
              <div className="relative mb-2 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-synai-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-surface/30 border border-border/50 rounded-lg outline-none text-synai-text placeholder:text-synai-muted focus:border-clay/50 transition-all"
                />
              </div>
            )}
          </>
        )}

        <div className={clsx("flex-1 overflow-y-auto w-full", isCollapsed ? "space-y-2" : "space-y-0.5")}>
          {filtered.length === 0 && !isCollapsed && (
            <div className="p-4 text-center text-xs text-synai-muted">
              No conversations.
            </div>
          )}
          {filtered.map((c) => {
            const isActive = c.id === activeId;
            
            if (isCollapsed) {
              return (
                <div key={c.id} className="w-full flex justify-center">
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    className={clsx(
                      "p-2 rounded-lg transition-all",
                      isActive ? "bg-[var(--bg-hover)] text-cyan-400" : "text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)]"
                    )}
                    title={c.title}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={clsx(
                  "group flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-all animate-fade-in",
                  isActive
                    ? "bg-[var(--bg-hover)] border-l-[3px] border-cyan-400 pl-[9px]"
                    : "border-l-[3px] border-transparent hover:bg-[var(--bg-hover)] text-synai-secondary hover:text-synai-text"
                )}
              >
                <div className="flex items-center justify-between min-w-0">
                  <span className={clsx("text-xs truncate", isActive && "text-synai-text font-medium")}>
                    {c.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-500 text-synai-muted transition-all shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[10px] text-synai-muted mt-0.5">
                  {getRelativeTime(c.updatedAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className={clsx("flex w-full shrink-0", isCollapsed ? "flex-col items-center py-3 gap-2" : "items-center justify-between p-3")}>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
