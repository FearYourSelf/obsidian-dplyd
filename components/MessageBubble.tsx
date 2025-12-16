import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role, UserSettings, ModelTier } from '../types';
import { Icon } from './Icon';
import { generateSpeech } from '../services/geminiService';
import { getSharedAudioContext } from '../services/audioUtils';
import { TypingIndicator } from './TypingIndicator';
import { CodeBlock } from './CodeBlock';

interface MessageBubbleProps {
  message: Message;
  userSettings?: UserSettings;
  tier?: ModelTier; // Receive tier
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, userSettings, tier }) => {
  const isUser = message.role === Role.USER;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleSpeak = async () => {
    if (isPlaying || isGenerating) return;
    
    setIsGenerating(true);
    
    // Slight delay to ensure UI updates before heavy work
    setTimeout(async () => {
        // Use configured voice or default
        const voice = userSettings?.voice || 'Zephyr';
        const audioBuffer = await generateSpeech(message.content, voice);
        setIsGenerating(false);
        
        if (audioBuffer) {
            setIsPlaying(true);
            // Use the SHARED context that created the buffer
            const ctx = getSharedAudioContext();
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(0);
            source.onended = () => setIsPlaying(false);
        } else {
            console.error("Failed to generate speech");
        }
    }, 10);
  };

  const handleFeedback = (type: 'up' | 'down') => {
      setFeedback(prev => prev === type ? null : type);
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} py-6 animate-fade-in-up group`}>
      <div className={`max-w-3xl w-full flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Role Label or Typing Indicator */}
        <div className="h-5 flex items-center mb-2">
            {message.role === Role.MODEL ? (
                message.isStreaming ? (
                    <TypingIndicator tier={tier} />
                ) : (
                    <span className="text-xs font-mono text-obsidian-500 uppercase tracking-widest opacity-60">
                        {message.thinking ? "OBSIDIAN • THINKING" : "OBSIDIAN"}
                    </span>
                )
            ) : (
                <span className="text-xs font-mono text-obsidian-500 uppercase tracking-widest opacity-60">
                    YOU
                </span>
            )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex gap-2 mb-3">
            {message.attachments.map((att, i) => (
              <div key={i} className="relative group overflow-hidden rounded border border-obsidian-700 bg-obsidian-800">
                 {att.mimeType.startsWith('image/') ? (
                   <img src={att.previewUrl} alt="Attachment" className="h-32 w-auto object-cover opacity-80" />
                 ) : (
                   <div className="h-32 w-32 flex items-center justify-center text-obsidian-400">
                     <span className="text-xs uppercase">Video</span>
                   </div>
                 )}
              </div>
            ))}
          </div>
        )}

        {/* Text Content */}
        <div className={`
          relative 
          prose prose-invert max-w-none 
          ${isUser ? 'text-obsidian-200 text-right' : 'text-obsidian-300 text-left markdown-body'}
        `}>
          <ReactMarkdown
             components={{
                 // Styled Markdown Links
                 a: ({node, ...props}) => (
                     <a 
                       {...props} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="text-obsidian-400 border-b border-obsidian-600/50 pb-0.5 hover:text-white hover:border-white transition-all duration-300 no-underline"
                     />
                 ),
                 // Custom Code Block Engine
                 code({node, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    // @ts-ignore
                    const isInline = !match && !String(children).includes('\n');
                    
                    if (!isInline) {
                        return (
                            <CodeBlock language={match ? match[1] : ''}>
                                {children}
                            </CodeBlock>
                        )
                    } 
                    return <code className={className} {...props}>{children}</code>
                }
             }}
          >
              {message.content}
          </ReactMarkdown>
          
          {/* Actions (Only for Model) */}
          {!isUser && !message.isStreaming && (
             <div className="absolute -bottom-12 left-0 pt-6 pb-2 pr-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 z-10">
                
                {/* Copy Button */}
                <button 
                  onClick={handleCopy} 
                  className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-obsidian-500 hover:text-white transition-colors uppercase p-2 -ml-2 rounded hover:bg-obsidian-900/50"
                  title="Copy Response"
                >
                    <div className="relative w-3 h-3">
                        <div className={`absolute inset-0 transition-all duration-300 ${showCopied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                            <Icon name="copy" className="w-3 h-3" />
                        </div>
                        <div className={`absolute inset-0 transition-all duration-300 text-green-400 ${showCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                            <Icon name="check" className="w-3 h-3" />
                        </div>
                    </div>
                </button>
                
                {/* Speak Button */}
                <button 
                  onClick={handleSpeak} 
                  className={`flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors p-2 rounded hover:bg-obsidian-900/50 ${isPlaying || isGenerating ? 'text-white' : 'text-obsidian-500 hover:text-white'}`}
                  title="Read Aloud"
                >
                    {isGenerating ? (
                        <div className="w-3 h-3 border-2 border-obsidian-500 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <div className="relative">
                            <Icon name="volume" className="w-3 h-3 z-10 relative" />
                            {isPlaying && (
                                <span className="absolute -inset-1 rounded-full border border-white opacity-40 animate-ping-slow"></span>
                            )}
                        </div>
                    )}
                </button>

                {/* Divider */}
                <div className="w-px h-3 bg-obsidian-800 my-auto"></div>

                {/* Feedback Buttons */}
                <button 
                    onClick={() => handleFeedback('up')}
                    className={`p-2 rounded hover:bg-obsidian-900/50 transition-colors ${feedback === 'up' ? 'text-green-500' : 'text-obsidian-500 hover:text-green-400'}`}
                >
                    <Icon name="thumbs-up" className="w-3 h-3" />
                </button>
                <button 
                    onClick={() => handleFeedback('down')}
                    className={`p-2 rounded hover:bg-obsidian-900/50 transition-colors ${feedback === 'down' ? 'text-red-500' : 'text-obsidian-500 hover:text-red-400'}`}
                >
                    <Icon name="thumbs-down" className="w-3 h-3" />
                </button>

             </div>
          )}
        </div>
      </div>
    </div>
  );
};