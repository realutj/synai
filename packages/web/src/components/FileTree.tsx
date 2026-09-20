import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { WorkspaceFile } from '../types/index.js';

interface FileTreeProps {
  files: WorkspaceFile[];
  selectedPath?: string;
  onSelectFile: (file: WorkspaceFile) => void;
  onRefresh: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedPath,
  onSelectFile,
  onRefresh,
}) => {
  const [filter, setFilter] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['.']));

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const getFileIcon = (fileName: string, isDirectory: boolean, isOpen: boolean) => {
    if (isDirectory) {
      return isOpen ? (
        <FolderOpen className="w-4 h-4 text-white shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-neutral-400 shrink-0" />
      );
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-neutral-300 shrink-0" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-neutral-300 shrink-0" />;
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-neutral-300 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-gray-400 shrink-0" />;
    }
  };

  const renderNode = (item: WorkspaceFile, depth: number = 0) => {
    if (filter && !item.name.toLowerCase().includes(filter.toLowerCase()) && !item.isDirectory) {
      return null;
    }

    const isOpen = expandedDirs.has(item.relativePath || item.path);
    const isSelected = selectedPath === item.relativePath;

    return (
      <div key={item.path} className="select-none text-xs font-sans">
        <div
          onClick={() => {
            if (item.isDirectory) {
              toggleDir(item.relativePath || item.path);
            } else {
              onSelectFile(item);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer transition rounded group ${
            isSelected
              ? 'bg-white/10 text-white font-medium'
              : 'text-gray-300 hover:bg-surface hover:text-white'
          }`}
        >
          {item.isDirectory ? (
            <span className="text-gray-500 group-hover:text-gray-300">
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}

          {getFileIcon(item.name, item.isDirectory, isOpen)}
          <span className="truncate font-sans font-normal text-xs">{item.name}</span>
        </div>

        {item.isDirectory && isOpen && item.children && (
          <div>{item.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 border-r border-border bg-[#0d0d0d]/50 flex flex-col h-full shrink-0 font-sans">
      {/* Header & Search */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">
            Workspace Files
          </span>
          <button
            onClick={onRefresh}
            title="Refresh files"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-surface transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-background border border-border rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/50 font-sans"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1 py-2">
        {files.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 font-sans">No files found</div>
        ) : (
          files.map((f) => renderNode(f, 0))
        )}
      </div>
    </aside>
  );
};
