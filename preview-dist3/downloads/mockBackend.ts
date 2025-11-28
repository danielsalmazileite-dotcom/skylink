import { User, Contact, Message } from '../../services/../types';

const GLOBAL_VAULT_KEY = 'skylink_vault_v1'; 
const MESSAGES_KEY = 'skylink_messages_v1';
const NEWS_CACHE_KEY = 'skylink_news_cache_v1';
const SESSION_KEY = 'skylink_session';

interface CachedNews {
    region: string;
    lang: string;
    articles: any[];
    timestamp: number;
}

class MockBackendService {
  private onUpdateCallback: (() => void) | null = null;

  constructor() { this.initVault(); }
  public setUpdateListener(cb: () => void) { this.onUpdateCallback = cb; }
  private notifyUpdate() { if (this.onUpdateCallback) this.onUpdateCallback(); }

  private initVault() {
    if (!localStorage.getItem(GLOBAL_VAULT_KEY)) {
        localStorage.setItem(GLOBAL_VAULT_KEY, JSON.stringify([])); 
    }
    if (!localStorage.getItem(MESSAGES_KEY)) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify({}));
    }
  }

  private getVault(): User[] {
    try { const data = localStorage.getItem(GLOBAL_VAULT_KEY); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  }
  private saveVault(users: User[]) { localStorage.setItem(GLOBAL_VAULT_KEY, JSON.stringify(users)); }
  private getMessageStore(): Record<string, Message[]> { try { return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}'); } catch (e) { return {}; } }
  private saveMessageStore(store: Record<string, Message[]>) { localStorage.setItem(MESSAGES_KEY, JSON.stringify(store)); }

  getCurrentUser(): User | null { const session = sessionStorage.getItem(SESSION_KEY); if (!session) return null; return JSON.parse(session); }
  login(email: string, password: string): User | null { const users = this.getVault(); const user = users.find(u => u.email === email && u.password === password); if (user) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); return user; } return null; }
  signup(name: string, email: string, password: string): Promise<User> { return new Promise((resolve, reject) => { let users = this.getVault(); if (users.find(u => u.email === email)) { reject(new Error("Account exists.")); return; } const newUser: User = { name, email, password, skypeId: `live:${name.replace(/\s/g, '').toLowerCase()}`, avatar: `https://ui-avatars.com/api/?name=${name}&background=random`, contacts: [], favorites: [], incomingRequests: [], }; users.push(newUser); this.saveVault(users); sessionStorage.setItem(SESSION_KEY, JSON.stringify(newUser)); resolve(newUser); }); }
  logout() { sessionStorage.removeItem(SESSION_KEY); }

  addContact(currentUserEmail: string, targetEmail: string) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === currentUserEmail);
      if (meIndex === -1) return;
      let resolvedEmail = targetEmail;
      if (!targetEmail.includes('@')) { const match = users.find(u => u.name.toLowerCase() === targetEmail.toLowerCase()); if (match) resolvedEmail = match.email; }
      const me = users[meIndex];
      const targetIndex = users.findIndex(u => u.email === resolvedEmail);
      if (targetIndex === -1) { if (!me.contacts.includes(resolvedEmail)) me.contacts.push(resolvedEmail); }
      else {
          const target = users[targetIndex];
          target.incomingRequests = target.incomingRequests || [];
          if (!target.incomingRequests.includes(currentUserEmail)) { target.incomingRequests.push(currentUserEmail); }
          users[targetIndex] = target;
          if (!me.contacts.includes(resolvedEmail)) me.contacts.push(resolvedEmail);
      }
      users[meIndex] = me; this.saveVault(users); sessionStorage.setItem(SESSION_KEY, JSON.stringify(me)); this.notifyUpdate();
  }

  getMyContacts(email: string): Contact[] {
      const me = this.getCurrentUser(); if (!me) return [];
      const users = this.getVault();
      return me.contacts.map(contactEmail => {
          const cachedUser = users.find(u => u.email === contactEmail);
          const msgs = this.getMessages(email, contactEmail);
          const lastMsg = msgs[msgs.length - 1];
          let requestStatus: 'pending_outgoing' | 'accepted' | 'pending_incoming' | undefined = undefined;
          if (cachedUser) { const theyAddedMe = cachedUser.contacts.includes(email); requestStatus = theyAddedMe ? 'accepted' : 'pending_outgoing'; }
          return { id: contactEmail, email: contactEmail, name: cachedUser ? cachedUser.name : contactEmail, avatar: cachedUser ? cachedUser.avatar : 'https://ui-avatars.com/api/?name=?&background=ccc', status: 'online', lastMessage: lastMsg ? lastMsg.text : '', lastMessageTimestamp: lastMsg ? lastMsg.timestamp : 0, type: 'direct', isAi: false, requestStatus } as Contact;
      });
  }

  private getConversationId(email1: string, email2: string): string { return [email1, email2].sort().join('_'); }
  getMessages(myEmail: string, otherEmail: string): Message[] { const store = this.getMessageStore(); const id = this.getConversationId(myEmail, otherEmail); return store[id] || []; }
  sendMessage(senderEmail: string, receiverEmail: string, text: string, audioUrl?: string, videoUrl?: string) { const store = this.getMessageStore(); const id = this.getConversationId(senderEmail, receiverEmail); if (!store[id]) store[id] = []; const msg: Message = { id: Date.now().toString(), senderId: senderEmail, text, timestamp: Date.now(), audioUrl, videoUrl }; store[id].push(msg); this.saveMessageStore(store); this.notifyUpdate(); }

  public getCachedNews(region: string, lang: string): any[] | null { try { const raw = localStorage.getItem(NEWS_CACHE_KEY); if (!raw) return null; const cache: CachedNews = JSON.parse(raw); const isError = cache.articles && cache.articles[0]?.isError; const ttl = isError ? 1000 * 60 * 2 : 1000 * 60 * 15; if (cache.region === region && cache.lang === lang && (Date.now() - cache.timestamp < ttl)) { return cache.articles; } } catch (e) { return null; } return null; }
  public setCachedNews(region: string, lang: string, articles: any[]) { try { const cache: CachedNews = { region, lang, articles, timestamp: Date.now() }; localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(cache)); } catch(e) { } }

  initNetwork(user: User) {} 
  getMyPeerId() { return null; }
  searchUserByName(query: string): User[] { const q = query.trim().toLowerCase(); if (!q) return []; const users = this.getVault(); return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); }
  getIncomingRequests(): Contact[] { const me = this.getCurrentUser(); if (!me) return []; const users = this.getVault(); const incoming = (me.incomingRequests || []).map(email => { const u = users.find(x => x.email === email); return { id: email, email, name: u ? u.name : email, avatar: u ? u.avatar : 'https://ui-avatars.com/api/?name=?&background=ccc', status: 'online', lastMessage: '', type: 'direct', requestStatus: 'pending_incoming' } as Contact; }); return incoming; }
  acceptRequest(requesterEmail: string) { const users = this.getVault(); const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email); if (meIndex === -1) return; const me = users[meIndex]; me.incomingRequests = (me.incomingRequests || []).filter(e => e !== requesterEmail); if (!me.contacts.includes(requesterEmail)) me.contacts.push(requesterEmail); users[meIndex] = me; const requesterIndex = users.findIndex(u => u.email === requesterEmail); if (requesterIndex !== -1) { const requester = users[requesterIndex]; if (!requester.contacts.includes(me.email)) requester.contacts.push(me.email); users[requesterIndex] = requester; } this.saveVault(users); sessionStorage.setItem(SESSION_KEY, JSON.stringify(me)); this.notifyUpdate(); }
  rejectRequest(requesterEmail: string) { const users = this.getVault(); const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email); if (meIndex === -1) return; const me = users[meIndex]; me.incomingRequests = (me.incomingRequests || []).filter(e => e !== requesterEmail); users[meIndex] = me; this.saveVault(users); sessionStorage.setItem(SESSION_KEY, JSON.stringify(me)); this.notifyUpdate(); }
  toggleFavorite(targetEmail: string) { const users = this.getVault(); const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email); if (meIndex === -1) return; const me = users[meIndex]; me.favorites = me.favorites || []; if (me.favorites.includes(targetEmail)) { me.favorites = me.favorites.filter(e => e !== targetEmail); } else { me.favorites.push(targetEmail); } users[meIndex] = me; this.saveVault(users); sessionStorage.setItem(SESSION_KEY, JSON.stringify(me)); this.notifyUpdate(); }
  exportAccount(): string { const user = this.getCurrentUser(); if (!user) return ""; const payload = { name: user.name, email: user.email, password: user.password, avatar: user.avatar, contacts: user.contacts || [], ts: Date.now() }; try { return btoa(JSON.stringify(payload)); } catch (e) { return ""; } }
  importAccount(code: string): User { let data: any = null; try { data = JSON.parse(atob(code)); } catch (e) { throw new Error('Invalid code'); } if (!data || !data.email || !data.password || !data.name) { throw new Error('Invalid data'); } const users = this.getVault(); let user = users.find(u => u.email === data.email) || null; if (!user) { user = { name: data.name, email: data.email, password: data.password, skypeId: `live:${data.name.replace(/\s/g, '').toLowerCase()}`, avatar: data.avatar || `https://ui-avatars.com/api/?name=${data.name}&background=random`, contacts: Array.isArray(data.contacts) ? data.contacts : [] } as User; users.push(user); this.saveVault(users); } sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); this.notifyUpdate(); return user; }
  getNetworkChannel() { return null; }
}

export const mockBackend = new MockBackendService();
