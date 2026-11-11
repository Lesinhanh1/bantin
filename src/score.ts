import { chat, extractJson, type ChatMsg } from './llm';
import { INTEREST_PROFILE, TAGS } from './profile';
import { int, type Env } from './types';

interface PendingRow { id: number; category: string; source_name: string; title: string; snippet: string | null }
interface Scored { id: number; score: number; tags: string[]; summary: string }

const MAX_ATTEMPTS = 3;

/** Chấm điểm + tóm tắt một lô tin đang chờ. */
export async function scorePending(env: Env) {
  const batch = int(env.LLM_BATCH, 15);
  const { results } = await env.DB.prepare(
    `SELECT id, category, source_name, title, snippet FROM items
     WHERE status = 'new' AND llm_attempts < ?
     ORDER BY fetched_at DESC LIMIT ?`,
  ).bind(MAX_ATTEMPTS, batch).all<PendingRow>();

  if (!results.length) return { pending: 0, scored: 0 };

  const feedback = await feedbackExamples(env);
  const messages = buildPrompt(results, feedback);

  let text: string, provider: string;
  try {
    ({ text, provider } = await chat(env, messages));
  } catch (e) {
    // Mọi nhà cung cấp đều lỗi (thường do hết hạn mức) → không tính lỗi cho tin, lần cron sau thử lại.
    return { pending: results.length, scored: 0, error: (e as Error).message };
  }

  const ids = new Set(results.map(r => r.id));
  let parsed: Scored[] = [];
  try {
    parsed = normalize(extractJson(text), ids);
  } catch (e) {
    await bumpAttempts(env, [...ids]);
    return { pending: results.length, scored: 0, provider, error: (e as Error).message };
  }

  const stmts = parsed.map(s => env.DB.prepare(
    `UPDATE items SET status='scored', score=?, tags=?, summary=?, llm_provider=?, llm_attempts=llm_attempts+1
     WHERE id=?`,
  ).bind(s.score, JSON.stringify(s.tags), s.summary, provider, s.id));

  const missing = [...ids].filter(id => !parsed.some(p => p.id === id));
  if (stmts.length) await env.DB.batch(stmts);
  if (missing.length) await bumpAttempts(env, missing);

  return { pending: results.length, scored: parsed.length, missing: missing.length, provider };
}

function buildPrompt(rows: PendingRow[], fb: { saved: string[]; dismissed: string[] }): ChatMsg[] {
  const system = `Bạn là biên tập viên lọc tin cho một người đọc cụ thể.

HỒ SƠ NGƯỜI ĐỌC:
${INTEREST_PROFILE}
${fb.saved.length ? `\nVí dụ tin người đọc ĐÃ LƯU (thích):\n- ${fb.saved.join('\n- ')}` : ''}
${fb.dismissed.length ? `\nVí dụ tin người đọc ĐÃ BỎ QUA (không thích):\n- ${fb.dismissed.join('\n- ')}` : ''}

NHIỆM VỤ: với mỗi tin, cho
- "score": số nguyên 0–10 = mức đáng đọc với người này (8–10: rất nên đọc; 5–7: có thể; 0–4: bỏ qua).
- "tags": tối đa 3 tag, CHỈ chọn trong: ${TAGS.join(', ')}.
- "summary": tóm tắt TIẾNG VIỆT 1–2 câu (≤ 45 từ), nói rõ tin nói gì và vì sao đáng/không đáng chú ý. Không bịa chi tiết không có trong tiêu đề/mô tả.

CHỈ trả về JSON đúng dạng: {"items":[{"id":123,"score":7,"tags":["llm"],"summary":"..."}]}`;

  const user = rows.map(r =>
    `[${r.id}] (${r.category} · ${r.source_name}) ${r.title}${r.snippet ? ' — ' + r.snippet.slice(0, 300) : ''}`,
  ).join('\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function normalize(raw: unknown, ids: Set<number>): Scored[] {
  const arr = Array.isArray(raw) ? raw : (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(arr)) throw new Error('JSON không có mảng items');
  const allowed = new Set<string>(TAGS);
  const seen = new Set<number>();
  const out: Scored[] = [];
  for (const x of arr as Record<string, unknown>[]) {
    const id = Number(x?.id);
    if (!ids.has(id) || seen.has(id)) continue;
    seen.add(id);
    const score = Math.max(0, Math.min(10, Math.round(Number(x.score) || 0)));
    const tags = (Array.isArray(x.tags) ? x.tags : [])
      .map(t => String(t).toLowerCase().trim()).filter(t => allowed.has(t)).slice(0, 3);
    const summary = String(x.summary ?? '').trim().slice(0, 500);
    out.push({ id, score, tags, summary });
  }
  return out;
}

async function bumpAttempts(env: Env, ids: number[]) {
  if (!ids.length) return;
  await env.DB.prepare(
    `UPDATE items SET llm_attempts = llm_attempts + 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).run();
}

/** Lấy vài tiêu đề đã lưu / đã bỏ gần đây để LLM học dần khẩu vị. */
async function feedbackExamples(env: Env) {
  const since = Date.now() - 30 * 86_400_000;
  const q = (action: string) => env.DB.prepare(
    `SELECT title FROM items WHERE user_action=? AND acted_at>=? ORDER BY acted_at DESC LIMIT 6`,
  ).bind(action, since).all<{ title: string }>();
  const [s, d] = await Promise.all([q('saved'), q('dismissed')]);
  return { saved: s.results.map(r => r.title), dismissed: d.results.map(r => r.title) };
}
