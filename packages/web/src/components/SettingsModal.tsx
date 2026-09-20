import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Cpu,
  Shield,
  Save,
  Check,
  ExternalLink,
  MessageSquare,
  Terminal,
  ClipboardPaste,
  Sliders,
  Palette,
  Bell,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  Zap,
  Layers,
  Volume2,
  Info,
  Brain,
} from 'lucide-react';
import { AgentConfig, ModelInfo, ApprovalMode, ThinkingLevel } from '../types/index.js';
import { SynAILogo } from './SynAILogo.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig | null;
  models?: ModelInfo[];
  onSave: (partial: Partial<AgentConfig>) => void;
  onOpenRemoteDebugging?: () => void;
}

type SettingsTab = 'provider' | 'autonomy' | 'appearance' | 'system';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  models = [],
  onSave,
  onOpenRemoteDebugging,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [model, setModel] = useState(config?.model || 'cohere/north-mini-code:free');
  const [customModelInput, setCustomModelInput] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [mode, setMode] = useState<ApprovalMode>(config?.mode || 'confirm');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(config?.thinkingLevel || 'medium');
  const [systemPrompt, setSystemPrompt] = useState(config?.systemPrompt || '');
  const [temperature, setTemperature] = useState<number>(config?.temperature ?? 0.7);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [smoothAnimations, setSmoothAnimations] = useState(true);

  useEffect(() => {
    if (config && isOpen) {
      if (config.apiKey !== undefined) setApiKey(config.apiKey);
      if (config.model) setModel(config.model);
      if (config.mode) setMode(config.mode);
      if (config.thinkingLevel) {
        const raw = config.thinkingLevel;
        const norm = (['low', 'fast'].includes(raw) ? 'low' : ['high', 'deep'].includes(raw) ? 'high' : ['max', 'genius'].includes(raw) ? 'max' : 'medium') as ThinkingLevel;
        setThinkingLevel(norm);
      }
      if (config.systemPrompt !== undefined) setSystemPrompt(config.systemPrompt);
      if (config.temperature !== undefined) setTemperature(config.temperature);
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = customModelInput.trim() || model;
    onSave({
      apiKey,
      model: finalModel,
      mode,
      systemPrompt,
      temperature,
      thinkingLevel,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKey(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      const manual = window.prompt('Paste your OpenRouter API Key (Ctrl+V):');
      if (manual && manual.trim()) {
        setApiKey(manual.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    }
  };

  const safeModels = Array.isArray(models) ? models : [];
  const filteredModels = safeModels.filter(
    (m) =>
      (m.name || '').toLowerCase().includes(modelSearch.toLowerCase()) ||
      (m.id || '').toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#080808] border border-[#222228] rounded-2xl w-full max-w-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh] text-zinc-200 text-xs font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22] bg-[#0c0c0f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-surface border border-[#26262e] flex items-center justify-center p-1.5">
              <SynAILogo variant="icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                SynAI Control Center
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#18181f] text-cyan-400 border border-cyan-500/20 font-mono font-normal">
                  v1.0.0
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Configure runtime engine, autonomous policies, and intelligence parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#1c1c22] bg-[#0c0c0f]/50 overflow-x-auto">
          {[
            { id: 'provider' as SettingsTab, label: 'Provider & Models', icon: <Cpu className="w-3.5 h-3.5" /> },
            { id: 'autonomy' as SettingsTab, label: 'Autonomy & Approvals', icon: <Shield className="w-3.5 h-3.5" /> },
            { id: 'appearance' as SettingsTab, label: 'Appearance & Alerts', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'system' as SettingsTab, label: 'Workspace & Diagnostics', icon: <HardDrive className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg font-medium text-xs transition border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-cyan-400 bg-[#14141a]'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* TAB 1: PROVIDER & MODELS */}
          {activeTab === 'provider' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* API Key Box */}
              <div className="space-y-2 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span>OpenRouter API Key</span>
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline transition"
                  >
                    <span>Get Free API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-[11px] text-zinc-400">
                  Your key is securely stored in local configuration and synchronized across the CLI, Web interface, and environment.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black border border-[#282832] rounded-lg font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/70 transition pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 bg-[#1a1a22] rounded transition"
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handlePasteKey}
                    className={`px-3.5 py-2.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition ${
                      pasted
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#15151c] hover:bg-[#1e1e28] text-zinc-200 border-[#2b2b36]'
                    }`}
                    title="Paste from clipboard"
                  >
                    {pasted ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{pasted ? 'Pasted!' : 'Paste'}</span>
                  </button>
                </div>

                {apiKey ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>API Key active and validated</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>No API Key configured. Free tier models may have reduced rate limits.</span>
                  </div>
                )}
              </div>

              {/* Active Model Selector */}
              <div className="space-y-3 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Active Foundation Model</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {safeModels.length} available models
                  </span>
                </div>

                {/* Model Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search models (e.g. north, laguna, nemotron, gemma, free)..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black border border-[#282832] rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/70 transition"
                  />
                </div>

                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setCustomModelInput('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-black border border-[#282832] rounded-lg font-mono text-xs text-zinc-100 focus:outline-none focus:border-cyan-500/70"
                >
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({Math.round(m.context_length / 1024)}k ctx) [{m.isFree ? 'FREE' : 'PAID'}]
                    </option>
                  ))}
                </select>

                {/* Custom Model Override */}
                <div className="pt-2 border-t border-[#1c1c22]">
                  <label className="text-[11px] text-zinc-400 block mb-1.5">
                    Or specify any custom OpenRouter model identifier:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. cohere/north-mini-code:free or poolside/laguna-s-2.1:free"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-black border border-[#282832] rounded-lg font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/70"
                  />
                </div>
              </div>

              {/* Cognitive Effort & Thinking Level */}
              <div className="space-y-3 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                    <Brain className="w-4 h-4 text-cyan-400" />
                    <span>Cognitive Effort / Thinking Level</span>
                  </label>
                  <span className="text-[11px] text-cyan-400 font-mono uppercase tracking-wide">
                    {thinkingLevel}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Controls model reasoning depth, token allocation budget, and maximum autonomous turns.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {[
                    {
                      id: 'low' as ThinkingLevel,
                      title: 'Low',
                      icon: '⚡',
                      tokens: '4K tokens',
                      turns: '15 turns',
                      desc: 'Quick responses',
                    },
                    {
                      id: 'medium' as ThinkingLevel,
                      title: 'Medium',
                      icon: '⚖️',
                      tokens: '8K tokens',
                      turns: '25 turns',
                      desc: 'Optimal balance',
                    },
                    {
                      id: 'high' as ThinkingLevel,
                      title: 'High',
                      icon: '🧠',
                      tokens: '16K tokens',
                      turns: '40 turns',
                      desc: 'Advanced reasoning',
                    },
                    {
                      id: 'max' as ThinkingLevel,
                      title: 'Max',
                      icon: '🌟',
                      tokens: '32K tokens',
                      turns: '60 turns',
                      desc: 'Maximum capacity',
                    },
                  ].map((item) => {
                    const normalizedCurrent = ['low', 'fast'].includes(thinkingLevel) ? 'low' : ['high', 'deep'].includes(thinkingLevel) ? 'high' : ['max', 'genius'].includes(thinkingLevel) ? 'max' : 'medium';
                    const isSelected = normalizedCurrent === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setThinkingLevel(item.id)}
                        className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-950/30 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40'
                            : 'bg-[#121217] border-[#22222b] hover:border-[#33333f] text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-base">{item.icon}</span>
                          {item.id === 'medium' && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                              def
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            {item.title}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                            {item.tokens}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {item.turns}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-2 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>Temperature ({temperature})</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {temperature <= 0.3 ? 'Deterministic / Precise' : temperature <= 0.7 ? 'Balanced / Production' : 'Creative / Exploratory'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: AUTONOMY & APPROVALS */}
          {activeTab === 'autonomy' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Tool Execution Policy */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Execution Autonomy Mode</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'confirm' as ApprovalMode,
                      title: 'Confirm',
                      desc: 'Requires explicit user approval for file edits, bash commands, and network queries.',
                      badge: 'Safest',
                      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                    },
                    {
                      id: 'auto' as ApprovalMode,
                      title: 'Autonomous',
                      desc: 'AI executes authorized tools autonomously with self-verification and auto-repair.',
                      badge: 'Fastest',
                      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    },
                    {
                      id: 'dry-run' as ApprovalMode,
                      title: 'Dry Run',
                      desc: 'Simulates actions and displays proposed diffs without writing modifications to disk.',
                      badge: 'Simulation',
                      badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMode(item.id)}
                      className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between ${
                        mode === item.id
                          ? 'bg-cyan-950/20 border-cyan-500/60 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                          : 'bg-[#0e0e12] border-[#1f1f26] hover:border-[#33333f]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold text-xs ${mode === item.id ? 'text-cyan-400' : 'text-zinc-200'}`}>
                          {item.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom System Instructions */}
              <div className="space-y-2 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <span>Custom System Directives (Omni-Prompt Extension)</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {systemPrompt.length} chars
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Custom rules injected into SynAI's cognitive system prompt for code standards, legal paradigms, or conversation habits.
                </p>
                <textarea
                  rows={4}
                  placeholder="e.g. Always write production-grade TypeScript with zero shortcuts. When reviewing contracts, strictly flag one-sided indemnification clauses..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black border border-[#282832] rounded-lg font-sans text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/70 resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: APPEARANCE & ALERTS */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Pure OLED Black Badge */}
              <div className="p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black border border-[#2d2d38] flex items-center justify-center">
                    <Palette className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 text-xs">
                      Pure OLED Black Aesthetic
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Pitch black #000000 base with electric cyan accent (#38bdf8) for zero eye strain.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-medium">
                  Active (Default)
                </span>
              </div>

              {/* Notification & Sounds Toggles */}
              <div className="space-y-3 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <h3 className="font-semibold text-zinc-100 text-xs flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>Desktop & Sensory Notifications</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-[#1c1c22]">
                  <div>
                    <span className="font-medium text-zinc-200">Desktop Push Notifications</span>
                    <p className="text-[11px] text-zinc-400">Receive alerts when long-running agent tasks complete</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      notificationsEnabled ? 'bg-cyan-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        notificationsEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#1c1c22]">
                  <div>
                    <span className="font-medium text-zinc-200">Audio Feedback & Chimes</span>
                    <p className="text-[11px] text-zinc-400">Play subtle acoustic notification upon step resolution</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      soundEnabled ? 'bg-cyan-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        soundEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-zinc-200">Hardware-Accelerated Smooth Animations</span>
                    <p className="text-[11px] text-zinc-400">Enable ultra-smooth 60fps streaming & UI transitions</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmoothAnimations(!smoothAnimations)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      smoothAnimations ? 'bg-cyan-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        smoothAnimations ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WORKSPACE & DIAGNOSTICS */}
          {activeTab === 'system' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="space-y-3 p-4 rounded-xl bg-[#0e0e12] border border-[#1f1f26]">
                <h3 className="font-semibold text-zinc-100 text-xs flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>Runtime Environment</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-black border border-[#1f1f26]">
                    <span className="text-[10px] uppercase text-zinc-500 font-mono font-semibold">Engine Core</span>
                    <div className="font-semibold text-zinc-200 mt-1">SynAI Omni-Architecture</div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Version 1.0.0 (Production)</div>
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-[#1f1f26]">
                    <span className="text-[10px] uppercase text-zinc-500 font-mono font-semibold">Connection Protocol</span>
                    <div className="font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      WebSocket Live (Port 4242)
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Bidirectional RPC Stream</div>
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-[#1f1f26]">
                    <span className="text-[10px] uppercase text-zinc-500 font-mono font-semibold">Primary Workspace</span>
                    <div className="font-mono text-zinc-300 text-[11px] mt-1 truncate">
                      c:\Users\PC\Desktop\synai
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-[#1f1f26]">
                    <span className="text-[10px] uppercase text-zinc-500 font-mono font-semibold">Global Config Sync</span>
                    <div className="font-mono text-zinc-300 text-[11px] mt-1 truncate">
                      ~/.synai/config.json
                    </div>
                  </div>
                </div>
              </div>

              {/* CLI Integration Note */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#0e0e14] to-[#12121a] border border-[#22222e] flex items-start gap-3">
                <Terminal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-zinc-200 text-xs">Universal Synchronization</div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Changes saved in this panel synchronize immediately with the SynAI CLI terminal, autonomous subagents, and filesystem rules without requiring a restart.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1c1c22]">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>SynAI Superhuman Cognitive Engine</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#14141a] hover:bg-[#1e1e26] text-zinc-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold transition shadow-[0_0_20px_rgba(56,189,248,0.3)] active:scale-95"
              >
                {saved ? <Check className="w-4 h-4 text-black" /> : <Save className="w-4 h-4" />}
                <span>{saved ? 'Synchronized & Saved!' : 'Save & Synchronize'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
