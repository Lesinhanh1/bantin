/**
 * Hồ sơ sở thích — LLM dựa vào đây để chấm điểm. Sửa cho đúng ý anh.
 * Viết càng cụ thể, điểm càng sát.
 */
export const INTEREST_PROFILE = `
Người đọc là một lập trình viên Việt Nam, đọc tin để học và áp dụng thực tế.

QUAN TÂM CAO:
- Xây web app: JavaScript/TypeScript, Cloudflare Workers/D1/Pages, Netlify, serverless, kiến trúc gọn nhẹ chi phí thấp.
- Công cụ desktop Windows, tiện ích năng suất.
- AI cho người làm sản phẩm: LLM API, agent, coding assistant, model mới có ứng dụng thực tế, kỹ thuật prompt, chạy model local.
- Trading có hệ thống: trend-following, pullback entry, quản trị rủi ro, backtest, Pine Script/TradingView, giao dịch thuật toán.
- Vĩ mô ảnh hưởng thị trường (lãi suất, Fed, tỷ giá) và thị trường chứng khoán Việt Nam ở mức xu hướng.
- Quản lý kiến thức cá nhân: Obsidian, ghi chú, workflow PKM, plugin.

ĐIỂM THẤP:
- Tin hype, gọi mua bán mã cụ thể, dự đoán giá ngắn hạn, "tín hiệu" giao dịch, shill tiền mã hoá.
- Chính trị, drama người nổi tiếng, tin giật gân, bài liệt kê chung chung, quảng cáo.
- Tin doanh nghiệp/huy động vốn không có giá trị kỹ thuật.
`.trim();

/** Bỏ ngay trước khi gọi LLM (so khớp không phân biệt hoa thường). */
export const MUTE_WORDS: string[] = [
  'memecoin', 'airdrop', 'giveaway', 'sponsored', 'tài trợ',
];

/** Bộ tag cố định để LLM chọn (tối đa 3 tag/tin). */
export const TAGS = [
  'llm', 'ai-tools', 'agents', 'web-dev', 'cloudflare', 'js-ts', 'desktop', 'open-source',
  'security', 'release', 'tutorial', 'research',
  'trading-system', 'pine-script', 'backtest', 'risk', 'macro', 'vn-stock',
  'pkm', 'obsidian', 'productivity',
] as const;
