import React, { useEffect, useState, useRef } from 'react';
import { Icon } from './Icon';

interface LogEntry {
  type: 'log' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export const DebugConsole: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Auto scroll to bottom
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  useEffect(() => {
    // Intercept console logging
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (type: 'log' | 'warn' | 'error', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      const entry: LogEntry = {
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setLogs(prev => [...prev.slice(-100), entry]); // Keep last 100 logs
    };

    console.log = (...args) => {
      addLog('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      addLog('error', args);
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[300px] bg-black/90 border-t-2 border-obsidian-700 z-[100] flex flex-col font-mono text-xs shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
       {/* Header */}
       <div className="flex items-center justify-between px-4 py-2 bg-obsidian-900 border-b border-obsidian-800">
           <div className="flex items-center gap-2">
               <Icon name="zap" className="w-3 h-3 text-yellow-500" />
               <span className="font-bold text-obsidian-200">SYSTEM DEBUG KERNEL</span>
           </div>
           <div className="flex items-center gap-4">
               <button onClick={() => setLogs([])} className="text-obsidian-400 hover:text-white uppercase tracking-wider">Clear</button>
               <button onClick={onClose} className="text-obsidian-400 hover:text-white">
                   <Icon name="x" className="w-4 h-4" />
               </button>
           </div>
       </div>

       {/* Log Window */}
       <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
           {logs.length === 0 && (
               <div className="text-obsidian-600 italic text-center mt-10">System nominal. Waiting for events...</div>
           )}
           {logs.map((log, i) => (
               <div key={i} className={`flex gap-3 font-mono border-b border-white/5 pb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-green-400/80'}`}>
                   <span className="opacity-50 shrink-0">[{log.timestamp}]</span>
                   <span className="uppercase shrink-0 w-12 text-center border border-white/10 rounded px-1 text-[9px] h-fit mt-0.5">{log.type}</span>
                   <span className="break-all whitespace-pre-wrap">{log.message}</span>
               </div>
           ))}
       </div>
    </div>
  );
};