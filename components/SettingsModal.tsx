import React, { useState, useEffect } from 'react';
import { UserSettings, Memory, SavedChat } from '../types';
import { VOICES } from '../constants';
import { Icon } from './Icon';
import { generateSpeech } from '../services/geminiService';
import { getSharedAudioContext } from '../services/audioUtils';
import { loadMemories, saveMemories, exportAllData, deleteAllChats, addMemory, extractSharedLinks, SharedLink, loadChats, unarchiveChat, deleteChat, archiveAllChats } from '../services/storageService';

interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
  onDataChange: () => void; // New callback
}

type Tab = 'general' | 'personalization' | 'voice' | 'memory' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, onDataChange }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [activeTab, setActiveTab] = useState<Tab>('personalization');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Data Tab States
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [archivedChats, setArchivedChats] = useState<SavedChat[]>([]);
  const [showArchived, setShowArchived] = useState(false); // Toggle view between controls and list

  useEffect(() => {
      setMemories(loadMemories());
      if (activeTab === 'data') {
          setSharedLinks(extractSharedLinks());
          setArchivedChats(loadChats().filter(c => c.archived));
      }
  }, [activeTab]);

  const handleChange = (field: keyof UserSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Mimic slight delay for feel
    setTimeout(() => {
        onSave(localSettings);
        setIsSaving(false);
        onClose();
    }, 300);
  };

  const playVoicePreview = async (voiceName: string) => {
      if (isPlayingPreview) return;
      setIsPlayingPreview(true);
      
      let text = "This is the voice of Obsidian, powered by N S D Core.";
      if (localSettings.accent === 'italian') {
          text = "Mamma mia! This is the voice of Obsidian, powered by N S D Core. Allora!";
      }
      
      // Use local toggle setting for preview
      const buffer = await generateSpeech(text, voiceName, localSettings.accent);
      
      if (buffer) {
          const ctx = getSharedAudioContext();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          source.onended = () => setIsPlayingPreview(false);
      } else {
          setIsPlayingPreview(false);
      }
  };

  const handleAddMemory = () => {
      if(!newMemory.trim()) return;
      const updated = addMemory(newMemory, 'manual');
      setMemories(updated);
      setNewMemory('');
  };

  const handleDeleteMemory = (id: string) => {
      const updated = memories.filter(m => m.id !== id);
      saveMemories(updated);
      setMemories(updated);
  };

  const handleDeleteAllChats = () => {
      if(confirm("Are you sure? This will delete all your conversation history locally.")) {
          deleteAllChats();
          setArchivedChats([]);
          onDataChange(); // Notify App
      }
  };

  const handleArchiveAll = () => {
      if (confirm("Archive all active chats?")) {
          archiveAllChats();
          setArchivedChats(loadChats().filter(c => c.archived));
          onDataChange(); // Notify App
      }
  };

  const handleUnarchive = (id: string) => {
      unarchiveChat(id);
      setArchivedChats(prev => prev.filter(c => c.id !== id));
      onDataChange(); // Notify App
  };

  const handlePermanentDelete = (id: string) => {
      if(confirm("Delete this chat permanently?")) {
          deleteChat(id);
          setArchivedChats(prev => prev.filter(c => c.id !== id));
          onDataChange(); // Notify App
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-obsidian-900 border border-obsidian-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-obsidian-800">
          <h2 className="text-lg font-light tracking-widest text-white">SETTINGS</h2>
          <button onClick={onClose} className="text-obsidian-500 hover:text-white transition-colors">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-obsidian-800 bg-obsidian-950/50 p-4 space-y-1">
             {[
                 { id: 'personalization', label: 'Personalization' },
                 { id: 'voice', label: 'Voice Mode' },
                 { id: 'memory', label: 'Memory Bank' },
                 { id: 'data', label: 'Data Controls' },
             ].map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`w-full text-left px-4 py-3 text-xs font-mono uppercase tracking-wider rounded transition-colors ${activeTab === tab.id ? 'bg-obsidian-800 text-white' : 'text-obsidian-400 hover:text-obsidian-200'}`}
                 >
                     {tab.label}
                 </button>
             ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-obsidian-900">
            
            {activeTab === 'personalization' && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Nickname</label>
                        <input 
                            type="text" 
                            value={localSettings.userName}
                            onChange={(e) => handleChange('userName', e.target.value)}
                            className="w-full bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none placeholder-obsidian-700"
                            placeholder="What should Obsidian call you?"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Occupation</label>
                        <input 
                            type="text" 
                            value={localSettings.occupation}
                            onChange={(e) => handleChange('occupation', e.target.value)}
                            className="w-full bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none placeholder-obsidian-700"
                            placeholder="e.g. Software Engineer, Architect"
                        />
                    </div>

                     {/* Language Settings */}
                     <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Spoken Language (AI)</label>
                        <select 
                            value={localSettings.languageModel || 'Auto-Detect'}
                            onChange={(e) => handleChange('languageModel', e.target.value)}
                            className="w-full bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none"
                        >
                            <option value="Auto-Detect">Auto-Detect (Match User)</option>
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Chinese">Chinese (Mandarin)</option>
                            <option value="Portuguese">Portuguese</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Interface Language</label>
                        <select 
                            value={localSettings.languageInterface || 'en'}
                            onChange={(e) => handleChange('languageInterface', e.target.value)}
                            className="w-full bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none"
                        >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="ja">Japanese</option>
                            <option value="zh">Chinese</option>
                            <option value="pt">Portuguese</option>
                        </select>
                        <p className="text-[10px] text-obsidian-600 mt-2">Note: Interface translation is limited in this preview.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Custom Instructions</label>
                        <textarea 
                            value={localSettings.customInstructions}
                            onChange={(e) => handleChange('customInstructions', e.target.value)}
                            className="w-full bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none placeholder-obsidian-700 min-h-[100px]"
                            placeholder="Specific rules for how Obsidian should behave..."
                        />
                    </div>
                </div>
            )}

            {activeTab === 'voice' && (
                <div className="space-y-8">
                    {/* Accent Selection */}
                    <div>
                         <label className="block text-xs font-mono text-obsidian-400 uppercase mb-3">Accent & Dialect</label>
                         <div className="grid grid-cols-2 gap-3">
                             {['australian', 'american', 'british', 'italian'].map((acc) => (
                                 <button 
                                    key={acc}
                                    onClick={() => handleChange('accent', acc)}
                                    className={`relative p-3 rounded border text-left transition-all overflow-hidden group ${localSettings.accent === acc ? (acc === 'italian' ? 'bg-gradient-to-r from-green-900/30 via-transparent to-red-900/30 border-red-900/50' : 'bg-obsidian-800 border-white') : 'bg-obsidian-950 border-obsidian-700 hover:border-obsidian-600'}`}
                                 >
                                     <div className="text-sm font-medium capitalize flex items-center gap-2">
                                         {acc === 'italian' ? '🤌 Italian' : acc}
                                         {localSettings.accent === acc && <Icon name="check" className="w-3 h-3 text-green-500" />}
                                     </div>
                                     {acc === 'italian' && (
                                         <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-transparent to-red-500/10 pointer-events-none"></div>
                                     )}
                                 </button>
                             ))}
                         </div>
                         <p className="text-[10px] text-obsidian-500 mt-2">
                             {localSettings.accent === 'italian' ? "Warning: Overrides all personality settings. Molto bene." : "Applies to both Text-to-Speech and Live Mode."}
                         </p>
                    </div>

                    <div>
                        <label className="block text-xs font-mono text-obsidian-400 uppercase mb-2">Voice Model</label>
                        <div className="grid grid-cols-1 gap-2">
                            {VOICES.map(v => (
                                <div key={v.name} className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${localSettings.voice === v.name ? 'border-white bg-obsidian-800' : 'border-obsidian-700 bg-obsidian-950 hover:border-obsidian-500'}`} onClick={() => handleChange('voice', v.name)}>
                                    <span className="text-sm">{v.label}</span>
                                    {localSettings.voice === v.name && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); playVoicePreview(v.name); }}
                                            disabled={isPlayingPreview}
                                            className="p-2 bg-white text-black rounded-full hover:bg-obsidian-200"
                                        >
                                            <Icon name={isPlayingPreview ? "stop" : "play"} className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'memory' && (
                <div className="space-y-6">
                    <div className="p-4 bg-obsidian-950/50 rounded border border-obsidian-800">
                        <p className="text-xs text-obsidian-400 leading-relaxed">
                            Obsidian will automatically save critical facts (names, preferences, milestones) to this bank. You can also manually add details you want guaranteed retention for.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={newMemory}
                            onChange={(e) => setNewMemory(e.target.value)}
                            placeholder="Add a new permanent memory..."
                            className="flex-1 bg-obsidian-950 border border-obsidian-700 rounded p-3 text-sm text-white focus:border-obsidian-500 focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                        />
                        <button 
                            onClick={handleAddMemory}
                            className="px-4 bg-white text-black text-xs font-mono uppercase tracking-wider rounded hover:bg-obsidian-200"
                        >
                            Add
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {memories.length === 0 ? (
                            <p className="text-center text-xs text-obsidian-600 py-4">Memory bank is empty.</p>
                        ) : (
                            memories.map(m => (
                                <div key={m.id} className="flex items-start justify-between p-3 bg-obsidian-800/30 border border-obsidian-800 rounded group hover:border-obsidian-600">
                                    <div className="flex-1">
                                        <p className="text-sm text-obsidian-200">{m.content}</p>
                                        <p className="text-[10px] text-obsidian-500 mt-1 flex gap-2">
                                            <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                                            <span className="uppercase tracking-wider">{m.type}</span>
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteMemory(m.id)} className="text-obsidian-500 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icon name="x" className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'data' && (
                <div className="space-y-2">
                    <h3 className="text-lg font-light mb-6">Data controls</h3>
                    
                    {/* Improve Model Toggle */}
                    <div className="py-4 border-b border-obsidian-800">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Improve the model for everyone</span>
                            <button 
                                onClick={() => handleChange('allowTraining', !localSettings.allowTraining)}
                                className={`flex items-center gap-2 text-sm transition-colors ${localSettings.allowTraining ? 'text-green-500' : 'text-obsidian-400 hover:text-white'}`}
                            >
                                {localSettings.allowTraining ? 'On' : 'Off'}
                                <Icon name="play" className={`w-3 h-3 transition-transform ${localSettings.allowTraining ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                            </button>
                        </div>
                        
                        {/* Privacy Warning */}
                        {localSettings.allowTraining && (
                            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-900/50 rounded flex items-start gap-3 animate-fade-in-up">
                                <Icon name="shield" className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-blue-200 font-medium">Encrypted & Secure</p>
                                    <p className="text-[10px] text-blue-300/70 mt-1 leading-relaxed">
                                        Your data is encrypted at rest and securely stored. We strip personally identifiable information (PII) before any training process. You can revoke this permission at any time.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Shared Links */}
                    <div className="py-4 border-b border-obsidian-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">Shared links</span>
                            <span className="text-xs text-obsidian-500">{sharedLinks.length} found</span>
                        </div>
                        {sharedLinks.length > 0 ? (
                             <div className="max-h-32 overflow-y-auto space-y-2 pr-1 ghost-scrollbar">
                                 {sharedLinks.map((link, i) => (
                                     <a 
                                        key={i} 
                                        href={link.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2 rounded bg-obsidian-950 border border-obsidian-800 hover:border-obsidian-600 group transition-colors no-underline"
                                     >
                                         <div className="p-1.5 bg-obsidian-900 rounded text-obsidian-400 group-hover:text-white">
                                             <Icon name="external-link" className="w-3 h-3" />
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <p className="text-xs text-obsidian-300 truncate">{link.url}</p>
                                             <p className="text-[9px] text-obsidian-600 truncate">From: {link.chatTitle}</p>
                                         </div>
                                     </a>
                                 ))}
                             </div>
                        ) : (
                            <p className="text-xs text-obsidian-600 italic">No shared links detected in your history.</p>
                        )}
                    </div>

                    {/* Archived Chats Toggle */}
                    <div className="py-4 border-b border-obsidian-800">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Archived chats</span>
                            <button 
                                onClick={() => setShowArchived(!showArchived)}
                                className="px-4 py-1.5 rounded-full border border-obsidian-700 text-xs font-medium hover:bg-obsidian-800 transition-colors"
                            >
                                {showArchived ? 'Hide' : 'Manage'}
                            </button>
                        </div>

                        {showArchived && (
                            <div className="mt-4 animate-fade-in-up">
                                {archivedChats.length === 0 ? (
                                    <p className="text-xs text-obsidian-600 italic">No archived chats.</p>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 ghost-scrollbar">
                                        {archivedChats.map(chat => (
                                            <div key={chat.id} className="flex items-center justify-between p-2 bg-obsidian-950 border border-obsidian-800 rounded">
                                                <span className="text-xs text-obsidian-300 truncate max-w-[150px]">{chat.title}</span>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleUnarchive(chat.id)}
                                                        className="p-1 text-obsidian-500 hover:text-green-500 hover:bg-obsidian-900 rounded"
                                                        title="Restore"
                                                    >
                                                        <Icon name="unarchive" className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePermanentDelete(chat.id)}
                                                        className="p-1 text-obsidian-500 hover:text-red-500 hover:bg-obsidian-900 rounded"
                                                        title="Delete Permanently"
                                                    >
                                                        <Icon name="trash" className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Archive All */}
                    <div className="flex items-center justify-between py-4 border-b border-obsidian-800">
                        <span className="text-sm">Archive all chats</span>
                        <button 
                             onClick={handleArchiveAll}
                             className="px-4 py-1.5 rounded-full border border-obsidian-700 text-xs font-medium hover:bg-obsidian-800 transition-colors"
                        >
                            Archive all
                        </button>
                    </div>

                    {/* Delete All */}
                    <div className="flex items-center justify-between py-4 border-b border-obsidian-800">
                        <span className="text-sm">Delete all chats</span>
                        <button 
                            onClick={handleDeleteAllChats}
                            className="px-4 py-1.5 rounded-full border border-red-900/50 text-red-500 text-xs font-medium hover:bg-red-900/10 transition-colors"
                        >
                            Delete all
                        </button>
                    </div>

                    {/* Export Data */}
                    <div className="flex items-center justify-between py-4">
                        <span className="text-sm">Export data</span>
                        <button 
                            onClick={exportAllData}
                            className="px-4 py-1.5 rounded-full border border-obsidian-700 text-xs font-medium hover:bg-obsidian-800 transition-colors"
                        >
                            Export
                        </button>
                    </div>

                </div>
            )}
            
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-obsidian-800 bg-obsidian-950/50 flex justify-end gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-obsidian-400 hover:text-white transition-colors"
             >
                 Cancel
             </button>
             <button 
                onClick={handleSave}
                disabled={isSaving}
                className={`px-6 py-2 bg-white text-black text-xs font-mono uppercase tracking-wider rounded hover:bg-obsidian-200 transition-colors flex items-center gap-2 ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
             >
                 {isSaving ? (
                     <>
                        <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                     </>
                 ) : "Save Changes"}
             </button>
        </div>
      </div>
    </div>
  );
};