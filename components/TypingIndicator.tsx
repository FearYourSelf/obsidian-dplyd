import React from 'react';
import { ModelTier } from '../types';

interface TypingIndicatorProps {
    tier?: ModelTier;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ tier = ModelTier.BALANCED }) => {
  // Determine animation class based on tier
  const isReasoning = tier === ModelTier.REASONING;
  
  // Reasoning: Slower, deeper pulse. Balanced/Fast: Quicker neural wave.
  const animationClass = isReasoning 
    ? 'animate-pulse-slow' // Custom slow pulse
    : 'animate-neural-wave';

  return (
    <div className="flex items-center gap-1 h-5">
      <div className={`w-1 bg-obsidian-500 rounded-full ${animationClass} [animation-delay:0ms] ${isReasoning ? 'h-3 w-3 opacity-60' : 'h-2'}`}></div>
      <div className={`w-1 bg-obsidian-500 rounded-full ${animationClass} [animation-delay:150ms] ${isReasoning ? 'h-4 w-4 opacity-80' : 'h-4'}`}></div>
      <div className={`w-1 bg-obsidian-500 rounded-full ${animationClass} [animation-delay:300ms] ${isReasoning ? 'h-3 w-3 opacity-60' : 'h-2'}`}></div>
    </div>
  );
};