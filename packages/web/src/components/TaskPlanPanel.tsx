import React from 'react';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  TrendingUp,
} from 'lucide-react';
import { TaskItem } from '../types/index.js';

interface TaskPlanPanelProps {
  tasks: TaskItem[];
}

export const TaskPlanPanel: React.FC<TaskPlanPanelProps> = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs p-6 text-center font-sans">
        <ListTodo className="w-8 h-8 mb-2 opacity-40 text-neutral-400" />
        <p className="font-semibold text-gray-300">No active task plan</p>
        <p className="text-[11.5px] text-gray-500 mt-1 leading-relaxed">
          When SynAI plans a multi-step task, the autonomous roadmap and live progress will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden text-xs font-sans">
      {/* Header & Progress */}
      <div className="p-3.5 bg-surface border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-100">
            <TrendingUp className="w-4 h-4 text-white" />
            <span>Task Roadmap ({completed}/{total} done)</span>
          </div>
          <span className="text-white font-bold text-xs">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto p-3.5 space-y-2.5">
        {tasks.map((task) => {
          let badgeClass = 'bg-surface border-border text-gray-400';
          let icon = <Circle className="w-3.5 h-3.5 text-gray-500 shrink-0" />;

          if (task.status === 'completed') {
            badgeClass = 'bg-white/5 border-white/20 text-gray-400';
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
          } else if (task.status === 'in_progress') {
            badgeClass = 'bg-white/10 border-white/40 text-white';
            icon = <Clock className="w-3.5 h-3.5 text-white animate-spin shrink-0" />;
          } else if (task.status === 'failed') {
            badgeClass = 'bg-white/[0.03] border-white/25 text-neutral-300';
            icon = <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />;
          }

          return (
            <div
              key={task.id}
              className={`p-3 rounded-xl border transition ${badgeClass} space-y-1.5`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5">{icon}</span>
                <div className="flex-1">
                  <div
                    className={`font-semibold text-[12.5px] ${
                      task.status === 'completed' ? 'line-through opacity-70 text-gray-400' : 'text-gray-100'
                    }`}
                  >
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-[11.5px] text-gray-400 mt-1 leading-relaxed font-normal">
                      {task.description}
                    </div>
                  )}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-2 pl-2.5 border-l-2 border-border/70 space-y-1">
                      {task.subtasks.map((st, i) => (
                        <div key={i} className="text-[11px] text-gray-400">
                          • {st}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
