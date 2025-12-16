export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum ModelTier {
  FAST = 'fast',        // Flash-Lite
  BALANCED = 'balanced',// Flash
  REASONING = 'reasoning' // Pro
}

export interface Attachment {
  file: File;
  previewUrl: string;
  mimeType: string;
  base64?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: Attachment[];
  thinking?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  mode: 'chat' | 'live';
  currentChatId: string | null;
}

export interface AppConfig {
  modelTier: ModelTier;
  enableThinking: boolean;
}

export interface Memory {
  id: string;
  content: string;
  type: 'auto' | 'manual';
  timestamp: number;
}

// Personalization & Settings
export interface UserSettings {
  userName: string;
  occupation: string;
  aboutUser: string; // Legacy field, kept for compatibility, now mostly replaced by Memory Bank
  customInstructions: string;
  voice: string;
  tone: string;
  
  // Language
  languageInterface: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh'; // UI Language
  languageModel: string; // "Auto", "English", "Spanish", etc.

  // Data
  allowTraining: boolean;
}

export interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}