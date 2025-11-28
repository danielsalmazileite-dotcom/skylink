
import { useState, useEffect, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Contact } from '../types';
import { Plus, Check, X, Bell, UserPlus, UserCheck, UserMinus, Map as MapIcon, Newspaper, ArrowRight, Loader2, ArrowLeft, ChevronDown, Globe, Search, Star, Clock, Users, AlertTriangle, RefreshCcw, Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { mockBackend } from '../services/mockBackend';
import { soundManager } from '../utils/SoundManager';

interface HubProps {
  mode?: 'contacts' | 'news' | 'media';
  contacts: Contact[];
  requests?: Contact[];
  currentLanguage: string;
  currentUserEmail: string;
  onSelect: (id: string) => void;
  onAddContact: (name: string) => void;
  onAcceptRequest?: (email: string) => void;
  onDeclineRequest?: (email: string) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onDeleteContact?: (email: string) => void;
  disableAnimations?: boolean; 
  t: (key: string) => string;
  mediaTracks?: { title: string; file: string; id: string }[];
  mediaCurrentTrackId?: string;
  mediaIsPlaying?: boolean;
  mediaProgress?: number;
  mediaDuration?: number;
  mediaVolume?: number;
  onMediaSetTrack?: (id: string) => void;
  onMediaPlayPause?: () => void;
  onMediaSeek?: (time: number) => void;
  onMediaSetVolume?: (v: number) => void;
  mediaLoop?: boolean;
  onMediaToggleLoop?: () => void;
  onMediaAddLocalFile?: (file: File) => void;
}

const NEWS_REGIONS = [
    "United States", "Canada", "United Kingdom", "Germany", "France", "Spain", "Italy",
    "Japan", "China", "India", "Australia", "New Zealand",
    "Brazil", "Mexico", "Argentina", "South Africa", "Nigeria",
    "Saudi Arabia", "UAE",
    "North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa", "Oceania", "South Asia"
];

interface NewsArticle {
    title: string;
    summary: string;
    source: string;
    content?: string;
    isError?: boolean;
}

interface AnimatedTileProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
    index?: number;
    disableAnimations?: boolean;
    onToggleFavorite?: (e: React.MouseEvent) => void;
    isFavorite?: boolean;
    showStar?: boolean;
}

const AnimatedTile = memo<AnimatedTileProps>(({ children, className = '', onClick, style, index = 0, disableAnimations = false, onToggleFavorite, isFavorite, showStar }) => {
    const [isVisible, setIsVisible] = useState(disableAnimations);

    useEffect(() => {
        if (disableAnimations) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, index * 50); 
            return () => clearTimeout(timer);
        }
    }, [index, disableAnimations]);

    const animationClass = disableAnimations 
        ? 'opacity-100' 
        : (isVisible ? 'animate-metro-pop opacity-100' : 'opacity-0');

    const handleClick = () => {
        if (onClick) {
            soundManager.playSelect();
            onClick();
        }
    };

    return (
        <div 
            onClick={handleClick}
            className={`relative cursor-pointer transform transition-all duration-500 ${className} ${animationClass}`}
            style={style}
        >
            {showStar && (
                <div 
                    onClick={(e) => { soundManager.playSelect(); if(onToggleFavorite) onToggleFavorite(e); }}
                    className={`absolute top-2 right-2 z-20 p-1 rounded-full transition-all hover:bg-white/20 ${isFavorite ? 'text-yellow-300' : 'text-white/30 hover:text-white'}`}
                    title="Toggle Favorite"
                >
                    <Star size={16} fill={isFavorite ? "currentColor" : "none"} strokeWidth={2} />
                </div>
            )}
            {children}
        </div>
    );
});

export const Hub: React.FC<HubProps> = ({ 
    mode = 'contacts', 
    contacts, 
    requests = [],
    currentLanguage,
    currentUserEmail,
    onSelect, 
    onAddContact,
    onAcceptRequest,
    onDeclineRequest,
    onToggleFavorite,
    onDeleteContact,
    disableAnimations = false,
    t,
    mediaTracks,
    mediaCurrentTrackId,
    mediaIsPlaying,
    mediaProgress,
    mediaDuration,
    mediaVolume,
    onMediaSetTrack,
    onMediaPlayPause,
    onMediaSeek,
    onMediaSetVolume,
    mediaLoop,
    onMediaToggleLoop,
    onMediaAddLocalFile
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchName, setSearchName] = useState('');
    
    // Filters
    const [filterTab, setFilterTab] = useState<'all' | 'favorites' | 'recents'>('all');
    const [contactSearch, setContactSearch] = useState('');

    // News State
    const [selectedRegion, setSelectedRegion] = useState("North America");
    const [isRegionSelectorOpen, setIsRegionSelectorOpen] = useState(false);
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loadingNews, setLoadingNews] = useState(false);
    const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
    const [fullStoryLoading, setFullStoryLoading] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [bypassCache, setBypassCache] = useState(false);
    const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
    const newsScrollRef = useRef<HTMLDivElement>(null);
    const mediaScrollRef = useRef<HTMLDivElement>(null);
    const mediaAreaRef = useRef<HTMLDivElement>(null);
    const imagesScrollRef = useRef<HTMLDivElement>(null);
    const imagesAreaRef = useRef<HTMLDivElement>(null);
    const contactsScrollRef = useRef<HTMLDivElement>(null);
    const contactsAreaRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef(0);
    const dragScrollLeftRef = useRef(0);
    const dragMovedRef = useRef(false);
    const justDraggedRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);

    const currentUser = mockBackend.getCurrentUser();

    const tracks = mediaTracks || [
        { title: 'Teto Territory', file: 'assets/ksttTetoTerritory.mp3', id: 'teto' },
        { title: 'Unity', file: 'assets/tfrUnity.mp3', id: 'unity' }
    ];
    const currentTrackId = mediaCurrentTrackId || tracks[0].id;
    const isPlaying = !!mediaIsPlaying;
    const progress = mediaProgress || 0;
    const duration = mediaDuration || 0;
    const volume = mediaVolume ?? 1;
    const currentTrack = tracks.find(t => t.id === currentTrackId) || tracks[0];

    const [mediaImages, setMediaImages] = useState<{ src: string; name: string }[]>([
        { src: 'assets/sample1.jpg', name: 'sample1.jpg' },
        { src: 'assets/sample2.jpg', name: 'sample2.jpg' },
        { src: 'assets/sample3.jpeg', name: 'sample3.jpeg' }
    ]);

    const setTrack = (id: string) => onMediaSetTrack?.(id);
    const playPause = () => onMediaPlayPause?.();
    const seek = (time: number) => onMediaSeek?.(time);
    const setVol = (v: number) => onMediaSetVolume?.(v);

    useEffect(() => {
        (async () => {
            const savedImages = await mockBackend.getSecureMedia('images');
            if (savedImages && savedImages.length) setMediaImages(savedImages);
        })();
        if (mode === 'news') {
            setReadingArticle(null);
            
            if (!bypassCache) {
                const cached = mockBackend.getCachedNews(selectedRegion, currentLanguage);
                if (cached) {
                    setArticles(cached);
                    return;
                }
            }

            let isMounted = true;

            const regionFeeds = (region: string): string[] => {
                const search = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
                const top = (hl: string, gl: string, ceid: string) => `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;
                switch(region) {
                    case 'United States': return [top('en-US','US','US:en'), search('United States')];
                    case 'Canada': return [top('en-CA','CA','CA:en'), search('Canada')];
                    case 'United Kingdom': return [top('en-GB','GB','GB:en'), search('United Kingdom'), search('Britain'), search('England')];
                    case 'Germany': return [top('de-DE','DE','DE:de'), search('Deutschland')];
                    case 'France': return [top('fr-FR','FR','FR:fr'), search('France')];
                    case 'Spain': return [top('es-ES','ES','ES:es'), search('España')];
                    case 'Italy': return [top('it-IT','IT','IT:it'), search('Italia')];
                    case 'Japan': return [top('ja-JP','JP','JP:ja'), search('日本'), search('Japan')];
                    case 'China': return [search('China'), search('中国'), search('中国 新闻')];
                    case 'India': return [top('en-IN','IN','IN:en'), search('India')];
                    case 'Australia': return [top('en-AU','AU','AU:en'), search('Australia')];
                    case 'New Zealand': return [top('en-NZ','NZ','NZ:en'), search('New Zealand')];
                    case 'Brazil': return [top('pt-BR','BR','BR:pt-BR'), search('Brasil')];
                    case 'Mexico': return [top('es-MX','MX','MX:es'), search('México')];
                    case 'Argentina': return [top('es-AR','AR','AR:es'), search('Argentina')];
                    case 'South Africa': return [top('en-ZA','ZA','ZA:en'), search('South Africa')];
                    case 'Nigeria': return [top('en-NG','NG','NG:en'), search('Nigeria')];
                    case 'Saudi Arabia': return [top('ar-SA','SA','SA:ar'), search('السعودية'), search('Saudi Arabia')];
                    case 'UAE': return [top('ar-AE','AE','AE:ar'), search('UAE'), search('United Arab Emirates'), search('الإمارات')];
                case 'Europe': return [search('Europe')];
                    case 'North America': return [search('North America')];
                    case 'Latin America': return [search('Latin America')];
                    case 'Asia Pacific': return [search('Asia Pacific')];
                    case 'Middle East': return [search('Middle East')];
                    case 'Africa': return [search('Africa')];
                    case 'Oceania': return [search('Oceania')];
                    case 'South Asia': return [search('South Asia')];
                    default: return [search(region)];
                }
            };

            const parseRSSItems = (xmlString: string) => {
                try {
                    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
                    const items = Array.from(doc.getElementsByTagName('item'));
                    return items.map(it => {
                        const title = it.getElementsByTagName('title')[0]?.textContent || '';
                        const description = it.getElementsByTagName('description')[0]?.textContent || '';
                        const sourceEl = it.getElementsByTagName('source')[0];
                        const source = sourceEl?.textContent || 'Google News';
                        const contentEncoded = it.getElementsByTagName('content:encoded')[0]?.textContent || '';
                        const summaryRaw = contentEncoded || description || '';
                        const summary = summaryRaw.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
                        return { title, summary, source } as NewsArticle;
                    });
                } catch { return []; }
            };

            const fetchTextWithProxy = async (url: string): Promise<string | null> => {
                const https = url.startsWith('https://');
                const base = url.replace(/^https?:\/\//, '');
                const proxies = [
                    `${https ? 'https://r.jina.ai/https://' : 'https://r.jina.ai/http://'}${base}`,
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
                    `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
                    `https://cors.isomorphic-git.org/${url}`
                ];
                for (const p of proxies) {
                    try {
                        const ctrl = new AbortController();
                        const t = setTimeout(() => ctrl.abort(), 12000);
                        const res = await fetch(p, { signal: ctrl.signal } as any);
                        clearTimeout(t);
                        if (res.ok) {
                            const txt = await res.text();
                            if (txt && txt.length > 0) return txt;
                        }
                    } catch {}
                }
                return null;
            };

            const fetchFeed = async (url: string) => {
                const text = await fetchTextWithProxy(url);
                if (!text) return [];
                return parseRSSItems(text);
            };

            const fetchNews = async () => {
                setLoadingNews(true);
                setArticles([]);
                const feeds = regionFeeds(selectedRegion);
                let combined: NewsArticle[] = [];
                for (const f of feeds) {
                    const items = await fetchFeed(f);
                    combined = combined.concat(items);
                    if (combined.length >= 10) break;
                }
                // Deduplicate by title
                const uniqMap = new Map<string, NewsArticle>();
                combined.forEach(a => { if (a.title) uniqMap.set(a.title, a); });
                let newsData = Array.from(uniqMap.values()).slice(0, 6);
                if (newsData.length === 0) {
                    const topics = ["Economy","Technology","Health","Sports","Weather","Travel","Politics","Culture","Science","Energy","Education","Security"]; 
                    const phrases = ["updates","outlook","trends","debate","milestone","report","growth","challenges","preview","review","forecast","insight"]; 
                    const src = "SkyLink Wire";
                    const seed = selectedRegion.length + Date.now();
                    const rnd = (n: number, i: number) => (Math.abs(Math.sin(seed + i)) * n) | 0;
                    const arr: NewsArticle[] = [];
                    for (let i = 0; i < 6; i++) {
                        const t = topics[rnd(topics.length, i) % topics.length];
                        const p = phrases[rnd(phrases.length, i + 13) % phrases.length];
                        const title = `${selectedRegion} ${t} ${p}`;
                        const summary = `Brief ${t.toLowerCase()} ${p} in ${selectedRegion}.`;
                        arr.push({ title, summary, source: src });
                    }
                    if (arr.length > 0) arr[0] = { ...arr[0], isError: true } as any;
                    newsData = arr;
                }
                if (!isMounted) return;
                setArticles(newsData);
                mockBackend.setCachedNews(selectedRegion, currentLanguage, newsData);
                setLoadingNews(false);
                setBypassCache(false);
            };
            fetchNews();
            return () => { isMounted = false; };
        }
    }, [mode, selectedRegion, currentLanguage, refreshTick, currentUserEmail]);

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchName.trim()) {
            const query = searchName.trim();
            const matches = mockBackend.searchUserByName(query);
            if (!query.includes('@') && (!matches || matches.length === 0)) {
                alert('this user doesnt exists');
                return;
            }
            if (matches && matches.length > 0) soundManager.playSound('request'); else soundManager.playSelect();
            onAddContact(searchName.trim());
            setSearchName('');
            setIsAddModalOpen(false);
        }
    };

    const handleRegionSelect = (region: string) => {
        soundManager.playSelect();
        setSelectedRegion(region);
        setIsRegionSelectorOpen(false);
    };

    const handleRefresh = () => {
        soundManager.playSelect();
        setBypassCache(true);
        setRefreshTick(t => t + 1);
    };

    const onPointerDownDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"]')) {
            return; // Let interactive elements handle clicks normally
        }
        if (!newsScrollRef.current) return;
        newsScrollRef.current.setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
        setIsDragging(true);
        dragMovedRef.current = false;
        dragStartXRef.current = e.clientX;
        dragScrollLeftRef.current = newsScrollRef.current.scrollLeft;
    };
    const onPointerDownDragMedia = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"], .btn-aero, .btn-aero-primary')) return;
        if (mediaAreaRef.current) (mediaAreaRef.current as any).setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
        setIsDragging(true);
        dragMovedRef.current = false;
        dragStartXRef.current = e.clientX;
        if (mediaScrollRef.current) dragScrollLeftRef.current = mediaScrollRef.current.scrollLeft;
    };
    const onPointerDownDragContacts = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"], .btn-aero, .btn-aero-primary')) {
            return;
        }
        pointerIdRef.current = e.pointerId;
        dragMovedRef.current = false;
        setIsDragging(false);
        dragStartXRef.current = e.clientX;
        if (contactsScrollRef.current) {
            dragScrollLeftRef.current = contactsScrollRef.current.scrollLeft;
        }
    };
    const onPointerMoveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !newsScrollRef.current) return;
        const walk = e.clientX - dragStartXRef.current;
        if (Math.abs(walk) > 6) dragMovedRef.current = true;
        newsScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
        e.preventDefault();
    };
    const onPointerMoveDragMedia = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const walk = e.clientX - dragStartXRef.current;
        if (Math.abs(walk) > 6 && pointerIdRef.current !== null) {
            (mediaAreaRef.current as any)?.setPointerCapture?.(pointerIdRef.current);
            dragMovedRef.current = true;
        }
        if (mediaScrollRef.current) mediaScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
        e.preventDefault();
    };
    const onPointerDownDragImages = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"], .btn-aero, .btn-aero-primary')) return;
        if (imagesAreaRef.current) (imagesAreaRef.current as any).setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
        setIsDragging(true);
        dragMovedRef.current = false;
        dragStartXRef.current = e.clientX;
        if (imagesScrollRef.current) dragScrollLeftRef.current = imagesScrollRef.current.scrollLeft;
    };
    const onPointerMoveDragImages = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const walk = e.clientX - dragStartXRef.current;
        if (Math.abs(walk) > 6 && pointerIdRef.current !== null) {
            (imagesAreaRef.current as any)?.setPointerCapture?.(pointerIdRef.current);
            dragMovedRef.current = true;
        }
        if (imagesScrollRef.current) imagesScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
        e.preventDefault();
    };
    const onPointerMoveDragContacts = (e: React.PointerEvent<HTMLDivElement>) => {
        const walk = e.clientX - dragStartXRef.current;
        if (!isDragging) {
            if (Math.abs(walk) > 6 && pointerIdRef.current !== null) {
                (contactsAreaRef.current as any)?.setPointerCapture?.(pointerIdRef.current);
                setIsDragging(true);
                dragMovedRef.current = true;
            } else {
                return;
            }
        }
        if (contactsScrollRef.current) {
            contactsScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
        }
        e.preventDefault();
    };
    const onPointerUpOrCancel = () => {
        setIsDragging(false);
        pointerIdRef.current = null;
        if (dragMovedRef.current) {
            justDraggedRef.current = true;
            dragMovedRef.current = false;
            setTimeout(() => { justDraggedRef.current = false; }, 200);
        }
    };
    const onPointerLeave = () => {
        setIsDragging(false);
        pointerIdRef.current = null;
    };
    const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"]')) {
            return; // Allow normal clicks on interactive children
        }
        if (justDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            justDraggedRef.current = false;
        }
    };
    const onClickCaptureContacts = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="button"]')) {
            return;
        }
        if (justDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            justDraggedRef.current = false;
        }
    };

    const handleReadArticle = async (article: NewsArticle) => {
        soundManager.playSelect();
        if (article.isError) return;

        setReadingArticle(article);
        
        if (!article.content) {
            setFullStoryLoading(true);
            try {
                const p1 = `${article.summary} This update reflects ongoing developments in ${selectedRegion}.`;
                const p2 = `Analysts in ${selectedRegion} highlight short-term shifts and longer-term signals affecting ${article.title.toLowerCase()}.`;
                const p3 = `Community and industry responses continue to shape the narrative as stakeholders adapt to new information.`;
                const fullContent = [p1, p2, p3].join('\n');
                
                setReadingArticle(prev => prev ? { ...prev, content: fullContent } : null);
                // Update local list (not cache, since full stories are heavy)
                setArticles(prev => prev.map(a => a.title === article.title ? { ...a, content: fullContent } : a));

            } catch (e: any) {
                console.error("Failed to load story", e);
                let msg = "Error loading full content. Please try again.";
                if (e.message && (e.message.includes("429") || e.message.includes("quota"))) {
                    msg = "API Quota Exceeded. Unable to generate full story at this time.";
                }
                setReadingArticle(prev => prev ? { ...prev, content: msg } : null);
            } finally {
                setFullStoryLoading(false);
            }
        }
    };

    // Filter Contacts Logic
    const getFilteredContacts = () => {
        let filtered = contacts;
        
        if (contactSearch.trim()) {
            const lower = contactSearch.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(lower) || c.email.toLowerCase().includes(lower));
        }

        if (filterTab === 'favorites') {
            filtered = filtered.filter(c => c.isFavorite);
        } else if (filterTab === 'recents') {
            filtered = filtered
                .filter(c => c.lastMessageTimestamp && c.lastMessageTimestamp > 0)
                .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
        }

        return filtered;
    };

    const displayContacts = getFilteredContacts();
    const isAllTab = filterTab === 'all';
    const isSearching = !!contactSearch;

    // Render Full Article View
    if (mode === 'news' && readingArticle) {
        return (
            <div className="px-4 md:px-20 py-6 pb-32 md:pb-10 relative z-20 animate-in slide-in-from-right duration-700 h-full overflow-y-auto">
                <div className="aero-glass p-8 md:p-12 bg-white/90 shadow-2xl rounded-lg max-w-4xl mx-auto relative min-h-[60vh]">
                    <button 
                        onClick={() => { soundManager.playSound('close'); setReadingArticle(null); }}
                        className="absolute top-6 right-6 btn-aero-icon w-10 h-10 text-slate-600 hover:text-[#00AFF0] z-10"
                    >
                        <X size={20} />
                    </button>

                    <button 
                        onClick={() => { soundManager.playSound('close'); setReadingArticle(null); }}
                        className="flex items-center gap-2 text-slate-500 hover:text-[#00AFF0] mb-6 font-bold text-sm transition-colors duration-500"
                    >
                        <ArrowLeft size={16} /> Back to Headlines
                    </button>

                    <div className="mb-2 flex items-center gap-2">
                        <span className="bg-[#00AFF0] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm tracking-widest">
                            {readingArticle.source}
                        </span>
                        <span className="text-slate-400 text-xs uppercase font-bold tracking-wide">
                            {selectedRegion}
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-segoe text-[#1e395b] mb-6 leading-tight drop-shadow-sm">
                        {readingArticle.title}
                    </h1>

                    {fullStoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                            <Loader2 size={40} className="animate-spin text-[#00AFF0]" />
                            <p className="font-segoe-light text-lg animate-pulse">Retrieving full story from the wire...</p>
                        </div>
                    ) : (
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-segoe text-base md:text-lg animate-in fade-in duration-500">
                            {(readingArticle.content || readingArticle.summary).split('\n').map((paragraph, idx) => (
                                 <p key={idx} className="mb-4 min-h-[1em]">{paragraph}</p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`relative z-20 h-full ${mode === 'news' ? 'p-0' : 'px-4 md:px-12 py-6'}`}>

            {/* Add Contact Modal with Aero Style */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-40 bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-500">
                    <div className="aero-glass p-5 shadow-2xl w-80 animate-in zoom-in-95 duration-500 rounded-md relative bg-white/90">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-300/50 pb-2">
                            <h3 className="text-[#1e395b] font-bold text-sm font-segoe shadow-white drop-shadow-sm">Add New Contact</h3>
                            <button onClick={() => { soundManager.playSound('close'); setIsAddModalOpen(false); }} className="text-slate-500 hover:text-red-600 transition-colors duration-300">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <label className="block text-[11px] text-slate-600 mb-2 font-bold">{t('Search')}</label>
                            <div className="flex items-center input-aero p-2 mb-4 bg-white">
                                <UserPlus size={16} className="text-slate-400 mr-2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search User (e.g. bob@gmail.com)..."
                                    className="w-full bg-transparent text-sm focus:outline-none text-slate-700"
                                    value={searchName}
                                    onChange={e => setSearchName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => { soundManager.playSelect(); setIsAddModalOpen(false); }} 
                                    className="btn-aero"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-aero-primary flex items-center gap-1"
                                >
                                    <Check size={12} /> Send
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Region Selection Modal */}
            {isRegionSelectorOpen && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-700">
                    <div className="aero-glass p-6 md:p-8 w-[94vw] md:w-full max-w-2xl relative bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-700 rounded-lg border-t border-white max-h-[85vh] overflow-hidden">
                         <button 
                             onClick={() => { soundManager.playSelect(); setIsRegionSelectorOpen(false); }}
                             className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors duration-300"
                         >
                             <X size={20} />
                         </button>
                         
                         <div className="mb-4 md:mb-6 text-center border-b border-slate-200 pb-3 md:pb-4">
                             <h3 className="text-xl md:text-2xl font-segoe text-[#1e395b] flex items-center justify-center gap-2">
                                 <Globe size={24} className="text-[#00AFF0]" /> Select Region
                             </h3>
                             <p className="text-slate-500 text-sm mt-1">Choose a region to view local headlines</p>
                         </div>

                         <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                 {NEWS_REGIONS.map((region, idx) => (
                                     <button
                                         key={region}
                                         onClick={() => handleRegionSelect(region)}
                                         className={`py-4 px-6 text-center text-sm font-bold shadow-md hover:scale-105 transition-transform duration-500 flex items-center justify-center rounded-sm border border-slate-400 text-slate-700 hover:brightness-105 ${selectedRegion === region ? 'ring-2 ring-[#00AFF0]' : ''}`}
                                         style={{ 
                                             animationDelay: `${idx * 150}ms`,
                                             background: 'linear-gradient(to bottom,  #f6f8f9 0%,#e5ebee 50%,#d7dee3 51%,#f5f7f9 100%)'
                                         }}
                                     >
                                         <div className="animate-metro-pop w-full truncate">
                                            {region}
                                         </div>
                                     </button>
                                 ))}
                             </div>
                         </div>
                    </div>
                </div>,
                document.body
            )}

            {imagePreviewSrc && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-500" onClick={() => { soundManager.playSound('close'); setImagePreviewSrc(null); }}>
                    <div className="relative max-w-[92vw] max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { soundManager.playSound('close'); setImagePreviewSrc(null); }} className="absolute -top-4 -right-4 btn-aero-icon w-9 h-9 z-10"><X size={16} /></button>
                        <div className="bg-black rounded-md shadow-2xl overflow-hidden">
                            <img src={imagePreviewSrc} alt="" className="block w-full h-full object-contain max-h-[92vh]" />
                        </div>
                    </div>
                </div>
            , document.body)}

            {mode === 'contacts' ? (
                <div 
                    ref={contactsAreaRef}
                    onPointerDown={onPointerDownDragContacts}
                    onPointerMove={onPointerMoveDragContacts}
                    onPointerUp={onPointerUpOrCancel}
                    onPointerCancel={onPointerUpOrCancel}
                    onPointerLeave={onPointerLeave}
                    onClickCapture={onClickCaptureContacts}
                    className="flex flex-col gap-6 h-full"
                    style={{ touchAction: 'pan-y' as any }}
                >
                    
                    {/* === CHAT REQUEST BOARD === */}
                    {requests && requests.length > 0 && isAllTab && (
                        <div className="animate-in slide-in-from-top-4 duration-1000 mb-4 shrink-0">
                             <div className="aero-glass p-0 overflow-hidden rounded-md bg-[#ffffe0]/90 border border-[#e6db55] shadow-lg relative">
                                <div className="bg-gradient-to-r from-[#ffd700] to-[#ffcc00] px-4 py-2 flex items-center gap-2 border-b border-[#e6b800] shadow-sm">
                                     <Bell size={16} className="text-yellow-900 animate-pulse" />
                                     <span className="font-bold text-yellow-900 text-sm uppercase tracking-wide font-segoe">{t('Chat Requests')}</span>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                                    {requests.map(req => (
                                        <div key={req.id} className="flex items-center gap-3 bg-white/60 p-3 rounded border border-yellow-200 shadow-sm">
                                            <img src={req.avatar} className="w-10 h-10 rounded shadow border border-white" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 text-sm truncate">{req.name}</div>
                                                <div className="text-[11px] text-slate-600 truncate">{req.email}</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => { soundManager.playSelect(); onAcceptRequest?.(req.email); }} className="p-1.5 bg-green-500 text-white rounded shadow hover:bg-green-600 transition-colors" title="Accept"><Check size={14}/></button>
                                                <button onClick={() => { soundManager.playSelect(); onDeclineRequest?.(req.email); }} className="p-1.5 bg-red-500 text-white rounded shadow hover:bg-red-600 transition-colors" title="Decline"><X size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}

                    {/* === CONTACTS ACTIONS ROW === */}
                    <div className="flex flex-row flex-wrap gap-3 md:gap-4 w-full">
                        <AnimatedTile 
                            index={0}
                            disableAnimations={disableAnimations}
                            className="h-32 md:h-40 w-60 md:w-64"
                        >
                             <button 
                                onClick={() => { soundManager.playSelect(); setIsAddModalOpen(true); }}
                                className="h-full w-full bg-[#00AFF0] hover:bg-[#009edb] text-white p-4 flex flex-col justify-between transition-all duration-200 shadow-sm group relative overflow-hidden hover:-translate-y-1"
                             >
                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity transform group-hover:scale-110 duration-500">
                                    <UserPlus size={64} />
                                </div>
                                <div className="z-10">
                                    <UserPlus size={32} className="mb-2" />
                                    <span className="text-2xl font-segoe-light leading-none block">{t('Add Contact')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider opacity-80">
                                    <Search size={12} />
                                    {t('Search')}
                                </div>
                             </button>
                        </AnimatedTile>
                        <AnimatedTile 
                            index={1} 
                            disableAnimations={disableAnimations}
                            className="h-32 md:h-40 w-60 md:w-64"
                        >
                            <button 
                                onClick={() => { soundManager.playSelect(); setFilterTab(filterTab === 'favorites' ? 'all' : 'favorites'); }}
                                className={`h-full w-full p-4 flex flex-col justify-between transition-all duration-200 shadow-sm relative overflow-hidden group border border-slate-200 hover:-translate-y-1 ${filterTab === 'favorites' ? 'ring-4 ring-[#00AFF0] ring-inset' : ''}`}
                                style={{
                                    background: 'linear-gradient(to bottom,  #fceabb 0%,#fccd4d 50%,#f8b500 51%,#fbdf93 100%)'
                                }}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12 duration-500">
                                    <Star size={64} className="text-[#5c4208]" />
                                </div>
                                <div className="z-10 text-[#5c4208]">
                                    <Star size={32} className="mb-2" fill="currentColor" />
                                    <span className="text-2xl font-segoe-light leading-none block">{t('Favorites')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#5c4208] opacity-80">
                                    <span>{contacts.filter(c => c.isFavorite).length} {t('Online')}</span>
                                </div>
                            </button>
                        </AnimatedTile>
                        <AnimatedTile 
                            index={2} 
                            disableAnimations={disableAnimations}
                            className="h-32 md:h-40 w-60 md:w-64"
                        >
                            <button 
                                onClick={() => { soundManager.playSelect(); setFilterTab(filterTab === 'recents' ? 'all' : 'recents'); }}
                                className={`h-full w-full p-4 flex flex-col justify-between transition-all duration-200 shadow-sm relative overflow-hidden group border border-slate-200 hover:-translate-y-1 ${filterTab === 'recents' ? 'ring-4 ring-[#00AFF0] ring-inset' : ''}`}
                                style={{
                                    background: 'linear-gradient(to bottom,  #e2e2e2 0%,#dbdbdb 50%,#d1d1d1 51%,#fefefe 100%)'
                                }}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:-rotate-12 duration-500">
                                    <Clock size={64} className="text-slate-700" />
                                </div>
                                <div className="z-10 text-slate-700">
                                    <Clock size={32} className="mb-2" />
                                    <span className="text-2xl font-segoe-light leading-none block">{t('Recents')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-600 opacity-80">
                                    <span>{t('History')}</span>
                                </div>
                            </button>
                        </AnimatedTile>
                    </div>

                    {/* === CONTACTS LIST (UNDER BUTTONS) === */}
                    <div 
                        ref={contactsScrollRef}
                        className={`flex flex-row gap-3 md:gap-4 w-full pb-20 md:pb-0 overflow-x-auto no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as any }}
                    >
                        {displayContacts.length === 0 ? (
                            <div className="h-32 md:h-40 flex items-center justify-center bg-white/50 border border-slate-200 text-slate-500 italic p-4 rounded-sm w-full">
                                {isSearching 
                                        ? t('No contacts found') 
                                        : filterTab === 'favorites' 
                                            ? "No favorites yet. Star a contact!" 
                                            : filterTab === 'recents'
                                                ? "No recent conversations."
                                                : t('No contacts found')}
                            </div>
                        ) : (
                            displayContacts.map((contact, idx) => (
                                <AnimatedTile 
                                    key={contact.id} 
                                    index={idx + 3} 
                                    onClick={() => onSelect(contact.id)}
                                    disableAnimations={disableAnimations}
                                    onToggleFavorite={(e) => onToggleFavorite && onToggleFavorite(contact.id, e)}
                                    isFavorite={contact.isFavorite}
                                    showStar={true}
                                    className="h-32 md:h-40 w-60 md:w-64 shrink-0"
                                >
                                    <div className={`h-full w-full p-4 flex flex-col justify-between transition-all duration-200 shadow-sm border-l-4 group relative overflow-hidden hover:-translate-y-1 
                                        ${contact.status === 'online' ? 'bg-white border-l-green-500 hover:bg-sky-50' : 
                                          contact.status === 'busy' ? 'bg-white border-l-red-500' : 
                                          'bg-slate-50 border-l-slate-300 hover:bg-slate-100'
                                        }`}>
                                        <div className="flex justify-between items-start z-10">
                                            <div className="relative">
                                                <img 
                                                    src={contact.avatar} 
                                                    alt={contact.name} 
                                                    className={`w-12 h-12 rounded-sm border shadow-sm ${contact.status === 'online' ? 'border-slate-200' : 'border-slate-300'}`} 
                                                />
                                                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white 
                                                    ${contact.status === 'online' ? 'bg-green-500' : 
                                                        contact.status === 'busy' ? 'bg-red-500' : 'bg-slate-400'}`}></div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); soundManager.playSound('close'); onDeleteContact && onDeleteContact(contact.email); }}
                                                className="p-1 rounded-sm text-slate-400 hover:text-red-600"
                                                title="Delete Contact"
                                            >
                                                <UserMinus size={14} />
                                            </button>
                                        </div>
                                        <div className="z-10">
                                            <h3 className={`text-lg font-segoe leading-tight truncate pr-6 ${contact.status === 'online' ? 'text-slate-800' : 'text-slate-600'}`}>{contact.name}</h3>
                                            <p className="text-xs text-slate-500 mt-1 truncate">{contact.lastMessage}</p>
                                        </div>
                                        <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
                                            <div className="text-6xl font-bold text-slate-800 select-none">{contact.name.charAt(0)}</div>
                                        </div>
                                    </div>
                                </AnimatedTile>
                            ))
                        )}
                    </div>
                </div>
            ) : mode === 'news' ? (
                /* === NEWS FEED === */
                <div 
                    ref={newsScrollRef}
                    onPointerDown={onPointerDownDrag}
                    onPointerMove={onPointerMoveDrag}
                    onPointerUp={onPointerUpOrCancel}
                    onPointerCancel={onPointerUpOrCancel}
                    onPointerLeave={onPointerLeave}
                    onClickCapture={onClickCapture}
                    className={`select-none flex flex-row gap-6 h-full items-center px-4 md:px-10 pb-24 md:pb-4 pt-2 w-full overflow-x-auto no-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as any }}
                >
                     
                     {/* Region Selector Tile */}
                     <AnimatedTile 
                        index={0} 
                        disableAnimations={false} 
                        className="relative w-full md:w-72 h-64 shrink-0 border border-white/40 rounded-sm"
                    >
                        <button 
                            onClick={() => { soundManager.playSelect(); setIsRegionSelectorOpen(true); }}
                            className="h-full w-full bg-[#73b703] hover:bg-[#639e03] text-white p-6 flex flex-col justify-between transition-all duration-200 shadow-lg group relative overflow-hidden hover:-translate-y-1"
                            style={{
                                background: 'linear-gradient(to bottom,  #f6f8f9 0%,#e5ebee 50%,#d7dee3 51%,#f5f7f9 100%)'
                            }}
                        >
                             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12 duration-500">
                                <MapIcon size={100} className="text-slate-800" />
                            </div>
                            <div className="z-10 text-left">
                                <Globe size={40} className="mb-4 text-[#1e395b]" />
                                <span className="text-3xl font-segoe-light leading-none block text-[#1e395b]">{selectedRegion}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1e395b] opacity-80">
                                <ChevronDown size={16} />
                                <span>Change Region</span>
                            </div>
                        </button>
                     </AnimatedTile>

                     {loadingNews ? (
                         <div className="relative w-full md:w-72 h-64 shrink-0 border border-white/40 flex flex-col items-start justify-start p-6 bg-white/50 backdrop-blur-sm text-left animate-pulse rounded-sm">
                             <Loader2 size={32} className="text-[#00AFF0] animate-spin mb-4" />
                             <p className="text-xl font-segoe-light text-slate-600">Fetching headlines from {selectedRegion}...</p>
                         </div>
                     ) : (
                         <>
                           <AnimatedTile 
                              index={1}
                              disableAnimations={false}
                              className="relative w-full md:w-36 h-64 shrink-0 border border-white/40 rounded-sm"
                           >
                               <button 
                                  onClick={handleRefresh}
                                  className="h-full w-full bg-white hover:bg-sky-50 p-6 flex flex-col justify-between transition-all duration-200 shadow-lg group relative overflow-hidden hover:-translate-y-1"
                               >
                                   <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                       <RefreshCcw size={80} className="text-slate-800" />
                                   </div>
                                   <div className="z-10">
                                       <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AFF0]">SkyLink</span>
                                       <h3 className="text-lg font-segoe text-[#1e395b] leading-tight mb-2">Refresh Headlines</h3>
                                       <p className="text-xs text-slate-500">Force update for {selectedRegion}</p>
                                   </div>
                                   <div className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-[#00AFF0] transition-colors mt-auto pt-4">
                                       <span>Refresh</span>
                                       <ArrowRight size={12} className="transform group-hover:translate-x-1 transition-transform" />
                                   </div>
                               </button>
                           </AnimatedTile>
                           {articles.map((article, i) => (
                            <AnimatedTile 
                                key={i} 
                                index={i + 2} 
                                disableAnimations={false} 
                                onClick={() => handleReadArticle(article)}
                                className="relative w-full md:w-80 h-64 shrink-0 border border-white/40 rounded-sm"
                            >
                                <div 
                                    className={`h-full w-full bg-white hover:bg-sky-50 p-6 flex flex-col justify-between transition-all duration-200 shadow-lg group relative overflow-hidden hover:-translate-y-1 ${article.isError ? 'cursor-default' : 'cursor-pointer'}`}
                                    style={{
                                        background: article.isError ? '#fff1f0' : 'linear-gradient(to bottom,  #f6f8f9 0%,#e5ebee 50%,#d7dee3 51%,#f5f7f9 100%)'
                                    }}
                                >
                                     <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                        {article.isError ? <AlertTriangle size={80} className="text-red-800" /> : <Newspaper size={80} className="text-slate-800" />}
                                    </div>
                                    <div className="z-10">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${article.isError ? 'text-red-500' : 'text-[#00AFF0]'}`}>{article.source}</span>
                                        </div>
                                        <h3 className="text-lg font-segoe text-[#1e395b] leading-tight line-clamp-3 font-medium mb-2 group-hover:text-[#00AFF0] transition-colors">
                                            {article.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                                            {article.summary}
                                        </p>
                                    </div>
                                    {!article.isError && (
                                        <button 
                                            type="button"
                                            onClick={() => handleReadArticle(article)}
                                            className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-[#00AFF0] transition-colors mt-auto pt-4"
                                        >
                                            <span>Read Full Story</span>
                                            <ArrowRight size={12} className="transform group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    )}
                                </div>
                            </AnimatedTile>
                           ))}
                         </>
                     )}
                     
                     {/* Spacer for end of list */}
                     <div className="w-10 shrink-0 h-10 md:h-auto"></div>
                </div>
            ) : (
                <div 
                    ref={mediaAreaRef}
                    className="flex flex-col md:flex-row gap-6 h-full"
                    style={{ touchAction: 'pan-y' as any }}
                >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="font-bold text-sm text-slate-700">{t('Music')}</span></div>
                      <div 
                        ref={mediaScrollRef}
                        className={`grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 w-full overflow-y-auto no-scrollbar select-none`}
                        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as any, alignContent: 'start' }}
                        onWheel={(e) => { if (mediaScrollRef.current) { mediaScrollRef.current.scrollTop += (e.deltaY || 0); e.preventDefault(); e.stopPropagation(); } }}
                      >
                        {tracks.map((t, idx) => (
                            <AnimatedTile 
                                key={t.id}
                                index={idx}
                                disableAnimations={false}
                                className={`h-32 md:h-40 w-full md:w-64 ${currentTrackId === t.id ? 'ring-4 ring-[#00AFF0] ring-inset' : ''}`}
                                onClick={() => { soundManager.playSelect(); setTrack(t.id); }}
                            >
                                <div className="h-full w-full p-4 flex flex-col justify-between transition-all duration-200 shadow-sm relative overflow-hidden group border border-slate-200 hover:-translate-y-1"
                                     style={{ background: 'linear-gradient(to bottom,  #f6f8f9 0%,#e5ebee 50%,#d7dee3 51%,#f5f7f9 100%)' }}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12 duration-500">
                                        <Music size={64} className="text-slate-800" />
                                    </div>
                                    <div className="z-10 text-slate-700">
                                        <Music size={32} className="mb-2" />
                                        <span className="text-2xl font-segoe-light leading-none block">{t.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-600 opacity-80">
                                        <span>{currentTrackId === t.id ? 'Selected' : 'Tap to select'}</span>
                                    </div>
                                </div>
                            </AnimatedTile>
                        ))}
                      </div>

                      <div className="aero-glass bg-white/90 rounded-md border border-slate-300 shadow-lg p-4 sticky top-2 z-30">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <Music size={20} className="text-[#00AFF0]" />
                                <div>
                                    <div className="font-bold text-sm text-slate-700">{currentTrack.title}</div>
                                    <div className="text-xs text-slate-500">{Math.floor(progress)}/{Math.floor(duration)}s</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { soundManager.playSelect(); const idx = tracks.findIndex(t => t.id === currentTrackId); const prev = (idx - 1 + tracks.length) % tracks.length; setTrack(tracks[prev].id); }} className="btn-aero-icon"><SkipBack size={16} /></button>
                                <button onClick={() => { soundManager.playSelect(); playPause(); }} className="btn-aero-icon">{isPlaying ? <Pause size={16}/> : <Play size={16}/>}</button>
                                <button onClick={() => { soundManager.playSelect(); const idx = tracks.findIndex(t => t.id === currentTrackId); const next = (idx + 1) % tracks.length; setTrack(tracks[next].id); }} className="btn-aero-icon"><SkipForward size={16} /></button>
                                <button onClick={() => { soundManager.playSelect(); onMediaToggleLoop?.(); }} className={`btn-aero-icon ${mediaLoop ? 'ring-2 ring-[#00AFF0]' : ''}`} title="Repeat"><RefreshCcw size={16} /></button>
                                <span className="inline-flex items-center">
                                  <input id="add-mp3-input" type="file" accept="audio/mp3,audio/mpeg" multiple style={{ display: 'none' }} onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length) {
                                      soundManager.playSelect();
                                      for (const f of files) onMediaAddLocalFile?.(f);
                                      e.target.value = '';
                                    }
                                  }} />
                                  <button onClick={() => { soundManager.playSelect(); const me = mockBackend.getCurrentUser(); if (!me || me.email === 'guest@local') { alert('Create an account to chat!'); return; } (document.getElementById('add-mp3-input') as HTMLInputElement)?.click(); }} className="btn-aero-icon" title="Add MP3">
                                    <Plus size={16} />
                                  </button>
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="range" min={0} max={duration || 0} step={0.1} value={progress} onChange={(e) => seek(parseFloat(e.target.value))} className="flex-1" />
                            <div className="flex items-center gap-2 w-40">
                                {volume === 0 ? <VolumeX size={16} className="text-slate-600" /> : <Volume2 size={16} className="text-slate-600" />}
                                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVol(parseFloat(e.target.value))} className="flex-1" />
                            </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:w-80 w-full md:flex-shrink-0 flex flex-col h-full">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-700">{t('Images')}</span>
                        <span className="inline-flex items-center">
                          <input id="add-image-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                            const input = e.currentTarget;
                            const files: File[] = Array.from(input.files ?? []);
                            if (files.length) {
                              const me = mockBackend.getCurrentUser();
                              if (!me || me.email === 'guest@local') { alert('Create an account to chat!'); input.value = ''; return; }
                              soundManager.playSelect();
                              await mockBackend.addMediaImagesFiles(files);
                              const updated = await mockBackend.getSecureMedia('images');
                              setMediaImages(updated);
                              input.value = '';
                            }
                          }} />
                          <button onClick={() => { soundManager.playSelect(); const me = mockBackend.getCurrentUser(); if (!me || me.email === 'guest@local') { alert('Create an account to chat!'); return; } (document.getElementById('add-image-input') as HTMLInputElement)?.click(); }} className="btn-aero-icon" title="Add Images">
                            <Plus size={16} />
                          </button>
                        </span>
                      </div>
                      <div 
                        ref={imagesAreaRef}
                        className="flex-1 min-h-0"
                      >
                        <div
                          ref={imagesScrollRef}
                          className={`flex flex-col gap-2 md:gap-3 w-full overflow-y-auto no-scrollbar select-none h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as any, overscrollBehavior: 'contain' }}
                        >
                          {mediaImages.map((item, idx) => (
                              <AnimatedTile key={`${item.name}-${idx}`} index={idx + 20} disableAnimations={false} className="w-full h-48 flex-none" onClick={() => { soundManager.playSelect(); setImagePreviewSrc(item.src); }}>
                                  <div className="h-full w-full relative overflow-hidden rounded-sm border border-slate-200 bg-white">
                                      <img src={item.src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1">{item.name}</div>
                                  </div>
                              </AnimatedTile>
                          ))}
                        </div>
                      </div>
                    </div>
                </div>
            )}
        </div>
    );
};
