
export class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private isMuted: boolean = false;

  // Valid Base64 WAV data for a short "Pop" sound (Fallback)
  // This ensures the app never crashes even if MP3s are missing.
  private readonly FALLBACK_SOUND = "data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; 

  constructor() {
    if (typeof window !== 'undefined') {
        // 1. Initialize with fallback first so we always have *something*
        this.sounds['click'] = new Audio(this.FALLBACK_SOUND);
        this.sounds['news'] = new Audio(this.FALLBACK_SOUND);
        this.sounds['contacts'] = new Audio(this.FALLBACK_SOUND);

        // 2. Try to load the real files from the assets folder
        this.loadSound('click', 'click.mp3');
        this.loadSound('news', 'news.mp3');
        this.loadSound('contacts', 'contacts.mp3');
    }
  }

  private loadSound(key: string, filename: string) {
      // Browsers handle paths differently depending on the server setup.
      // Based on the file structure (public/assets), we prioritize those paths.
      const paths = [
          `assets/${filename}`,        
          `/assets/${filename}`,       
          `./assets/${filename}`,      
          `${filename}`,               
          `public/assets/${filename}`, 
          `/public/assets/${filename}` 
      ];

      const tryLoad = (pathIndex: number) => {
          if (pathIndex >= paths.length) {
              // All paths failed, we stick to the fallback already set in constructor.
              console.warn(`[SoundManager] Could not load ${filename} after trying all paths. Keeping fallback.`);
              return; 
          }

          const path = paths[pathIndex];
          const audio = new Audio(path);
          
          // Use 'onloadeddata' which fires when the first frame is loaded.
          // This is sufficient for UI sounds and usually faster than 'canplaythrough'.
          audio.onloadeddata = () => {
              this.sounds[key] = audio;
          };

          // If this path fails (404), try the next one immediately
          audio.onerror = () => {
              tryLoad(pathIndex + 1);
          };
          
          // Trigger load
          audio.load();
      };

      tryLoad(0);
  }

  public registerSound(key: string, filename: string) {
    if (typeof window === 'undefined') return;
    this.sounds[key] = new Audio(this.FALLBACK_SOUND);
    this.loadSound(key, filename);
  }

  public stopAll() {
    Object.values(this.sounds).forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (e) { }
    });
  }

  private play(key: string) {
    if (this.isMuted) return;
    
    // Ensure Context is resumed on user interaction
    this.resume();

    const audio = this.sounds[key];
    if (audio) {
        try {
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((e) => {
                    // Expected if user hasn't interacted with document yet
                });
            }
        } catch (e) { 
            // Silent fail
        }
    }
  }

  public playNewsSound() { this.play('news'); }
  public playContactsSound() { this.play('contacts'); }
  public playSelect() { this.play('click'); }
  public playSound(key: string) { this.play(key); }
  public playLoop(key: string) {
    if (this.isMuted) return;
    const audio = this.sounds[key];
    if (audio) {
        try {
            audio.loop = true;
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } catch (e) {}
    }
  }
  public stop(key: string) {
    const audio = this.sounds[key];
    if (audio) {
        try { audio.pause(); audio.currentTime = 0; audio.loop = false; } catch (e) {}
    }
  }
  
  // Aliases for legacy calls
  public playWhoosh() { this.play('news'); }
  public playButtonSound() { this.play('click'); }
  public playNewsAmbience() { }
  public playChatAmbience() { }
  
  public resume() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        // We don't hold a persistent context in this simple manager, 
        // but we can try to resume if one was created elsewhere or if we expand this class.
        // For HTML5 Audio elements, we just need the document to be interacted with.
    } catch (e) {}
  }
}

export const soundManager = new SoundManager();
