
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Hub } from './components/Hub';
import { ChatArea } from './components/ChatArea';
import { AuthScreen } from './components/AuthScreen';
import { Contact, ViewState, User } from './types';
import { mockBackend } from './services/mockBackend';
 
import { LogOut, AlertTriangle, Loader2, Globe, Key, Copy, CheckCircle, X, Trash2, Plus, Phone, Video, Download } from 'lucide-react';
import { LANGUAGES, getTranslation } from './utils/translations';
import { soundManager } from './utils/SoundManager';
import { Music } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('hub');
  const [dashboardMode, setDashboardMode] = useState<'contacts' | 'news' | 'media'>('contacts');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Contact[]>([]);
  
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  
  const getApiKey = () => {
    try {
      const im = (import.meta as any);
      const env = im?.env || {};
      return env.VITE_API_KEY || env.API_KEY || (typeof window !== 'undefined' ? (window as any).__API_KEY__ : undefined);
    } catch { return undefined; }
  };
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(!!getApiKey());
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [passportCode, setPassportCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncCode, setSyncCode] = useState<string>("");
  const [syncCopied, setSyncCopied] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [appLanguage, setAppLanguage] = useState<string>("English");
  
  const mainRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaTracks, setMediaTracks] = useState<Array<{ title: string; file: string; id: string }>>([
    { title: 'Teto Territory', file: 'assets/ksttTetoTerritory.mp3', id: 'teto' },
    { title: 'Unity', file: 'assets/tfrUnity.mp3', id: 'unity' }
  ]);
  const [mediaCurrentTrackId, setMediaCurrentTrackId] = useState<string>('teto');
  const [mediaIsPlaying, setMediaIsPlaying] = useState<boolean>(false);
  const [mediaProgress, setMediaProgress] = useState<number>(0);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [mediaVolume, setMediaVolume] = useState<number>(1);
  const [mediaLoop, setMediaLoop] = useState<boolean>(false);
  const [globalMessageNotice, setGlobalMessageNotice] = useState<{ name: string; avatar: string; text: string } | null>(null);
  const [globalCallNotice, setGlobalCallNotice] = useState<{ name: string; avatar: string; email: string; media: 'audio' | 'video'; sdp: any } | null>(null);
  const [pendingIncomingCall, setPendingIncomingCall] = useState<{ media: 'audio' | 'video'; sdp: any; from: string } | null>(null);
  const lastGlobalMsgTsRef = useRef<number>(0);
  const lastGlobalCallTsRef = useRef<number>(0);

  useEffect(() => {
    const k = getApiKey();
    if (k) setIsApiKeySet(true);

    // Register custom UI sounds if present in public/assets
    soundManager.registerSound('request', 'contact request sent.mp3');
    soundManager.registerSound('close', 'close.mp3');
    soundManager.registerSound('login', 'login.mp3');
    soundManager.registerSound('mouse', 'mouse.mp3');
    soundManager.registerSound('ringtone', 'ringtone.mp3');
    soundManager.registerSound('notf', 'notf.mp3');

    const currentUser = mockBackend.getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
        refreshData(currentUser.email);
    }

    // Subscribe to backend updates
    mockBackend.setUpdateListener(() => {
        const current = mockBackend.getCurrentUser();
        if (current) refreshData(current.email);
    });
    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button');
      if (!btn) return;
      const from = e.relatedTarget as HTMLElement | null;
      if (from && btn.contains(from)) return;
      soundManager.playSound('mouse');
    };

    document.addEventListener('mouseover', onMouseOver);

    return () => {
      mockBackend.setUpdateListener(() => {});
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const meta = await mockBackend.getSecureMedia('audio');
      if (Array.isArray(meta) && meta.length) {
        const loaded: Array<{ title: string; file: string; id: string }> = [];
        for (const m of meta) {
          const url = await mockBackend.getAudioObjectUrl(m.id) || await mockBackend.getAudioDataUrl(m.id);
          if (url) loaded.push({ title: m.title || m.name || 'Audio', file: url, id: m.id });
        }
        const base = [
          { title: 'Teto Territory', file: 'assets/ksttTetoTerritory.mp3', id: 'teto' },
          { title: 'Unity', file: 'assets/tfrUnity.mp3', id: 'unity' }
        ];
        setMediaTracks(base.concat(loaded));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const meta = await mockBackend.getSecureMedia('audio');
      const loaded: Array<{ title: string; file: string; id: string }> = [];
      for (const m of meta) {
        const url = await mockBackend.getAudioObjectUrl(m.id) || await mockBackend.getAudioDataUrl(m.id);
        if (url) loaded.push({ title: m.title || m.name || 'Audio', file: url, id: m.id });
      }
      const base = [
        { title: 'Teto Territory', file: 'assets/ksttTetoTerritory.mp3', id: 'teto' },
        { title: 'Unity', file: 'assets/tfrUnity.mp3', id: 'unity' }
      ];
      setMediaTracks(base.concat(loaded));
    })();
  }, [user?.email]);

  const refreshData = (email: string) => {
      const myContacts = mockBackend.getMyContacts(email);
      setContacts(myContacts);
      const reqs = mockBackend.getIncomingRequests();
      setRequests(reqs);
  };

  useEffect(() => {
    if (!user) return;
    let newestMsgTs = lastGlobalMsgTsRef.current;
    let newestCallTs = lastGlobalCallTsRef.current;
    contacts.forEach(c => {
      const msgs = mockBackend.getMessages(user.email, c.email);
      if (!msgs || !msgs.length) return;
      // Incoming text
      const latestText = [...msgs].reverse().find(m => !m.isSystem && m.senderId === c.email);
      if (latestText && latestText.timestamp > newestMsgTs) {
        newestMsgTs = latestText.timestamp;
        setGlobalMessageNotice({ name: c.name, avatar: c.avatar, text: latestText.text });
        soundManager.playSound('notf');
        setTimeout(() => setGlobalMessageNotice(null), 5000);
      }
      // Incoming call offer
      const latestOffer = [...msgs].reverse().find(m => m.isSystem && typeof m.text === 'string' && m.text.startsWith('CALL_SIGNAL:') && m.senderId === c.email);
      if (latestOffer && latestOffer.timestamp > newestCallTs) {
        try {
          const payload = JSON.parse(String(latestOffer.text).substring('CALL_SIGNAL:'.length));
          if (payload && payload.type === 'offer') {
            newestCallTs = latestOffer.timestamp;
            setGlobalCallNotice({ name: c.name, avatar: c.avatar, email: c.email, media: payload.media || 'audio', sdp: payload.sdp });
            soundManager.playLoop('ringtone');
          }
        } catch {}
      }
    });
    lastGlobalMsgTsRef.current = newestMsgTs;
    lastGlobalCallTsRef.current = newestCallTs;
  }, [contacts, user?.email]);

  const handleLoginSuccess = (loggedInUser: User) => {
      setUser(loggedInUser);
      refreshData(loggedInUser.email);
      setView('hub');
      soundManager.playSound('login');
  };

  const handleLogout = () => {
      soundManager.playSelect();
      mockBackend.logout();
      setUser(null);
      setView('hub');
      soundManager.stopAll();
  };

  const handleAddContact = (emailToFind: string) => {
    if (!user) return;
    if (user.email === 'guest@local') {
      alert('Create an account to chat!');
      return;
    }
    const ok = mockBackend.addContact(user.email, emailToFind);
    if (!ok) {
      soundManager.playSelect();
      alert('this user doesnt exists');
      return;
    }
    soundManager.playSound('request');
    refreshData(user.email);
  };

  const handleContactSelect = async (id: string) => {
    soundManager.playSelect(); 
    if (!user) return;
    setActiveContactId(id);
    setView('chat');
  };

  const handleBackToHub = () => {
    soundManager.playSound('close');
    setView('hub');
    if (user) refreshData(user.email);
  };

  const handleModeSwitch = (mode: 'contacts' | 'news' | 'media') => {
    if (mode === 'news') soundManager.playNewsSound();
    else if (mode === 'contacts') soundManager.playContactsSound();
    else soundManager.playSelect();
    setDashboardMode(mode);
  };

  const ensureAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setMediaIsPlaying(false);
      audioRef.current.onloadedmetadata = () => setMediaDuration(audioRef.current?.duration || 0);
      audioRef.current.ontimeupdate = () => setMediaProgress(audioRef.current?.currentTime || 0);
    }
    audioRef.current.loop = mediaLoop;
    audioRef.current.volume = mediaVolume;
    return audioRef.current;
  };
  const getCurrentTrack = () => mediaTracks.find(t => t.id === mediaCurrentTrackId) || mediaTracks[0];
  const onMediaSetTrack = (id: string) => {
    setMediaCurrentTrackId(id);
    const audio = ensureAudio();
    const track = mediaTracks.find(t => t.id === id);
    if (track) {
      audio.src = track.file;
      audio.currentTime = 0;
      setMediaProgress(0);
      if (mediaIsPlaying) audio.play().catch(() => {});
    }
  };
  const onMediaPlayPause = () => {
    const audio = ensureAudio();
    const track = getCurrentTrack();
    if (!audio.src) audio.src = track.file;
    if (mediaIsPlaying) {
      audio.pause();
      setMediaIsPlaying(false);
    } else {
      audio.play().then(() => setMediaIsPlaying(true)).catch(() => {});
    }
  };
  const onMediaSeek = (time: number) => {
    const audio = ensureAudio();
    audio.currentTime = time;
    setMediaProgress(time);
  };
  const onMediaSetVolume = (v: number) => {
    setMediaVolume(v);
    const audio = ensureAudio();
    audio.volume = v;
  };
  const onMediaToggleLoop = () => {
    const next = !mediaLoop;
    setMediaLoop(next);
    const audio = ensureAudio();
    audio.loop = next;
  };
  const onMediaAddLocalFile = async (file: File) => {
    if (!user || user.email === 'guest@local') {
      alert('Create an account to chat!');
      return;
    }
    const added = await mockBackend.addMediaAudioFile(file);
    const meta = await mockBackend.getSecureMedia('audio');
    const loaded: Array<{ title: string; file: string; id: string }> = [];
    for (const m of meta) {
      const durl = await mockBackend.getAudioObjectUrl(m.id) || await mockBackend.getAudioDataUrl(m.id);
      if (durl) loaded.push({ title: m.title || m.name || 'Audio', file: durl, id: m.id });
    }
    const base = [
      { title: 'Teto Territory', file: 'assets/ksttTetoTerritory.mp3', id: 'teto' },
      { title: 'Unity', file: 'assets/tfrUnity.mp3', id: 'unity' }
    ];
    setMediaTracks(base.concat(loaded));
    if (added) {
      setMediaCurrentTrackId(added.id);
      const audio = ensureAudio();
      const src = await mockBackend.getAudioObjectUrl(added.id);
      if (src) {
        audio.src = src;
        audio.play().then(() => setMediaIsPlaying(true)).catch(() => {});
      }
    }
  };

  const t = (text: string) => getTranslation(text, appLanguage);

  

  if (!user) {
      return <AuthScreen onLogin={handleLoginSuccess} />;
  }

  const activeContact = contacts.find(c => c.id === activeContactId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans text-slate-800 relative bg-transparent">
      
      {/* Background - Dynamic Color Switching */}
      <div className={`fixed inset-0 z-0 pointer-events-none transition-all duration-1000 ${dashboardMode === 'news' ? 'bg-theme-green' : 'bg-theme-gray'}`}>
        {/* Animated Waves */}
        <div className="absolute bottom-0 w-full h-[40vh] opacity-30 animate-wave pointer-events-none">
             <svg viewBox="0 0 1440 320" className="w-full h-full" preserveAspectRatio="none">
                 <path fill="#ffffff" fillOpacity="1" d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,149.3C672,139,768,149,864,170.7C960,192,1056,224,1152,224C1248,224,1344,192,1440,176L1440,320L1344,320C1248,320,1152,320,1056,320C960,320,864,320,768,320C672,320,576,320,480,320C384,320,288,320,192,320L48,320L0,320Z"></path>
             </svg>
        </div>
        <div className="absolute bottom-0 w-full h-[45vh] opacity-20 animate-wave-slow pointer-events-none">
             <svg viewBox="0 0 1440 320" className="w-full h-full" preserveAspectRatio="none">
                 <path fill="#ffffff" fillOpacity="1" d="M0,64L48,85.3C96,107,192,149,288,160C384,171,480,149,576,133.3C672,117,768,107,864,112C960,117,1056,139,1152,144C1248,149,1344,139,1440,133.3L1440,320L1344,320C1248,320,1152,320,1056,320C960,320,864,320,768,320C672,320,576,320,480,320C384,320,288,320,192,320L48,320L0,320Z"></path>
             </svg>
        </div>
      </div>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-baseline px-4 md:px-20 pt-6 md:pt-14 pb-3 z-30 bg-transparent shrink-0 transition-colors duration-300">
         <div className="flex flex-col md:flex-row md:items-baseline gap-4 md:gap-10">
           <h1 className="text-3xl md:text-[44px] text-white font-normal tracking-tight leading-none drop-shadow-sm" style={{ fontFamily: '"Antique Olive", "Segoe UI", Arial, sans-serif' }}>
                Skylink<span className="align-top text-lg text-white ml-1 relative top-1">™</span>
            </h1>
            <div className="flex gap-6 md:gap-8">
                <button onClick={() => handleModeSwitch('contacts')} className={`text-lg md:text-3xl font-segoe-light hover:text-white transition-colors duration-300 ${dashboardMode === 'contacts' ? 'text-white font-semibold' : 'text-white/60'}`}>{t('Contacts')}</button>
                <button onClick={() => handleModeSwitch('news')} className={`text-lg md:text-3xl font-segoe-light hover:text-white transition-colors duration-300 ${dashboardMode === 'news' ? 'text-white font-semibold' : 'text-white/60'}`}>{t('News')}</button>
                <button onClick={() => handleModeSwitch('media')} className={`text-lg md:text-3xl font-segoe-light hover:text-white transition-colors duration-300 ${dashboardMode === 'media' ? 'text-white font-semibold' : 'text-white/60'}`}>{t('Media')}</button>
            </div>
         </div>
         <div className="hidden md:flex flex-col items-end text-white">
         <div className="flex items-center gap-4">
                 <span className="text-3xl font-segoe-light drop-shadow-sm">{user.name}</span>
                 <span className="relative inline-flex items-center">
                   <img src={user.avatar} className="w-14 h-14 border-2 border-white/80 shadow-sm" alt="Me" />
                   <input id="change-avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = '';
                      if (!file) return;
                      soundManager.playSelect();
                      const typeOk = /image\/.+/i.test(file.type);
                      if (!typeOk) return;
                      if (/image\/gif/i.test(file.type)) {
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const dataUrl = String(reader.result || '');
                          await mockBackend.setMyAvatar(dataUrl);
                          const updated = mockBackend.getCurrentUser();
                          if (updated) setUser(updated);
                          if (updated) refreshData(updated.email);
                        };
                        reader.readAsDataURL(file);
                      } else {
                        const url = URL.createObjectURL(file);
                        const img = new Image();
                        img.onload = async () => {
                          const size = 256;
                          const canvas = document.createElement('canvas');
                          canvas.width = size; canvas.height = size;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.clearRect(0, 0, size, size);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, size, size);
                            const ratio = Math.min(size / img.width, size / img.height);
                            const w = Math.max(1, Math.round(img.width * ratio));
                            const h = Math.max(1, Math.round(img.height * ratio));
                            const x = Math.round((size - w) / 2);
                            const y = Math.round((size - h) / 2);
                            ctx.drawImage(img, x, y, w, h);
                          }
                          URL.revokeObjectURL(url);
                          const preferredType = /image\/png/i.test(file.type) ? 'image/png' : 'image/jpeg';
                          const dataUrl = canvas.toDataURL(preferredType, 0.9);
                          await mockBackend.setMyAvatar(dataUrl);
                          const updated = mockBackend.getCurrentUser();
                          if (updated) setUser(updated);
                          if (updated) refreshData(updated.email);
                        };
                        img.onerror = () => { URL.revokeObjectURL(url); };
                        img.src = url;
                      }
                   }} />
                   <button onClick={() => { (document.getElementById('change-avatar-input') as HTMLInputElement)?.click(); }} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00AFF0] hover:bg-[#009edb] border border-white/80 flex items-center justify-center text-white" title="Change Avatar">
                     <Plus size={14} />
                   </button>
                </span>
               <button onClick={() => { soundManager.playSelect(); const code = mockBackend.exportAccount(); setPassportCode(code); setCopied(false); setIsPassportOpen(true); }}><Key size={20} className="text-white/60 hover:text-white" /></button>
               <button onClick={() => { soundManager.playSelect(); const code = mockBackend.exportVault(); setSyncCode(code); setSyncCopied(false); setIsSyncOpen(true); }} title="Sync Browsers"><Globe size={20} className="text-white/60 hover:text-white" /></button>
                <button onClick={() => { soundManager.playSelect(); setIsDeleteConfirmOpen(true); }} title="Delete Account"><Trash2 size={20} className="text-white/60 hover:text-white" /></button>
                <button onClick={handleLogout}><LogOut size={20} className="text-white/60 hover:text-white" /></button>
                <button onClick={() => { soundManager.playLoop('ringtone'); setGlobalCallNotice({ name: user.name, avatar: user.avatar, email: user.email, media: 'audio', sdp: null }); }} title="Ring Myself (Voice)"><Phone size={20} className="text-white/60 hover:text-white" /></button>
                <button onClick={() => { soundManager.playLoop('ringtone'); setGlobalCallNotice({ name: user.name, avatar: user.avatar, email: user.email, media: 'video', sdp: null }); }} title="Ring Myself (Video)"><Video size={20} className="text-white/60 hover:text-white" /></button>
             </div>
             <div className="flex items-center gap-1.5 text-sm text-white/90 mt-1">
                 <div className="w-2.5 h-2.5 bg-green-400 border border-white/30 shadow-sm rounded-full"></div>
                 <span className="font-mono text-xs opacity-75">Online</span>
             </div>
             
         </div>
         
      </header>

      {globalCallNotice && (
        <div className="fixed top-0 left-0 right-0 z-40">
          <div className="mx-4 md:mx-20 mt-2 bg-[#e6f7ff] border border-sky-200 px-4 py-3 rounded-sm flex items-center justify-between gap-3 text-sm text-sky-800 shadow">
            <div className="flex items-center gap-3">
              <img src={globalCallNotice.avatar} className="w-8 h-8 rounded-sm border border-slate-300" alt="avatar" />
              <div>
                <div className="font-bold">{globalCallNotice.name}</div>
                <div className="text-xs">Incoming {globalCallNotice.media === 'audio' ? 'voice' : 'video'} call</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { soundManager.stop('ringtone'); setPendingIncomingCall({ media: globalCallNotice.media, sdp: globalCallNotice.sdp, from: globalCallNotice.email }); setActiveContactId(globalCallNotice.email); setView('chat'); setGlobalCallNotice(null); }} className="btn-aero-primary px-3 py-1">Accept</button>
              <button onClick={() => { soundManager.stop('ringtone'); if (user) mockBackend.sendSignal(user.email, globalCallNotice.email, { type: 'reject' }); setGlobalCallNotice(null); }} className="btn-aero px-3 py-1">Reject</button>
            </div>
          </div>
        </div>
      )}

      {globalMessageNotice && (
        <div className="fixed top-0 left-0 right-0 z-40">
          <div className="mx-4 md:mx-20 mt-2 bg-[#fff9e6] border border-[#e6dbb8] px-4 py-3 rounded-sm flex items-center justify-center gap-3 text-sm text-[#8a6d3b] shadow">
            <img src={globalMessageNotice.avatar} className="w-6 h-6 rounded-sm border border-slate-300" alt="avatar" />
            <span className="font-semibold">{globalMessageNotice.name}: {globalMessageNotice.text}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main ref={mainRef} className={`flex-1 relative z-20 overflow-y-auto no-scrollbar ${view === 'hub' ? 'block' : 'hidden'}`}>
         <Hub 
            mode={dashboardMode}
            contacts={contacts}
            requests={requests}
            currentLanguage={appLanguage}
            currentUserEmail={user.email}
            onSelect={handleContactSelect} 
            onAddContact={handleAddContact}
            onDeleteContact={(email) => { soundManager.playSound('close'); mockBackend.removeContact(email); if (user) refreshData(user.email); }}
            onAcceptRequest={(email) => { mockBackend.acceptRequest(email); if (user) refreshData(user.email); }}
            onDeclineRequest={(email) => { mockBackend.rejectRequest(email); if (user) refreshData(user.email); }}
            t={t}
            mediaTracks={mediaTracks}
            mediaCurrentTrackId={mediaCurrentTrackId}
            mediaIsPlaying={mediaIsPlaying}
            mediaProgress={mediaProgress}
            mediaDuration={mediaDuration}
            mediaVolume={mediaVolume}
            onMediaSetTrack={onMediaSetTrack}
            onMediaPlayPause={onMediaPlayPause}
            onMediaSeek={onMediaSeek}
            onMediaSetVolume={onMediaSetVolume}
            mediaLoop={mediaLoop}
            onMediaToggleLoop={onMediaToggleLoop}
            onMediaAddLocalFile={onMediaAddLocalFile}
         />
      </main>

      {/* Chat Area */}
      {view === 'chat' && activeContact && (
          <div className="flex-1 relative z-20 animate-in slide-in-from-right duration-300 h-full md:h-[calc(100vh-120px)]">
              <ChatArea 
                  contact={activeContact} 
                  onBack={handleBackToHub} 
                  autoAcceptCall={pendingIncomingCall}
                  onAutoAcceptHandled={() => setPendingIncomingCall(null)}
              />
          </div>
      )}

      {isPassportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
              <div className="aero-glass p-6 bg-white rounded-sm shadow-2xl border border-slate-300 w-[520px] relative">
                  <button onClick={() => { soundManager.playSound('close'); setIsPassportOpen(false); }} className="absolute top-3 right-3 text-slate-500 hover:text-red-600">
                      <X size={16} />
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white">
                          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                      <div>
                          <div className="text-sm font-bold text-slate-700">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                      <Key size={18} className="text-[#00AFF0]" />
                      <span className="font-bold text-sm text-slate-700">Passport Code</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mb-2">Use this code to sign in on another device.</div>
                  <textarea readOnly value={passportCode} className="w-full h-32 p-2 border border-slate-300 rounded-sm font-mono text-[10px] bg-slate-50" />
                  <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => { soundManager.playSelect(); navigator.clipboard.writeText(passportCode); setCopied(true); }} className="btn-aero flex items-center gap-1">
                          <Copy size={14} /> Copy
                      </button>
                      {copied && (
                          <div className="flex items-center gap-1 text-green-700 text-xs font-bold"><CheckCircle size={14} /> Copied</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isSyncOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
              <div className="aero-glass p-6 bg-white rounded-sm shadow-2xl border border-slate-300 w-[520px] relative">
                  <button onClick={() => { soundManager.playSound('close'); setIsSyncOpen(false); }} className="absolute top-3 right-3 text-slate-500 hover:text-red-600">
                      <X size={16} />
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                      <Globe size={18} className="text-[#00AFF0]" />
                      <span className="font-bold text-sm text-slate-700">Sync Browsers</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mb-2">Copy this code and paste it in another browser to install all accounts.</div>
                  <textarea readOnly value={syncCode} className="w-full h-32 p-2 border border-slate-300 rounded-sm font-mono text-[10px] bg-slate-50" />
                  <div className="flex justify-between gap-2 mt-3">
                      <div className="flex gap-2">
                          <button onClick={() => { soundManager.playSelect(); navigator.clipboard.writeText(syncCode); setSyncCopied(true); }} className="btn-aero flex items-center gap-1">
                              <Copy size={14} /> Copy
                          </button>
                          <button onClick={() => { try { const json = atob(syncCode); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'skylink-accounts.json'; a.click(); URL.revokeObjectURL(url); soundManager.playSelect(); } catch {} }} className="btn-aero flex items-center gap-1">
                              <Download size={14} /> Download
                          </button>
                      </div>
                      <button onClick={() => { soundManager.playSelect(); try { const n = mockBackend.importVault(syncCode); if (user) refreshData(user.email); } catch {} setIsSyncOpen(false); }} className="btn-aero-primary">Install here</button>
                  </div>
              </div>
          </div>
      )}

      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
              <div className="aero-glass p-6 bg-white rounded-sm shadow-2xl border border-slate-300 w-[420px] relative">
                  <button onClick={() => { soundManager.playSound('close'); setIsDeleteConfirmOpen(false); }} className="absolute top-3 right-3 text-slate-500 hover:text-red-600">
                      <X size={16} />
                  </button>
                  <div className="flex items-center gap-2 mb-3">
                      <Trash2 size={18} className="text-red-600" />
                      <span className="font-bold text-sm text-slate-700">Delete Account</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mb-3">This will remove your profile and conversations from this device.</div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => { soundManager.playSelect(); setIsDeleteConfirmOpen(false); }} className="btn-aero">Cancel</button>
                      <button onClick={() => { soundManager.playSound('close'); if (user) { mockBackend.deleteUser(user.email); setUser(null); setView('hub'); } setIsDeleteConfirmOpen(false); }} className="btn-aero-primary bg-red-600 hover:bg-red-700">Delete</button>
                  </div>
              </div>
          </div>
      )}

      {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
              <div className="aero-glass p-6 bg-white rounded-sm shadow-2xl border border-slate-300 w-[420px] max-w-[90%] relative">
                  <button onClick={() => { soundManager.playSound('close'); setIsProfileOpen(false); }} className="absolute top-3 right-3 text-slate-500 hover:text-red-600">
                      <X size={16} />
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                      <img src={user.avatar} className="w-12 h-12 border border-slate-300" alt="Me" />
                      <div>
                          <div className="text-sm font-bold text-slate-700">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                  </div>
                  <div className="text-xs text-slate-600">
                      <div className="mt-2">ID: <span className="font-mono">{user.skypeId}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => { soundManager.playSelect(); setIsProfileOpen(false); }} className="btn-aero">Close</button>
                  </div>
              </div>
          </div>
      )}

      {view !== 'chat' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 border-t border-slate-300 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-around p-2">
                <button onClick={() => { soundManager.playSelect(); setIsProfileOpen(true); }} className="btn-aero flex-1 mx-1 py-2">
                    Profile
                </button>
                <button onClick={() => { soundManager.playSelect(); const code = mockBackend.exportAccount(); setPassportCode(code); setCopied(false); setIsPassportOpen(true); }} className="btn-aero flex-1 mx-1 py-2">
                    Passport
                </button>
                <button onClick={handleLogout} className="btn-aero-primary flex-1 mx-1 py-2">
                    Log off
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
