import React, { useEffect, useRef, useState } from 'react';
import { ObsidianLive } from '../services/geminiService';
import { Icon } from './Icon';
import { UserSettings } from '../types';

interface LiveInterfaceProps {
  onClose: () => void;
  settings: UserSettings;
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ onClose, settings }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [audioLevel, setAudioLevel] = useState(0);
  const liveRef = useRef<ObsidianLive | null>(null);

  useEffect(() => {
    liveRef.current = new ObsidianLive(
      (s) => setStatus(s === 'disconnected' ? 'error' : s),
      (level) => setAudioLevel(prev => prev * 0.9 + level * 0.1) // Smooth out level
    );
    liveRef.current.connect(settings);

    return () => {
      liveRef.current?.disconnect();
    };
  }, []);

  // Visualizer Calculation
  const circleSize = 100 + (audioLevel * 300); // Base 100px, expands with volume
  const isUnhinged = settings.tone === 'Unhinged';
  
  return (
    <div className="fixed inset-0 z-50 bg-obsidian-950 flex flex-col items-center justify-center animate-fade-in">
      
      {/* Visualizer */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Core */}
        <div className={`absolute w-32 h-32 rounded-full border border-obsidian-700 z-10 flex items-center justify-center transition-all duration-300 ${status === 'connected' ? 'shadow-[0_0_50px_rgba(255,255,255,0.05)]' : ''} ${isUnhinged ? 'bg-red-950/30' : 'bg-obsidian-900'}`}>
           <div className={`w-2 h-2 rounded-full ${status === 'connected' ? (isUnhinged ? 'bg-red-600' : 'bg-green-500') : 'bg-obsidian-600'}`}></div>
        </div>

        {/* Ripple */}
        {status === 'connected' && (
             <div 
               className={`absolute rounded-full border transition-all duration-75 ease-out opacity-30 ${isUnhinged ? 'border-red-900' : 'border-obsidian-800'}`}
               style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
             ></div>
        )}
        
        {/* Second Ripple */}
        {status === 'connected' && (
             <div 
               className={`absolute rounded-full border transition-all duration-150 ease-out opacity-20 ${isUnhinged ? 'border-red-900' : 'border-obsidian-800'}`}
               style={{ width: `${circleSize * 1.2}px`, height: `${circleSize * 1.2}px` }}
             ></div>
        )}
      </div>

      <div className="mt-12 text-center space-y-2">
        <h2 className={`text-xl font-light tracking-widest ${isUnhinged ? 'text-red-500' : 'text-obsidian-200'}`}>
            {isUnhinged ? 'UNHINGED LIVE' : 'LIVE CONNECTION'}
        </h2>
        <p className="text-sm text-obsidian-500 font-mono uppercase">
            {status === 'connecting' && "Establishing Secure Uplink..."}
            {status === 'connected' && "NSD-CORE Audio Link Active"}
            {status === 'error' && "Connection Terminated"}
        </p>
      </div>

      {/* Controls */}
      <button 
        onClick={onClose}
        className="mt-16 group p-4 rounded-full bg-obsidian-900 border border-obsidian-800 hover:border-red-900/50 hover:bg-red-900/10 transition-all"
      >
        <Icon name="x" className="w-6 h-6 text-obsidian-400 group-hover:text-red-500" />
      </button>

    </div>
  );
};