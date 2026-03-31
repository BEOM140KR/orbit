import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Summary from '@/lib/models/Summary';
import { adminAuth } from '@/lib/firebase/admin';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

// Gemini 초기화 여부 확인 로그
console.log('[DEBUG] Initializing GoogleGenAI client...');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch (e) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('\n=========================================');
  console.log('[DEBUG] 🔵 Summary POST request initiated.');
  
  const decodedToken = await verifyToken(req);
  if (!decodedToken) {
    console.log('[DEBUG] 🔴 Unauthorized Request blocked.');
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { url } = await req.json();
    console.log(`[DEBUG] 1. Request URL check: ${url}`);
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // SSRF Protection: Validate URL and blacklist internal IPs
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
         return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
      }
      const hostname = parsedUrl.hostname.toLowerCase();
      const blacklistedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
      if (blacklistedHosts.includes(hostname) || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
         return NextResponse.json({ error: 'Access to internal network is forbidden' }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Malformed URL' }, { status: 400 });
    }

    // 1. Double Cache (MongoDB)
    const cachedEntry = await Summary.findOne({ url });
    if (cachedEntry && cachedEntry.content) {
      console.log('[DEBUG] 🟢 Found existing summary in MongoDB cache. Returning immediately.');
      return NextResponse.json({ summary: cachedEntry.content, cached: true });
    }

    console.log(`[DEBUG] 2. No cache found. Initiating Scraping for: ${url}`);

    // 2. Scraping with Timeout
    let extractedText = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(url, { 
        headers: { 'User-Agent': 'Orbit-Bot/1.0 (Mozilla/5.0)' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // 스크래핑 강화를 위한 범용적 태그 선택자 조합
      extractedText = $('article, main, .article-body, .post-content, section, p')
        .map((i, el) => $(el).text())
        .get()
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); 

      console.log(`[DEBUG] 3. Scraped Raw Data length: ${extractedText.length} characters.`);
      if (extractedText.length < 50) {
        console.log(`[DEBUG] 🟡 WARNING: Extracted rawText is too small or empty! Might be blocked by target server.`);
        console.log(`[DEBUG] --> Raw Text Snippet: "${extractedText}"`);
      } else {
        console.log(`[DEBUG] --> Raw Text Snippet: "${extractedText.substring(0, 50)}..."`);
      }
    } catch (e) {
      console.error('[DEBUG] 🔴 Scraping error:', e);
    }

    const contentToSummarize = extractedText.length > 50 
      ? extractedText 
      : `원본 링크에서 본문 추출이 봇 차단에 의해 방어되었습니다. URL의 메타데이터와 컨텍스트를 최대한 추론하여 3줄로 적당한 뉴스 요약을 작성해주세요. URL: ${url}`;

    const prompt = `
      You are an expert news analyst and summarizer.
      Read the following article text extracted from the web.
      Provide a highly informative and structured analysis in Korean. 
      Follow this structure exactly (Use simple text format, no Markdown bold/headers inside):
      
      [주요 헤드라인]
      기사의 핵심을 찌르는 한 줄 요약
      
      [핵심 내용 분석]
      기사의 전체적인 흐름과 중요한 팩트를 3-5문장으로 상세히 설명하세요. 단순 요약이 아닌 깊이 있는 정보 전달이 목적입니다.
      
      [이 뉴스의 가치와 영향]
      이 정보가 독자에게 왜 중요한지, 어떤 변화나 영향을 미칠 수 있는지 분석하여 설명하세요.
      
      [한 줄 결론]
      기억해야 할 가장 중요한 포인트 하나.

      Article Text:
      ${contentToSummarize}
    `;

    console.log('[DEBUG] 4. Prompt Prepared, sending request to Gemini 1.5 Flash...');
    
    // 3. Gemini 통신 (호출 빈도와 가성비에 특화된 Lite 모델 적용)
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    
    // @google/genai SDK v0.1.1 은 result.text 로 결과에 접근함
    const aiSummary = result.text;
    
    console.log(`[DEBUG] 5. Gemini Response received:`);
    console.log(`[DEBUG] --> ${aiSummary}`);

    if (!aiSummary || aiSummary.trim() === '') {
      console.log('[DEBUG] 🔴 Gemini response text is empty!');
      return NextResponse.json({ error: 'AI Summary generated nothing.' }, { status: 500 });
    }

    console.log('[DEBUG] 6. Saving AI Summary to MongoDB...');
    // 4. DB 캐싱 저장 로직 (누락 위험 방지용 확실한 await)
    try {
      await Summary.create({ url, content: aiSummary });
      console.log('[DEBUG] 🟢 Successfully saved caching to MongoDB.');
    } catch (dbError) {
      console.error('[DEBUG] 🔴 MongoDB save Failed:', dbError);
    }

    console.log('[DEBUG] 7. Returning final JSON to frontend client.\n=========================================');
    
    // 5. 프론트로 내려가는 리턴 타입 (확실한 JSON.stringify 포맷)
    return NextResponse.json({ summary: aiSummary, cached: false });
  } catch (error) {
    console.error('[DEBUG] 🔴 FATAL Route Error:', error);
    return NextResponse.json({ error: 'Internal AI Server Error' }, { status: 500 });
  }
}
