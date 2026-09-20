import React from 'react';
import { History, RotateCcw, FileText, CheckCircle2, Shield } from 'lucide-react';
import { Checkpoint } from '../types/index.js';

interface CheckpointsPanelProps {
  checkpoints: Checkpoint[];
  onUndo: () => void;
}

export const CheckpointsPanel: React.FC<CheckpointsPanelProps> = ({
  checkpoints,
  onUndo,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden text-xs font-sans">
      {/* Header & Undo Action */}
      <div className="p-3.5 bg-surface border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-gray-100">
          <History className="w-4 h-4 text-white" />
          <span>Rollback Checkpoints ({checkpoints.length})</span>
        </div>
        <button
          onClick={onUndo}
          disabled={checkpoints.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow-sm ${
            checkpoints.length > 0
              ? 'bg-transparent hover:bg-white/10 text-white border border-white/40 cursor-pointer'
              : 'bg-surface text-gray-600 border border-border cursor-not-allowed'
          }`}
          title="Revert the last modification"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Undo Latest</span>
        </button>
      </div>

      {/* Checkpoints Timeline */}
      <div className="flex-1 overflow-auto p-3.5 space-y-3">
        {checkpoints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs p-6 text-center font-sans">
            <Shield className="w-8 h-8 mb-2 opacity-40 text-neutral-400" />
            <p className="font-semibold text-gray-300">Workspace Protected</p>
            <p className="text-[11.5px] text-gray-500 mt-1 leading-relaxed">
              Automatic snapshots are recorded before every file write or edit so you can instantly undo at any time.
            </p>
          </div>
        ) : (
          checkpoints.map((cp, idx) => {
            const dateStr = new Date(cp.timestamp).toLocaleTimeString();
            const isLatest = idx === 0;

            return (
              <div
                key={cp.id}
                className={`p-3.5 rounded-xl border transition ${
                  isLatest
                    ? 'bg-white/5 border-white/30 text-white shadow-sm'
                    : 'bg-surface border-border text-gray-300'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="text-white text-xs font-semibold">{dateStr}</span>
                    {isLatest && (
                      <span className="px-1.5 py-0.5 rounded bg-white text-black text-[10px] uppercase font-bold">
                        Latest
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] text-gray-400 font-medium px-1.5 py-0.5 rounded bg-background">
                    {cp.toolName}
                  </span>
                </div>

                <div className="text-gray-100 font-semibold text-xs leading-relaxed">
                  {cp.description}
                </div>

                <div className="pt-1.5 border-t border-border/50 space-y-1">
                  {cp.files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="truncate">{f.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
