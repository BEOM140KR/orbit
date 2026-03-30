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

export default function OrbitNewsCurator() {
  const { user, loading: authLoading } = useAuth();
  
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Modal & AI States
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 공통 Fetch 로직
  const fetchNews = useCallback(async () => {
    if (!user) return;
    setNewsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/news', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (e) { console.error('Error news:', e); } 
    finally { setNewsLoading(false); }
  }, [user]);

  const fetchKeywords = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/keywords', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
        fetchNews();
      }
    } catch (e) { console.error('Error kw:', e); } 
    finally { setDataLoading(false); }
  }, [user, fetchNews]);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  const saveKeywordsToDB = async (updatedKeywords: string[]) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keywords: updatedKeywords }),
      });
      fetchNews(); 
    } catch (e) { console.error('Error save:', e); }
  };

  const handleAddKeyword = () => {
    const text = newKeyword.trim();
    if (!text || keywords.includes(text)) return;
    const newArray = [...keywords, text];
    setKeywords(newArray);
    setNewKeyword('');
    saveKeywordsToDB(newArray);
  };

  const handleRemoveKeyword = (targetKw: string) => {
    const newArray = keywords.filter((kw) => kw !== targetKw);
    setKeywords(newArray);
    saveKeywordsToDB(newArray);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // 모달(상세보기) 핸들러
  const handleCardClick = async (e: React.MouseEvent, article: Article) => {
    e.preventDefault(); // 기본 링크 이동 방어
    setSelectedArticle(article);
    setSummary(null);
    setIsSummarizing(true);
    
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

  if (authLoading) return <div className="loadingContainer">Auth Sync...</div>;

  if (!user) {
    return (
      <main className="guestContainer">
        <div className="heroCard">
          <h1 className="title">Orbit MVP</h1>
          <p className="subtitle">AI Curated News & Translation Dashboard.</p>
          <button onClick={handleLogin} className="loginButton">Sign In with Google</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboardContainer">
      <header className="header">
        <h2>Orbit Dashboard</h2>
        <div className="userConfig">
          <span className="userEmail">{user.email}</span>
          <button onClick={() => signOut(auth)} className="logoutButton">Log out</button>
        </div>
      </header>

      {/* 키워드 영역 */}
      <section className="keywordSection">
        <h3>My Target Topics</h3>
        <div className="inputGroup">
          <input 
            value={newKeyword} 
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            placeholder="예: 클라우드, 해외주식" 
            className="keywordInput"
          />
          <button onClick={handleAddKeyword} className="addButton">추가</button>
        </div>
        
        {dataLoading ? (
           <p className="loadingText">연동 정보를 확인중...</p>
        ) : (
          <div className="chipContainer">
            {keywords.length === 0 && <span className="emptyText">등록된 키워드가 없습니다. 기본(IT, 경제, 문화) 피드가 로드됩니다.</span>}
            {keywords.map((kw) => (
              <span key={kw} onClick={() => handleRemoveKeyword(kw)} className="chip">
                  {kw} <span className="closeIcon">✕</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 뉴스 피드 */}
      <section className="feedSection">
        <div className="feedHeader">
           <h3>Live Pipeline</h3>
           <button onClick={fetchNews} className="refreshButton">🔄 갱신</button>
        </div>
        
        {newsLoading ? (
          <div className="spinner">빅데이터를 긁어오고 알고리즘을 최적화하는 중입니다...</div>
        ) : articles.length > 0 ? (
          <div className="newsGrid">
             {articles.map((article, index) => (
               <a 
                 key={index} 
                 href={article.url} 
                 onClick={(e) => handleCardClick(e, article)} 
                 className="newsCard"
               >
                 {article.urlToImage && (
                   <div className="imageWrapper">
                      <img src={article.urlToImage} alt={article.title} />
                   </div>
                 )}
                 <div className="cardContent">
                    <span className="badge">{article.matchedKeyword}</span>
                    <h4 className="cardTitle">{article.title}</h4>
                    <p className="cardDesc">{article.description?.slice(0, 100)}...</p>
                    <div className="cardFooter">
                       <span className="source">{article.source.name}</span>
                       <span className="date">{new Date(article.publishedAt).toLocaleDateString()}</span>
                    </div>
                 </div>
               </a>
             ))}
          </div>
        ) : (
          <p className="emptyNews">뉴스 소스를 찾고 있습니다. 잠시 후 다시 갱신해주세요.</p>
        )}
      </section>

      {/* 모달(상세보기 & AI 요약) */}
      {selectedArticle && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <button className="modalCloseBtn" onClick={closeModal}>✕</button>
            <div className="modalHeader">
              {selectedArticle.urlToImage && <img src={selectedArticle.urlToImage} alt="news cover" className="modalImg" />}
              <h2 className="modalTitle">{selectedArticle.title}</h2>
            </div>
            <div className="modalBody">
              <div className="aiBadge">✨ Gemini 2.5 Flash Lite 초고속 한글 요약 및 번역</div>
              {isSummarizing ? (
                <div className="skeletonBox">
                  <div className="skeletonLine"></div>
                  <div className="skeletonLine"></div>
                  <div className="skeletonLine short"></div>
                </div>
              ) : (
                <div className="summaryBox">
                  {summary ? (
                    summary.split('\n').filter(s => s.trim() !== '').map((line, i) => (
                      <p key={i} className="summaryLine">{line}</p>
                    ))
                  ) : (
                    <p>내용을 불러올 수 없습니다.</p>
                  )}
                </div>
              )}
            </div>
            <div className="modalFooter">
              <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="originalLinkBtn">
                  📰 원문 웹사이트에서 읽기
              </a>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { margin: 0; padding: 0; background-color: #0d0d0d; color: #ededed; font-family: 'Inter', sans-serif; }
        .loadingContainer, .guestContainer { display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; }
        .dashboardContainer { max-width: 1000px; margin: 0 auto; padding: 2rem; }
        .loginButton { padding: 0.8rem 1.8rem; font-size: 1.1rem; font-weight: 500; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .loginButton:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255,255,255,0.2); }
        .logoutButton { padding: 0.5rem 1rem; background: transparent; border: 1px solid #444; color: #bbb; border-radius: 4px; cursor: pointer; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 1rem; margin-bottom: 2rem; }
        .keywordSection { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 1.5rem; margin-bottom: 2.5rem; backdrop-filter: blur(10px); }
        .inputGroup { display: flex; gap: 0.8rem; margin-bottom: 1.5rem; }
        .keywordInput { flex: 1; padding: 0.8rem; background: #1a1a1a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 1rem; outline: none; }
        .addButton { background: #fff; color: #000; padding: 0 1.5rem; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }
        .chipContainer { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .chip { background: #2a2a2a; color: #dedede; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; cursor: pointer; display: flex; gap: 0.4rem; }
        .chip:hover { background: #3a3a3a; transform: translateY(-1px); }
        .closeIcon { color: #888; } .chip:hover .closeIcon { color: #ff4d4d; }
        .feedHeader { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #333; padding-bottom: 0.5rem; margin-bottom: 2rem; }
        .refreshButton { background: none; border: none; color: #aaa; cursor: pointer; transition: color 0.2s; }
        .newsGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .newsCard { display: flex; flex-direction: column; background: #161616; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .newsCard:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-color: #444; }
        .imageWrapper { height: 160px; overflow: hidden; }
        .imageWrapper img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
        .newsCard:hover .imageWrapper img { transform: scale(1.05); }
        .cardContent { padding: 1.2rem; display: flex; flex-direction: column; flex: 1; }
        .badge { align-self: flex-start; background: #004d40; color: #80cbc4; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.8rem; }
        .cardTitle { font-size: 1.05rem; line-height: 1.4; margin: 0 0 0.5rem 0; font-weight: 600; color: #fff; }
        .cardDesc { font-size: 0.9rem; color: #999; line-height: 1.5; flex: 1; margin: 0 0 1rem 0; }
        .cardFooter { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #666; padding-top: 1rem; border-top: 1px solid #2a2a2a; }

        /* Modal Styles */
        .modalOverlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 999; display: flex; justify-content: center; align-items: center; padding: 1rem; }
        .modalContent { background: #1a1a1a; width: 100%; max-width: 600px; border-radius: 16px; overflow: hidden; position: relative; border: 1px solid #333; box-shadow: 0 20px 40px rgba(0,0,0,0.8); animation: fadeUp 0.3s ease-out; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .modalCloseBtn { position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.5); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; justify-content: center; align-items: center; z-index: 10; transition: background 0.2s; }
        .modalCloseBtn:hover { background: rgba(255,255,255,0.2); }
        .modalHeader { position: relative; }
        .modalImg { width: 100%; height: 200px; object-fit: cover; opacity: 0.8; mask-image: linear-gradient(to top, transparent, black); -webkit-mask-image: linear-gradient(to top, transparent, black); }
        .modalTitle { position: absolute; bottom: 1rem; left: 1.5rem; right: 1.5rem; margin: 0; font-size: 1.3rem; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); line-height: 1.4; }
        .modalBody { padding: 1.5rem; }
        .aiBadge { display: inline-block; background: linear-gradient(90deg, #1A2980 0%, #26D0CE 100%); color: #fff; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(38,208,206,0.3); }
        .summaryBox { background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; border-left: 4px solid #26D0CE; font-size: 1.05rem; line-height: 1.7; color: #e0e0e0; }
        .summaryLine { margin-bottom: 0.8rem; }
        .summaryLine:last-child { margin-bottom: 0; }
        
        /* Skeleton Animation */
        .skeletonBox { display: flex; flex-direction: column; gap: 0.8rem; padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: 8px; }
        .skeletonLine { height: 16px; background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 4px; }
        .skeletonLine.short { width: 60%; }
        @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .modalFooter { padding: 1rem 1.5rem 1.5rem; display: flex; justify-content: flex-end; }
        .originalLinkBtn { background: #fff; color: #000; text-decoration: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; transition: transform 0.2s, background 0.2s; }
        .originalLinkBtn:hover { transform: translateY(-2px); background: #eee; }
      `}} />
    </main>
  );
}
