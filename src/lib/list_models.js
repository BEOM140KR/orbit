const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function listAllModels() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKey = env.match(/GEMINI_API_KEY=(.*)/)?.[1]?.trim();

  if (!apiKey) {
    console.error('API KEY NOT FOUND');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // 1.5-flash 가 가장 저렴하고 한도가 높지만, 실제 사용 가능한 목록을 조회함
    console.log('--- SCANNING MODELS ---');
    const modelList = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 일단 연결 확인용
    // 실제 전체 모델 리스트 API 호출은 REST로 하는 것이 더 정확할 때가 많음
    console.log('Fetching available model list via REST...');
    
    const https = require('https');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log('AVAILABLE MODELS:');
        json.models.forEach(m => {
          console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`);
        });
        console.log('--- SCANNING COMPLETE ---');
      });
    });
  } catch (e) {
    console.error('FAILED TO FETCH MODELS:', e.message);
  }
}

listAllModels();
