
import { User, Contact, Message } from '../types';

const GLOBAL_VAULT_KEY = 'skylink_vault_v1'; 
const MESSAGES_KEY = 'skylink_messages_v1';
const NEWS_CACHE_KEY = 'skylink_news_cache_v1';
const SESSION_KEY = 'skylink_session';
const SECURE_STORE_PREFIX = 'skylink_secure_store_';
const IDB_DB_NAME = 'skylink_media_v1';
const IDB_AUDIO_STORE = 'audio_blobs';
const IDB_IMAGE_STORE = 'image_blobs';
const IDB_AUDIO_META = 'audio_meta';
const IDB_IMAGE_META = 'image_meta';

interface CachedNews {
    region: string;
    lang: string;
    articles: any[];
    timestamp: number;
}

class MockBackendService {
  // Observable callback for UI updates
  private onUpdateCallback: (() => void) | null = null;

  constructor() {
    this.initVault();
  }

  public setUpdateListener(cb: () => void) {
      this.onUpdateCallback = cb;
  }

  private notifyUpdate() {
      if (this.onUpdateCallback) this.onUpdateCallback();
  }

  private initVault() {
    if (!localStorage.getItem(GLOBAL_VAULT_KEY)) {
        localStorage.setItem(GLOBAL_VAULT_KEY, JSON.stringify([])); 
    }
    if (!localStorage.getItem(MESSAGES_KEY)) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify({}));
    }
  }

  // === DATA STORAGE ===

  private getVault(): User[] {
    try {
        const data = localStorage.getItem(GLOBAL_VAULT_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  private saveVault(users: User[]) {
    try {
        const light = users.map(u => ({
            ...u,
            mediaAudio: [],
            mediaImages: [],
            mediaVideos: []
        }));
        localStorage.setItem(GLOBAL_VAULT_KEY, JSON.stringify(light));
    } catch (e) {
        console.warn("Vault save skipped or limited due to quota");
    }
  }

  private getMessageStore(): Record<string, Message[]> {
      try {
          return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}');
      } catch (e) { return {}; }
  }

  private saveMessageStore(store: Record<string, Message[]>) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
  }

  // === SECURE MEDIA STORAGE (AES-GCM) ===
  private async getKey(): Promise<CryptoKey | null> {
      try {
          const user = this.getCurrentUser();
          if (!user || !user.password) return null;
          const enc = new TextEncoder();
          const baseKey = await crypto.subtle.importKey('raw', enc.encode(user.password + ':' + user.email), { name: 'PBKDF2' }, false, ['deriveKey']);
          const salt = enc.encode('skylink_salt_v1');
          return await crypto.subtle.deriveKey(
              { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
              baseKey,
              { name: 'AES-GCM', length: 256 },
              false,
              ['encrypt', 'decrypt']
          );
      } catch { return null; }
  }
  private async encrypt(text: string): Promise<string> {
      const key = await this.getKey();
      if (!key) return text; // fallback
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const data = enc.encode(text);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
      const ivb64 = btoa(String.fromCharCode(...iv));
      return `${ivb64}:${b64}`;
  }
  private async decrypt(payload: string): Promise<string> {
      const key = await this.getKey();
      if (!key) return payload; // fallback
      const [ivb64, b64] = payload.split(':');
      const iv = new Uint8Array(atob(ivb64).split('').map(c => c.charCodeAt(0)));
      const ct = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(pt);
  }
  // === OPFS UTILITIES ===
  private async getOpfsRoot(): Promise<any> {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (!nav || !nav.storage || !nav.storage.getDirectory) return null;
      return await nav.storage.getDirectory();
  }
  private isOpfsAvailable(): boolean {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      return !!(nav && nav.storage && nav.storage.getDirectory);
  }
  private getCurrentEmail(): string {
      return this.getCurrentUser()?.email || 'guest';
  }
  private getUserBucket(): string {
      const em = this.getCurrentEmail().toLowerCase();
      return `u_${em.replace(/[^a-z0-9]/g, '')}`;
  }
  private async getOpfsSubdir(name: string): Promise<any | null> {
      const root = await this.getOpfsRoot();
      if (!root) return null;
      const bucket = this.getUserBucket();
      const parts = [bucket, name].join('/').split('/').filter(Boolean);
      try {
          // Walk nested directories
          // @ts-ignore
          let dir: any = root;
          for (const part of parts) {
              // @ts-ignore
              dir = await dir.getDirectoryHandle(part, { create: true } as any);
          }
          return dir;
      } catch { return null; }
  }
  private async opfsWrite(subdir: string, filename: string, blob: Blob): Promise<boolean> {
      const dir = await this.getOpfsSubdir(subdir);
      if (!dir) return false;
      try {
          // @ts-ignore
          const fh = await dir.getFileHandle(filename, { create: true } as any);
          // @ts-ignore
          const ws = await fh.createWritable();
          await ws.write(blob);
          await ws.close();
          return true;
      } catch { return false; }
  }
  private async opfsGetObjectUrl(subdir: string, filename: string): Promise<string | null> {
      const dir = await this.getOpfsSubdir(subdir);
      if (!dir) return null;
      try {
          // @ts-ignore
          const fh = await dir.getFileHandle(filename);
          const file = await fh.getFile();
          return URL.createObjectURL(file);
      } catch { return null; }
  }
  private openIdb(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
          const req = indexedDB.open(IDB_DB_NAME, 3);
          req.onupgradeneeded = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) {
                  db.createObjectStore(IDB_AUDIO_STORE);
              }
              if (!db.objectStoreNames.contains(IDB_IMAGE_STORE)) {
                  db.createObjectStore(IDB_IMAGE_STORE);
              }
              if (!db.objectStoreNames.contains(IDB_AUDIO_META)) {
                  db.createObjectStore(IDB_AUDIO_META);
              }
              if (!db.objectStoreNames.contains(IDB_IMAGE_META)) {
                  db.createObjectStore(IDB_IMAGE_META);
              }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
      });
  }
  private async idbPutAudio(id: string, dataUrl: string) {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
              const store = tx.objectStore(IDB_AUDIO_STORE);
              const r = store.put(dataUrl, id);
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  private async idbSetAudioMeta(items: Array<{ id: string; title?: string; name: string }>) {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_META, 'readwrite');
              const store = tx.objectStore(IDB_AUDIO_META);
              const key = `list_${this.getUserBucket()}`;
              const r = store.put(items, key);
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  public async idbGetAudioMeta(): Promise<Array<{ id: string; title?: string; name: string }>> {
      try {
          const db = await this.openIdb();
          return await new Promise<any[]>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_META, 'readonly');
              const store = tx.objectStore(IDB_AUDIO_META);
              const key = `list_${this.getUserBucket()}`;
              const r = store.get(key);
              r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
              r.onerror = () => reject(r.error);
          });
      } catch { return []; }
  }
  private async idbPutImage(id: string, dataUrl: string) {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_STORE, 'readwrite');
              const store = tx.objectStore(IDB_IMAGE_STORE);
              const r = store.put(dataUrl, id);
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  private async idbSetImageMeta(items: Array<{ id: string; name: string }>) {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_META, 'readwrite');
              const store = tx.objectStore(IDB_IMAGE_META);
              const key = `list_${this.getUserBucket()}`;
              const r = store.put(items, key);
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  public async idbGetImageMeta(): Promise<Array<{ id: string; name: string }>> {
      try {
          const db = await this.openIdb();
          return await new Promise<any[]>((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_META, 'readonly');
              const store = tx.objectStore(IDB_IMAGE_META);
              const key = `list_${this.getUserBucket()}`;
              const r = store.get(key);
              r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
              r.onerror = () => reject(r.error);
          });
      } catch { return []; }
  }
  public async getAudioDataUrl(id: string): Promise<string | null> {
      try {
          const db = await this.openIdb();
          return await new Promise<string | null>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_STORE, 'readonly');
              const store = tx.objectStore(IDB_AUDIO_STORE);
              const r = store.get(id);
              r.onsuccess = () => resolve(r.result || null);
              r.onerror = () => reject(r.error);
          });
      } catch { return null; }
  }
  public async getAudioObjectUrl(id: string): Promise<string | null> {
      const meta = await this.idbGetAudioMeta();
      const item = meta.find(m => m.id === id);
      if (!item) return null;
      const fname = `${id}.bin`;
      const opfsUrl = await this.opfsGetObjectUrl('audio', fname);
      if (opfsUrl) return opfsUrl;
      try {
          const db = await this.openIdb();
          const blob: Blob | null = await new Promise((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_STORE, 'readonly');
              const store = tx.objectStore(IDB_AUDIO_STORE);
              const r = store.get(id);
              r.onsuccess = () => resolve(r.result || null);
              r.onerror = () => reject(r.error);
          });
          if (blob) return URL.createObjectURL(blob);
      } catch {}
      return null;
  }
  public async getImageDataUrl(id: string): Promise<string | null> {
      try {
          const db = await this.openIdb();
          return await new Promise<string | null>((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_STORE, 'readonly');
              const store = tx.objectStore(IDB_IMAGE_STORE);
              const r = store.get(id);
              r.onsuccess = () => resolve(r.result || null);
              r.onerror = () => reject(r.error);
          });
      } catch { return null; }
  }
  public async getImageObjectUrl(id: string): Promise<string | null> {
      const meta = await this.idbGetImageMeta();
      const item = meta.find(m => m.id === id);
      if (!item) return null;
      const fname = `${id}.bin`;
      const opfsUrl = await this.opfsGetObjectUrl('images', fname);
      if (opfsUrl) return opfsUrl;
      try {
          const db = await this.openIdb();
          const blob: Blob | null = await new Promise((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_STORE, 'readonly');
              const store = tx.objectStore(IDB_IMAGE_STORE);
              const r = store.get(id);
              r.onsuccess = () => resolve(r.result || null);
              r.onerror = () => reject(r.error);
          });
          if (blob) return URL.createObjectURL(blob);
      } catch {}
      return null;
  }
  private getSecureKey(type: 'audio' | 'images' | 'videos') {
      const email = this.getCurrentUser()?.email || 'guest';
      return `${SECURE_STORE_PREFIX}${email}_${type}`;
  }
  public async setSecureMedia(type: 'audio' | 'images' | 'videos', items: any[]) {
      try {
          const json = JSON.stringify(items);
          const enc = await this.encrypt(json);
          localStorage.setItem(this.getSecureKey(type), enc);
      } catch {}
  }
  public async getSecureMedia(type: 'audio' | 'images' | 'videos'): Promise<any[]> {
      try {
          if (type === 'audio') {
              const meta = await this.idbGetAudioMeta();
              return meta.slice(-500); // much higher capacity
          }
          if (type === 'images') {
              const meta = await this.idbGetImageMeta();
              const sliced = meta.slice(-1000);
              // Backward compatibility: if entries already include src, return as-is
              if ((sliced as any[]).length > 0 && typeof (sliced as any[])[0].src === 'string') return sliced as any[];
              // Resolve data URLs from IDB based on id
              const resolved = await Promise.all(sliced.map(async (m) => {
                  const src = await this.getImageObjectUrl(m.id) || await this.getImageDataUrl(m.id);
                  return { src: src || '', name: m.name };
              }));
              return resolved.filter(it => it.src);
          }
          const raw = localStorage.getItem(this.getSecureKey(type));
          if (!raw) return [];
          const dec = await this.decrypt(raw);
          const arr = JSON.parse(dec);
          if (!Array.isArray(arr)) return [];
          return arr.slice(-100); // videos or other legacy
      } catch { return []; }
  }

  private clearSecureMedia(type: 'audio' | 'images' | 'videos') {
      try {
          localStorage.removeItem(this.getSecureKey(type));
      } catch {}
  }
  private async clearIdbAudio() {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
              const store = tx.objectStore(IDB_AUDIO_STORE);
              const r = store.clear();
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  private async clearIdbImages() {
      try {
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_IMAGE_STORE, 'readwrite');
              const store = tx.objectStore(IDB_IMAGE_STORE);
              const r = store.clear();
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
  }
  private async clearIdbMeta() {
      try {
          const db = await this.openIdb();
          await Promise.all([
              new Promise<void>((resolve, reject) => {
                  const tx = db.transaction(IDB_AUDIO_META, 'readwrite');
                  const store = tx.objectStore(IDB_AUDIO_META);
                  const key = `list_${this.getUserBucket()}`;
                  const r = store.delete(key);
                  r.onsuccess = () => resolve();
                  r.onerror = () => reject(r.error);
              }),
              new Promise<void>((resolve, reject) => {
                  const tx = db.transaction(IDB_IMAGE_META, 'readwrite');
                  const store = tx.objectStore(IDB_IMAGE_META);
                  const key = `list_${this.getUserBucket()}`;
                  const r = store.delete(key);
                  r.onsuccess = () => resolve();
                  r.onerror = () => reject(r.error);
              })
          ]);
      } catch {}
  }
  public async clearAllMedia() {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaAudio = [];
      me.mediaImages = [];
      me.mediaVideos = [];
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.clearSecureMedia('audio');
      this.clearSecureMedia('images');
      this.clearSecureMedia('videos');
      await this.clearIdbAudio();
      await this.clearIdbImages();
      await this.clearIdbMeta();
      this.notifyUpdate();
  }

  // === AUTH ===

  getCurrentUser(): User | null {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    return JSON.parse(session);
  }

  deleteUser(email: string) {
    const users = this.getVault();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return;

    const removed = users[idx];
    users.splice(idx, 1);

    // Remove from other users' contacts and incoming requests
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      u.contacts = (u.contacts || []).filter(e => e !== email);
      u.favorites = (u.favorites || []).filter(e => e !== email);
      u.incomingRequests = (u.incomingRequests || []).filter(e => e !== email);
      users[i] = u;
    }

    // Remove related conversations
    const store = this.getMessageStore();
    const keys = Object.keys(store);
    for (const k of keys) {
      if (k.includes(email)) {
        delete (store as any)[k];
      }
    }
    this.saveMessageStore(store);

    this.saveVault(users);
    if (this.getCurrentUser()?.email === email) {
      this.logout();
    }
    this.notifyUpdate();
  }

  async login(email: string, password: string): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) return null;
      const user = await res.json();
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user as User;
    } catch { return null; }
  }

  signup(name: string, email: string, password: string): Promise<User> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password })
        });
        if (!res.ok) {
          try {
            const body = await res.json();
            if (res.status === 409 && body && body.error === 'account_exists') {
              reject(new Error('Account exists'));
            } else {
              reject(new Error('Signup failed'));
            }
          } catch {
            reject(new Error('Signup failed'));
          }
          return;
        }
        const user = await res.json();
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        resolve(user as User);
      } catch (e) { reject(e as any); }
    });
  }

  loginGuest(): User {
    const users = this.getVault();
    const email = 'guest@local';
    let user = users.find(u => u.email === email) || null;
    if (!user) {
        user = {
            name: 'Guest',
            email,
            password: '',
            skypeId: 'live:guest',
            avatar: 'https://ui-avatars.com/api/?name=Guest&background=random',
            contacts: [],
            favorites: [],
            incomingRequests: [],
            mediaAudio: [],
            mediaImages: [],
            mediaVideos: []
        } as User;
        users.push(user);
        this.saveVault(users);
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.notifyUpdate();
    return user;
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  // === CONTACTS ===

  addContact(currentUserEmail: string, targetEmailOrName: string): boolean {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === currentUserEmail);
      if (meIndex === -1) return false;

      let resolvedEmail = targetEmailOrName;
      if (!targetEmailOrName.includes('@')) {
          const match = users.find(u => u.name.toLowerCase() === targetEmailOrName.toLowerCase());
          if (match) resolvedEmail = match.email;
      }

      if (resolvedEmail === currentUserEmail) return false;

      const targetIndex = users.findIndex(u => u.email === resolvedEmail);
      if (targetIndex === -1) {
          return false; // Do not allow adding non-existent users
      }

      const me = users[meIndex];
      const target = users[targetIndex];

      target.incomingRequests = target.incomingRequests || [];
      if (!target.incomingRequests.includes(currentUserEmail)) {
          target.incomingRequests.push(currentUserEmail);
      }
      users[targetIndex] = target;

      if (!me.contacts.includes(resolvedEmail)) me.contacts.push(resolvedEmail);

      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      return true;
  }

  getMyContacts(email: string): Contact[] {
      const me = this.getCurrentUser();
      if (!me) return [];

      const users = this.getVault(); // Serves as our local "Phonebook" cache

      return me.contacts.map(contactEmail => {
          // Try to find cached profile
          const cachedUser = users.find(u => u.email === contactEmail);
          
          const msgs = this.getMessages(email, contactEmail);
          const lastMsg = msgs[msgs.length - 1];

          let requestStatus: 'pending_outgoing' | 'accepted' | 'pending_incoming' | undefined = undefined;
          if (cachedUser) {
              const theyAddedMe = cachedUser.contacts.includes(email);
              requestStatus = theyAddedMe ? 'accepted' : 'pending_outgoing';
          }

          return {
              id: contactEmail,
              email: contactEmail,
              name: cachedUser ? cachedUser.name : contactEmail, 
              avatar: cachedUser ? cachedUser.avatar : 'https://ui-avatars.com/api/?name=?&background=ccc',
              status: 'online', // In local simulation, everyone is "online" if they exist
              lastMessage: lastMsg ? lastMsg.text : '',
              lastMessageTimestamp: lastMsg ? lastMsg.timestamp : 0,
              type: 'direct',
              isAi: false,
              requestStatus
          };
      });
  }

  // === MESSAGING ===

  private getConversationId(email1: string, email2: string): string {
      return [email1, email2].sort().join('_');
  }

  getMessages(myEmail: string, otherEmail: string): Message[] {
      const store = this.getMessageStore();
      const id = this.getConversationId(myEmail, otherEmail);
      return store[id] || [];
  }

  sendMessage(senderEmail: string, receiverEmail: string, text: string, audioUrl?: string, videoUrl?: string) {
      const store = this.getMessageStore();
      const id = this.getConversationId(senderEmail, receiverEmail);
      if (!store[id]) store[id] = [];

      const msg: Message = {
          id: Date.now().toString(),
          senderId: senderEmail,
          text,
          timestamp: Date.now(),
          audioUrl,
          videoUrl
      };

      store[id].push(msg);
      this.saveMessageStore(store);
      this.notifyUpdate();
  }

  sendSignal(senderEmail: string, receiverEmail: string, payload: any) {
      const store = this.getMessageStore();
      const id = this.getConversationId(senderEmail, receiverEmail);
      if (!store[id]) store[id] = [];
      const msg: Message = {
          id: Date.now().toString(),
          senderId: senderEmail,
          text: `CALL_SIGNAL:${JSON.stringify(payload)}`,
          timestamp: Date.now(),
          isSystem: true,
          hidden: true
      } as Message;
      store[id].push(msg);
      this.saveMessageStore(store);
      this.notifyUpdate();
  }

  // === NEWS CACHING (LOCAL STORAGE) ===
  
  public getCachedNews(region: string, lang: string): any[] | null {
      try {
          const raw = localStorage.getItem(NEWS_CACHE_KEY);
          if (!raw) return null;
          
          const cache: CachedNews = JSON.parse(raw);
          
          // Smart TTL: If cache contains an error, expire it faster (2 min) than success (15 min)
          // This prevents quota limit errors from locking the user out for too long.
          const isError = cache.articles && cache.articles[0]?.isError;
          const ttl = isError ? 1000 * 60 * 2 : 1000 * 60 * 15; 

          if (cache.region === region && 
              cache.lang === lang && 
              (Date.now() - cache.timestamp < ttl)) { 
              console.log("[News] Returning cached news from LocalStorage");
              return cache.articles;
          }
      } catch (e) {
          return null;
      }
      return null;
  }

  public setCachedNews(region: string, lang: string, articles: any[]) {
      try {
          const cache: CachedNews = {
              region,
              lang,
              articles,
              timestamp: Date.now()
          };
          localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(cache));
      } catch(e) {
          console.warn("Failed to write news cache");
      }
  }

  // Stubs for removed interface methods
  initNetwork(user: User) {} 
  getMyPeerId() { return null; }
  searchUserByName(query: string): User[] {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const users = this.getVault();
      return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  getIncomingRequests(): Contact[] {
      const me = this.getCurrentUser();
      if (!me) return [];
      const users = this.getVault();
      const incoming = (me.incomingRequests || []).map(email => {
          const u = users.find(x => x.email === email);
          return {
              id: email,
              email,
              name: u ? u.name : email,
              avatar: u ? u.avatar : 'https://ui-avatars.com/api/?name=?&background=ccc',
              status: 'online',
              lastMessage: '',
              type: 'direct',
              requestStatus: 'pending_incoming'
          } as Contact;
      });
      return incoming;
  }

  async setMyAvatar(dataUrl: string) {
      try {
          const users = this.getVault();
          const meEmail = this.getCurrentUser()?.email;
          const meIndex = users.findIndex(u => u.email === meEmail);
          if (meIndex === -1) return;
          const me = users[meIndex];
          me.avatar = dataUrl;
          users[meIndex] = me;
          this.saveVault(users);
          localStorage.setItem(SESSION_KEY, JSON.stringify(me));
          this.notifyUpdate();
      } catch {}
  }

  async addMediaAudio(item: { id: string; title: string; url: string; name: string }) {
      if (this.getCurrentUser()?.email === 'guest@local') return;
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaAudio = me.mediaAudio || [];
      // Ensure unique id to avoid overwriting in IDB
      if (me.mediaAudio.some(a => a.id === item.id)) {
          item.id = `${item.id}_${Date.now()}`;
      }
      me.mediaAudio.push(item);
      if (me.mediaAudio.length > 500) {
          me.mediaAudio = me.mediaAudio.slice(-500);
      }
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      try {
          const b64 = item.url.split(',')[1] || '';
          const bstr = atob(b64);
          const arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
          const blob = new Blob([arr], { type: 'audio/mpeg' });
          const db = await this.openIdb();
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
              const store = tx.objectStore(IDB_AUDIO_STORE);
              const r = store.put(blob, item.id);
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
          });
      } catch {}
      const prev = await this.idbGetAudioMeta();
      const next = prev.concat([{ id: item.id, title: item.title, name: item.name }]);
      const capped = next.length > 500 ? next.slice(-500) : next;
      await this.idbSetAudioMeta(capped);
      // Write to OPFS as well to avoid quota issues with large blobs
      try {
          const b64 = item.url.split(',')[1] || '';
          const bstr = atob(b64);
          const arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
          const blob = new Blob([arr], { type: 'audio/mpeg' });
          const ok = await this.opfsWrite('audio', `${item.id}.bin`, blob);
          if (!ok) {
              const db = await this.openIdb();
              await new Promise<void>((resolve, reject) => {
                  const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
                  const store = tx.objectStore(IDB_AUDIO_STORE);
                  const r = store.put(blob, item.id);
                  r.onsuccess = () => resolve();
                  r.onerror = () => reject(r.error);
              });
          }
      } catch {}
  }
  async addMediaAudioFile(file: File) {
      if (this.getCurrentUser()?.email === 'guest@local') return null;
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaAudio = me.mediaAudio || [];
      const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const title = file.name;
      me.mediaAudio.push({ id, title, url: '', name: title } as any);
      if (me.mediaAudio.length > 500) me.mediaAudio = me.mediaAudio.slice(-500);
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      let wrote = false;
      if (this.isOpfsAvailable()) {
          wrote = await this.opfsWrite('audio', `${id}.bin`, file);
      }
      if (!wrote) {
          try {
              const db = await this.openIdb();
              await new Promise<void>((resolve, reject) => {
                  const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
                  const store = tx.objectStore(IDB_AUDIO_STORE);
                  const r = store.put(file, id);
                  r.onsuccess = () => resolve();
                  r.onerror = () => reject(r.error);
              });
          } catch {}
      }
      const prev = await this.idbGetAudioMeta();
      const next = prev.concat([{ id, title, name: title }]);
      const capped = next.length > 500 ? next.slice(-500) : next;
      await this.idbSetAudioMeta(capped);
      return { id, title };
  }
  addMediaImage(item: { src: string; name: string }) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaImages = me.mediaImages || [];
      me.mediaImages.push(item);
      if (me.mediaImages.length > 30) {
          me.mediaImages = me.mediaImages.slice(-30);
      }
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      this.setSecureMedia('images', me.mediaImages);
  }
  async addMediaImages(items: { src: string; name: string }[]) {
      if (this.getCurrentUser()?.email === 'guest@local') return;
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaImages = me.mediaImages || [];
      // Store image data in IndexedDB, persist only metadata in vault/secure store
      const metas: { id: string; name: string }[] = [];
      for (const it of items) {
          const id = `img_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          metas.push({ id, name: it.name });
          try {
              const b64 = it.src.split(',')[1] || '';
              const bstr = atob(b64);
              const arr = new Uint8Array(bstr.length);
              for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
              const blob = new Blob([arr], { type: 'image/jpeg' });
              const ok = await this.opfsWrite('images', `${id}.bin`, blob);
              if (!ok) {
                  const db = await this.openIdb();
                  await new Promise<void>((resolve, reject) => {
                      const tx = db.transaction(IDB_IMAGE_STORE, 'readwrite');
                      const store = tx.objectStore(IDB_IMAGE_STORE);
                      const r = store.put(blob, id);
                      r.onsuccess = () => resolve();
                      r.onerror = () => reject(r.error);
                  });
              }
          } catch {}
      }
      // Append to existing image meta list in IDB
      const prevMeta = await this.idbGetImageMeta();
      const combinedMeta = prevMeta.concat(metas);
      const cappedMeta = combinedMeta.length > 1000 ? combinedMeta.slice(-1000) : combinedMeta;
      me.mediaImages = cappedMeta as any;
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      await this.idbSetImageMeta(me.mediaImages as any);
  }
  async addMediaImagesFiles(files: File[]) {
      if (this.getCurrentUser()?.email === 'guest@local') return false;
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaImages = me.mediaImages || [];
      const additions: { id: string; name: string }[] = [];
      for (const file of files) {
          const id = `img_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          additions.push({ id, name: file.name });
          let wrote = false;
          if (this.isOpfsAvailable()) {
              wrote = await this.opfsWrite('images', `${id}.bin`, file);
          }
          if (!wrote) {
              try {
                  const db = await this.openIdb();
                  await new Promise<void>((resolve, reject) => {
                      const tx = db.transaction(IDB_IMAGE_STORE, 'readwrite');
                      const store = tx.objectStore(IDB_IMAGE_STORE);
                      const r = store.put(file, id);
                      r.onsuccess = () => resolve();
                      r.onerror = () => reject(r.error);
                  });
              } catch {}
          }
      }
      const prevMeta = await this.idbGetImageMeta();
      const nextMeta = prevMeta.concat(additions);
      const capped = nextMeta.length > 1000 ? nextMeta.slice(-1000) : nextMeta;
      me.mediaImages = capped as any;
      users[meIndex] = me;
      this.saveVault(users);
      const lightMe = { ...me, mediaAudio: [], mediaImages: [], mediaVideos: [] } as User;
      localStorage.setItem(SESSION_KEY, JSON.stringify(lightMe));
      this.notifyUpdate();
      await this.idbSetImageMeta(me.mediaImages as any);
      return true;
  }
  addMediaVideo(item: { id: string; title?: string; url: string; name: string }) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.mediaVideos = me.mediaVideos || [];
      me.mediaVideos.push(item);
      users[meIndex] = me;
      this.saveVault(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(me));
      this.notifyUpdate();
      this.setSecureMedia('videos', me.mediaVideos);
  }
  getMediaAudio(): Array<{ id: string; title: string; url: string; name: string }> {
      const me = this.getCurrentUser();
      return (me?.mediaAudio || []).slice();
  }
  getMediaImages(): Array<{ src: string; name: string }> {
      const me = this.getCurrentUser();
      return (me?.mediaImages || []).slice();
  }
  getMediaVideos(): Array<{ id: string; title?: string; url: string; name: string }> {
      const me = this.getCurrentUser();
      return (me?.mediaVideos || []).slice();
  }
  acceptRequest(requesterEmail: string) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.incomingRequests = (me.incomingRequests || []).filter(e => e !== requesterEmail);
      if (!me.contacts.includes(requesterEmail)) me.contacts.push(requesterEmail);
      users[meIndex] = me;

      const requesterIndex = users.findIndex(u => u.email === requesterEmail);
      if (requesterIndex !== -1) {
          const requester = users[requesterIndex];
          if (!requester.contacts.includes(me.email)) requester.contacts.push(me.email);
          users[requesterIndex] = requester;
      }

      this.saveVault(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(me));
      this.notifyUpdate();
  }
  removeContact(targetEmail: string) {
      const users = this.getVault();
      const me = this.getCurrentUser();
      if (!me) return;
      const meIndex = users.findIndex(u => u.email === me.email);
      if (meIndex === -1) return;
      const mine = users[meIndex];
      mine.contacts = (mine.contacts || []).filter(e => e !== targetEmail);
      mine.favorites = (mine.favorites || []).filter(e => e !== targetEmail);
      users[meIndex] = mine;
      this.saveVault(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(mine));
      this.notifyUpdate();
  }
  rejectRequest(requesterEmail: string) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.incomingRequests = (me.incomingRequests || []).filter(e => e !== requesterEmail);
      users[meIndex] = me;
      this.saveVault(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(me));
      this.notifyUpdate();
  }
  toggleFavorite(targetEmail: string) {
      const users = this.getVault();
      const meIndex = users.findIndex(u => u.email === this.getCurrentUser()?.email);
      if (meIndex === -1) return;
      const me = users[meIndex];
      me.favorites = me.favorites || [];
      if (me.favorites.includes(targetEmail)) {
          me.favorites = me.favorites.filter(e => e !== targetEmail);
      } else {
          me.favorites.push(targetEmail);
      }
      users[meIndex] = me;
      this.saveVault(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(me));
      this.notifyUpdate();
  }
  exportAccount(): string {
      const user = this.getCurrentUser();
      if (!user) return "";
      const payload = {
          name: user.name,
          email: user.email,
          password: user.password,
          avatar: user.avatar,
          contacts: user.contacts || [],
          ts: Date.now()
      };
      try {
          return btoa(JSON.stringify(payload));
      } catch (e) {
          return "";
      }
  }

  exportVault(): string {
      const users = this.getVault();
      const payload = users.map(u => ({
          name: u.name,
          email: u.email,
          password: u.password,
          avatar: u.avatar,
          contacts: u.contacts || []
      }));
      try {
          return btoa(JSON.stringify(payload));
      } catch (e) {
          return "";
      }
  }

  importAccount(code: string): User {
      let data: any = null;
      try {
          data = JSON.parse(atob(code));
      } catch (e) {
          throw new Error('Invalid code');
      }

      if (!data || !data.email || !data.password || !data.name) {
          throw new Error('Invalid data');
      }

      const users = this.getVault();
      let user = users.find(u => u.email === data.email) || null;
      if (!user) {
          user = {
              name: data.name,
              email: data.email,
              password: data.password,
              skypeId: `live:${data.name.replace(/\s/g, '').toLowerCase()}`,
              avatar: data.avatar || `https://ui-avatars.com/api/?name=${data.name}&background=random`,
              contacts: Array.isArray(data.contacts) ? data.contacts : []
          } as User;
          users.push(user);
          this.saveVault(users);
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      this.notifyUpdate();
      return user;
  }

  importVault(code: string): number {
      let list: any = null;
      try {
          list = JSON.parse(atob(code));
      } catch (e) {
          throw new Error('Invalid code');
      }
      if (!Array.isArray(list)) {
          throw new Error('Invalid data');
      }
      const users = this.getVault();
      let imported = 0;
      for (const d of list) {
          if (!d || !d.email || !d.password || !d.name) continue;
          let user = users.find(u => u.email === d.email) || null;
          if (!user) {
              user = {
                  name: d.name,
                  email: d.email,
                  password: d.password,
                  skypeId: `live:${String(d.name || '').replace(/\s/g, '').toLowerCase()}`,
                  avatar: d.avatar || `https://ui-avatars.com/api/?name=${d.name}&background=random`,
                  contacts: Array.isArray(d.contacts) ? d.contacts : [],
                  favorites: [],
                  incomingRequests: [],
                  mediaAudio: [],
                  mediaImages: [],
                  mediaVideos: []
              } as User;
              users.push(user);
              imported++;
          } else {
              user.name = d.name;
              user.password = d.password;
              user.avatar = d.avatar || user.avatar;
              const nextContacts = Array.isArray(d.contacts) ? d.contacts : [];
              user.contacts = Array.from(new Set((user.contacts || []).concat(nextContacts)));
          }
      }
      this.saveVault(users);
      this.notifyUpdate();
      return imported;
  }
  getNetworkChannel() { return null; }
}

export const mockBackend = new MockBackendService();
const API_BASE = (() => {
  const host = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (/onrender\.com$/.test(host)) return 'https://skylink-auth-api.onrender.com';
  if (/skylinkwebchat\.com$/.test(host)) return '/api';
  return '/api';
})();
