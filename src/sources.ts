import type { Source } from './types';

/**
 * Danh sách nguồn. Thêm/bớt thoải mái — chỉ cần `id` không trùng.
 * Mẹo lấy RSS:
 *  - Reddit:  https://www.reddit.com/r/<sub>/top/.rss?t=day
 *  - GitHub:  https://github.com/<owner>/<repo>/releases.atom
 *  - Discourse forum: <forum>/top.rss?period=weekly
 * Các URL dưới đây nên kiểm tra lại khi deploy; nguồn lỗi sẽ hiện ở /api/sources.
 */
export const SOURCES: Source[] = [
  // ───────── Dev / AI ─────────
  {
    id: 'hn-front', name: 'Hacker News', category: 'dev-ai', type: 'hn',
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40',
    intervalMin: 60, minPoints: 100,
  },
  { id: 'simonw', name: 'Simon Willison', category: 'dev-ai', type: 'feed',
    url: 'https://simonwillison.net/atom/everything/', intervalMin: 120 },
  { id: 'latent-space', name: 'Latent Space', category: 'dev-ai', type: 'feed',
    url: 'https://www.latent.space/feed', intervalMin: 360 },
  { id: 'cf-blog', name: 'Cloudflare Blog', category: 'dev-ai', type: 'feed',
    url: 'https://blog.cloudflare.com/rss/', intervalMin: 360 },
  { id: 'gh-workers-sdk', name: 'GitHub · workers-sdk', category: 'dev-ai', type: 'feed',
    url: 'https://github.com/cloudflare/workers-sdk/releases.atom', intervalMin: 720,
    include: ['wrangler@'] },
  { id: 'r-localllama', name: 'r/LocalLLaMA', category: 'dev-ai', type: 'feed',
    url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day', intervalMin: 180, maxItems: 15 },

  // ───────── Trading ─────────
  { id: 'r-algotrading', name: 'r/algotrading', category: 'trading', type: 'feed',
    url: 'https://www.reddit.com/r/algotrading/top/.rss?t=day', intervalMin: 180, maxItems: 15 },
  { id: 'cafef-ck', name: 'CafeF · Chứng khoán', category: 'trading', type: 'feed',
    url: 'https://cafef.vn/thi-truong-chung-khoan.rss', intervalMin: 60 },
  { id: 'vnexpress-kd', name: 'VnExpress · Kinh doanh', category: 'trading', type: 'feed',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss', intervalMin: 120,
    include: ['chứng khoán', 'cổ phiếu', 'lãi suất', 'tỷ giá', 'vn-index', 'fed', 'ngân hàng', 'vàng', 'lạm phát'] },
  { id: 'investing-stock', name: 'Investing.com · Stock market', category: 'trading', type: 'feed',
    url: 'https://www.investing.com/rss/news_25.rss', intervalMin: 120 },

  // ───────── PKM ─────────
  { id: 'obsidian-forum', name: 'Obsidian Forum', category: 'pkm', type: 'feed',
    url: 'https://forum.obsidian.md/top.rss?period=weekly', intervalMin: 720 },
  { id: 'r-obsidian', name: 'r/ObsidianMD', category: 'pkm', type: 'feed',
    url: 'https://www.reddit.com/r/ObsidianMD/top/.rss?t=week', intervalMin: 720, maxItems: 15 },
];
