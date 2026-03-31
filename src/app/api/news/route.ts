import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { adminAuth } from '@/lib/firebase/admin';
import { GoogleGenAI } from '@google/genai';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // 1. 유저 데이터 호출
    const user = await User.findOne({ uid: decodedToken.uid });
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    
    // 키워드 최대 5개 반영 (모델에서 긁어올 때의 정합성 유지)
    let keywords: string[] = user?.keywords?.slice(0, 5) || [];

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!NEWS_API_KEY) {
      return NextResponse.json({ error: 'NEWS_API_KEY missing' }, { status: 500 });
    }

    // [트렌딩 모드]: 인기 뉴스 10선
    if (mode === 'trending' || keywords.length === 0) {
      const trendingRes = await fetch(
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${NEWS_API_KEY}`,
        { next: { revalidate: 3600 } }
      );
      const trendingData = await trendingRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const articles = (trendingData.articles || []).map((art: any) => ({
        ...art,
        matchedKeyword: 'Trending',
        isTrending: true
      }));
      return NextResponse.json({ articles });
    }

    // [개인화 모드]: 등록된 키워드별 뉴스 병렬 호출
    const newsPromises = keywords.map(async (kw) => {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(kw)}&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`,
        { next: { revalidate: 1800 } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.articles || []).map((art: any) => ({
        ...art,
        matchedKeyword: kw,
      }));
    });

    const results = await Promise.all(newsPromises);
    const allArticles = results.flat();

    // 중복 제거 및 시간순 정렬
    const uniqueArticles = Array.from(new Map(allArticles.map(a => [a.url, a])).values());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uniqueArticles.sort((a: any, b: any) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return NextResponse.json({ articles: uniqueArticles });
  } catch (error) {
    console.error('News API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
