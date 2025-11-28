
import { useState, useEffect, useRef } from 'react';
import { Contact, Message } from '../types';
import { translateText, LANGUAGES } from '../utils/translations';
import { mockBackend } from '../services/mockBackend';
import { Send, Smile, Paperclip, ArrowLeft, MoreHorizontal, Mail, Users, Languages, AlertCircle, Mic, Square, Video, Music, Loader2, File, Bird, PhoneOff, MicOff, VideoOff, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { soundManager } from '../utils/SoundManager';

interface ChatAreaProps {
  contact: Contact;
  onBack: () => void;
  targetLanguage?: string | null;
  autoAcceptCall?: { media: 'audio' | 'video'; sdp: any; from: string } | null;
  onAutoAcceptHandled?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ contact, onBack, targetLanguage, autoAcceptCall, onAutoAcceptHandled }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [quotaError, setQuotaError] = useState(false);
  const [localLang, setLocalLang] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callMode, setCallMode] = useState<'audio' | 'video' | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [callError, setCallError] = useState<string | null>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [incomingCall, setIncomingCall] = useState<{ media: 'audio' | 'video'; sdp: any; from: string } | null>(null);
  const [messageNotice, setMessageNotice] = useState<{ text: string } | null>(null);
  const lastMsgTsRef = useRef<number>(0);

  const currentUser = mockBackend.getCurrentUser();
  const isPending = contact.requestStatus === 'pending_outgoing';

  // Poll for new messages from backend
  useEffect(() => {
    const myEmail = currentUser?.email || mockBackend.getCurrentUser()?.email;
    if (!myEmail) return;

    const fetchMessages = () => {
        const msgs = mockBackend.getMessages(myEmail, contact.email);
        setMessages(msgs);
    };

    fetchMessages();

    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [contact.id, currentUser?.email]);

  useEffect(() => {
    messages.forEach(m => {
        if (m.isSystem && m.text.startsWith('CALL_SIGNAL:')) {
            if (processedSignalsRef.current.has(m.id)) return;
            processedSignalsRef.current.add(m.id);
            const payload = JSON.parse(m.text.substring('CALL_SIGNAL:'.length));
            handleSignal(payload, m.senderId);
        } else if (!m.isSystem) {
            if (m.senderId !== currentUser?.email && m.timestamp > (lastMsgTsRef.current || 0)) {
                lastMsgTsRef.current = m.timestamp;
                setMessageNotice({ text: m.text });
                soundManager.playSound('notf');
                setTimeout(() => setMessageNotice(null), 5000);
            }
        }
    });
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  };

  useEffect(() => {
    resizeTextarea();
  }, [inputValue]);

  useEffect(() => {
    if (autoAcceptCall && autoAcceptCall.sdp) {
      setIncomingCall(autoAcceptCall);
      acceptIncomingCall();
      onAutoAcceptHandled && onAutoAcceptHandled();
    }
  }, [autoAcceptCall && autoAcceptCall.sdp]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createPeer = () => {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
    });
    pc.onicecandidate = (e) => {
        if (e.candidate && currentUser) {
            mockBackend.sendSignal(currentUser.email, contact.email, { type: 'candidate', candidate: e.candidate });
        }
    };
    pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        remoteStreamRef.current = stream;
        if (callMode === 'video') {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        } else {
            if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
        }
    };
    pcRef.current = pc;
    return pc;
  };

  const startMedia = async (mode: 'audio' | 'video') => {
    setCallError(null);
    try {
      const constraints = mode === 'video' ? { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
      localStreamRef.current = stream;
      if (mode === 'video') {
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
      stream.getTracks().forEach(track => pcRef.current?.addTrack(track, stream));
    } catch (e: any) {
      if (mode === 'video') {
        setCallError('Could not start video source. Falling back to audio.');
        setCallMode('audio');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true } as any);
        localStreamRef.current = stream;
        stream.getTracks().forEach(track => pcRef.current?.addTrack(track, stream));
      } else {
        setCallError('Audio input unavailable.');
        throw e;
      }
    }
  };

  const startCall = async (mode: 'audio' | 'video') => {
    soundManager.playSelect();
    setCallMode(mode);
    setIsCallOpen(true);
    const pc = createPeer();
    await startMedia(mode);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (currentUser) {
        mockBackend.sendSignal(currentUser.email, contact.email, { type: 'offer', sdp: offer, media: mode });
    }
  };

  const handleSignal = async (payload: any, fromEmail?: string) => {
    if (!currentUser) return;
    if (payload.type === 'offer') {
        setIncomingCall({ media: (payload.media || 'audio'), sdp: payload.sdp, from: fromEmail || contact.email });
        soundManager.playLoop('ringtone');
    } else if (payload.type === 'answer') {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } else if (payload.type === 'candidate') {
        try {
            await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {}
    } else if (payload.type === 'reject') {
        setIsCallOpen(false);
        setCallError('Call declined');
        soundManager.stop('ringtone');
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;
    soundManager.playSelect();
    soundManager.stop('ringtone');
    setCallMode(incomingCall.media);
    setIsCallOpen(true);
    const pc = createPeer();
    await startMedia(incomingCall.media);
    if (incomingCall.sdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        mockBackend.sendSignal(currentUser.email, contact.email, { type: 'answer', sdp: answer });
      } catch (e) {
        // If SDP invalid (e.g., self-ring), proceed with local media only
      }
    }
    setIncomingCall(null);
  };

  const rejectIncomingCall = () => {
    if (!currentUser) return;
    soundManager.playSelect();
    soundManager.stop('ringtone');
    mockBackend.sendSignal(currentUser.email, contact.email, { type: 'reject' });
    setIncomingCall(null);
  };

  const endCall = () => {
    soundManager.playSound('close');
    setIsCallOpen(false);
    setCallMode(null);
    try {
        pcRef.current?.getSenders().forEach(s => { try { s.track?.stop(); } catch {} });
        pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) (remoteVideoRef.current as any).srcObject = null;
    if (localVideoRef.current) (localVideoRef.current as any).srcObject = null;
    if (remoteAudioRef.current) (remoteAudioRef.current as any).srcObject = null;
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !isMuted;
    tracks.forEach(t => t.enabled = !next ? true : false);
    setIsMuted(next);
  };

  const toggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    const next = !cameraOn;
    tracks.forEach(t => t.enabled = next);
    setCameraOn(next);
  };

  const enterFullscreen = () => {
    const el: any = callContainerRef.current;
    el?.requestFullscreen?.();
  };

  const zoomIn = () => setZoomLevel(z => Math.min(1.4, z + 0.1));
  const zoomOut = () => setZoomLevel(z => Math.max(0.8, z - 0.1));

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentUser) return;

    let finalText = inputValue;

    // AUTO-TRANSLATE OUTGOING IF ENABLED
    const effectiveTargetLanguage = targetLanguage || localLang;
    if (effectiveTargetLanguage) {
        finalText = translateText(inputValue, effectiveTargetLanguage);
    }

    mockBackend.sendMessage(currentUser.email, contact.email, finalText);
    setInputValue('');
    
    // Refresh local state immediately
    const msgs = mockBackend.getMessages(currentUser.email, contact.email);
    setMessages(msgs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- VOICE RECORDING LOGIC ---

  const startRecording = async () => {
      soundManager.playSelect();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Microphone access not supported in this browser.");
          return;
      }

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' }); // Simplification, often webm/ogg
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                  const base64data = reader.result as string;
                  if (currentUser) {
                      mockBackend.sendMessage(currentUser.email, contact.email, "Sent a voice message", base64data);
                      // Refresh
                      const msgs = mockBackend.getMessages(currentUser.email, contact.email);
                      setMessages(msgs);
                  }
              };
              
              // Stop all tracks
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingDuration(0);
          timerRef.current = window.setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Error accessing mic:", err);
          alert("Could not access microphone.");
      }
  };

  const stopRecording = () => {
      soundManager.playSelect();
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
      }
  };

  // --- FILE UPLOAD (VIDEO & AUDIO) LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Robust check: allow any audio or video mime type
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      if (!isVideo && !isAudio) {
          alert("Only video and audio files are supported.");
          return;
      }

      // 10MB limit (Local Storage quota safety)
      if (file.size > 10 * 1024 * 1024) {
          alert("File too large. Please select a file under 10MB.");
          return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      // Simulate Upload Progress for the Retro Animation
      const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
              if (prev >= 100) {
                  clearInterval(progressInterval);
                  return 100;
              }
              return prev + 2; // Increment progress
          });
      }, 50);

      reader.onloadend = () => {
          setTimeout(() => { // Wait for animation
              const base64data = reader.result as string;
              if (currentUser) {
                  if (isVideo) {
                    mockBackend.sendMessage(currentUser.email, contact.email, "Sent a video", undefined, base64data);
                  } else {
                    mockBackend.sendMessage(currentUser.email, contact.email, "Sent an audio file", base64data, undefined);
                  }
                  const msgs = mockBackend.getMessages(currentUser.email, contact.email);
                  setMessages(msgs);
              }
              setIsUploading(false);
              setUploadProgress(0);
              clearInterval(progressInterval);
          }, 2600);
      };
      reader.onerror = () => {
          alert("Failed to read file.");
          setIsUploading(false);
          clearInterval(progressInterval);
      };
      
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDuration = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in mx-0 md:mx-12 border border-slate-400 shadow-2xl rounded-sm overflow-hidden relative">
      
      {/* RETRO FILE TRANSFER MODAL */}
      {isUploading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]">
              <div className="aero-glass w-80 p-4 bg-white shadow-2xl rounded border border-slate-300">
                  <div className="flex items-center gap-2 mb-4">
                      <File size={20} className="text-slate-600" />
                      <span className="font-segoe text-sm font-bold text-slate-700">Sending File...</span>
                  </div>
                  
                  <div className="relative h-16 bg-white border border-slate-300 rounded mb-4 p-2 flex items-center justify-between overflow-hidden">
                       <File size={24} className="text-slate-400 shrink-0" />
                       
                       {/* Authentic Loading Bar */}
                       <div className="flex-1 mx-4 h-3 bg-slate-200 rounded-full overflow-hidden relative border border-slate-300 shadow-inner">
                           <div 
                                className="h-full bg-gradient-to-b from-green-400 to-green-600 transition-all duration-100" 
                                style={{ width: `${uploadProgress}%` }}
                           >
                               {/* Glossy Highlight */}
                               <div className="w-full h-[50%] bg-white/30"></div>
                           </div>
                           {/* Moving Bird */}
                           <div 
                                className="absolute top-1/2 -translate-y-1/2 transition-all duration-100 text-slate-600"
                                style={{ left: `calc(${uploadProgress}% - 16px)` }}
                           >
                                <Bird size={16} className={`transform -scale-x-100 ${uploadProgress < 100 ? 'animate-bounce' : ''}`} />
                           </div>
                       </div>

                       <File size={24} className="text-sky-500 shrink-0" />
                  </div>

                  <div className="text-center text-xs text-slate-500">
                      {uploadProgress < 100 ? `Transferring data... ${uploadProgress}%` : "Finalizing..."}
                  </div>
              </div>
          </div>
      )}

      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-300 bg-gradient-to-b from-[#f3f8fb] to-[#e0e8f0]">
          <div className="flex items-center gap-4 min-w-0">
              <button onClick={onBack} className="btn-aero-icon w-8 h-8 text-slate-600 hover:text-slate-900 shrink-0">
                  <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                      <img src={contact.avatar} alt={contact.name} className="w-10 h-10 md:w-12 md:h-12 object-cover border-2 border-white shadow-md rounded-sm" />
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 border border-white shadow-sm ${contact.status === 'online' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                  </div>
                  <div className="min-w-0">
                      <h2 className="text-xl md:text-2xl font-segoe text-[#1e395b] truncate leading-tight">{contact.name}</h2>
                      <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                          {contact.type === 'region' ? (
                              <>
                                <Users size={10} />
                                <span>Public Room</span>
                              </>
                          ) : (
                              <>
                                <Mail size={10} /> <span className="truncate">{contact.email}</span>
                              </>
                          )}
                      </div>
                  </div>
              </div>
          </div>
          
      <div className="flex gap-2 shrink-0">
              {(targetLanguage || localLang) && (
                  <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200 mr-2 shadow-sm">
                      <Languages size={14} />
                      <span>{targetLanguage || localLang}</span>
                  </div>
              )}
              <button onClick={() => soundManager.playSelect()} className="btn-aero-icon w-9 h-9 text-slate-600 hidden md:flex">
                <MoreHorizontal size={16} />
              </button>
              <button onClick={() => startCall('audio')} title="Voice Call" className="btn-aero-icon w-9 h-9 text-slate-600 hidden md:flex">
                 <Mic size={16} />
              </button>
              <button onClick={() => startCall('video')} title="Video Call" className="btn-aero-icon w-9 h-9 text-slate-600 hidden md:flex">
                 <Video size={16} />
              </button>
              <select 
                 value={localLang || ''}
                 onChange={(e) => setLocalLang(e.target.value || null)}
                 className="hidden md:block text-xs bg-white border border-slate-300 rounded-sm px-2 py-1"
                 title="Translate outgoing"
              >
                 <option value="">No translate</option>
                 {LANGUAGES.filter(l => l !== 'English').map(l => (
                   <option key={l} value={l}>{l}</option>
                 ))}
              </select>
          </div>
          <div className="flex gap-2 md:hidden">
              <button onClick={() => startCall('audio')} className="btn-aero-icon w-8 h-8 text-slate-600"><Mic size={14} /></button>
              <button onClick={() => startCall('video')} className="btn-aero-icon w-8 h-8 text-slate-600"><Video size={14} /></button>
          </div>
      </div>

      {/* PENDING BANNER */}
      {isPending && (
        <div className="bg-[#fff9e6] border-b border-[#e6dbb8] px-4 py-4 flex items-center justify-center gap-3 text-sm text-[#8a6d3b] font-segoe shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
               <AlertCircle size={18} className="text-[#8a6d3b]" />
               <span className="font-semibold">Chat request pending… wait for the user to accept.</span>
        </div>
      )}

      {incomingCall && (
          <div className="bg-[#e6f7ff] border-b border-sky-200 px-4 py-4 flex items-center justify-between gap-3 text-sm text-sky-800 font-segoe shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                  <img src={contact.avatar} className="w-8 h-8 rounded-sm border border-slate-300" alt="avatar" />
                  <div>
                      <div className="font-bold">{contact.name}</div>
                      <div className="text-xs">Incoming {incomingCall.media === 'audio' ? 'voice' : 'video'} call</div>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={acceptIncomingCall} className="btn-aero-primary px-3 py-1">Accept</button>
                  <button onClick={rejectIncomingCall} className="btn-aero px-3 py-1">Reject</button>
              </div>
          </div>
      )}

      {messageNotice && (
          <div className="bg-[#fff9e6] border-b border-[#e6dbb8] px-4 py-3 flex items-center justify-center gap-3 text-sm text-[#8a6d3b] font-segoe shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
              <img src={contact.avatar} className="w-6 h-6 rounded-sm border border-slate-300" alt="avatar" />
              <span className="font-semibold">{contact.name}: {messageNotice.text}</span>
          </div>
      )}

      {/* Ringtone trigger */}

      {isCallOpen && (
        <div className="fixed inset-0 md:absolute z-50 flex items-center justify-center bg-slate-900/30">
            <div ref={callContainerRef} className="aero-glass p-0 bg-white rounded-sm shadow-2xl border border-slate-300 w-full h-full md:w-[840px] md:max-w-[95%] relative overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-gradient-to-b from-[#f3f8fb] to-[#e0e8f0]">
                    <div className="font-segoe text-[#1e395b] text-sm font-bold truncate">Skylink Video</div>
                    <button onClick={endCall} className="text-slate-600 hover:text-red-600 flex items-center gap-1 text-xs"><span>Close</span><PhoneOff size={14} /></button>
                </div>
                {callMode === 'video' ? (
                    <div className="relative bg-black md:h-[420px] h-[70vh]">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: `scale(${zoomLevel})` }} />
                        <div className="absolute top-3 right-3 md:w-40 md:h-28 w-24 h-16 bg-black/60 rounded-sm overflow-hidden border border-white/20">
                            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        </div>
                    </div>
                ) : (
                    <div className="relative bg-black md:h-[200px] h-[40vh] flex items-center justify-center">
                        <audio ref={remoteAudioRef} autoPlay />
                        <div className="text-white/80 text-sm">Voice call in progress…</div>
                    </div>
                )}
                {callError && (<div className="px-4 py-2 bg-red-100 text-red-700 text-xs border-t border-red-200">{callError}</div>)}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-300 bg-gradient-to-t from-[#f3f8fb] to-[#e0e8f0] flex-col md:flex-row gap-3 md:gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={endCall} className="px-4 py-3 md:px-3 md:py-2 rounded-full bg-red-600 text-white text-sm md:text-xs font-bold shadow hover:bg-red-700">End call</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={toggleMute} className="btn-aero-icon md:w-9 md:h-9 w-12 h-12 text-slate-700 bg-white">
                            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                        {callMode === 'video' && (
                          <button onClick={toggleCamera} className="btn-aero-icon md:w-9 md:h-9 w-12 h-12 text-slate-700 bg-white">
                            {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                          </button>
                        )}
                        {callMode === 'video' && (
                          <>
                            <button onClick={zoomIn} className="btn-aero-icon md:w-9 md:h-9 w-12 h-12 text-slate-700 bg-white"><ZoomIn size={16} /></button>
                            <button onClick={zoomOut} className="btn-aero-icon md:w-9 md:h-9 w-12 h-12 text-slate-700 bg-white"><ZoomOut size={16} /></button>
                            <button onClick={enterFullscreen} className="btn-aero-icon md:w-9 md:h-9 w-12 h-12 text-slate-700 bg-white"><Maximize2 size={16} /></button>
                          </>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f0f2f5] space-y-6">
        {(targetLanguage || localLang) && (
            <div className="flex justify-center">
                <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-xs shadow-sm border border-yellow-200">
                    Translating all messages to <strong>{targetLanguage || localLang}</strong>
                </div>
            </div>
        )}
        
        {messages.filter(m => !m.hidden && !(m.isSystem && m.text.startsWith('CALL_SIGNAL:'))).map((msg) => {
          if (msg.isSystem) {
            return (
                <div key={msg.id} className="flex justify-center my-2">
                    <div className="bg-sky-50 text-sky-700 text-xs px-3 py-1 rounded-full border border-sky-100 flex items-center gap-2 shadow-sm">
                        {msg.text}
                    </div>
                </div>
            );
          }

          const isMe = msg.senderId === currentUser?.email;
          
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
               {!isMe && (
                   <div className="flex flex-col items-center">
                        <img 
                            src={msg.senderId === contact.email ? contact.avatar : `https://ui-avatars.com/api/?name=${msg.senderName || 'User'}&background=random&color=fff&size=32`} 
                            className="w-8 h-8 mt-1 rounded-sm shadow-sm border border-slate-300" 
                            alt="avatar"
                        />
                   </div>
               )}
               
               <div className="flex flex-col max-w-[85%] md:max-w-[60%]">
                   {!isMe && msg.senderName && (
                       <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</span>
                   )}
                   <div className={`p-3 text-sm leading-relaxed shadow-sm break-words ${
                       isMe 
                       ? 'bg-[#dcf8c6] text-slate-900 border border-[#c5e6ae] rounded-l-lg rounded-tr-lg shadow-sm' 
                       : 'bg-white text-slate-800 border border-slate-300 rounded-r-lg rounded-tl-lg shadow-sm'
                   }`}>
                      {msg.videoUrl ? (
                         <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex items-center gap-2 font-bold text-xs opacity-70 uppercase">
                                  <Video size={12} /> Video Message
                              </div>
                              <video controls src={msg.videoUrl} className="w-full max-h-60 rounded-sm bg-black" />
                         </div>
                      ) : msg.audioUrl ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex items-center gap-2 font-bold text-xs opacity-70 uppercase">
                                  {/* Differentiate icon based on text content (hacky but effective for retro feel) */}
                                  {msg.text === "Sent a voice message" ? <Mic size={12} /> : <Music size={12} />}
                                  {msg.text === "Sent a voice message" ? "Voice Message" : "Audio File"}
                              </div>
                              <audio controls src={msg.audioUrl} className="w-full h-8" />
                          </div>
                      ) : (
                          msg.text
                      )}
                   </div>
                   <span className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'self-end mr-1' : 'self-start ml-1'}`}>
                       {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                   </span>
               </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 md:p-4 bg-[#f0f2f5] border-t border-slate-300 flex items-end gap-2 shadow-[0_-1px_5px_rgba(0,0,0,0.05)]">
          {/* Hidden File Input */}
          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="video/*,audio/*,.mp3,.mp4,.wav,.ogg,.m4a" 
              onChange={handleFileChange} 
          />
          
          <button className="btn-aero-icon w-10 h-10 text-slate-600 hidden md:flex bg-white shrink-0"><Smile size={20} /></button>
          <button 
              onClick={() => { soundManager.playSelect(); fileInputRef.current?.click(); }}
              disabled={isUploading || isPending}
              className={`btn-aero-icon w-10 h-10 text-slate-600 bg-white shrink-0 ${isUploading ? 'cursor-wait opacity-50' : ''}`}
              title="Attach File (Audio or Video)"
          >
              {isUploading ? <Loader2 size={20} className="animate-spin text-sky-500" /> : <Paperclip size={20} />}
          </button>
          
          <div className="flex-1 relative">
              {isRecording ? (
                  <div className="w-full bg-red-50 border border-red-300 p-3 h-10 min-h-[40px] rounded-sm flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                          Recording... {formatDuration(recordingDuration)}
                      </div>
                      <span className="text-[10px] text-red-400 uppercase hidden sm:inline">Click Square to Send</span>
                  </div>
              ) : (
                  <div className="relative w-full">
                       <textarea 
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isPending ? "Waiting for approval..." : (targetLanguage ? `Type to translate to ${targetLanguage}...` : "Type a message...")}
                        className={`w-full bg-white border ${quotaError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-400 focus:border-sky-500 focus:ring-sky-400'} focus:ring-1 p-3 h-10 min-h-[40px] resize-none text-sm rounded-sm transition-all shadow-inner outline-none`}
                        style={{ overflow: 'hidden' }}
                        disabled={isPending}
                      />
                      {quotaError && (
                          <div className="absolute -top-6 left-0 text-[10px] text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-200">
                              Translation Unavailable: API Quota Exceeded.
                          </div>
                      )}
                  </div>
              )}
          </div>

          {!isRecording ? (
               <>
                  <button 
                    onClick={startRecording}
                    disabled={isPending}
                    title="Record Voice Message"
                    className={`btn-aero-icon w-12 h-10 text-red-600 bg-white shrink-0 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      <Mic size={18} />
                  </button>
                  <button 
                    onClick={() => { soundManager.playSelect(); handleSendMessage(); }} 
                    disabled={isPending}
                    className={`btn-aero-primary w-12 h-10 rounded-sm flex items-center justify-center shrink-0 ${isPending ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                      <Send size={18} />
                  </button>
               </>
          ) : (
               <button 
                  onClick={stopRecording} 
                  className="btn-aero w-12 h-10 rounded-sm flex items-center justify-center border-red-400 text-red-600 hover:bg-red-50 shrink-0"
               >
                  <Square size={16} fill="currentColor" />
               </button>
          )}
      </div>
    </div>
  );
};
