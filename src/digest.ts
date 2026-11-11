import { int, type Env } from './types';

interface DigestRow { id: number; url: string; title: string; source_name: string; score: number; summary: string | null }

/** Gửi bản tin sáng qua Telegram: top tin điểm cao trong 24h chưa gửi. */
export async function sendDigest(env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { sent: 0, note: 'chưa cấu hình Telegram' };

  const since = Date.now() - 24 * 3_600_000;
  const { results } = await env.DB.prepare(
    `SELECT id, url, title, source_name, score, summary FROM items
     WHERE status='scored' AND digested=0 AND score>=? AND fetched_at>=?
       AND (user_action IS NULL OR user_action!='dismissed')
     ORDER BY score DESC, published_at DESC LIMIT ?`,
  ).bind(int(env.DIGEST_MIN_SCORE, 6), since, int(env.DIGEST_SIZE, 10)).all<DigestRow>();

  if (!results.length) return { sent: 0, note: 'không có tin đủ điểm' };

  const date = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  let msg = `<b>📰 Bản tin sáng ${esc(date)}</b>\n`;
  for (const [i, r] of results.entries()) {
    const block = `\n<b>${i + 1}.</b> <a href="${esc(r.url)}">${esc(r.title)}</a>\n` +
      `<i>${esc(r.source_name)} · ${r.score}/10</i>\n${r.summary ? esc(r.summary) + '\n' : ''}`;
    if (msg.length + block.length > 3900) break; // Telegram giới hạn 4096 ký tự
    msg += block;
  }

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const ids = results.map(r => r.id);
  await env.DB.prepare(
    `UPDATE items SET digested=1 WHERE id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).run();
  return { sent: ids.length };
}

/** Xoá tin cũ chưa lưu để D1 gọn nhẹ. */
export async function cleanup(env: Env) {
  const before = Date.now() - int(env.RETENTION_DAYS, 30) * 86_400_000;
  const r = await env.DB.prepare(
    `DELETE FROM items WHERE fetched_at < ? AND (user_action IS NULL OR user_action != 'saved')`,
  ).bind(before).run();
  return { deleted: r.meta?.changes ?? 0 };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
