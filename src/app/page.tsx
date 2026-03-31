'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { name: string };
  matchedKeyword: string;
}

export default function OrbitNews() {
  const { user, loading: authLoading } = useAuth();
  
  const [keywords, setKeywords] = useState<string[]>([]);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [trendingArticles, setTrendingArticles] = useState<Article[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState('ko');
  const [articles, setArticles] = useState<Article[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Modal & AI States
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Feature States
  const [bookmarks, setBookmarks] = useState<string[]>([]); // URLs only for quick check
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Article[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [view, setView] = useState<'feed' | 'bookmarks'>('feed');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Data fetching
  const fetchNews = useCallback(async () => {
    if (!user) return;
    setNewsLoading(true);
    try {
      const token = await user.getIdToken();
      // Fetch Personalized News
      const res = await fetch('/api/news', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setArticles(data.articles || []);

      // Fetch Trending News
      const trendRes = await fetch('/api/news?mode=trending', { headers: { Authorization: `Bearer ${token}` } });
      const trendData = await trendRes.json();
      setTrendingArticles(trendData.articles || []);
    } catch (e) { console.error('Error fetching news:', e); } 
    finally { setNewsLoading(false); }
  }, [user]);

  const fetchKeywords = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/keywords', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
        fetchNews();
      }
    } catch (e) { console.error('Error fetching keywords:', e); } 
    finally { setDataLoading(false); }
  }, [user, fetchNews]);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/bookmarks', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBookmarks(data.bookmarks.map((b: any) => b.url));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBookmarkedArticles(data.bookmarks.map((b: any) => ({
          ...b,
          source: { name: b.sourceName || 'Unknown' }
        })));
      }
    } catch (e) { console.error('Error fetching bookmarks:', e); }
  }, [user]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (selectedArticle) {
       document.body.style.overflow = 'hidden';
    } else {
       document.body.style.overflow = 'auto';
    }
    return () => {
       document.body.style.overflow = 'auto';
    };
  }, [selectedArticle]);

  useEffect(() => { 
    fetchKeywords(); 
    fetchBookmarks();

    // Google Translate Initialization
    if (typeof window !== 'undefined' && !window.location.hash.includes('google-translate')) {
      const match = document.cookie.match(/googtrans=\/auto\/(\w+)/);
      if (match) {
        setCurrentLang(match[1]);
      } else {
        // Default to 'ko' if no cookie exists to force widget state consistency
        document.cookie = 'googtrans=/auto/ko; path=/; SameSite=Lax';
        setCurrentLang('ko');
      }

      (window as any).googleTranslateElementInit = () => {
        new (window as any).google.translate.TranslateElement({
          pageLanguage: 'auto',
          includedLanguages: 'ko,en,ja',
          layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        }, 'google_translate_element');
      };

      if (!document.querySelector('script[src*="translate_a/element.js"]')) {
        const script = document.createElement('script');
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [fetchKeywords, fetchBookmarks]);

  const switchLanguage = (lang: string) => {
    document.cookie = `googtrans=/auto/${lang}; path=/; SameSite=Lax`;
    setCurrentLang(lang);
    window.location.reload();
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim() || !user) return;
    if (keywords.length >= 5) {
      showToast('최대 5개의 키워드만 등록 가능합니다.');
      return;
    }
    const updatedKeywords = [...keywords, newKeyword.trim()];
    
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keywords: updatedKeywords }),
      });
      if (res.ok) {
        setKeywords(updatedKeywords);
        setNewKeyword('');
        fetchNews();
      }
    } catch (e) {
      console.error('Error saving keywords:', e);
      showToast('키워드 저장 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveKeyword = async (targetKw: string) => {
    if (!user) return;
    const updatedKeywords = keywords.filter((kw) => kw !== targetKw);
    
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keywords: updatedKeywords }),
      });
      if (res.ok) {
        setKeywords(updatedKeywords);
        if (activeKeyword === targetKw) setActiveKeyword(null);
        fetchNews();
      }
    } catch (e) {
      console.error('Error removing keywords:', e);
      showToast('키워드 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleToggleBookmark = async (article: Article) => {
    if (!user) return;
    const isBookmarked = bookmarks.includes(article.url);
    const method = isBookmarked ? 'DELETE' : 'POST';
    const body = isBookmarked 
      ? { url: article.url } 
      : { ...article, sourceName: article.source?.name || '' };

    // Optimistic UI update
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(url => url !== article.url));
      setBookmarkedArticles(prev => prev.filter(a => a.url !== article.url));
    } else {
      setBookmarks(prev => [...prev, article.url]);
      setBookmarkedArticles(prev => [article, ...prev]);
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/bookmarks', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) showToast(isBookmarked ? '북마크가 해제되었습니다.' : '북마크에 추가되었습니다.');
      else fetchBookmarks(); // Revert on failure
    } catch (error) { fetchBookmarks(); }
  };

  const handleShare = async (article: Article) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.description,
          url: article.url,
        });
      } catch (err) { console.error('Share failed', err); }
    } else {
      await navigator.clipboard.writeText(article.url);
      showToast('🔗 링크가 복사되었습니다!');
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleCardClick = async (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    setSelectedArticle(article);
    setSummary(null);
    setIsSummarizing(true);
    
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: article.url })
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      } else {
        setSummary('요약을 생성하는 중에 오류가 발생했습니다.');
      }
    } catch(e) {
      setSummary('서버 처리 중 지연이 발생했습니다.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const closeModal = () => setSelectedArticle(null);

  if (authLoading) return <div className="flex justify-center items-center h-screen bg-black text-on-surface">Auth Sync...</div>;

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 px-4">
        <div className="glass-card p-12 rounded-[2.5rem] text-center max-w-lg shadow-[0_40px_100px_rgba(139,92,246,0.2)] animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="Orbit Logo" className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold font-headline mb-4 notranslate">
             <span className="orbit-gradient-text">Orbit</span>
          </h1>
          <p className="text-on-surface-variant font-medium mb-8 leading-relaxed">
            The universe of information, distilled for you. AI Curated News & Translation Dashboard.
          </p>
          <button onClick={handleLogin} className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-on-primary-fixed font-bold text-shadow transition-transform hover:scale-[1.03] active:scale-95 shadow-lg shadow-primary/20">
             <span className="material-symbols-outlined text-[20px]">login</span> Sign In with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Top Navbar */}
      <header className="fixed top-0 w-full z-40 bg-neutral-950/40 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-4 sm:px-6 h-16 shadow-[0_20px_40px_rgba(139,92,246,0.08)]">
        <div className="flex items-center gap-3 sm:gap-8">
          <div className="flex items-center gap-2 cursor-pointer notranslate" onClick={() => setView('feed')}>
            <img src="/logo.png" alt="Orbit Logo" className="w-8 h-8 object-contain" />
            <h1 className="text-2xl font-bold font-headline tracking-tight orbit-gradient-text">Orbit</h1>
          </div>
          <nav className="flex items-center gap-1 p-0.5 sm:p-1 rounded-full bg-white/5 border border-white/10 shrink-0 notranslate">
            <button 
              onClick={() => setView('feed')}
              className={`px-4 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 select-none ${view === 'feed' ? 'bg-primary text-neutral-900 shadow-[0_0_15px_rgba(208,188,255,0.4)]' : 'text-neutral-400 hover:text-white'}`}>
              Feed
            </button>
            <button 
              onClick={() => setView('bookmarks')}
              className={`px-4 sm:px-5 py-2 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 select-none ${view === 'bookmarks' ? 'bg-primary text-neutral-900 shadow-[0_0_15px_rgba(208,188,255,0.4)]' : 'text-neutral-400 hover:text-white'}`}>
              Saved
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/5 notranslate">
            {['ko', 'en', 'ja'].map((l) => (
              <button 
                key={l}
                onClick={() => switchLanguage(l)}
                className={`orbit-lang-chip notranslate ${currentLang === l ? 'active' : ''}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div id="google_translate_element" className="google-translate-container"></div>
          <div className="flex items-center gap-2 sm:gap-3 notranslate">
            <span className="hidden lg:inline-block text-on-surface-variant text-sm border border-outline-variant px-3 py-1 rounded-full">{user.email}</span>
            <button onClick={() => signOut(auth)} className="text-neutral-400 hover:text-sky-300 transition-colors flex items-center justify-center p-2 rounded-full hover:bg-white/5 active:scale-75 shrink-0" aria-label="Log Out">
              <span className="material-symbols-outlined" data-icon="logout">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-24 px-4 sm:px-6 max-w-6xl mx-auto min-h-screen w-full overflow-x-hidden">
        <section className="mb-12 flex flex-col justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
              {view === 'feed' ? 'Daily Briefing' : 'Personal Archive'}
            </span>
            <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter leading-[1.1] text-white">
                {view === 'feed' ? (
                  <>Live <span className="orbit-gradient-text">feed</span> pipeline</>
                ) : (
                  <>Saved <span className="orbit-gradient-text">bookmarks</span></>
                )}
            </h2>
          </div>

          {view === 'feed' && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4 glass-card p-4 rounded-xl max-w-3xl">
              <div className="flex w-full sm:w-auto flex-1 h-10 border border-outline-variant rounded-full bg-surface-container-lowest overflow-hidden focus-within:border-primary transition-colors">
                <input 
                  value={newKeyword} 
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="관심 키워드 추가 (예: 클라우드, 주식)" 
                  className="flex-1 bg-transparent px-4 py-2 outline-none text-white text-sm placeholder:text-neutral-600"
                />
                <button onClick={handleAddKeyword} className="bg-surface-bright hover:bg-white/10 px-4 text-sm font-semibold text-on-surface transition border-l border-outline-variant notranslate">추가</button>
              </div>
              {/* Keywords Bar */}
              <div className="flex gap-2 pb-2 sm:pb-0 overflow-x-auto no-scrollbar items-center whitespace-nowrap notranslate">
                <button 
                  onClick={() => {
                    setActiveKeyword(null);
                    fetchNews();
                  }} 
                  title="Sync Feed"
                  className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full transition-all ${
                    activeKeyword === null 
                    ? 'bg-gradient-to-r from-primary to-secondary text-on-primary shadow-lg shadow-primary/30 rotate-180' 
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-white/10'
                  }`}>
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                </button>
                {!dataLoading && keywords.map(kw => (
                   <button 
                     key={kw} 
                     onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)} 
                     className={`group relative px-6 py-2 rounded-full border transition-all flex items-center pr-10 h-10 overflow-hidden select-none active:scale-95 ${
                       activeKeyword === kw 
                       ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(208,188,255,0.3)]' 
                       : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-white/20'
                     }`}>
                     #{kw} 
                     <span 
                       onClick={(e) => {
                         e.stopPropagation();
                         handleRemoveKeyword(kw);
                       }}
                       className="material-symbols-outlined text-[16px] absolute right-3 opacity-40 hover:opacity-100 transition-opacity hover:text-error">
                       close
                     </span>
                   </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Orbit Trending 10 Section (NEW) */}
        {view === 'feed' && trendingArticles.length > 0 && !activeKeyword && (
          <section className="mb-12 animate-in fade-in slide-in-from-right-10 duration-700">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-1 h-6 bg-primary rounded-full"></div>
               <h3 className="text-xl font-bold font-headline text-white tracking-tight uppercase tracking-widest text-[14px]">🔥 Orbit Trending 10</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {trendingArticles.map((article, idx) => (
                <div 
                  key={idx} 
                  onClick={(e) => handleCardClick(e, article)}
                  className="flex-shrink-0 w-[280px] sm:w-[320px] glass-card p-4 rounded-2xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group flex gap-4 items-center active:scale-[0.98]">
                  <span className="text-4xl font-headline font-black orbit-gradient-text opacity-30 group-hover:opacity-100 transition-opacity notranslate">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-neutral-500 mb-1 font-mono notranslate">{article.source.name}</p>
                    <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors">{article.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === 'feed' ? (
          newsLoading ? (
              <div className="flex justify-center flex-col gap-4 items-center py-32">
                <div className="w-10 h-10 rounded-full border-4 border-surface-bright border-t-primary animate-spin"></div>
                <p className="text-sm font-mono text-on-surface-variant tracking-widest uppercase">Fetching Cosmos Data</p>
              </div>
          ) : articles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles
                  .filter(art => !activeKeyword || art.matchedKeyword === activeKeyword)
                  .map((article, idx) => (
                  <article key={idx} onClick={(e) => handleCardClick(e, article)} className={`group glass-card rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer select-none ring-1 ring-white/5 active:ring-primary/40 ${idx === 0 ? 'md:col-span-2' : ''}`}>
                    <div className={`relative ${idx === 0 ? 'h-64' : 'h-48'} overflow-hidden`}>
                      <img alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={article.urlToImage || 'https://images.unsplash.com/photo-1550592704-5e58992e5c8e'} />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-transparent to-transparent opacity-80"></div>
                      <div className="absolute top-4 left-4 notranslate">
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg glass-card bg-neutral-900/40 backdrop-blur-md text-primary text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                              AI SUMMARY
                          </span>
                      </div>
                    </div>
                      <div className="p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-3">
                           <span className="text-[10px] font-mono orbit-gradient-text uppercase tracking-widest notranslate">{article.matchedKeyword || 'NEWS'}</span>
                           <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-neutral-400 font-bold uppercase tracking-tight notranslate">{article.source.name}</span>
                        </div>
                      <h3 className={`font-headline font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-3 ${idx === 0 ? 'text-2xl' : 'text-lg'}`}>
                         {article.title}
                      </h3>
                      <p className={`text-on-surface-variant line-clamp-2 leading-relaxed ${idx === 0 ? 'text-sm mb-4' : 'text-xs'}`}>
                         {article.description}
                      </p>
                      
                      {/* 카드 직접 북마크 버튼 (Native App Style) */}
                      <div className="mt-4 flex justify-end notranslate">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(article);
                          }}
                          className={`p-3 rounded-full transition-all active:scale-75 ${
                            bookmarks.includes(article.url) 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-white/5 text-neutral-500 hover:text-white'
                          }`}
                          aria-label="Toggle Bookmark"
                        >
                          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: bookmarks.includes(article.url) ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
          ) : (
              <div className="py-20 text-center glass-card rounded-2xl">
                <span className="material-symbols-outlined text-4xl text-neutral-600 mb-4 block">snooze</span>
                <p className="text-on-surface-variant">표시할 뉴스 데이터가 없습니다.</p>
              </div>
          )
        ) : (
          bookmarkedArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookmarkedArticles.map((article, idx) => (
                <article key={idx} onClick={(e) => handleCardClick(e, article)} className="group glass-card rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                  <div className="relative h-48 overflow-hidden">
                    <img alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={article.urlToImage || 'https://images.unsplash.com/photo-1550592704-5e58992e5c8e'} />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-transparent to-transparent opacity-80"></div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                       <span className="text-[10px] text-neutral-500">{article.source.name}</span>
                    </div>
                    <h3 className="font-headline font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-3 text-lg">
                       {article.title}
                    </h3>
                    <div className="mt-2 flex justify-end notranslate">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(article);
                        }}
                        className="p-3 rounded-full bg-primary/20 text-primary active:scale-75 transition-all"
                      >
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center glass-card rounded-2xl border border-dashed border-white/5">
              <span className="material-symbols-outlined text-4xl text-neutral-600 mb-4 block">bookmark_border</span>
              <p className="text-on-surface-variant">저장된 북마크가 없습니다.</p>
              <button 
                onClick={() => setView('feed')}
                className="mt-6 px-8 py-3 rounded-full border border-primary/30 text-primary text-sm font-bold hover:bg-primary/10 transition-all active:scale-95">
                Find News to Save
              </button>
            </div>
          )
        )}
      </main>

      {/* Detail Modal Overlay */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-surface-container-lowest/80 backdrop-blur-md transition-opacity" onClick={closeModal}>
          <div className="glass-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(139,92,246,0.15)] animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 sm:p-8 pb-0 flex justify-between items-start">
              <div className="flex-1 pr-4 sm:pr-8">
                <div className="flex items-center gap-2 mb-3 notranslate">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <span className="text-[10px] text-primary font-label uppercase tracking-widest font-bold">Orbit AI Analysis</span>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-headline font-bold text-white leading-tight">
                  {selectedArticle.title}
                </h2>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-white/10 text-neutral-400 transition-colors group shrink-0 notranslate">
                <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform duration-300">close</span>
              </button>
            </div>

            {/* Modal Middle: AI Summary Content */}
            <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {isSummarizing ? (
                <div className="space-y-4 animate-pulse pt-4">
                  <div className="h-4 bg-white/10 rounded-full w-[95%]"></div>
                  <div className="h-4 bg-white/10 rounded-full w-[90%]"></div>
                  <div className="h-4 bg-white/10 rounded-full w-[98%]"></div>
                  <div className="h-4 bg-white/10 rounded-full w-[85%]"></div>
                  <div className="h-4 bg-white/10 rounded-full w-[60%]"></div>
                </div>
              ) : (
                <div className="text-on-surface-variant text-base md:text-lg leading-relaxed space-y-6">
                  {summary ? (
                    summary.split('\n').filter(s => s.trim() !== '').map((line, i) => {
                      const isHeading = line.startsWith('[') && line.endsWith(']');
                      return (
                        <p key={i} className={`font-body font-normal ${isHeading ? 'text-primary font-bold mt-4' : 'text-on-surface'}`}>
                          {line}
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-error">요약 정보를 불러올 수 없는 기사입니다.</p>
                  )}

                  {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 notranslate">
                      <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/5 flex gap-4">
                        <span className="material-symbols-outlined text-secondary shrink-0">check_circle</span>
                        <div>
                          <p className="text-[10px] sm:text-xs font-bold text-neutral-300 mb-1 uppercase tracking-tighter">Fast Translation</p>
                          <p className="text-xs sm:text-sm text-neutral-400">Gemini 2.5 Flash Lite</p>
                        </div>
                      </div>
                      <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/5 flex gap-4">
                        <span className="material-symbols-outlined text-primary shrink-0">bolt</span>
                        <div>
                          <p className="text-[10px] sm:text-xs font-bold text-neutral-300 mb-1 uppercase tracking-tighter">Powered By</p>
                          <p className="text-xs sm:text-sm text-neutral-400">Orbit Intelligence</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom: Action Bar */}
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-2 flex flex-col md:flex-row items-center gap-3 sm:gap-4 border-t border-white/5 mt-4 notranslate">
              <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-primary to-secondary text-on-primary-fixed font-bold flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-95 transition-all group">
                <span>원문 읽기</span>
                <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
              </a>
              <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                <button 
                  onClick={() => handleToggleBookmark(selectedArticle)}
                  className={`flex-1 md:flex-none p-3.5 sm:p-4 rounded-full transition-all flex items-center justify-center gap-2 ${
                    bookmarks.includes(selectedArticle.url) 
                      ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                      : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}>
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: bookmarks.includes(selectedArticle.url) ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                  <span className="md:hidden text-xs font-bold">{bookmarks.includes(selectedArticle.url) ? 'Saved' : 'Save'}</span>
                </button>
                <button 
                  onClick={() => handleShare(selectedArticle)}
                  className="flex-1 md:flex-none p-3.5 sm:p-4 rounded-full bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-xl">share</span>
                  <span className="md:hidden text-xs font-bold">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full bg-surface-container-high/90 backdrop-blur-md border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 notranslate">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {toastMessage}
          </p>
        </div>
      )}
    </>
  );
}
