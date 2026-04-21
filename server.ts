/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache for Xtream data
let xtreamCache: Record<string, any> = {};
let lastFetch: number = 0;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Simple request logger for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development', timestamp: new Date().toISOString() });
  });

// API Proxy Route to bypass CORS and handle large payloads with caching
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  const useCache = req.query.cache === 'true';

  if (!targetUrl) {
    console.warn('[PROXY_ERROR] Missing URL parameter');
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
    const response = await fetch(targetUrl, { 
      signal: AbortSignal.timeout(30000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': targetUrl.split('?')[0]
      }
    });
    
    if (!response.ok) {
      console.warn(`[PROXY_WARNING] External server ${targetUrl} returned ${response.status}`);
      return res.status(response.status).json({ 
        error: `External server responded with status: ${response.status}`,
        url: targetUrl 
      });
    }

    const content = await response.text();
    
    // Simple caching for large lists (live/vod)
    if (useCache || content.length > 100000) {
      xtreamCache[targetUrl] = content;
      lastFetch = now;
    }

    // Try to detect if it's JSON
    try {
      JSON.parse(content);
      res.setHeader('Content-Type', 'application/json');
    } catch (e) {
      // Not JSON, maybe M3U or text
      res.setHeader('Content-Type', 'text/plain');
    }
    
    res.send(content);
  } catch (error: any) {
    console.error(`[PROXY_CRITICAL]: ${error.message} while fetching ${targetUrl}`);
    res.status(500).json({ error: 'Failed to fetch external URL', details: error.message });
  }
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
    
    // Explicit 404 for missing API routes to prevent HTML leaking into JSON fetches
    app.all('/api/*', (req, res) => {
      res.status(404).json({ error: 'API route not found', path: req.path });
    });

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
