
import { useState, useEffect } from 'react';
import { Contact } from '../types';
import { Search, UserPlus, ChevronDown, Users, X, Check, Globe, Signal } from 'lucide-react';
import { mockBackend } from '../services/mockBackend';
import { soundManager } from '../utils/SoundManager';

interface SidebarProps {
  contacts: Contact[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddContact: (email: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ contacts, activeId, onSelect, onAddContact }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const filteredContacts = contacts.filter(contact => !contact.isGroup);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail.trim()) {
        onAddContact(newEmail);
        setNewEmail('');
        setIsAddModalOpen(false);
    }
  };

  return (
    <div className="w-full md:w-80 h-full bg-[#F1F5F9] flex flex-col border-r border-slate-300 shadow-inner font-sans relative">
      
      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/20 backdrop-blur-[1px]">
            <div className="bg-white p-4 shadow-2xl border border-sky-500 w-64 animate-in zoom-in-95 duration-200 rounded-sm">
                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                    <h3 className="text-sky-700 font-bold text-xs uppercase tracking-wide">Add Contact</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500">
                        <X size={14} />
                    </button>
                </div>
                <form onSubmit={handleAddSubmit}>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase font-bold">Email Address</label>
                    <input
                        type="email"
                        autoFocus
                        placeholder="name@example.com"
                        className="w-full border border-slate-300 p-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 rounded-sm bg-slate-50"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={() => setIsAddModalOpen(false)} 
                            className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 border border-transparent rounded-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-3 py-1 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 border border-sky-600 rounded-sm flex items-center gap-1"
                        >
                            <Check size={12} /> Add
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Sidebar Header (My Profile) */}
      <div className="h-16 bg-gradient-to-b from-sky-500 to-sky-600 flex items-center px-4 justify-between shadow-md z-10">
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity">
            <div className="relative">
                <div className="w-10 h-10 bg-sky-200 rounded-lg flex items-center justify-center text-sky-700 font-bold border border-sky-400 shadow-sm">
                    Me
                </div>
                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-sky-600 bg-green-400`}></div>
            </div>
            <div className="flex flex-col text-white">
                <span className="font-bold text-sm drop-shadow-md">My Status</span>
                <div className="flex items-center gap-1 text-xs text-sky-100">
                    <Signal size={10} className="text-green-300" />
                    <span className="truncate max-w-[100px]">Online</span>
                </div>
            </div>
        </div>
        <button className="text-white/80 hover:text-white transition-colors">
             <SettingsButton />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-[#E5E9F0] border-b border-slate-300/50 shadow-sm">
         <div className="relative">
            <input 
                type="text" 
                placeholder="Search..." 
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-400 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white shadow-inner placeholder-slate-400"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
         </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between bg-[#F8FAFC] border-b border-slate-200">
             <span>My Contacts</span>
             <button 
                onClick={() => { soundManager.playSelect(); setIsAddModalOpen(true); }} 
                className="flex items-center gap-1 text-sky-600 hover:text-sky-800 hover:bg-sky-100 px-1.5 py-0.5 rounded transition-colors"
                title="Add new contact"
             >
                 <UserPlus size={14} />
             </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                  No contacts found.
                  <button onClick={() => { soundManager.playSelect(); setIsAddModalOpen(true); }} className="block mx-auto mt-2 text-sky-500 hover:underline">Add one now</button>
              </div>
          ) : (
            filteredContacts.map((contact) => (
                <li 
                    key={contact.id}
                    onClick={() => onSelect(contact.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-transparent hover:bg-sky-100 hover:border-sky-200 ${activeId === contact.id ? 'bg-gradient-to-r from-sky-100 to-transparent border-l-4 border-l-sky-500 shadow-sm' : ''}`}
                >
                    <div className="relative">
                        <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-slate-300" />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${contact.status === 'online' ? 'bg-green-500' : contact.status === 'busy' ? 'bg-red-500' : 'bg-slate-400'}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                            <h3 className={`font-semibold text-sm truncate ${activeId === contact.id ? 'text-sky-900' : 'text-slate-700'}`}>{contact.name}</h3>
                            {contact.id.startsWith('remote:') && <Globe size={10} className="text-sky-400" />}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{contact.lastMessage}</p>
                    </div>
                </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

const SettingsButton = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);
