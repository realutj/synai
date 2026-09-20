import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Zap,
  ShieldCheck,
  Eye,
  ChevronDown,
  Globe,
  Code2,
  Menu,
  X,
  Brain,
} from 'lucide-react';
import { AgentConfig, ModelInfo, ApprovalMode, ThinkingLevel } from '../types/index.js';
import clsx from 'clsx';

interface NavbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  config: AgentConfig | null;
  models: ModelInfo[];
  isConnected: boolean;
  isBusy: boolean;
  statusText: string;
  currentTopic?: string;
  onUpdateConfig: (partial: Partial<AgentConfig>) => void;
  onReset: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onOpenSettings: () => void;
  onOpenBrowserControl: () => void;
  isArtifactsOpen?: boolean;
  onToggleArtifacts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  config,
  models,
  isConnected,
  isBusy,
  statusText,
  currentTopic,
  onUpdateConfig,
  onOpenSettings,
  onOpenBrowserControl,
  isArtifactsOpen,
  onToggleArtifacts,
}) => {
  const currentModel = config?.model || 'cohere/north-mini-code:free';
  const currentMode = config?.mode || 'confirm';
  const currentThinking: ThinkingLevel = config?.thinkingLevel || 'medium';
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const thinkingDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (thinkingDropdownRef.current && !thinkingDropdownRef.current.contains(event.target as Node)) {
        setIsThinkingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modes: { key: ApprovalMode; label: string; icon: React.ReactNode }[] = [
    { key: 'confirm', label: 'Confirm', icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> },
    { key: 'auto', label: 'Auto', icon: <Zap className="w-3.5 h-3.5 text-emerald-500" /> },
    { key: 'dry-run', label: 'Dry-Run', icon: <Eye className="w-3.5 h-3.5 text-blue-500" /> },
  ];

  const thinkingLevels: { key: ThinkingLevel; label: string; icon: string; desc: string }[] = [
    { key: 'low', label: 'Low', icon: '⚡', desc: '4K tokens, 15 turns' },
    { key: 'medium', label: 'Medium', icon: '⚖️', desc: '8K tokens, 25 turns' },
    { key: 'high', label: 'High', icon: '🧠', desc: '16K tokens, 40 turns' },
    { key: 'max', label: 'Max', icon: '🌟', desc: '32K tokens, 60 turns' },
  ];

  const normalizedCurrentThinking: ThinkingLevel =
    ['low', 'fast'].includes(currentThinking) ? 'low' :
    ['high', 'deep'].includes(currentThinking) ? 'high' :
    ['max', 'genius'].includes(currentThinking) ? 'max' : 'medium';

  const activeThinkingObj = thinkingLevels.find((t) => t.key === normalizedCurrentThinking) || thinkingLevels[1];
  const shortModel = currentModel.split('/').pop()?.replace(':free', '') || currentModel;

  return (
    <header className="navbar-glass h-14 px-4 flex items-center justify-between select-none z-20 font-sans transition-all duration-300">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold gradient-text select-none">✻</span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <div
            className={clsx(
              "w-2 h-2 rounded-full transition-all duration-300",
              isConnected && isBusy ? "bg-clay status-pulse" : isConnected ? "bg-emerald-500" : "bg-neutral-500"
            )}
            title={statusText}
          />
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex justify-center items-center">
        {currentTopic && (
          <span className="text-sm text-synai-muted truncate max-w-md transition-all">
            {currentTopic}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] text-xs font-medium text-synai-text transition-all"
          >
            <span>{shortModel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-synai-muted" />
          </button>
          
          {isModelDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 glass-panel rounded-xl shadow-lg p-1.5 z-50">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-synai-muted uppercase tracking-wider">
                Model
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {models.map((m) => {
                  const isSelected = m.id === currentModel;
                  const name = m.id.split('/').pop()?.replace(':free', '') || m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onUpdateConfig({ model: m.id });
                        setIsModelDropdownOpen(false);
                      }}
                      className={clsx(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all",
                        isSelected
                          ? 'bg-clay/15 text-clay font-medium'
                          : 'text-synai-text hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      <span className="truncate">{name}</span>
                      {m.isFree && (
                        <span className="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-500 font-mono">
                          free
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Thinking Level Selector Dropdown */}
        <div className="relative" ref={thinkingDropdownRef}>
          <button
            onClick={() => setIsThinkingDropdownOpen(!isThinkingDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] text-xs font-medium text-synai-text transition-all"
            title={`Thinking Level / Effort: ${activeThinkingObj.label} (${activeThinkingObj.desc})`}
          >
            <span>{activeThinkingObj.icon}</span>
            <span className="hidden md:inline capitalize">{activeThinkingObj.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-synai-muted" />
          </button>

          {isThinkingDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 glass-panel rounded-xl shadow-lg p-1.5 z-50">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-synai-muted uppercase tracking-wider flex items-center justify-between">
                <span>Effort & Thinking</span>
                <Brain className="w-3 h-3 text-cyan-400" />
              </div>
              <div className="space-y-0.5">
                {thinkingLevels.map((lvl) => {
                  const isSelected = lvl.key === normalizedCurrentThinking;
                  return (
                    <button
                      key={lvl.key}
                      onClick={() => {
                        onUpdateConfig({ thinkingLevel: lvl.key });
                        setIsThinkingDropdownOpen(false);
                      }}
                      className={clsx(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all",
                        isSelected
                          ? 'bg-clay/15 text-clay font-medium'
                          : 'text-synai-text hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{lvl.icon}</span>
                        <div>
                          <div className="font-medium capitalize">{lvl.label}</div>
                          <div className="text-[10px] text-synai-muted font-normal">{lvl.desc}</div>
                        </div>
                      </div>
                      {lvl.key === 'medium' && (
                        <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                          def
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mode Indicator Badge */}
        <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[var(--bg-hover)]">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => onUpdateConfig({ mode: m.key })}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-md transition-all text-xs",
                currentMode === m.key
                  ? "bg-surface shadow-sm text-synai-text font-medium"
                  : "text-synai-muted hover:text-synai-text hover:bg-[var(--bg-hover)]"
              )}
              title={`${m.label} Mode`}
            >
              {m.icon}
              <span className="hidden md:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Browser Toggle */}
        <button
          onClick={onOpenBrowserControl}
          className="p-1.5 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
          title="Browser Control"
        >
          <Globe className="w-4 h-4" />
        </button>

        {/* Artifacts Toggle */}
        {onToggleArtifacts && (
          <button
            onClick={onToggleArtifacts}
            className={clsx(
              "p-1.5 rounded-lg transition-all",
              isArtifactsOpen
                ? "bg-clay/10 text-clay"
                : "text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)]"
            )}
            title="Artifacts"
          >
            <Code2 className="w-4 h-4" />
          </button>
        )}

        {/* Settings Icon */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-synai-secondary hover:text-synai-text hover:bg-[var(--bg-hover)] transition-all"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
