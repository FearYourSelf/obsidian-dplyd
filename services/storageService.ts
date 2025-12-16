import { SavedChat, UserSettings, Memory } from '../types';

const CHATS_KEY = 'obsidian_saved_chats';
const SETTINGS_KEY = 'obsidian_user_settings';
const MEMORIES_KEY = 'obsidian_memories';

export const defaultSettings: UserSettings = {
  userName: '',
  occupation: '',
  aboutUser: '',
  customInstructions: '',
  voice: 'Zephyr',
  tone: 'Default',
  languageInterface: 'en',
  languageModel: 'Auto-Detect',
  allowTraining: false
};

// --- Settings ---
export const loadSettings = (): UserSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- Chats ---
export const loadChats = (): SavedChat[] => {
  try {
    const stored = localStorage.getItem(CHATS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveChats = (chats: SavedChat[]) => {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
};

export const saveSingleChat = (chat: SavedChat) => {
  const chats = loadChats();
  const existingIndex = chats.findIndex(c => c.id === chat.id);
  if (existingIndex >= 0) {
    chats[existingIndex] = chat;
  } else {
    chats.unshift(chat); // Add to top
  }
  saveChats(chats);
};

export const deleteChat = (chatId: string) => {
  const chats = loadChats();
  const filtered = chats.filter(c => c.id !== chatId);
  saveChats(filtered);
  return filtered;
};

export const deleteAllChats = () => {
    localStorage.removeItem(CHATS_KEY);
};

// --- Memories ---
export const loadMemories = (): Memory[] => {
    try {
        const stored = localStorage.getItem(MEMORIES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

export const saveMemories = (memories: Memory[]) => {
    localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
};

export const addMemory = (content: string, type: 'auto' | 'manual') => {
    const memories = loadMemories();
    const newMemory: Memory = {
        id: Math.random().toString(36).substr(2, 9),
        content,
        type,
        timestamp: Date.now()
    };
    // Avoid exact duplicates
    if (!memories.some(m => m.content === content)) {
        memories.push(newMemory);
        saveMemories(memories);
    }
    return memories;
};

// --- Data Export ---
export const exportAllData = () => {
    const data = {
        settings: loadSettings(),
        chats: loadChats(),
        memories: loadMemories(),
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obsidian-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};