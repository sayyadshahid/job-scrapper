import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface PureScrapeRequest {
  keywords: string[];
  location?: string;
  remote_only?: boolean;
  platforms?: string[];
  max_results?: number;
}

export interface PureJob {
  title: string;
  company: string;
  location: string;
  url: string;
  salary?: string;
  job_type: string;
  tags: string[];
  posted_date?: string;
  platform: string;
  source_type: 'api' | 'rss' | 'html';
  scraped_at: string;
}

export interface PureScrapeResponse {
  jobs: PureJob[];
  total: number;
  platforms_scraped: string[];
  duration_seconds: number;
  errors: string[];
}

export interface PlatformInfo {
  name: string;
  method: string;
  label: string;
}

export const pureScraperApi = {
  scrape: (data: PureScrapeRequest) =>
    axios.post<PureScrapeResponse>(`${BASE}/api/pure-scraper/scrape`, data),

  getPlatforms: () =>
    axios.get<{ platforms: PlatformInfo[] }>(`${BASE}/api/pure-scraper/platforms`),
};
