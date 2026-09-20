import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content into blocks: code blocks vs text blocks
  const parts: { type: 'code' | 'text'; lang?: string; text: string }[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      lang: match[1].trim() || 'text',
      text: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  return (
    <div className="space-y-3 font-sans text-xs leading-relaxed text-gray-200">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} language={part.lang || 'text'} code={part.text} />;
        }
        return <TextBlock key={index} text={part.text} />;
      })}
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');
  const isDiff = language.toLowerCase() === 'diff';

  return (
    <div className="my-2.5 rounded-lg border border-white/15 bg-[#09090b] overflow-hidden shadow-md text-xs font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/10 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5 font-semibold text-gray-300">
          {isDiff ? <Terminal className="w-3.5 h-3.5 text-neutral-300" /> : <Code2 className="w-3.5 h-3.5 text-neutral-300" />}
          <span className="uppercase">{language}</span>
          <span className="text-gray-600">({lines.length} lines)</span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition text-[10.5px]"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code contents */}
      <div className="p-3 overflow-x-auto text-[12px] leading-relaxed">
        {lines.map((line, idx) => {
          let lineClass = 'text-gray-200';
          if (isDiff) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-emerald-400 bg-emerald-500/10 -mx-3 px-3 block';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-rose-400 bg-rose-500/10 -mx-3 px-3 block';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-neutral-400 font-semibold';
            }
          }

          return (
            <div key={idx} className="flex">
              <span className="select-none text-gray-600 text-right pr-4 shrink-0 min-w-[2.2rem] text-[11px]">
                {idx + 1}
              </span>
              <span className={`${lineClass} whitespace-pre flex-1`}>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TextBlockProps {
  text: string;
}

const TextBlock: React.FC<TextBlockProps> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        // Headings
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-white text-sm pt-2 pb-1">
              {renderInlineMarkdown(line.replace('### ', ''))}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-white text-base pt-2.5 pb-1 border-b border-white/10">
              {renderInlineMarkdown(line.replace('## ', ''))}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-bold text-white text-lg pt-3 pb-1 border-b border-white/15">
              {renderInlineMarkdown(line.replace('# ', ''))}
            </h2>
          );
        }

        // Blockquotes
        if (line.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-white/40 pl-3 py-1 my-1 text-gray-400 italic bg-white/[0.02] rounded-r"
            >
              {renderInlineMarkdown(line.replace('> ', ''))}
            </blockquote>
          );
        }

        // Bullet lists
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const content = line.trim().replace(/^[\*\-]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-white mt-1 shrink-0">•</span>
              <span className="text-gray-200">{renderInlineMarkdown(content)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-neutral-400 font-mono text-[11px] shrink-0 font-semibold">{numMatch[1]}.</span>
              <span className="text-gray-200">{renderInlineMarkdown(numMatch[2])}</span>
            </div>
          );
        }

        // Blank line
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }

        // Regular paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
};

function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to split by bold (**text**), inline code (`code`), or normal text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-200 font-mono text-[11px] border border-white/10 mx-0.5"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
