import React, { useState, useEffect, memo, useRef } from 'react';
import { Contact } from '../../components/../types';
import { Plus, Check, X, Bell, UserPlus, UserCheck, UserMinus, Map as MapIcon, Newspaper, ArrowRight, Loader2, ArrowLeft, ChevronDown, Globe, Search, Star, Clock, Users, AlertTriangle, RefreshCcw } from 'lucide-react';
import { mockBackend } from '../../services/mockBackend';
import { soundManager } from '../../utils/SoundManager';

interface HubProps {
  mode?: 'contacts' | 'news';
  contacts: Contact[];
  requests?: Contact[];
  currentLanguage: string;
  onSelect: (id: string) => void;
  onAddContact: (name: string) => void;
  onAcceptRequest?: (email: string) => void;
  onDeclineRequest?: (email: string) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  disableAnimations?: boolean; 
  t: (key: string) => string;
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
    onSelect, 
    onAddContact,
    onAcceptRequest,
    onDeclineRequest,
    onToggleFavorite,
    disableAnimations = false,
    t
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchName, setSearchName] = useState('');
    
    const [filterTab, setFilterTab] = useState<'all' | 'favorites' | 'recents'>('all');
    const [contactSearch, setContactSearch] = useState('');

    const [selectedRegion, setSelectedRegion] = useState("North America");
    const [isRegionSelectorOpen, setIsRegionSelectorOpen] = useState(false);
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loadingNews, setLoadingNews] = useState(false);
    const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
    const [fullStoryLoading, setFullStoryLoading] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [bypassCache, setBypassCache] = useState(false);
    const newsScrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef(0);
    const dragScrollLeftRef = useRef(0);
    const dragMovedRef = useRef(false);
    const justDraggedRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);

    const currentUser = mockBackend.getCurrentUser();

    useEffect(() => {
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
                    case 'United States': return [top('en-US','US','US:en')];
                    case 'Canada': return [top('en-CA','CA','CA:en'), search('Canada')];
                    case 'United Kingdom': return [top('en-GB','GB','GB:en'), search('UK')];
                    case 'Germany': return [search('Germany')];
                    case 'France': return [search('France')];
                    case 'Spain': return [search('Spain')];
                    case 'Italy': return [search('Italy')];
                    case 'Japan': return [search('Japan')];
                    case 'China': return [search('China')];
                    case 'India': return [top('en-IN','IN','IN:en'), search('India')];
                    case 'Australia': return [top('en-AU','AU','AU:en'), search('Australia')];
                    case 'New Zealand': return [search('New Zealand')];
                    case 'Brazil': return [search('Brazil')];
                    case 'Mexico': return [search('Mexico')];
                    case 'Argentina': return [search('Argentina')];
                    case 'South Africa': return [search('South Africa')];
                    case 'Nigeria': return [search('Nigeria')];
                    case 'Saudi Arabia': return [search('Saudi Arabia')];
                    case 'UAE': return [search('UAE'), search('United Arab Emirates')];
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
                const proxies = [
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                    `https://thingproxy.freeboard.io/fetch/${url}`,
                    `https://cors.isomorphic-git.org/${url}`
                ];
                for (const p of proxies) {
                    try {
                        const ctrl = new AbortController();
                        const t = setTimeout(() => ctrl.abort(), 8000);
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
    }, [mode, selectedRegion, currentLanguage, refreshTick]);

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        soundManager.playSelect();
        if (searchName.trim()) {
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
            return;
        }
        if (!newsScrollRef.current) return;
        newsScrollRef.current.setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
        setIsDragging(true);
        dragMovedRef.current = false;
        dragStartXRef.current = e.clientX;
        dragScrollLeftRef.current = newsScrollRef.current.scrollLeft;
    };
    const onPointerMoveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !newsScrollRef.current) return;
        const walk = e.clientX - dragStartXRef.current;
        if (Math.abs(walk) > 6) dragMovedRef.current = true;
        newsScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
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
            return;
        }
        if (justDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            justDraggedRef.current = false;
        }
    };

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

    if (mode === 'news' && readingArticle) {
        return (
            <div className="px-4 md:px-20 py-6 pb-32 md:pb-10 relative z-20 animate-in slide-in-from-right duration-700 h-full overflow-y-auto">
                <div className="aero-glass p-8 md:p-12 bg-white/90 shadow-2xl rounded-lg max-w-4xl mx-auto relative min-h-[60vh]">
                    <button 
                        onClick={() => { soundManager.playSelect(); setReadingArticle(null); }}
                        className="absolute top-6 right-6 btn-aero-icon w-10 h-10 text-slate-600 hover:text-[#00AFF0] z-10"
                    >
                        <X size={20} />
                    </button>

                    <button 
                        onClick={() => { soundManager.playSelect(); setReadingArticle(null); }}
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
            {mode === 'contacts' ? (
                <div className="flex flex-col gap-6 h-full">
                </div>
            ) : (
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
                     <div className="w-10 shrink-0 h-10 md:h-auto"></div>
                </div>
            )}
        </div>
    );
};

export default Hub;
