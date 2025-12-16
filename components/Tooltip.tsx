import React, { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top' }) => {
  return (
    <div className="relative group flex items-center justify-center">
      {children}
      <div className={`
        absolute left-1/2 -translate-x-1/2 px-3 py-1.5 
        bg-obsidian-800 text-obsidian-500 text-[10px] font-mono uppercase tracking-wider rounded border border-obsidian-700
        opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-50
        ${position === 'top' ? '-top-10 translate-y-2' : 'top-full mt-3 -translate-y-2'}
      `}>
        {content}
        {/* Little arrow */}
        <div className={`
          absolute left-1/2 -translate-x-1/2 border-4 border-transparent
          ${position === 'top' ? 'top-full border-t-obsidian-700' : 'bottom-full border-b-obsidian-700'}
        `}></div>
      </div>
    </div>
  );
};