/**
 * Multi-Language Series Merger Service
 * Generates a unified M3U that combines multiple series into one for OTT panels.
 */

import { XtreamSeries, XtreamEpisode, XtreamSeriesInfo } from '../types';
import { XtreamService } from '../lib/xtreamService';

export interface MergedSeriesItem {
  series: XtreamSeries;
  language: string;
}

export class MergerService {
  private xtream: XtreamService;

  constructor(xtream: XtreamService) {
    this.xtream = xtream;
  }

  /**
   * Generates a single M3U file representing multiple series as different seasons of one series.
   * @param masterName The name that will be displayed in the OTT panel
   * @param items List of series with their associated language labels
   * @param onProgress Callback for tracking progress
   */
  async generateMergedM3U(
    masterName: string, 
    items: MergedSeriesItem[], 
    onProgress?: (msg: string) => void
  ): Promise<string> {
    let combinedM3U = "#EXTM3U\r\n";
    
    // Fetch all series info in parallel for speed
    onProgress?.(`INITIATING_PARALLEL_FETCH: Processing ${items.length} Series...`);
    
    const results = await Promise.all(items.map(async (item, idx) => {
      const { series, language } = item;
      const seasonValue = idx + 1;
      
      try {
        onProgress?.(`FETCHING_DATA: [${language}] ${series.name}...`);
        const info = await this.xtream.getSeriesInfo(series.series_id);
        const allEpisodes = Object.values(info.episodes).flat();
        
        // Sort episodes
        allEpisodes.sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episode_num - b.episode_num;
        });

        let entries = "";
        for (const ep of allEpisodes) {
          const url = this.xtream.generateM3ULink(ep.id, ep.container_extension, 'series');
          
          // Use ORIGINAL season and episode numbers from the server
          const sNum = ep.season < 10 ? `0${ep.season}` : ep.season;
          const eNum = ep.episode_num < 10 ? `0${ep.episode_num}` : ep.episode_num;
          const pattern = `S${sNum} E${eNum}`;
          
          // Identity MUST be the original series name to prevent grouping them together
          // tvg-name and display name must match the original format
          const entryName = `${series.name} ${pattern}`;
          
          // Critical: series-name must be the ORIGINAL series name for each item
          // We remove the masterName override for bulk export mode
          const metadata = `series-name="${series.name}" season-number="${ep.season}" episode-number="${ep.episode_num}"`;
          
          entries += `#EXTINF:-1 tvg-id="" tvg-name="${entryName}" group-title="${series.name}" ${metadata},${entryName}\r\n${url}\r\n`;
        }
        
        return entries;
      } catch (err) {
        onProgress?.(`ERR: FAILED_TO_FETCH [${language}] ${series.name}`);
        return "";
      }
    }));
    
    combinedM3U += results.filter(Boolean).join("");
    return combinedM3U;
  }
}
