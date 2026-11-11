export interface Env {
  DB: D1Database;
  AI: Ai;

  // secrets
  ACCESS_TOKEN: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  // vars
  FETCH_BATCH: string;
  LLM_BATCH: string;
  LLM_ORDER: string;
  GROQ_MODEL: string;
  GEMINI_MODEL: string;
  MISTRAL_MODEL: string;
  WORKERS_AI_MODEL: string;
  DIGEST_MIN_SCORE: string;
  DIGEST_SIZE: string;
  MAX_AGE_DAYS: string;
  RETENTION_DAYS: string;
}

export type Category = 'dev-ai' | 'trading' | 'pkm';

export interface Source {
  id: string;
  name: string;
  category: Category;
  /** feed = RSS/Atom; hn = Hacker News qua Algolia API */
  type: 'feed' | 'hn';
  url: string;
  /** Khoảng cách tối thiểu giữa 2 lần kéo (phút) */
  intervalMin: number;
  /** Chỉ giữ tin có ít nhất một từ khoá này (tiêu đề + mô tả, không phân biệt hoa thường) */
  include?: string[];
  /** Bỏ tin có từ khoá này */
  exclude?: string[];
  /** Chỉ cho HN: điểm tối thiểu */
  minPoints?: number;
  /** Số tin tối đa lấy mỗi lần */
  maxItems?: number;
}

export interface RawItem {
  url: string;
  title: string;
  snippet: string;
  publishedAt: number;
  extra?: Record<string, unknown>;
}

export const int = (v: string | undefined, d: number): number => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : d;
};
