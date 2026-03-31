const fs = require('fs');
const https = require('https');

async function testApis() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const newsApiKey = env.match(/NEWS_API_KEY=(.*)/)?.[1]?.trim();
  const geminiApiKey = env.match(/GEMINI_API_KEY=(.*)/)?.[1]?.trim();

  console.log('--- DIAGNOSTIC START ---');

  // 1. NewsAPI Test
  if (newsApiKey) {
    const newsUrl = `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${newsApiKey}`;
    https.get(newsUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.status === 'ok') {
          console.log('[NewsAPI] SUCCESS: News articles are being fetched correctly.');
        } else {
          console.error(`[NewsAPI] FAILED: ${json.message || json.code}`);
        }
      });
    }).on('error', (err) => console.error(`[NewsAPI] ERROR: ${err.message}`));
  }

  // 2. Gemini API Test
  if (geminiApiKey) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const payload = JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] });
    
    const req = https.request(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('[Gemini] SUCCESS: API key is ALIVE and responding.');
          } else {
            console.error(`[Gemini] FAILED (${res.statusCode}): ${json.error?.message || 'Quota or Auth Error'}`);
          }
        } catch (e) {
          console.error('[Gemini] Parsing Error:', data);
        }
      });
    });
    req.on('error', (err) => console.error(`[Gemini] ERROR: ${err.message}`));
    req.write(payload);
    req.end();
  }
}

testApis();
