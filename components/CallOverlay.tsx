import { useEffect, useState } from 'react';
import { Contact, CallState } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Signal } from 'lucide-react';

interface CallOverlayProps {
  contact: Contact;
  state: CallState;
  onEndCall: () => void;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({ contact, state, onEndCall }) => {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Only activate the Live hook if the state is 'connected' or 'connecting'
  const isLiveActive = state !== 'idle';
  const { status, volume } = useGeminiLive({ 
      onClose: onEndCall, 
      isActive: isLiveActive 
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'connected') {
        interval = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getConnectionColor = () => {
      switch(status) {
          case 'connected': return 'bg-green-500';
          case 'connecting': return 'bg-yellow-500';
          case 'error': return 'bg-red-500';
          default: return 'bg-slate-500';
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      {/* Call Window */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[600px]">
        
        {/* Header */}
        <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2 text-white">
                <Signal size={16} className={status === 'connected' ? 'text-green-400' : 'text-yellow-400 animate-pulse'} />
                <span className="text-sm font-medium">
                    {status === 'connecting' ? 'Calling...' : status === 'connected' ? 'Connected via Global Network' : 'Connection Error'}
                </span>
            </div>
            <div className="flex gap-2">
                 <Maximize2 size={18} className="text-slate-400 hover:text-white cursor-pointer" />
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-8">
            
            {/* Big Avatar with Pulse */}
            <div className="relative mb-8">
                 {/* Voice Activity Rings */}
                 <div className={`absolute inset-0 rounded-full border-2 border-sky-500/30 scale-150 transition-transform duration-100`} style={{ transform: `scale(${1 + volume * 2})` }}></div>
                 <div className={`absolute inset-0 rounded-full border-2 border-sky-400/20 scale-125 transition-transform duration-100`} style={{ transform: `scale(${1 + volume * 1.5})` }}></div>
                 
                 <img src={contact.avatar} alt={contact.name} className="w-32 h-32 rounded-2xl shadow-2xl border-4 border-slate-700 relative z-10" />
                 <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-slate-800 ${getConnectionColor()} z-20`}></div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2 text-center">{contact.name}</h2>
            <p className="text-sky-400 font-medium mb-8 animate-pulse">
                {status === 'connecting' ? 'Establishing Secure Connection...' : formatDuration(duration)}
            </p>

            {/* Audio Visualizer Bar */}
            {status === 'connected' && (
                 <div className="flex items-center gap-1 h-8 mb-8">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className="w-2 bg-sky-500 rounded-full transition-all duration-75"
                            style={{ 
                                height: `${Math.max(20, Math.random() * 100 * (volume * 5))}%`,
                                opacity: 0.5 + (volume * 0.5)
                            }} 
                        />
                    ))}
                 </div>
            )}

            {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm">
                    Connection failed. Please check your network or API key.
                </div>
            )}
        </div>

        {/* Control Bar */}
        <div className="bg-slate-900 p-6 flex justify-center items-center gap-6 border-t border-slate-800">
             <button 
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`p-4 rounded-full transition-all ${isMicMuted ? 'bg-white text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
            >
                {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             
             <button 
                onClick={onEndCall}
                className="p-5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg transform hover:scale-105 transition-all"
            >
                <PhoneOff size={32} fill="currentColor" />
             </button>

             <button className="p-4 bg-slate-700 text-slate-400 rounded-full hover:bg-slate-600 hover:text-white transition-all">
                <VideoOff size={24} />
             </button>
        </div>
      </div>
    </div>
  );
};
