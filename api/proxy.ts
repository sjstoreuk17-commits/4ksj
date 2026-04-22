import type { VercelRequest, VercelResponse } from '@vercel/node';

let xtreamCache: Record<string, string> = {};
let lastFetch: number = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetUrl = req.query.url as string;
  const useCache = req.query.cache === 'true';

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Check cache (ttl 1 hour)
  const now = Date.now();
  if (useCache && xtreamCache[targetUrl] && (now - lastFetch < 3600000)) {
    console.log(`[CACHE_HIT] ${targetUrl}`);
    return res.send(xtreamCache[targetUrl]);
  }

  try {
    console.log(`[PROXY] Fetching: ${targetUrl}`);
    const response = await fetch(targetUrl, { signal: AbortSignal.timeout(30000) });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `External server responded with status: ${response.status}` 
      });
    }

    const content = await response.text();
    
    // Simple caching for large lists (live/vod)
    if (useCache || content.length > 100000) {
      xtreamCache[targetUrl] = content;
      lastFetch = now;
    }

    // Set permissive CORS just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'text/plain'); // Sending raw text/json from IPTV can be tricky, text/plain is safest
    res.send(content);
  } catch (error: any) {
    console.error(`[PROXY_ERROR]: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch external URL', details: error.message });
  }
}
