import type { Env } from './types';

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatResult { text: string; provider: string }

/**
 * Gọi lần lượt các nhà cung cấp theo LLM_ORDER. Bỏ qua cái chưa có key,
 * lỗi/429/hết hạn mức thì chuyển sang cái kế tiếp.
 */
export async function chat(env: Env, messages: ChatMsg[]): Promise<ChatResult> {
  const order = (env.LLM_ORDER || 'groq,gemini,mistral,workersai')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const errors: string[] = [];

  for (const p of order) {
    try {
      const text = await callProvider(env, p, messages);
      if (text && text.trim()) return { text, provider: p };
      errors.push(`${p}: phản hồi rỗng`);
    } catch (e) {
      errors.push(`${p}: ${(e as Error).message}`.slice(0, 200));
    }
  }
  throw new Error('Tất cả LLM đều lỗi → ' + errors.join(' | '));
}

async function callProvider(env: Env, p: string, messages: ChatMsg[]): Promise<string | null> {
  switch (p) {
    case 'groq':
      if (!env.GROQ_API_KEY) throw new Error('chưa có key');
      return openAICompat('https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY, env.GROQ_MODEL, messages);
    case 'gemini':
      if (!env.GEMINI_API_KEY) throw new Error('chưa có key');
      return openAICompat('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        env.GEMINI_API_KEY, env.GEMINI_MODEL, messages);
    case 'mistral':
      if (!env.MISTRAL_API_KEY) throw new Error('chưa có key');
      return openAICompat('https://api.mistral.ai/v1/chat/completions',
        env.MISTRAL_API_KEY, env.MISTRAL_MODEL, messages);
    case 'workersai':
      return workersAI(env, messages);
    default:
      throw new Error('không rõ nhà cung cấp');
  }
}

async function openAICompat(url: string, key: string, model: string, messages: ChatMsg[]): Promise<string | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, messages, temperature: 0.2, max_tokens: 4000,
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 150);
    throw new Error(`HTTP ${res.status} ${body}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

async function workersAI(env: Env, messages: ChatMsg[]): Promise<string | null> {
  if (!env.AI) throw new Error('chưa bind AI');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (env.AI as any).run(env.WORKERS_AI_MODEL, { messages, max_tokens: 2500 }) as { response?: unknown };
  const out = r?.response;
  if (out == null) return null;
  return typeof out === 'string' ? out : JSON.stringify(out);
}

/** Lấy JSON từ câu trả lời LLM (chịu được ```json ... ``` và chữ thừa). */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, '').trim();
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return undefined; } };
  const o1 = t.indexOf('{'), o2 = t.lastIndexOf('}');
  if (o1 >= 0 && o2 > o1) {
    const v = tryParse(t.slice(o1, o2 + 1));
    if (v !== undefined) return v;
  }
  const a1 = t.indexOf('['), a2 = t.lastIndexOf(']');
  if (a1 >= 0 && a2 > a1) {
    const v = tryParse(t.slice(a1, a2 + 1));
    if (v !== undefined) return v;
  }
  throw new Error('Không đọc được JSON từ LLM');
}
