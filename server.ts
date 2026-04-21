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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Fully open CORS to allow hosting basically anywhere (Hugging Face, custom domains, etc)
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));

  // Middleware for JSON parsing
  app.use(express.json());

  // Health check for remote monitoring
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'online', 
      origin: req.headers.origin || 'unknown',
      host: req.headers.host,
      timestamp: new Date().toISOString() 
    });
  });

// In-memory cache for Xtream data
let xtreamCache: Record<string, any> = {};
let lastFetch: number = 0;

// API Proxy Route to bypass CORS and handle large payloads with caching
app.all('/api/proxy', async (req, res) => {
  const targetUrl = (req.query.url || req.body.url) as string;
  const useCache = req.query.cache === 'true' || req.body.cache === true;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Set broad CORS headers for this specific route as well
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Check cache (ttl 1 hour)
  const now = Date.now();
  if (useCache && xtreamCache[targetUrl] && (now - lastFetch < 3600000)) {
    console.log(`[CACHE_HIT] ${targetUrl}`);
    return res.send(xtreamCache[targetUrl]);
  }

  try {
    console.log(`[PROXY] Fetching: ${targetUrl}`);
    
    // Pass User-Agent to avoid being blocked by IPTV servers
    const response = await fetch(targetUrl, { 
      signal: AbortSignal.timeout(60000), // Increased to 60s for slow M3U loads
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    });
    
    if (!response.ok) {
      console.error(`[PROXY_WARN] Target returned ${response.status}`);
      return res.status(response.status).json({ 
        error: `External server responded with status: ${response.status}`,
        url: targetUrl
      });
    }

    const content = await response.text();
    
    // Simple caching for large lists (live/vod)
    if (useCache || content.length > 50000) {
      xtreamCache[targetUrl] = content;
      lastFetch = now;
    }

    // Determine type from content or extension
    if (content.trim().startsWith('#EXTM3U')) {
      res.setHeader('Content-Type', 'text/plain');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(content);
  } catch (error: any) {
    console.error(`[PROXY_ERROR]: ${error.message}`);
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
