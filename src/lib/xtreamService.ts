/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XtreamAuth, XtreamCategory, XtreamStream, XtreamSeries, XtreamSeriesInfo, XtreamEpisode } from '../types';
import { fetchApiData } from '../services/proxyEngine';

export class XtreamService {
  private auth: XtreamAuth;
  private m3uAuth?: XtreamAuth;

  constructor(auth: XtreamAuth, m3uAuth?: XtreamAuth) {
    this.auth = {
      ...auth,
      url: auth.url.endsWith('/') ? auth.url.slice(0, -1) : auth.url
    };
    if (m3uAuth) {
      this.m3uAuth = {
        ...m3uAuth,
        url: m3uAuth.url.endsWith('/') ? m3uAuth.url.slice(0, -1) : m3uAuth.url
      };
    }
  }

  setM3UAuth(auth: XtreamAuth) {
    this.m3uAuth = {
      ...auth,
      url: auth.url.endsWith('/') ? auth.url.slice(0, -1) : auth.url
    };
  }

  private async fetchAction<T>(action: string, extraParams: Record<string, string | number> = {}, useCache: boolean = false): Promise<T> {
    const params = new URLSearchParams({
      username: this.auth.username,
      password: this.auth.password,
      action,
      ...Object.entries(extraParams).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    });

    const targetUrl = `${this.auth.url}/player_api.php?${params.toString()}`;
    return fetchApiData(targetUrl, useCache);
  }

  async testConnection(): Promise<any> {
    return this.fetchAction('get_live_categories');
  }

  async getVodCategories(): Promise<XtreamCategory[]> {
    return this.fetchAction<XtreamCategory[]>('get_vod_categories');
  }

  async getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.fetchAction<XtreamCategory[]>('get_series_categories');
  }

  async getVodStreams(categoryId?: string): Promise<XtreamStream[]> {
    return this.fetchAction<XtreamStream[]>('get_vod_streams', categoryId ? { category_id: categoryId } : {});
  }

  async getSeries(categoryId?: string): Promise<XtreamSeries[]> {
    return this.fetchAction<XtreamSeries[]>('get_series', categoryId ? { category_id: categoryId } : {});
  }

  async getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo> {
    return this.fetchAction<XtreamSeriesInfo>('get_series_info', { series_id: seriesId });
  }

  async getVodInfo(vodId: number): Promise<any> {
    return this.fetchAction<any>('get_vod_info', { vod_id: vodId });
  }

  private forceHttp(url: string, forcePort80: boolean = false): string {
    let processed = url;
    if (processed.startsWith('https:')) {
      processed = processed.replace('https:', 'http:');
    }
    
    // Add port 80 ONLY if requested (for admin domain) and no port is specified
    if (forcePort80) {
      try {
        const urlObj = new URL(processed);
        if (!urlObj.port && urlObj.protocol === 'http:') {
          const protocolEnd = processed.indexOf('://') + 3;
          const firstSlash = processed.indexOf('/', protocolEnd);
          if (firstSlash === -1) {
            processed = processed + ':80';
          } else {
            processed = processed.substring(0, firstSlash) + ':80' + processed.substring(firstSlash);
          }
        }
      } catch (e) {
        // Fallback
      }
    }
    
    return processed;
  }

  generateM3ULink(streamId: string | number, extension: string = 'ts', type: 'movie' | 'series' | 'live' = 'movie'): string {
    const typePath = type === 'series' ? 'series' : type === 'movie' ? 'movie' : 'live';
    const cleanExtension = extension.startsWith('.') ? extension.slice(1) : extension;
    
    const activeAuth = this.m3uAuth || this.auth;
    const url = `${activeAuth.url}/${typePath}/${activeAuth.username}/${activeAuth.password}/${streamId}.${cleanExtension || 'ts'}`;
    
    // Only force port 80 if we are using the admin export credentials
    const isUsingAdminExport = !!this.m3uAuth && activeAuth.url.includes('sjstorestar4k.store');
    return this.forceHttp(url, isUsingAdminExport);
  }

  generateCategoryM3U(items: (XtreamStream | XtreamSeries)[], type: 'movie' | 'series'): string {
    let m3u = "#EXTM3U\r\n";
    items.forEach(item => {
      const id = 'stream_id' in item ? item.stream_id : item.series_id;
      const ext = 'container_extension' in item ? item.container_extension : 'mp4';
      const url = this.generateM3ULink(id, ext, type);
      const icon = 'stream_icon' in item ? item.stream_icon : item.cover;
      m3u += `#EXTINF:-1 tvg-id="" tvg-name="${item.name}" tvg-logo="${icon}" group-title="${type.toUpperCase()}",${item.name}\r\n${url}\r\n`;
    });
    return m3u;
  }

  generateSeriesM3U(name: string, cover: string, episodes: XtreamEpisode[]): string {
    let m3u = "#EXTM3U\r\n";
    episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode_num - b.episode_num;
    });

    episodes.forEach(ep => {
      const url = this.generateM3ULink(ep.id, ep.container_extension, 'series');
      const seasonPrefix = ep.season < 10 ? `S0${ep.season}` : `S${ep.season}`;
      const episodePrefix = ep.episode_num < 10 ? `E0${ep.episode_num}` : `E${ep.episode_num}`;
      const epName = `${name} ${seasonPrefix} ${episodePrefix}`;
      // Standard attributes for OTT Panels
      m3u += `#EXTINF:-1 tvg-id="" tvg-name="${epName}" tvg-logo="${cover}" group-title="${name}",${epName}\r\n${url}\r\n`;
    });
    return m3u;
  }

  async getBatchSeriesEpisodes(seriesList: XtreamSeries[]): Promise<string> {
    let combinedM3U = "#EXTM3U\r\n";
    
    // Process in smaller batches to avoid overloading
    const batchSize = 10;
    for (let i = 0; i < seriesList.length; i += batchSize) {
      const batch = seriesList.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (s) => {
          try {
            const info = await this.getSeriesInfo(s.series_id);
            const episodes = Object.values(info.episodes).flat();
            return this.generateSeriesM3U(s.name, s.cover, episodes).replace("#EXTM3U\r\n", "");
          } catch (e) {
            console.error(`Failed to fetch episodes for ${s.name}`, e);
            return "";
          }
        })
      );
      combinedM3U += batchResults.join("");
    }
    
    return combinedM3U;
  }
}
