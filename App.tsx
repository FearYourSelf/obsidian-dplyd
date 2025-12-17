import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChatState, Message, Role, ModelTier, AppConfig, Attachment, SavedChat, UserSettings } from './types';
import { MODEL_MAPPING, TONES } from './constants';
import { streamChatResponse } from './services/geminiService';
import { loadSettings, saveSettings, loadChats, saveSingleChat, deleteChat, addMemory, archiveChat } from './services/storageService';
import { MessageBubble } from './components/MessageBubble';
import { LiveInterface } from './components/LiveInterface';
import { Icon } from './components/Icon';
import Sidebar from './components/Sidebar'; 
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
  const [userSettings, setUserSettings] = useState<UserSettings>(() => loadSettings());
  
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false, // Tracks if streaming is active
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
  const [showMemoryToast, setShowMemoryToast] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false);
  
  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Stop Generation Ref
  const stopGenerationRef = useRef<boolean>(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // SCROLLING LOGIC REF
  const autoScrollEnabledRef = useRef(true);

  // --- Effects ---

  // Security & Shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
        if (
            e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
            (e.ctrlKey && e.key === 'u')
        ) {
            e.preventDefault();
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            clearChat();
            inputRef.current?.focus();
        }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Close Dropdown on Click Outside
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.study-dropdown') && !target.closest('.study-toggle')) {
            setIsStudyDropdownOpen(false);
        }
    };
    document.addEventListener('click', handleClickOutside);

    return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
        inputRef.current.style.height = '44px'; // Reset height
        const scrollHeight = inputRef.current.scrollHeight;
        inputRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Load chats on mount
  useEffect(() => {
    setSavedChats(loadChats());
  }, []);

  // SCROLL LOCK ENGINE v2.0
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (autoScrollEnabledRef.current) {
        container.style.scrollBehavior = 'auto'; 
        container.scrollTop = container.scrollHeight;
    }
  }, [chatState.messages]);

  // Auto-save chat when messages change
  useEffect(() => {
    if (chatState.messages.length > 0) {
      const chatId = chatState.currentChatId || generateId();
      
      if (!chatState.currentChatId) {
          setChatState(prev => ({ ...prev, currentChatId: chatId }));
      }

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
      setSavedChats(loadChats()); 

      setShowSaveToast(true);
      const timer = setTimeout(() => setShowSaveToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [chatState.messages]);

  // --- Handlers ---

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.style.scrollBehavior = smooth ? 'smooth' : 'auto';
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        
        autoScrollEnabledRef.current = true;
        setShowScrollButton(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScrollEnabledRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  };

  const handleSettingsSave = (newSettings: UserSettings) => {
      setUserSettings(newSettings);
      saveSettings(newSettings);
      setSavedChats(loadChats());
  };
  
  const handleDataChange = () => {
      setSavedChats(loadChats());
  };

  const handleToneChange = (newTone: string) => {
      const updated = { ...userSettings, tone: newTone };
      handleSettingsSave(updated);
  };

  const handleStudyOption = (type: 'study' | 'homework' | 'explain' | 'quiz') => {
      let prompt = "";
      switch(type) {
          case 'study': prompt = "Help me study "; break;
          case 'homework': prompt = "Help me solve this problem: "; break;
          case 'explain': prompt = "Explain [topic] to me simply: "; break;
          case 'quiz': prompt = "Create a practice quiz about "; break;
      }
      setInput(prompt);
      inputRef.current?.focus();
      setIsStudyDropdownOpen(false);
  };

  const handleStopGeneration = () => {
      stopGenerationRef.current = true;
      setChatState(prev => ({ ...prev, isLoading: false }));
  };

  const handleRegenerate = async () => {
      // Find the last user message to use as prompt
      const lastUserMsgIndex = chatState.messages.findLastIndex(m => m.role === Role.USER);
      if (lastUserMsgIndex === -1) return;

      const userMsg = chatState.messages[lastUserMsgIndex];
      
      // Remove everything after this user message
      const trimmedMessages = chatState.messages.slice(0, lastUserMsgIndex + 1);

      setChatState(prev => ({
          ...prev,
          messages: trimmedMessages,
          isLoading: true,
          error: null
      }));

      // Trigger standard send logic with the identified message content/attachments
      await processMessage(userMsg.content, userMsg.attachments || [], trimmedMessages);
  };

  // Logic extracted to support both new messages and regeneration
  const processMessage = async (msgContent: string, msgAttachments: Attachment[], history: Message[]) => {
      stopGenerationRef.current = false;
      setAutoEscalated(false);

      const modelMessageId = generateId();
      let activeTier = config.modelTier;
      let thinkingEnabled = config.enableThinking;

      if (config.modelTier === ModelTier.BALANCED && !config.enableThinking) {
          if (detectComplexity(msgContent) || msgAttachments?.length > 0) {
              activeTier = ModelTier.REASONING;
              thinkingEnabled = true;
              setAutoEscalated(true);
          }
      }
      
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
          history, 
          msgContent,
          msgAttachments || [],
          activeTier,
          thinkingEnabled,
          isSearchEnabled,
          userSettings, 
          (chunk) => {
             if (stopGenerationRef.current) return; // Stop update if cancelled
             accumulatedText += chunk;
             setChatState(prev => ({
               ...prev,
               messages: prev.messages.map(msg => 
                 msg.id === modelMessageId 
                   ? { ...msg, content: accumulatedText, thinking: false } 
                   : msg
               )
             }));
          },
          (metadata) => {
              if (stopGenerationRef.current) return;
              setChatState(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === modelMessageId 
                      ? { ...msg, groundingMetadata: metadata } 
                      : msg
                  )
              }));
          },
          chatState.currentChatId
        );

        if (stopGenerationRef.current) return;

        let finalText = accumulatedText;
        const memoryRegex = /\[\[MEMORY: (.*?)\]\]/g;
        const memoriesFound: string[] = [];
        let match;
        while ((match = memoryRegex.exec(accumulatedText)) !== null) {
            memoriesFound.push(match[1]);
        }

        if (memoriesFound.length > 0) {
            memoriesFound.forEach(mem => addMemory(mem, 'auto'));
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
        if (!stopGenerationRef.current) {
            setChatState(prev => ({
              ...prev,
              isLoading: false,
              error: "Connection Interrupted. NSD-CORE unreachable."
            }));
        }
      }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || chatState.isLoading) return;

    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    const userMessage: Message = {
      id: generateId(),
      role: Role.USER,
      content: input,
      timestamp: Date.now(),
      attachments: [...attachments]
    };

    const newHistory = [...chatState.messages, userMessage];

    setChatState(prev => ({
      ...prev,
      messages: newHistory,
      isLoading: true,
      error: null
    }));

    setInput('');
    setAttachments([]);
    
    await processMessage(userMessage.content, userMessage.attachments || [], newHistory);
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
    autoScrollEnabledRef.current = true; // Reset scroll
  };

  const loadChat = (chat: SavedChat) => {
      setChatState({
          messages: chat.messages,
          isLoading: false,
          error: null,
          mode: 'chat',
          currentChatId: chat.id
      });
      autoScrollEnabledRef.current = true; // Reset scroll
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = deleteChat(id);
      setSavedChats(updated);
      if (chatState.currentChatId === id) {
          clearChat();
      }
  };

  const handleArchiveChat = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = archiveChat(id);
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
  
  const isUnhinged = userSettings.tone === 'Unhinged';
  const isItalian = userSettings.accent === 'italian';

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden selection:bg-obsidian-700 selection:text-white relative transition-colors duration-1000 ${isUnhinged ? 'bg-[#050000]' : 'bg-obsidian-950'} text-obsidian-200`}>
      
      <div className="bg-noise absolute inset-0 z-0 opacity-[0.03]"></div>
      
      {isItalian ? (
         <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#008C45]/20 via-transparent to-[#CD212A]/20 opacity-80 pointer-events-none animate-fade-in"></div>
      ) : (
         <div className={`absolute inset-0 z-0 bg-gradient-radial opacity-90 animate-aurora pointer-events-none ${isUnhinged ? 'from-[#1a0000] via-[#050000] to-[#000000]' : 'from-obsidian-900 via-obsidian-950 to-obsidian-950'}`}></div>
      )}

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-6 z-50 backdrop-blur-md border-b transition-colors duration-500 ${isUnhinged ? 'bg-[#050000]/90 border-red-900/20' : 'bg-gradient-to-b from-obsidian-950 to-obsidian-950/90 border-white/5'}`}>
        <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="text-obsidian-500 hover:text-white transition-colors">
                <Icon name="menu" className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 select-none">
              <div className={`w-2 h-2 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse-slow ${isItalian ? 'bg-white' : (isUnhinged ? 'bg-red-600 shadow-red-500/50' : 'bg-white')}`}></div>
              <h1 className={`text-xs font-semibold tracking-[0.2em] opacity-90 ${isUnhinged ? 'text-red-500' : 'text-white'}`}>
                OBSIDIAN
                {isItalian && <span className="ml-2 px-1.5 py-0.5 bg-green-900/30 border border-green-800 rounded text-[9px] font-mono text-green-500 animate-fade-in-up hidden sm:inline-block">Per rispetto della nostra patria 🤌</span>}
                {isUnhinged && !isItalian && <span className="ml-2 px-1.5 py-0.5 bg-red-900/30 border border-red-800 rounded text-[9px] font-mono text-red-500 animate-pulse hidden sm:inline-block">UNHINGED</span>}
              </h1>
            </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative group flex items-center">
                <select 
                    value={userSettings.tone}
                    onChange={(e) => handleToneChange(e.target.value)}
                    className={`bg-transparent text-[10px] font-mono uppercase tracking-widest border-none focus:ring-0 cursor-pointer hover:text-white transition-colors text-right appearance-none py-1 pr-6 outline-none ${isUnhinged ? 'text-red-600 hover:text-red-400' : 'text-obsidian-500'}`}
                    style={{ textAlignLast: 'right' }} 
                >
                    {TONES.map(t => (
                        <option key={t} value={t} className="bg-obsidian-900 text-obsidian-300">{t}</option>
                    ))}
                </select>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-obsidian-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>

            <div className="h-3 w-px bg-obsidian-800"></div>

            <button 
                onClick={toggleModel}
                className="text-[10px] font-mono uppercase tracking-widest text-obsidian-500 hover:text-white transition-colors flex items-center gap-2"
            >
                <Icon name={config.enableThinking ? "cpu" : "zap"} className="w-3 h-3" />
                <span className="hidden sm:inline">{getModelLabel()}</span>
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

      {/* Main Chat Area */}
      <main 
        className="ghost-scrollbar flex-1 h-screen overflow-y-auto px-4 sm:px-0 z-10 pt-16 relative" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ overflowAnchor: 'none' }}
      >
        <div className="max-w-3xl mx-auto min-h-full flex flex-col pb-40 pt-10 relative">
          
          <div className="mt-auto flex flex-col">
              {chatState.messages.length === 0 && (
                 <div className="flex flex-col items-center justify-center opacity-30 select-none pb-20 animate-fade-in-up py-20">
                    <div className={`w-20 h-20 border rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] ${isUnhinged ? 'border-red-900/50 bg-red-950/10' : 'border-obsidian-800'}`}>
                        <Icon name="cpu" className={`w-6 h-6 ${isUnhinged ? 'text-red-600' : 'text-obsidian-600'}`} />
                    </div>
                    <p className="text-xs tracking-[0.3em] uppercase">
                        {isItalian ? 'System is Italian' : 'System Online'}
                    </p>
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
                      onRegenerate={handleRegenerate}
                      onImageClick={setLightboxImage}
                    />
                </React.Fragment>
              ))}
              
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
          </div>
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Lightbox Overlay */}
      {lightboxImage && (
          <div 
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in p-4"
            onClick={() => setLightboxImage(null)}
          >
              <div className="relative max-w-full max-h-full animate-scale-in">
                  <img src={lightboxImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                  <button 
                    onClick={() => setLightboxImage(null)}
                    className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors"
                  >
                      <Icon name="x" className="w-8 h-8" />
                  </button>
              </div>
          </div>
      )}

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

      {/* Input Area */}
      <div className={`fixed bottom-0 left-0 right-0 pt-12 pb-8 px-4 z-20 bg-gradient-to-t via-obsidian-950 to-transparent ${isUnhinged ? 'from-[#050000]' : 'from-obsidian-950'}`}>
         
         <div className="max-w-3xl mx-auto animate-fade-in-up relative" style={{ animationDelay: '0.1s' }}>
             
             {/* Academics Dropdown */}
             {isStudyDropdownOpen && (
                 <div className="study-dropdown absolute bottom-full left-0 mb-3 w-64 bg-obsidian-900 border border-obsidian-800 rounded-lg shadow-2xl overflow-hidden animate-fade-in-up z-50">
                     <div className="p-3 bg-obsidian-950/50 border-b border-obsidian-800">
                         <h3 className="text-xs font-mono uppercase tracking-widest text-obsidian-400">Academics</h3>
                     </div>
                     <div className="p-1">
                         <button onClick={() => handleStudyOption('study')} className="w-full text-left flex items-center gap-3 p-2.5 rounded hover:bg-obsidian-800 transition-colors group">
                             <div className="p-1.5 bg-blue-900/20 rounded text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-900/30">
                                 <Icon name="book" className="w-4 h-4" />
                             </div>
                             <span className="text-sm text-obsidian-300 group-hover:text-white">Study Partner</span>
                         </button>
                         <button onClick={() => handleStudyOption('homework')} className="w-full text-left flex items-center gap-3 p-2.5 rounded hover:bg-obsidian-800 transition-colors group">
                             <div className="p-1.5 bg-purple-900/20 rounded text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-900/30">
                                 <Icon name="pen" className="w-4 h-4" />
                             </div>
                             <span className="text-sm text-obsidian-300 group-hover:text-white">Homework Aid</span>
                         </button>
                         <button onClick={() => handleStudyOption('explain')} className="w-full text-left flex items-center gap-3 p-2.5 rounded hover:bg-obsidian-800 transition-colors group">
                             <div className="p-1.5 bg-green-900/20 rounded text-green-400 group-hover:text-green-300 group-hover:bg-green-900/30">
                                 <Icon name="brain" className="w-4 h-4" />
                             </div>
                             <span className="text-sm text-obsidian-300 group-hover:text-white">Explain Concept</span>
                         </button>
                         <button onClick={() => handleStudyOption('quiz')} className="w-full text-left flex items-center gap-3 p-2.5 rounded hover:bg-obsidian-800 transition-colors group">
                             <div className="p-1.5 bg-yellow-900/20 rounded text-yellow-400 group-hover:text-yellow-300 group-hover:bg-yellow-900/30">
                                 <Icon name="quiz" className="w-4 h-4" />
                             </div>
                             <span className="text-sm text-obsidian-300 group-hover:text-white">Generate Quiz</span>
                         </button>
                     </div>
                 </div>
             )}

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

             <div className={`relative flex items-end gap-2 bg-obsidian-900/40 backdrop-blur-xl border border-obsidian-800/50 rounded-2xl p-2 transition-all duration-300 hover:border-obsidian-700 group focus-within:border-obsidian-500/50 focus-within:shadow-[0_0_30px_rgba(255,255,255,0.05)] focus-within:bg-obsidian-900/80 ${chatState.isLoading ? 'border-obsidian-500/30 animate-pulse-slow' : ''}`}>
                
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
                        className={`p-2 transition-colors rounded-lg hover:bg-obsidian-800/50 ${isUnhinged ? 'text-red-500 hover:text-red-400' : 'text-obsidian-500 hover:text-white'}`}
                        title="Live Voice Mode"
                    >
                        <Icon name="mic" />
                    </button>

                    <button 
                        onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                        className={`p-2 transition-colors rounded-lg hover:bg-obsidian-800/50 ${isSearchEnabled ? 'text-blue-400' : 'text-obsidian-500 hover:text-white'}`}
                        title={isSearchEnabled ? "Search Enabled" : "Enable Web Search"}
                    >
                        <Icon name="globe" />
                    </button>

                    <button 
                        onClick={() => setIsStudyDropdownOpen(!isStudyDropdownOpen)}
                        className={`study-toggle p-2 transition-colors rounded-lg hover:bg-obsidian-800/50 ${isStudyDropdownOpen ? 'text-white bg-obsidian-800' : 'text-obsidian-500 hover:text-white'}`}
                        title="Academics"
                    >
                        <Icon name="book" />
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
                    {chatState.isLoading ? (
                        <button 
                            onClick={handleStopGeneration}
                            className="p-2 rounded-xl text-white bg-obsidian-800 hover:bg-red-900/80 hover:text-red-200 transition-all duration-300 shadow-lg animate-fade-in"
                            title="Stop Generation"
                        >
                            <Icon name="stop-circle" className="w-4 h-4" />
                        </button>
                    ) : (
                        <button 
                            onClick={handleSendMessage}
                            disabled={!input.trim() && attachments.length === 0}
                            className={`p-2 rounded-xl transition-all duration-500 ${(!input.trim() && attachments.length === 0) ? 'text-obsidian-700 cursor-not-allowed opacity-50' : 'text-obsidian-950 bg-white hover:bg-obsidian-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}
                        >
                            <Icon name="send" className="w-4 h-4" />
                        </button>
                    )}
                </div>
             </div>
             
             <div className="text-center mt-4">
                 <p className="text-[9px] text-obsidian-700 uppercase tracking-[0.2em] font-mono">
                    {getModelLabel()} • POWERED BY <a href="https://fearyour.life/" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400 transition-colors border-b border-transparent hover:border-purple-500/50">NSD-CORE/70B</a>
                 </p>
             </div>
         </div>
      </div>

      <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          chats={savedChats}
          currentChatId={chatState.currentChatId}
          onSelectChat={loadChat}
          onNewChat={clearChat}
          onDeleteChat={handleDeleteChat}
          onArchiveChat={handleArchiveChat}
      />

      {isSettingsOpen && (
          <SettingsModal 
             settings={userSettings}
             onSave={handleSettingsSave}
             onClose={() => setIsSettingsOpen(false)}
             onDataChange={handleDataChange}
          />
      )}

      {chatState.mode === 'live' && (
          <LiveInterface onClose={() => setChatState(prev => ({...prev, mode: 'chat'}))} settings={userSettings} />
      )}

    </div>
  );
};

export default App;