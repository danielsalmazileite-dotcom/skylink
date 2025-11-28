
export type ContactStatus = 'online' | 'away' | 'busy' | 'offline';

export interface Contact {
  id: string;
  name: string;
  email: string;
  skypeId?: string;
  status: ContactStatus;
  avatar: string;
  lastMessage: string;
  lastMessageTimestamp?: number; // For Recents sorting
  isGroup?: boolean;
  isAi?: boolean;
  isFavorite?: boolean; // For Favorites tab
  type?: 'direct' | 'region' | 'directory_listing';
  requestStatus?: 'pending_outgoing' | 'accepted' | 'pending_incoming'; 
}

export interface User {
  email: string;
  name: string;
  password: string; // Required for auth
  skypeId: string;
  avatar: string;
  contacts: string[]; // Array of emails of people I have added
  favorites?: string[]; // Array of emails of favorite contacts
  incomingRequests?: string[]; // Array of emails of people who added me but I haven't added back
  mediaAudio?: Array<{ id: string; title: string; url: string; name: string }>; 
  mediaImages?: Array<{ src: string; name: string }>;
  mediaVideos?: Array<{ id: string; title?: string; url: string; name: string }>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  senderName?: string; // For group chats
  audioUrl?: string; // Base64 data URI for voice messages
  videoUrl?: string; // Base64 data URI for video messages
  hidden?: boolean;
}

export type CallState = 'idle' | 'audio-connecting' | 'video-connecting' | 'connected' | 'reconnecting';

export type ViewState = 'hub' | 'chat' | 'auth';
