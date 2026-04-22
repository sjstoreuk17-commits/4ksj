import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Fallback proxy list
  const proxies = [
    { name: 'DIRECT', url: targetUrl },
    { name: 'CODETABS', url: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}` },
    { name: 'ALLORIGINS', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}` },
    { name: 'CORSPROXY', url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` }
  ];

  let lastError = null;

  for (const proxy of proxies) {
    try {
      console.log(`[PROXY_ENGINE] Attempting ${proxy.name} for: ${targetUrl}`);
      
      const response = await fetch(proxy.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'IPTVSmartersPro',
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const content = await response.text();
        
        // Ensure we don't return an error page from the proxy itself
        if (content.toLowerCase().includes('rate limit') || content.toLowerCase().includes('too many requests')) {
          console.warn(`[PROXY_ENGINE] ${proxy.name} returned rate limit, trying next...`);
          continue;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Proxy-Used', proxy.name);
        
        const contentType = response.headers.get('Content-Type') || 'text/plain';
        res.setHeader('Content-Type', contentType);
        
        return res.send(content);
      } else {
        console.warn(`[PROXY_ENGINE] ${proxy.name} failed with status: ${response.status}`);
        lastError = `Status ${response.status}`;
      }
    } catch (error: any) {
      console.error(`[PROXY_ENGINE] ${proxy.name} error: ${error.message}`);
      lastError = error.message;
    }
  }

  res.status(500).json({ 
    error: 'Bulletproof Proxy Engine failed all fallbacks', 
    details: lastError,
    target: targetUrl
  });
}
