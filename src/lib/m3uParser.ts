/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { M3UEntry, M3UPlaylist } from '../types';

export function parseM3U(content: string): M3UPlaylist {
  const lines = content.split('\n');
  const entries: M3UEntry[] = [];
  const categories = new Set<string>();

  let currentEntry: Partial<M3UEntry> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      const extinf = line;
      
      // Parse attributes
      const nameMatch = extinf.match(/tvg-name="([^"]*)"/) || extinf.match(/,([^,]*)$/);
      const logoMatch = extinf.match(/tvg-logo="([^"]*)"/);
      const groupMatch = extinf.match(/group-title="([^"]*)"/);

      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      const logo = logoMatch ? logoMatch[1] : undefined;
      const group = groupMatch ? groupMatch[1] : 'Uncategorized';

      categories.add(group);

      currentEntry = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        logo,
        group,
        raw: extinf
      };
    } else if (line && !line.startsWith('#')) {
      if (currentEntry) {
        currentEntry.url = line;
        currentEntry.raw += '\n' + line;
        
        // Advanced heuristic for type
        const lowerGroup = currentEntry.group?.toLowerCase() || '';
        const lowerName = currentEntry.name?.toLowerCase() || '';
        const lowerUrl = currentEntry.url?.toLowerCase() || '';
        
        let type: M3UEntry['type'] = 'unknown';
        const isVideoFile = /\.(mp4|mkv|avi|mov|wmv|flv|mpg|mpeg|ts|m4v)$/i.test(lowerUrl);
        const hasSeriesKey = lowerName.includes(' s') && lowerName.includes('e') && /\s[sS]\d+[eE]\d+/.test(lowerName); // S01E01 pattern

        if (lowerGroup.includes('movie') || lowerGroup.includes('film') || lowerGroup.includes('vod') || lowerGroup.includes('cinema')) {
          type = 'movie';
        } else if (lowerGroup.includes('series') || lowerGroup.includes('show') || lowerGroup.includes('season') || hasSeriesKey) {
          type = 'series';
        } else if (lowerGroup.includes('live') || lowerGroup.includes('tv') || lowerUrl.includes('.m3u8')) {
          type = 'live';
        } else if (isVideoFile) {
          // If it's a file extension and not clearly a series, default to movie
          type = 'movie';
        }

        entries.push({ ...currentEntry, type } as M3UEntry);
        currentEntry = null;
      }
    }
  }

  const movieCount = entries.filter(e => e.type === 'movie').length;
  const seriesCount = entries.filter(e => e.type === 'series').length;

  return {
    entries,
    categories: Array.from(categories).sort(),
    stats: {
      totalEntries: entries.length,
      movieCount,
      seriesCount,
      categoryCount: categories.size
    }
  };
}

export function downloadM3U(name: string, content: string) {
  const blob = new Blob(['#EXTM3U\n' + content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]/gi, '_')}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string) {
  // Automatically downgrade https to http for all links as requested
  let processedText = text.replace(/https:\/\//g, 'http://');
  
  // ONLY inject :80 if it's the specific admin domain and no port is specified
  processedText = processedText.replace(/(http:\/\/sjstorestar4k\.store)([^\/\s]*)/g, (match, origin, path) => {
    if (!origin.includes(':', 7) && !path.startsWith(':')) {
      return origin + ':80' + path;
    }
    return match;
  });
  
  navigator.clipboard.writeText(processedText);
}
