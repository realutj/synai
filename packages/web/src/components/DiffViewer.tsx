import React from 'react';
import { GitCommit, Plus, Minus, FileCode } from 'lucide-react';

interface DiffViewerProps {
  diffText?: string;
  filePath?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, filePath }) => {
  if (!diffText) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs p-6">
        <GitCommit className="w-8 h-8 mb-2 opacity-40 text-neutral-400" />
        <p>No active diff to display.</p>
        <p className="text-[11px] text-gray-600 mt-1">
          When SynAI edits files, proposed changes and diffs appear here.
        </p>
      </div>
    );
  }

  const lines = diffText.split('\n');
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden text-xs">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border">
        <div className="flex items-center gap-2 font-mono truncate">
          <FileCode className="w-4 h-4 text-neutral-300 shrink-0" />
          <span className="text-gray-200 font-semibold truncate">{filePath || 'Changes Diff'}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1 text-white font-mono font-medium">
            <Plus className="w-3 h-3" /> {added}
          </span>
          <span className="flex items-center gap-1 text-neutral-500 font-mono font-medium">
            <Minus className="w-3 h-3" /> {removed}
          </span>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto p-2 font-mono text-[11.5px] leading-relaxed">
        {lines.map((line, idx) => {
          let lineClass = 'text-gray-300 hover:bg-surface/40';
          let indicator = ' ';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'bg-white/10 text-white border-l-2 border-white';
            indicator = '+';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'bg-white/[0.03] text-neutral-500 border-l-2 border-neutral-600';
            indicator = '-';
          } else if (line.startsWith('@@')) {
            lineClass = 'bg-white/[0.06] text-neutral-200 py-0.5 my-1 rounded-sm';
            indicator = '@';
          } else if (line.startsWith('---') || line.startsWith('+++')) {
            lineClass = 'text-gray-500 italic';
          }

          return (
            <div key={idx} className={`px-2 py-0.5 font-mono whitespace-pre flex gap-2 ${lineClass}`}>
              <span className="text-gray-600 select-none w-8 text-right shrink-0">{idx + 1}</span>
              <span className="select-none font-bold opacity-60 w-3">{indicator}</span>
              <span className="flex-1">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
