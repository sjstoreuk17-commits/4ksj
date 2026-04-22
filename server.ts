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

    res.setHeader('Content-Type', 'application/json');
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
