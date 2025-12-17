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
  const wakeLockRef = useRef<any>(null);

  // Function to request Screen Wake Lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Obsidian: Screen Wake Lock Active');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Obsidian: Screen Wake Lock Released');
        });
      }
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  useEffect(() => {
    liveRef.current = new ObsidianLive(
      (s) => setStatus(s === 'disconnected' ? 'error' : s),
      (level) => setAudioLevel(prev => prev * 0.9 + level * 0.1) // Smooth out level
    );
    liveRef.current.connect(settings);

    // Initial wake lock request
    requestWakeLock();

    // Re-acquire wake lock if page becomes visible again
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      liveRef.current?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Visualizer Calculation
  const circleSize = 100 + (audioLevel * 300); // Base 100px, expands with volume
  const isUnhinged = settings.tone === 'Unhinged';
  
  return (
    <div className="fixed inset-0 z-50 bg-obsidian-950 flex flex-col items-center justify-center animate-fade-in">
      
      {/* Background layer: Removed animate-pulse to prevent distraction */}
      <div className={`absolute inset-0 opacity-5 pointer-events-none transition-colors duration-1000 ${isUnhinged ? 'bg-red-900' : 'bg-obsidian-400'}`}></div>

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

      <div className="mt-12 text-center space-y-2 relative z-10">
        <h2 className={`text-xl font-light tracking-widest ${isUnhinged ? 'text-red-500' : 'text-obsidian-200'}`}>
            {isUnhinged ? 'UNHINGED LIVE' : 'LIVE CONNECTION'}
        </h2>
        <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-obsidian-500 font-mono uppercase tracking-widest">
                {status === 'connecting' && "Establishing Secure Uplink..."}
                {status === 'connected' && "NSD-CORE Audio Link Active"}
                {status === 'error' && "Connection Terminated"}
            </p>
            {status === 'connected' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-obsidian-900/50 border border-obsidian-800 rounded-full">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-mono text-obsidian-400 uppercase tracking-tighter">Stay-Awake Protocol Engaged</span>
                </div>
            )}
        </div>
      </div>

      {/* Controls */}
      <button 
        onClick={onClose}
        className="mt-16 group p-4 rounded-full bg-obsidian-900 border border-obsidian-800 hover:border-red-900/50 hover:bg-red-900/10 transition-all relative z-10"
      >
        <Icon name="x" className="w-6 h-6 text-obsidian-400 group-hover:text-red-500" />
      </button>

      {/* Subliminal usage info */}
      <div className="absolute bottom-10 text-[9px] font-mono text-obsidian-700 uppercase tracking-[0.3em] opacity-40">
        Audio persistence active for locked devices
      </div>

    </div>
  );
};