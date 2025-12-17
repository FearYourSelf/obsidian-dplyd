
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum ModelTier {
  FAST = 'fast',        // Flash-Lite
  BALANCED = 'balanced',// Flash
  // Reasoning deprecated to prevent 503 errors
  REASONING = 'reasoning' 
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
  groundingMetadata?: any; 
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
  // enableThinking removed
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
  aboutUser: string; // Legacy field
  customInstructions: string;
  voice: string;
  accent: 'australian' | 'american' | 'british' | 'italian'; 
  tone: string;
  
  // Language
  languageInterface: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh'; 
  languageModel: string; 

  // Data
  allowTraining: boolean;
}

export interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  archived?: boolean; 
}