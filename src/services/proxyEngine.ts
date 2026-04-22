/**
 * Bulletproof Proxy Engine
 * Fallback chain: Direct -> CodeTabs -> AllOrigins -> CORSProxy.io
 */

const CACHE_PREFIX = 'iptv_cache_';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  data: any;
  timestamp: number;
}

/**
 * Encodes URL strictly as per user requirement
 */
function encodeTargetUrl(url: string): string {
  return encodeURIComponent(url);
}

/**
 * Fetch with fallback mechanism
 */
export async function fetchApiData(url: string, useCache: boolean = true): Promise<any> {
  // 1. Check Cache
  if (useCache) {
    const cached = localStorage.getItem(CACHE_PREFIX + url);
    if (cached) {
      const parsed: CachedData = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
        console.log('[PROXY] Serving from cache:', url);
        return parsed.data;
      }
    }
  }

  const encodedUrl = encodeTargetUrl(url);
  const fallbacks = [
    // Step 1: Direct (Might fail CORS in browser, but following request)
    async () => {
      console.log('[PROXY] Attempting Direct Fetch...');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Direct fetch failed');
      const text = await response.text();
      try { return JSON.parse(text); } catch (e) { return text; }
    },
    // Step 2: CodeTabs Proxy
    async () => {
      console.log('[PROXY] Attempting CodeTabs...');
      const response = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodedUrl}`);
      if (!response.ok) throw new Error('CodeTabs failed');
      const text = await response.text();
      try { return JSON.parse(text); } catch (e) { return text; }
    },
    // Step 3: AllOrigins Proxy
    async () => {
      console.log('[PROXY] Attempting AllOrigins...');
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodedUrl}`);
      if (!response.ok) throw new Error('AllOrigins failed');
      const text = await response.text();
      try { return JSON.parse(text); } catch (e) { return text; }
    },
    // Step 4: CORSProxy.io
    async () => {
      console.log('[PROXY] Attempting CORSProxy.io...');
      const response = await fetch(`https://corsproxy.io/?${encodedUrl}`);
      if (!response.ok) throw new Error('CORSProxy.io failed');
      const text = await response.text();
      try { return JSON.parse(text); } catch (e) { return text; }
    }
  ];

  let lastError: any = null;
  for (const attempt of fallbacks) {
    try {
      const data = await attempt();
      
      // If it's a string (M3U), don't try to parse as JSON if it's already a string
      let processedData = data;
      if (typeof data === 'string') {
        try {
          processedData = JSON.parse(data);
        } catch (e) {
          // Keep as string (likely M3U content)
        }
      }

      // Save to Cache
      if (useCache) {
        localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({
          data: processedData,
          timestamp: Date.now()
        }));
      }
      
      return processedData;
    } catch (err) {
      console.warn('[PROXY] Attempt failed, moving to next...', err);
      lastError = err;
    }
  }

  throw lastError || new Error('All proxy attempts failed');
}
