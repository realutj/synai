import React, { useState, useEffect } from 'react';
import { Save, Check, FileCode, Copy } from 'lucide-react';
import { WorkspaceFile } from '../types/index.js';

interface CodeViewerProps {
  file: WorkspaceFile | null;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!file || file.isDirectory) {
      setContent('');
      return;
    }

    setLoading(true);
    fetch(`/api/file?path=${encodeURIComponent(file.relativePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setContent(data.content || '');
        } else {
          setContent(`// Failed to load file: ${data.error}`);
        }
      })
      .catch((err) => {
        setContent(`// Error loading file: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [file]);

  const handleSave = async () => {
    if (!file) return;
    try {
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.relativePath, content }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs p-6">
        <FileCode className="w-8 h-8 mb-2 opacity-40 text-neutral-400" />
        <p>No file selected.</p>
        <p className="text-[11px] text-gray-600 mt-1">
          Select a file from the workspace tree to view or edit its contents.
        </p>
      </div>
    );
  }

  const lines = content.split('\n');

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden text-xs">
      {/* File Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border">
        <div className="flex items-center gap-2 font-mono truncate">
          <FileCode className="w-4 h-4 text-neutral-300 shrink-0" />
          <span className="text-gray-200 font-semibold truncate">{file.relativePath}</span>
          <span className="text-[11px] text-gray-500 font-mono">({lines.length} lines)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title="Copy code"
            className="flex items-center gap-1 px-2 py-1 bg-surface-hover hover:bg-border text-gray-300 rounded text-xs transition"
          >
            {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleSave}
            title="Save file changes"
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-200 text-black font-medium rounded text-xs transition shadow-sm"
          >
            {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Content */}
      <div className="flex-1 relative overflow-hidden flex">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
            Loading file...
          </div>
        ) : (
          <div className="flex-1 flex overflow-auto font-mono text-[12px] leading-relaxed">
            {/* Line numbers */}
            <div className="bg-[#0d0d0d] py-2 px-2 text-right text-gray-600 select-none border-r border-border shrink-0 min-w-[3rem]">
              {lines.map((_, i) => (
                <div key={i} className="h-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editable code area */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="flex-1 p-2 bg-transparent text-gray-200 resize-none outline-none font-mono text-[12px] leading-relaxed whitespace-pre"
              style={{ lineHeight: '1.25rem' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
