export interface ProxyInspectResult {
  status: number;
  statusText: string;
  loadTimeMs: number;
  contentType: string;
  contentLength: string;
  headers: Record<string, string>;
  meta: {
    title: string;
    description: string;
    ogImage: string;
    wordCount: number;
  };
}

export interface ReaderContent {
  title: string;
  content: string;
  wordCount: number;
  readingTime: number;
  url: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  timestamp: number;
  title: string;
}

export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
}

export interface CustomHeader {
  name: string;
  value: string;
}
