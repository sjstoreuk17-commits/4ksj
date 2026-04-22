/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON parsing
  app.use(express.json());

// In-memory cache for Xtream data
let xtreamCache: Record<string, any> = {};
let lastFetch: number = 0;

  // API Proxy Route to bypass CORS and handle large payloads with caching
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    const useCache = req.query.cache === 'true';

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Check memory cache (ttl 1 hour)
    const now = Date.now();
    if (useCache && xtreamCache[targetUrl] && (now - lastFetch < 3600000)) {
      console.log(`[CACHE_HIT] ${targetUrl}`);
      return res.send(xtreamCache[targetUrl]);
    }

    // Bulletproof Fallback Engine
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
          signal: AbortSignal.timeout(15000), // Shorter timeout for faster fallback
          headers: {
            'User-Agent': 'IPTVSmartersPro',
            'Accept': '*/*',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (proxy.name === 'DIRECT' && response.status === 403) {
          console.warn(`[PROXY_ENGINE] Direct blocked (403), falling back...`);
          continue;
        }

        if (response.ok) {
          const content = await response.text();
          
          if (content.toLowerCase().includes('rate limit')) continue;

          // Simple caching for large lists (live/vod)
          if (useCache || content.length > 200000) {
            xtreamCache[targetUrl] = content;
            lastFetch = now;
          }

          const contentType = response.headers.get('Content-Type') || 'application/json';
          res.setHeader('Content-Type', contentType);
          res.setHeader('X-Proxy-Used', proxy.name);
          return res.send(content);
        } else {
          lastError = `Status ${response.status}`;
        }
      } catch (error: any) {
        console.error(`[PROXY_ENGINE] ${proxy.name} error: ${error.message}`);
        lastError = error.message;
      }
    }

    res.status(500).json({ error: 'Bulletproof Proxy Engine failure', details: lastError });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS Proxy active at http://localhost:${PORT}/api/proxy`);
  });
}

startServer();
