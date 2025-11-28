import { useState, useEffect } from 'react';

interface UseGeminiLiveProps {
  onClose: () => void;
  isActive: boolean;
}

export const useGeminiLive = ({ onClose, isActive }: UseGeminiLiveProps) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>(isActive ? 'connecting' : 'closed');
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActive) {
      setStatus('connected');
      interval = setInterval(() => {
        setVolume(v => Math.max(0, Math.min(1, v * 0.7 + Math.random() * 0.4)));
      }, 120);
    } else {
      setStatus('closed');
      setVolume(0);
    }
    return () => {
      if (interval) clearInterval(interval);
      setStatus('closed');
      onClose();
    };
  }, [isActive, onClose]);

  return { status, volume };
};
