import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  FileCode,
  Terminal,
  ListTodo,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Code2,
  X,
} from 'lucide-react';
import { useAgentSocket } from './hooks/useAgentSocket.js';
import { Navbar } from './components/Navbar.js';
import { SynAISidebar } from './components/SynAISidebar.js';
import { FileTree } from './components/FileTree.js';
import { ChatArea } from './components/ChatArea.js';
import { DiffViewer } from './components/DiffViewer.js';
import { CodeViewer } from './components/CodeViewer.js';
import { TaskPlanPanel } from './components/TaskPlanPanel.js';
import { CheckpointsPanel } from './components/CheckpointsPanel.js';
import { TerminalPanel } from './components/TerminalPanel.js';
import { SettingsModal } from './components/SettingsModal.js';
import { RemoteDebuggingModal } from './components/RemoteDebuggingModal.js';
import { BrowserControlModal } from './components/BrowserControlModal.js';
import { WorkspaceFile, ToolCall } from './types/index.js';

export const App: React.FC = () => {
  const {
    isConnected,
    isBusy,
    statusText,
    messages,
    config,
    models,
    files,
    plan,
    checkpoints,
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
    triggerUndo,
    respondApproval,
    updateConfig,
    refreshFiles,
  } = useAgentSocket();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('synai-theme') as 'light' | 'dark') || 'dark';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [activeDiff, setActiveDiff] = useState<{ diff: string; path: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'diff' | 'code' | 'plan' | 'checkpoints' | 'terminal'>('code');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRemoteDebugOpen, setIsRemoteDebugOpen] = useState(false);
  const [isBrowserControlOpen, setIsBrowserControlOpen] = useState(false);

  // Sync theme with HTML class
  useEffect(() => {
    localStorage.setItem('synai-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectFile = (file: WorkspaceFile) => {
    setSelectedFile(file);
    setActiveTab('code');
    setIsRightPanelOpen(true);
  };

  const handleSelectDiff = (diff: string, path: string) => {
    setActiveDiff({ diff, path });
    setActiveTab('diff');
    setIsRightPanelOpen(true);
  };

  return (
    <div className="h-screen w-screen flex bg-background text-synai-text overflow-hidden select-none font-sans relative mesh-gradient">
      {/* Left: SynAI Sidebar */}
      <SynAISidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onNewChat={newConversation}
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={loadConversation}
        onDeleteConversation={deleteConversation}
        isFilesOpen={isFilesOpen}
        onToggleFiles={() => setIsFilesOpen(!isFilesOpen)}
        isArtifactsOpen={isRightPanelOpen}
        onToggleArtifacts={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onOpenBrowserControl={() => setIsBrowserControlOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Optional Workspace Files Drawer */}
      {isFilesOpen && (
        <FileTree
          files={files}
          selectedPath={selectedFile?.relativePath}
          onSelectFile={handleSelectFile}
          onRefresh={refreshFiles}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top SynAI Navbar */}
        <Navbar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          config={config}
          models={models}
          isConnected={isConnected}
          isBusy={isBusy}
          statusText={statusText}
          currentTopic={currentTopic}
          onUpdateConfig={updateConfig}
          onReset={reset}
          onNewChat={newConversation}
          onToggleHistory={() => setIsSidebarCollapsed(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenBrowserControl={() => setIsBrowserControlOpen(true)}
          isArtifactsOpen={isRightPanelOpen}
          onToggleArtifacts={() => setIsRightPanelOpen(!isRightPanelOpen)}
        />

        {/* Center Chat & Right Artifacts Split View */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          <ChatArea
            messages={messages}
            isBusy={isBusy}
            tasks={plan}
            pendingApproval={pendingApproval}
            onSendMessage={sendMessage}
            onAbort={abort}
            onRespondApproval={respondApproval}
            onSelectDiff={handleSelectDiff}
            onOpenBrowserControl={() => setIsBrowserControlOpen(true)}
            modelName={config?.model || 'SynAI'}
            thinkingLevel={config?.thinkingLevel || 'medium'}
            mode={config?.mode || 'confirm'}
          />

          {/* Right Panel: SynAI Artifacts Side-by-Side Inspector */}
          {isRightPanelOpen && (
            <aside className="w-96 lg:w-[480px] xl:w-[560px] border-l border-border glass-panel-heavy flex flex-col h-full shrink-0 shadow-lg z-20">
              {/* Artifacts Header */}
              <div className="h-11 bg-surface/80 backdrop-blur border-b border-border flex items-center justify-between px-3">
                {/* Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeTab === 'code'
                        ? 'bg-clay/10 text-clay font-semibold'
                        : 'text-synai-secondary hover:text-synai-text'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Editor</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('diff')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeTab === 'diff'
                        ? 'bg-clay/10 text-clay font-semibold'
                        : 'text-synai-secondary hover:text-synai-text'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Diff</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('plan')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeTab === 'plan'
                        ? 'bg-clay/10 text-clay font-semibold'
                        : 'text-synai-secondary hover:text-synai-text'
                    }`}
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Plan</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('checkpoints')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeTab === 'checkpoints'
                        ? 'bg-clay/10 text-clay font-semibold'
                        : 'text-synai-secondary hover:text-synai-text'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Checkpoints</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('terminal')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeTab === 'terminal'
                        ? 'bg-clay/10 text-clay font-semibold'
                        : 'text-synai-secondary hover:text-synai-text'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Terminal</span>
                  </button>
                </div>

                {/* Close Artifacts Button */}
                <button
                  onClick={() => setIsRightPanelOpen(false)}
                  className="p-1.5 rounded-lg text-synai-muted hover:text-synai-text hover:bg-surface-hover transition"
                  title="Close Artifacts"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Artifacts Body Content */}
              <div className="flex-1 min-h-0 overflow-hidden bg-transparent">
                {activeTab === 'code' && (
                  <CodeViewer file={selectedFile} onRefresh={refreshFiles} />
                )}

                {activeTab === 'diff' && (
                  <DiffViewer
                    diff={activeDiff?.diff || ''}
                    filePath={activeDiff?.path || ''}
                  />
                )}

                {activeTab === 'plan' && (
                  <TaskPlanPanel tasks={plan} />
                )}

                {activeTab === 'checkpoints' && (
                  <CheckpointsPanel
                    checkpoints={checkpoints}
                    onRollback={(id) => triggerUndo(id)}
                  />
                )}

                {activeTab === 'terminal' && (
                  <TerminalPanel toolCalls={messages.flatMap((m) => m.toolCalls || [])} />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        config={config}
        models={models}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(partial) => {
          updateConfig(partial);
          setIsSettingsOpen(false);
        }}
        onOpenRemoteDebugging={() => setIsRemoteDebugOpen(true)}
      />

      {/* Remote Debugging Permission Modal */}
      <RemoteDebuggingModal
        isOpen={isRemoteDebugOpen}
        onClose={() => setIsRemoteDebugOpen(false)}
        onLaunchChrome={() => {
          sendMessage('/browser:launch');
          setIsRemoteDebugOpen(false);
          setIsBrowserControlOpen(true);
        }}
        onProceedAnyway={() => {
          setIsRemoteDebugOpen(false);
          setIsBrowserControlOpen(true);
        }}
      />

      {/* Live Browser Management Modal */}
      <BrowserControlModal
        isOpen={isBrowserControlOpen}
        onClose={() => setIsBrowserControlOpen(false)}
        onOpenRemoteDebugging={() => setIsRemoteDebugOpen(true)}
        onExecuteBrowserCommand={(cmd) => sendMessage(cmd)}
      />
    </div>
  );
};

export default App;
