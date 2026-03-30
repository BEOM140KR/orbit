import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { adminAuth } from '@/lib/firebase/admin';

async function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error('API Auth Error:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    // 1. 유저 데이터 호출
    const user = await User.findOne({ uid: decodedToken.uid });
    let keywords: string[] = user?.keywords || [];

    // [기능 추가]: 등록된 키워드가 0개일 경우, 지정된 기본 대표 키워드 피드 구성
    if (keywords.length === 0) {
      keywords = ['IT/기술', '경제', '문화', '트렌드'];
    }

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!NEWS_API_KEY) {
      return NextResponse.json({ error: 'NEWS_API_KEY missing' }, { status: 500 });
    }

    // 2. 키워드별 병렬 Fetching (Vercel Edge Caching 지원 및 속도 최적화)
    const fetchPromises = keywords.map(async (kw: string) => {
      const apiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(kw)}&sortBy=publishedAt&pageSize=15&apiKey=${NEWS_API_KEY}`;
      
      // [기능 추가]: News API 서버 리밋 초과 우회용, 내부 30분(1800초) 캐시 설정
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Orbit-News-Curator/1.0' },
        next: { revalidate: 1800 } 
      });
      if (!res.ok) return [];
      
      const data = await res.json();
      return (data.articles || []).map((art: { 
        title: string; 
        description: string; 
        url: string; 
        urlToImage: string; 
        publishedAt: string;
        source: { name: string };
      }) => ({
        ...art,
        matchedKeyword: kw, 
      }));
    });

    const resultsArray = await Promise.all(fetchPromises);
    const allArticles = resultsArray.flat();

    // 3. 중복 제거 (URL 기준)
    const seenUrls = new Set<string>();
    const deduplicatedArticles = allArticles.filter((article) => {
      if (!article.url || article.url === 'https://removed.com') return false; 
      if (seenUrls.has(article.url)) return false;
      seenUrls.add(article.url);
      return true;
    });

    // 4. 시간순 강제 재정렬 (최신 상단)
    deduplicatedArticles.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return NextResponse.json({ articles: deduplicatedArticles.slice(0, 60) });
  } catch (error) {
    console.error('News Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch external news' }, { status: 500 });
  }
}
