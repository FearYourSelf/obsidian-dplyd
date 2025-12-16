import React, { useState, useRef, useEffect } from 'react';
import { ChatState, Message, Role, ModelTier, AppConfig, Attachment, SavedChat, UserSettings } from './types';
import { MODEL_MAPPING } from './constants';
import { streamChatResponse } from './services/geminiService';
import { loadSettings, saveSettings, loadChats, saveSingleChat, deleteChat, addMemory } from './services/storageService';
import { MessageBubble } from './components/MessageBubble';
import { LiveInterface } from './components/LiveInterface';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Heuristic to detect complexity
const detectComplexity = (text: string): boolean => {
    const complexKeywords = ['analyze', 'code', 'python', 'javascript', 'plan', 'architecture', 'design pattern', 'math', 'physics', 'why', 'compare', 'generate'];
    const lower = text.toLowerCase();
    return text.length > 150 || complexKeywords.some(kw => lower.includes(kw));
};

const App: React.FC = () => {
  // --- State ---
  // FIX: Lazy initialization ensures loadSettings is called only once and correctly on mount
  const [userSettings, setUserSettings] = useState<UserSettings>(() => loadSettings());
  
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    mode: 'chat',
    currentChatId: null
  });

  const [config, setConfig] = useState<AppConfig>({
    modelTier: ModelTier.BALANCED,
    enableThinking: false
  });

  // Data State
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);

  // UI State
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoEscalated, setAutoEscalated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false); 
  const [showMemoryToast, setShowMemoryToast] = useState(false); // New Memory Toast

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Effects ---

  // Security & Shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevention
        if (
            e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
            (e.ctrlKey && e.key === 'u')
        ) {
            e.preventDefault();
        }

        // Feature Shortcuts
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            clearChat();
            inputRef.current?.focus();
        }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Load chats on mount
  useEffect(() => {
    setSavedChats(loadChats());
  }, []);

  // Scroll on message update
  useEffect(() => {
    // If the last message is streaming, we want INSTANT snap to bottom (auto) to prevent drifting
    const lastMsg = chatState.messages[chatState.messages.length - 1];
    const isStreaming = lastMsg?.isStreaming;
    scrollToBottom(!isStreaming); 
  }, [chatState.messages]);

  // Auto-save chat when messages change
  useEffect(() => {
    if (chatState.messages.length > 0) {
      const chatId = chatState.currentChatId || generateId();
      
      // If new chat, set ID
      if (!chatState.currentChatId) {
          setChatState(prev => ({ ...prev, currentChatId: chatId }));
      }

      // Generate simple title from first message
      let title = "New Conversation";
      const firstUserMsg = chatState.messages.find(m => m.role === Role.USER);
      if (firstUserMsg) {
          title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
      }

      const chatToSave: SavedChat = {
          id: chatId,
          title: title,
          messages: chatState.messages,
          timestamp: Date.now()
      };
      
      saveSingleChat(chatToSave);
      setSavedChats(loadChats()); // Refresh list

      // Trigger Toast
      setShowSaveToast(true);
      const timer = setTimeout(() => setShowSaveToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [chatState.messages]);

  // --- Handlers ---

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    setShowScrollButton(!isNearBottom);
  };

  const handleSettingsSave = (newSettings: UserSettings) => {
      // Immediate state update
      setUserSettings(newSettings);
      // Persist to storage
      saveSettings(newSettings);
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || chatState.isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: Role.USER,
      content: input,
      timestamp: Date.now(),
      attachments: [...attachments]
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null
    }));

    setInput('');
    setAttachments([]);
    setAutoEscalated(false);

    const modelMessageId = generateId();

    // Determine tier logic
    let activeTier = config.modelTier;
    let thinkingEnabled = config.enableThinking;

    if (config.modelTier === ModelTier.BALANCED && !config.enableThinking) {
        if (detectComplexity(userMessage.content) || userMessage.attachments?.length > 0) {
            activeTier = ModelTier.REASONING;
            thinkingEnabled = true;
            setAutoEscalated(true);
        }
    }
    
    // Optimistic Model Message
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: modelMessageId,
        role: Role.MODEL,
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        thinking: thinkingEnabled
      }]
    }));

    try {
      let accumulatedText = '';
      
      await streamChatResponse(
        [...chatState.messages, userMessage], 
        userMessage.content,
        userMessage.attachments || [],
        activeTier,
        thinkingEnabled,
        userSettings, 
        (chunk) => {
           accumulatedText += chunk;
           setChatState(prev => ({
             ...prev,
             messages: prev.messages.map(msg => 
               msg.id === modelMessageId 
                 ? { ...msg, content: accumulatedText, thinking: false } 
                 : msg
             )
           }));
        }
      );

      // Post-Processing: Extract Memories
      let finalText = accumulatedText;
      const memoryRegex = /\[\[MEMORY: (.*?)\]\]/g;
      const memoriesFound: string[] = [];
      let match;
      while ((match = memoryRegex.exec(accumulatedText)) !== null) {
          memoriesFound.push(match[1]);
      }

      // Save memories if found
      if (memoriesFound.length > 0) {
          memoriesFound.forEach(mem => addMemory(mem, 'auto'));
          // Remove memory tags from displayed text
          finalText = accumulatedText.replace(memoryRegex, '').trim();
          setShowMemoryToast(true);
          setTimeout(() => setShowMemoryToast(false), 3000);
      }

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        messages: prev.messages.map(msg => 
            msg.id === modelMessageId 
              ? { ...msg, content: finalText, isStreaming: false } 
              : msg
          )
      }));

    } catch (error) {
      console.error(error);
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: "Connection Interrupted. NSD-CORE unreachable."
      }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [...prev, {
          file,
          previewUrl: URL.createObjectURL(file),
          mimeType: file.type,
          base64: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearChat = () => {
    setChatState({ messages: [], isLoading: false, error: null, mode: 'chat', currentChatId: null });
    setAutoEscalated(false);
  };

  const loadChat = (chat: SavedChat) => {
      setChatState({
          messages: chat.messages,
          isLoading: false,
          error: null,
          mode: 'chat',
          currentChatId: chat.id
      });
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = deleteChat(id);
      setSavedChats(updated);
      if (chatState.currentChatId === id) {
          clearChat();
      }
  };

  const toggleModel = () => {
      setConfig(prev => {
          if (prev.modelTier === ModelTier.FAST) return { ...prev, modelTier: ModelTier.BALANCED };
          if (prev.modelTier === ModelTier.BALANCED) return { ...prev, modelTier: ModelTier.REASONING, enableThinking: true };
          return { ...prev, modelTier: ModelTier.FAST, enableThinking: false };
      });
  };

  const getModelLabel = () => {
      if (config.enableThinking) return "Think Harder";
      if (config.modelTier === ModelTier.FAST) return "Quick";
      return "Balanced";
  };

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-obsidian-200 font-sans overflow-hidden selection:bg-obsidian-700 selection:text-white relative">
      
      {/* Backgrounds - Boosted Visibility */}
      <div className="bg-noise absolute inset-0 z-0 opacity-[0.03]"></div>
      <div className="absolute inset-0 z-0 bg-gradient-radial from-obsidian-900 via-obsidian-950 to-obsidian-950 opacity-90 animate-aurora pointer-events-none"></div>

      {/* Header - Fixed Position */}
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-50 bg-gradient-to-b from-obsidian-950 to-obsidian-950/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="text-obsidian-500 hover:text-white transition-colors">
                <Icon name="menu" className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 select-none">
              <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse-slow"></div>
              <h1 className="text-xs font-semibold tracking-[0.2em] text-white opacity-90">OBSIDIAN</h1>
            </div>
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={toggleModel}
                className="text-[10px] font-mono uppercase tracking-widest text-obsidian-500 hover:text-white transition-colors flex items-center gap-2"
            >
                <Icon name={config.enableThinking ? "cpu" : "zap"} className="w-3 h-3" />
                {getModelLabel()}
            </button>
            <div className="h-3 w-px bg-obsidian-800"></div>
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-obsidian-500 hover:text-white transition-colors"
                title="Settings"
            >
                <Icon name="settings" className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Main Chat Area - Scrollable with padding for header */}
      <main 
        className="ghost-scrollbar flex-1 h-screen overflow-y-auto px-4 sm:px-0 z-10 pt-16 relative" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end pb-40 pt-10 relative">
          
          {chatState.messages.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center opacity-30 select-none pb-20 animate-fade-in-up">
                <div className="w-20 h-20 border border-obsidian-800 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                    <Icon name="cpu" className="w-6 h-6 text-obsidian-600" />
                </div>
                <p className="text-xs tracking-[0.3em] uppercase">System Online</p>
                <p className="text-[10px] text-obsidian-600 mt-2 font-mono">NSD-CORE/70B • Ready</p>
                <p className="text-[9px] text-obsidian-700 mt-6 font-mono tracking-widest">CMD + K to Clear</p>
             </div>
          )}

          {chatState.messages.map((msg, index) => (
            <React.Fragment key={msg.id}>
                {index > 0 && (
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-obsidian-800/30 to-transparent my-4" />
                )}
                <MessageBubble 
                  message={msg} 
                  userSettings={userSettings} 
                  tier={config.enableThinking ? ModelTier.REASONING : config.modelTier} 
                />
            </React.Fragment>
          ))}
          
          {/* Status Indicators */}
          <div className="ml-4 mt-2 mb-10 h-6">
            {chatState.isLoading && chatState.messages.length > 0 && chatState.messages[chatState.messages.length-1].thinking && (
                <div className="text-[10px] text-obsidian-500 font-mono animate-pulse flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-obsidian-500 rounded-full animate-bounce"></div>
                    PROCESSING COMPLEX LOGIC
                </div>
            )}
            {!chatState.isLoading && autoEscalated && (
                 <div className="text-[10px] text-obsidian-600 font-mono flex items-center gap-2 animate-fade-in-up">
                    <Icon name="zap" className="w-3 h-3" />
                    AUTO-ESCALATED TO THINK HARDER
                </div>
            )}
          </div>

          {chatState.error && (
            <div className="mt-8 mb-8 p-4 border border-red-900/30 bg-obsidian-900/50 text-red-500 text-xs font-mono text-center tracking-widest uppercase rounded animate-fade-in-up">
                {chatState.error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Auto-Save Toast */}
      {showSaveToast && (
          <div className="fixed top-20 right-6 z-50 animate-fade-in-up">
              <div className="bg-obsidian-900 border border-obsidian-800 text-obsidian-400 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Saved
              </div>
          </div>
      )}

      {/* Memory Added Toast */}
      {showMemoryToast && (
          <div className="fixed top-20 left-6 z-50 animate-fade-in-up">
              <div className="bg-obsidian-900 border border-obsidian-800 text-obsidian-400 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                  Memory Updated
              </div>
          </div>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button 
            onClick={() => scrollToBottom(true)}
            className="fixed bottom-28 right-8 z-30 p-3 bg-obsidian-900/80 backdrop-blur border border-obsidian-800 text-obsidian-400 hover:text-white rounded-full shadow-lg transition-all duration-300 animate-fade-in-up hover:border-obsidian-600"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </button>
      )}

      {/* Input Area - Already fixed position in original code, no change needed */}
      <div className="fixed bottom-0 left-0 right-0 pt-12 pb-8 px-4 z-20 bg-gradient-to-t from-obsidian-950 via-obsidian-950 to-transparent">
         <div className="max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
             
             {/* Attachment Previews */}
             {attachments.length > 0 && (
                <div className="flex gap-2 mb-3 px-1 overflow-x-auto animate-fade-in-up">
                    {attachments.map((att, i) => (
                        <div key={i} className="relative group">
                            <img src={att.previewUrl} className="h-14 w-14 object-cover rounded border border-obsidian-700 opacity-80" alt="preview" />
                            <button 
                                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-1 -right-1 bg-obsidian-800 rounded-full p-0.5 border border-obsidian-600 hover:text-white text-obsidian-400"
                            >
                                <Icon name="x" className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
             )}

             <div className="relative flex items-end gap-2 bg-obsidian-900/40 backdrop-blur-xl border border-obsidian-800/50 rounded-2xl p-2 transition-all duration-300 hover:border-obsidian-700 group focus-within:border-obsidian-500/50 focus-within:shadow-[0_0_30px_rgba(255,255,255,0.05)] focus-within:bg-obsidian-900/80">
                
                {/* File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    accept="image/*,video/*"
                />
                
                <div className="flex gap-1 pb-1 pl-1">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-obsidian-500 hover:text-white transition-colors rounded-lg hover:bg-obsidian-800/50"
                        title="Add Attachment"
                    >
                        <Icon name="paperclip" />
                    </button>
                    
                    <button 
                        onClick={() => setChatState(prev => ({...prev, mode: 'live'}))}
                        className="p-2 text-obsidian-500 hover:text-white transition-colors rounded-lg hover:bg-obsidian-800/50"
                        title="Live Voice Mode"
                    >
                        <Icon name="mic" />
                    </button>
                </div>

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={`Message ${userSettings.userName ? 'Obsidian' : 'Obsidian'}...`}
                    className="flex-1 bg-transparent border-0 resize-none focus:ring-0 text-white placeholder-obsidian-600 py-2.5 h-[44px] max-h-[200px] leading-relaxed scrollbar-hide text-sm"
                    rows={1}
                />

                <div className="pb-1 pr-1">
                    <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() && attachments.length === 0}
                        className={`p-2 rounded-xl transition-all duration-500 ${(!input.trim() && attachments.length === 0) ? 'text-obsidian-700 cursor-not-allowed opacity-50' : 'text-obsidian-950 bg-white hover:bg-obsidian-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}
                    >
                        <Icon name="send" className="w-4 h-4" />
                    </button>
                </div>
             </div>
             
             <div className="text-center mt-4">
                 <p className="text-[9px] text-obsidian-700 uppercase tracking-[0.2em] font-mono">
                    {getModelLabel()} • POWERED BY <a href="https://fearyour.life/" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400 transition-colors border-b border-transparent hover:border-purple-500/50">NSD-CORE/70B</a>
                 </p>
             </div>
         </div>
      </div>

      {/* Overlays */}
      <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          chats={savedChats}
          currentChatId={chatState.currentChatId}
          onSelectChat={loadChat}
          onNewChat={clearChat}
          onDeleteChat={handleDeleteChat}
      />

      {isSettingsOpen && (
          <SettingsModal 
             settings={userSettings}
             onSave={handleSettingsSave}
             onClose={() => setIsSettingsOpen(false)}
          />
      )}

      {/* Live Interface Modal */}
      {chatState.mode === 'live' && (
          <LiveInterface onClose={() => setChatState(prev => ({...prev, mode: 'chat'}))} />
      )}

    </div>
  );
};

export default App;