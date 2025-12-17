import { SavedChat, UserSettings, Memory, Role } from '../types';

const CHATS_KEY = 'obsidian_saved_chats';
const SETTINGS_KEY = 'obsidian_user_settings';
const MEMORIES_KEY = 'obsidian_memories';

export const defaultSettings: UserSettings = {
  userName: '',
  occupation: '',
  aboutUser: '',
  customInstructions: '',
  voice: 'Zephyr',
  accent: 'australian', // Default to Australian
  tone: 'Default',
  languageInterface: 'en',
  languageModel: 'Auto-Detect',
  allowTraining: false
};

// --- Settings ---
export const loadSettings = (): UserSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    // Migration for old boolean setting if exists
    if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.enableAustralianAccent === 'boolean') {
            parsed.accent = parsed.enableAustralianAccent ? 'australian' : 'american';
            delete parsed.enableAustralianAccent;
        }
        return { ...defaultSettings, ...parsed };
    }
    return defaultSettings;
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

// --- Archive Features ---

export const archiveChat = (chatId: string) => {
    const chats = loadChats();
    const updated = chats.map(c => 
        c.id === chatId ? { ...c, archived: true } : c
    );
    saveChats(updated);
    return updated;
};

export const unarchiveChat = (chatId: string) => {
    const chats = loadChats();
    const updated = chats.map(c => 
        c.id === chatId ? { ...c, archived: false } : c
    );
    saveChats(updated);
    return updated;
};

export const archiveAllChats = () => {
    const chats = loadChats();
    const updated = chats.map(c => ({ ...c, archived: true }));
    saveChats(updated);
    return updated;
};

// --- Search / Memory ---
export const findRelevantChatSegments = (query: string, currentChatId: string | null): string => {
    const chats = loadChats();
    // Clean query and extract keywords (words > 3 chars)
    const keywords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) return "";

    const candidates: { score: number, content: string, date: number }[] = [];

    chats.forEach(chat => {
        if (chat.id === currentChatId) return; // Skip current chat

        chat.messages.forEach((msg, idx) => {
            if (msg.role === Role.USER) {
                let score = 0;
                const text = msg.content.toLowerCase();
                keywords.forEach(kw => {
                    if (text.includes(kw)) score++;
                });

                // Bonus for recency (not implemented complexly, just date sort later)
                if (score > 0) {
                    // Get the assistant response if it exists
                    const response = chat.messages[idx + 1];
                    const obsContent = response?.content ? response.content.substring(0, 300) + "..." : "[No response]";
                    // Format as a memory snippet
                    let snippet = `[Date: ${new Date(msg.timestamp).toLocaleDateString()}]\nUser: ${msg.content}\nObsidian: ${obsContent}`;
                    candidates.push({ score, content: snippet, date: msg.timestamp });
                }
            }
        });
    });

    // Sort by Score desc, then Date desc
    candidates.sort((a, b) => b.score - a.score || b.date - a.date);
    
    // Take top 3 most relevant snippets
    const top = candidates.slice(0, 3);
    
    if (top.length === 0) return "";

    return top.map(c => c.content).join("\n---\n");
};

// --- Link Extraction ---
export interface SharedLink {
    url: string;
    chatTitle: string;
    timestamp: number;
}

export const extractSharedLinks = (): SharedLink[] => {
    const chats = loadChats();
    const links: SharedLink[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    chats.forEach(chat => {
        chat.messages.forEach(msg => {
            if (msg.role === Role.USER) {
                const matches = msg.content.match(urlRegex);
                if (matches) {
                    matches.forEach(url => {
                        // Avoid duplicates if user sent same link multiple times in same chat?
                        // Let's keep them to show history for now, or distinct them.
                        // Filter basic duplicates from list
                        if(!links.some(l => l.url === url && l.chatTitle === chat.title)) {
                            links.push({
                                url: url,
                                chatTitle: chat.title,
                                timestamp: msg.timestamp
                            });
                        }
                    });
                }
            }
        });
    });

    // Sort by newest
    return links.sort((a, b) => b.timestamp - a.timestamp);
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