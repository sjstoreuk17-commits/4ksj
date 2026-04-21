/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface M3UEntry {
  id: string;
  name: string;
  logo?: string;
  group: string;
  url: string;
  raw: string; // The full #EXTINF line + URL
  type: 'movie' | 'series' | 'live' | 'unknown';
}

export interface M3UPlaylist {
  entries: M3UEntry[];
  categories: string[];
  stats: {
    totalEntries: number;
    movieCount: number;
    seriesCount: number;
    categoryCount: number;
  };
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: string | number;
  stream_icon: string;
  rating: string;
  rating_5_0: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5_0: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface XtreamEpisode {
  id: string;
  episode_num: number;
  season: number;
  title: string;
  container_extension: string;
  info: {
    duration: string;
    movie_image: string;
    plot: string;
    rating: string;
    release_date: string;
  };
}

export interface XtreamSeriesInfo {
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    last_modified: string;
    rating: string;
    rating_5_0: number;
    backdrop_path: string[];
    youtube_trailer: string;
    episode_run_time: string;
    category_id: string;
  };
  episodes: {
    [seasonNum: string]: XtreamEpisode[];
  };
}

export interface XtreamAuth {
  url: string;
  username: string;
  password: string;
}
