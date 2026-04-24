/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XtreamService } from '../lib/xtreamService';
import { XtreamEpisode, XtreamSeriesInfo } from '../types';

export interface SyncReport {
  found: boolean;
  masterSeriesId?: number;
  missingEpisodes: { season: number; episode: number; title: string; streamId: string | number; extension: string }[];
  matchCount: number;
  totalMasterEpisodes: number;
  totalCurrentEpisodes: number;
  seasonsReport: { season: string; currentCount: number; masterCount: number; status: 'match' | 'mismatch' | 'missing' }[];
  missingM3U: string;
}

const MASTER_AUTH = {
    url: 'https://4ksj.store',
    username: 'webplayer44',
    password: '62246624'
};

export class MasterSyncService {
  private masterXtream: XtreamService;

  constructor() {
    this.masterXtream = new XtreamService(MASTER_AUTH);
  }

  async checkSeriesSync(targetName: string, currentEpisodes: XtreamEpisode[], currentSvc: XtreamService): Promise<SyncReport> {
    try {
      const allMasterSeries = await this.masterXtream.getSeries();
      
      const normalizedTarget = targetName.toLowerCase().replace(/\s+/g, '');
      const match = allMasterSeries.find(s => {
        const normalizedName = s.name.toLowerCase().replace(/\s+/g, '');
        return normalizedName === normalizedTarget || normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
      });

      if (!match) {
        let fullM3U = "#EXTM3U\r\n";
        currentEpisodes.forEach(ep => {
          const link = currentSvc.generateM3ULink(ep.id, ep.container_extension, 'series');
          fullM3U += `#EXTINF:-1, ${targetName} - S${ep.season}E${ep.episode_num} - ${ep.title}\r\n${link}\r\n`;
        });

        return {
          found: false,
          missingEpisodes: [],
          matchCount: 0,
          totalMasterEpisodes: 0,
          totalCurrentEpisodes: currentEpisodes.length,
          seasonsReport: [],
          missingM3U: fullM3U
        };
      }

      const masterInfo = await this.masterXtream.getSeriesInfo(match.series_id);
      if (!masterInfo) {
        throw new Error("Could not retrieve series info from Master.");
      }
      const masterEpisodesMap = masterInfo.episodes || {};
      const allMasterEpisodes = (Object.values(masterEpisodesMap).flat() as XtreamEpisode[]).filter(ep => !!ep);

      const missingEpisodes: SyncReport['missingEpisodes'] = [];
      const seasonsReport: SyncReport['seasonsReport'] = [];

      const masterEpKeys = new Set(allMasterEpisodes.map(ep => `${ep.season}-${ep.episode_num}`));
      
      currentEpisodes.forEach(ep => {
        const key = `${ep.season}-${ep.episode_num}`;
        if (!masterEpKeys.has(key)) {
            missingEpisodes.push({
                season: ep.season,
                episode: ep.episode_num,
                title: ep.title,
                streamId: ep.id,
                extension: ep.container_extension
            });
        }
      });

      let missingM3U = "#EXTM3U\r\n";
      missingEpisodes.forEach(ep => {
          const link = currentSvc.generateM3ULink(ep.streamId, ep.extension, 'series');
          missingM3U += `#EXTINF:-1, ${targetName} - S${ep.season}E${ep.episode} - ${ep.title}\r\n${link}\r\n`;
      });

      const masterSeasons = Object.keys(masterEpisodesMap);
      const currentSeasons = [...new Set(currentEpisodes.map(ep => String(ep.season)))];
      const allSeasons = [...new Set([...currentSeasons, ...masterSeasons])].sort((a, b) => Number(a) - Number(b));

      allSeasons.forEach(s => {
        const currCount = currentEpisodes.filter(ep => String(ep.season) === s).length;
        const mastCount = masterEpisodesMap[s]?.length || 0;
        
        seasonsReport.push({
          season: s,
          currentCount: currCount,
          masterCount: mastCount,
          status: currCount === mastCount ? 'match' : (mastCount === 0 ? 'missing' : 'mismatch')
        });
      });

      return {
        found: true,
        masterSeriesId: match.series_id,
        missingEpisodes,
        matchCount: currentEpisodes.length - missingEpisodes.length,
        totalMasterEpisodes: allMasterEpisodes.length,
        totalCurrentEpisodes: currentEpisodes.length,
        seasonsReport,
        missingM3U
      };


    } catch (error) {
      console.error("Sync Check Error:", error);
      throw error;
    }
  }
}
