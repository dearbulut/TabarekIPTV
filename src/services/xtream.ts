import { Database } from './db';

interface XtreamConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface XtreamUserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

interface XtreamStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

interface XtreamEPG {
  id: number;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: number;
  stop_timestamp: number;
}

interface XtreamMovieInfo {
  movie_data: {
    name: string;
    stream_id: number;
    stream_icon: string;
    rating: string;
    rating_5based: number;
    added: string;
    category_id: string;
    container_extension: string;
    custom_sid: string;
    direct_source: string;
  };
  subtitle_tracks?: Array<{
    id: string;
    language: string;
    url: string;
  }>;
  audio_tracks?: Array<{
    id: string;
    language: string;
    name: string;
  }>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class XtreamService {
  private config: XtreamConfig;
  private userInfo: XtreamUserInfo | null = null;
  private db: Database;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private retryDelays = [1000, 2000, 5000]; // Retry delays in milliseconds
  
  // Cache duration in milliseconds
  private CACHE_DURATION = {
    epg: 5 * 60 * 1000, // 5 minutes
    movieInfo: 30 * 60 * 1000, // 30 minutes
    streams: 10 * 60 * 1000 // 10 minutes
  };

  constructor(config: XtreamConfig) {
    this.config = config;
    this.db = new Database();
    
    // Clean cache periodically
    setInterval(() => this.cleanCache(), 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private cacheSet<T>(key: string, data: T, duration: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + duration
    });
  }

  private async fetchWithRetry<T>(url: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal,
        headers: {
          ...options.headers,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      if (retryCount < this.retryDelays.length) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelays[retryCount]));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/player_api.php?username=${this.config.username}&password=${this.config.password}`;
      const data = await this.fetchWithRetry<{ user_info: XtreamUserInfo }>(url);
      
      if (data.user_info && data.user_info.auth === 1) {
        this.userInfo = data.user_info;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async getLiveStreams(category_id?: string, signal?: AbortSignal): Promise<XtreamStream[]> {
    const cacheKey = `streams_${category_id || 'all'}`;
    const cached = this.cacheGet<XtreamStream[]>(cacheKey);
    if (cached) return cached;

    // Deduplicate in-flight requests
    const pendingKey = `pending_${cacheKey}`;
    const pendingRequest = this.pendingRequests.get(pendingKey);
    if (pendingRequest) return pendingRequest;

    const url = new URL(`${this.config.baseUrl}/player_api.php`);
    url.searchParams.append('username', this.config.username);
    url.searchParams.append('password', this.config.password);
    url.searchParams.append('action', 'get_live_streams');
    if (category_id) {
      url.searchParams.append('category_id', category_id);
    }

    const request = this.fetchWithRetry<XtreamStream[]>(url.toString(), { signal })
      .then(data => {
        this.cacheSet(cacheKey, data, this.CACHE_DURATION.streams);
        this.pendingRequests.delete(pendingKey);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(pendingKey);
        throw error;
      });

    this.pendingRequests.set(pendingKey, request);
    return request;
  }

  async getEPG(stream_id: string | number, limit = 24, signal?: AbortSignal): Promise<XtreamEPG[]> {
    const cacheKey = `epg_${stream_id}_${limit}`;
    const cached = this.cacheGet<XtreamEPG[]>(cacheKey);
    if (cached) return cached;

    const url = new URL(`${this.config.baseUrl}/player_api.php`);
    url.searchParams.append('username', this.config.username);
    url.searchParams.append('password', this.config.password);
    url.searchParams.append('action', 'get_epg');
    url.searchParams.append('stream_id', stream_id.toString());
    url.searchParams.append('limit', limit.toString());

    const data = await this.fetchWithRetry<XtreamEPG[]>(url.toString(), { signal });
    this.cacheSet(cacheKey, data, this.CACHE_DURATION.epg);
    return data;
  }

  async getMovieInfo(movie_id: string | number, signal?: AbortSignal): Promise<XtreamMovieInfo> {
    const cacheKey = `movie_${movie_id}`;
    const cached = this.cacheGet<XtreamMovieInfo>(cacheKey);
    if (cached) return cached;

    const url = new URL(`${this.config.baseUrl}/player_api.php`);
    url.searchParams.append('username', this.config.username);
    url.searchParams.append('password', this.config.password);
    url.searchParams.append('action', 'get_movie_info');
    url.searchParams.append('movie_id', movie_id.toString());

    const data = await this.fetchWithRetry<XtreamMovieInfo>(url.toString(), { signal });
    this.cacheSet(cacheKey, data, this.CACHE_DURATION.movieInfo);
    return data;
  }

  getLiveStreamUrl(stream_id: string | number): string {
    return `${this.config.baseUrl}/live/${this.config.username}/${this.config.password}/${stream_id}`;
  }

  getMovieStreamUrl(movie_id: string | number): string {
    return `${this.config.baseUrl}/movie/${this.config.username}/${this.config.password}/${movie_id}`;
  }

  getSeriesStreamUrl(series_id: string | number): string {
    return `${this.config.baseUrl}/series/${this.config.username}/${this.config.password}/${series_id}`;
  }

  async saveWatchProgress(type: 'movie' | 'series', id: string, position: number, duration: number): Promise<void> {
    await this.db.saveProgress(type, id, position, duration);
  }

  async getWatchProgress(type: 'movie' | 'series', id: string): Promise<number> {
    return await this.db.getProgress(type, id);
  }

  // Clear specific cache entries
  clearCache(type: 'epg' | 'movieInfo' | 'streams'): void {
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(type)) {
        this.cache.delete(key);
      }
    }
  }
}

// Create and export singleton instance
const xtreamService = new XtreamService({
  baseUrl: process.env.XTREAM_BASE_URL || '',
  username: process.env.XTREAM_USERNAME || '',
  password: process.env.XTREAM_PASSWORD || ''
});

export default xtreamService;