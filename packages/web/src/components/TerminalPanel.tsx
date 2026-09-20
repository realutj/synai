import React, { useState } from 'react';
import { Terminal, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ToolCall } from '../types/index.js';

interface TerminalPanelProps {
  toolCalls?: ToolCall[];
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ toolCalls = [] }) => {
  const [cleared, setCleared] = useState(false);

  const commandTools = cleared ? [] : toolCalls.filter((tc) => tc.name === 'run_command');

  return (
    <div className="flex flex-col h-full bg-[#050505] text-gray-200 overflow-hidden text-xs">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border">
        <div className="flex items-center gap-2 font-mono">
          <Terminal className="w-4 h-4 text-white" />
          <span className="text-gray-200 font-semibold">Terminal Output</span>
        </div>
        <button
          onClick={() => setCleared(true)}
          title="Clear terminal"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-surface-hover transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] space-y-3 leading-relaxed">
        {commandTools.length === 0 ? (
          <div className="text-gray-500 italic py-4 text-center">
            No terminal commands executed in this session.
          </div>
        ) : (
          commandTools.map((tc, idx) => (
            <div key={idx} className="space-y-1">
              {/* Command line */}
              <div className="flex items-center gap-2 text-neutral-300">
                <span className="text-white font-bold">$</span>
                <span className="font-semibold">{tc.args.command}</span>
                {tc.status === 'completed' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                )}
                {tc.status === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                )}
              </div>

              {/* Command Output */}
              {tc.output && (
                <pre
                  className={`p-2 rounded text-[11.5px] whitespace-pre-wrap ${
                    tc.isError
                      ? 'bg-white/[0.04] text-neutral-200 border border-white/20'
                      : 'bg-background/80 text-gray-300 border border-border/60'
                  }`}
                >
                  {tc.output}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
