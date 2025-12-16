import React, { useState } from 'react';
import { Icon } from './Icon';

interface CodeBlockProps {
  language: string;
  children: React.ReactNode;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Extract text content from children
    let text = '';
    if (typeof children === 'string') {
        text = children;
    } else if (Array.isArray(children)) {
        text = children.map(child => (typeof child === 'string' ? child : child?.props?.children)).join('');
    } else if (typeof children === 'object' && children !== null) {
         // @ts-ignore
         text = children.props?.children || '';
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-obsidian-800 bg-obsidian-950/80 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-obsidian-900 border-b border-obsidian-800">
        <span className="text-[10px] font-mono uppercase tracking-widest text-obsidian-500">
          {language || 'PLAINTEXT'}
        </span>
        <button 
          onClick={handleCopy}
          className="group flex items-center gap-2 text-[10px] uppercase tracking-wider text-obsidian-500 hover:text-white transition-colors"
        >
          {copied ? (
            <span className="flex items-center gap-1.5 text-green-500 animate-fade-in-up">
              <Icon name="check" className="w-3 h-3" />
              Copied
            </span>
          ) : (
            <span className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <Icon name="copy" className="w-3 h-3" />
              Copy
            </span>
          )}
        </button>
      </div>
      
      {/* Code Area */}
      <div className="p-4 overflow-x-auto">
        <code className="font-mono text-sm text-obsidian-200 leading-relaxed block whitespace-pre">
          {children}
        </code>
      </div>
    </div>
  );
};