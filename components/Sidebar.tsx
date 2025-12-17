import React from 'react';
import { SavedChat } from '../types';
import { Icon } from './Icon';

interface SidebarProps {
  chats: SavedChat[];
  currentChatId: string | null;
  onSelectChat: (chat: SavedChat) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onArchiveChat: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  chats, 
  currentChatId, 
  onSelectChat, 
  onNewChat, 
  onDeleteChat,
  onArchiveChat,
  isOpen,
  onClose
}) => {
  // Filter out archived chats for the sidebar
  const activeChats = chats.filter(c => !c.archived);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className={`fixed top-0 left-0 bottom-0 w-72 bg-obsidian-950 border-r border-obsidian-800 z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-obsidian-800">
                <span className="text-xs font-mono text-obsidian-400 uppercase tracking-widest">History</span>
                <button onClick={onClose} className="text-obsidian-500 hover:text-white">
                    <Icon name="x" className="w-5 h-5" />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4">
                <button 
                    onClick={() => { onNewChat(); onClose(); }}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-obsidian-700 rounded-lg text-sm text-white hover:bg-obsidian-900 transition-colors group"
                >
                    <Icon name="plus" className="w-4 h-4 text-obsidian-400 group-hover:text-white" />
                    <span>New Chat</span>
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
                {activeChats.length === 0 ? (
                    <div className="text-center mt-10 text-obsidian-600 text-xs">No active chats</div>
                ) : (
                    <div className="space-y-1">
                        {activeChats.map(chat => (
                            <div 
                                key={chat.id}
                                onClick={() => { onSelectChat(chat); onClose(); }}
                                className={`group relative flex items-center p-3 rounded cursor-pointer transition-colors ${currentChatId === chat.id ? 'bg-obsidian-800' : 'hover:bg-obsidian-900'}`}
                            >
                                <div className="flex-1 min-w-0 pr-14">
                                    <h3 className={`text-sm truncate ${currentChatId === chat.id ? 'text-white' : 'text-obsidian-300 group-hover:text-white'}`}>
                                        {chat.title || "Untitled Conversation"}
                                    </h3>
                                    <p className="text-[10px] text-obsidian-500 mt-1">
                                        {new Date(chat.timestamp).toLocaleDateString()}
                                    </p>
                                </div>
                                
                                {/* Actions - Absolute positioned to the right */}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-obsidian-900/80 backdrop-blur rounded p-0.5">
                                    <button 
                                        onClick={(e) => onArchiveChat(chat.id, e)}
                                        className="p-1.5 text-obsidian-500 hover:text-white transition-colors hover:bg-obsidian-800 rounded"
                                        title="Archive"
                                    >
                                        <Icon name="archive" className="w-3 h-3" />
                                    </button>
                                    <button 
                                        onClick={(e) => onDeleteChat(chat.id, e)}
                                        className="p-1.5 text-obsidian-500 hover:text-red-400 transition-colors hover:bg-obsidian-950 rounded"
                                        title="Delete"
                                    >
                                        <Icon name="trash" className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </>
  );
};
// Export Sidebar directly
export default Sidebar;