import { fetchSource, normalizeUrl } from './fetchers';
import { MUTE_WORDS } from './profile';
import { scorePending } from './score';
import { SOURCES } from './sources';
import { int, type Env, type RawItem, type Source } from './types';

/** Một vòng: kéo vài nguồn đến hạn → lưu → chấm điểm một lô. */
export async function runPipeline(env: Env, opts: { force?: boolean } = {}) {
  const fetched = await fetchDueSources(env, !!opts.force);
  const scored = await scorePending(env);
  return { fetched, scored };
}

async function fetchDueSources(env: Env, force: boolean) {
  const n = int(env.FETCH_BATCH, 3);
  const { results } = await env.DB.prepare(
    'SELECT source_id, last_fetched_at FROM source_state',
  ).all<{ source_id: string; last_fetched_at: number }>();
  const last = new Map(results.map(r => [r.source_id, r.last_fetched_at]));
  const now = Date.now();

  const due = SOURCES
    .filter(s => force || now - (last.get(s.id) ?? 0) >= s.intervalMin * 60_000)
    .sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0))
    .slice(0, n);

  return Promise.all(due.map(async s => {
    try {
      const raw = await fetchSource(s);
      const kept = prefilter(env, s, raw);
      const added = await insertItems(env, s, kept, now);
      await saveState(env, s.id, now, 'ok', null, added);
      return { source: s.id, got: raw.length, kept: kept.length, added };
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await saveState(env, s.id, now, 'error', msg, 0);
      return { source: s.id, error: msg };
    }
  }));
}

/** Lọc thô (không tốn LLM): tuổi tin, điểm HN, từ khoá include/exclude, mute. */
function prefilter(env: Env, s: Source, items: RawItem[]): RawItem[] {
  const minTs = Date.now() - int(env.MAX_AGE_DAYS, 5) * 86_400_000;
  const inc = s.include?.map(w => w.toLowerCase());
  const exc = [...(s.exclude ?? []), ...MUTE_WORDS].map(w => w.toLowerCase());
  return items.filter(it => {
    if (it.publishedAt < minTs) return false;
    if (s.minPoints != null && Number(it.extra?.points ?? 0) < s.minPoints) return false;
    const text = `${it.title} ${it.snippet}`.toLowerCase();
    if (inc?.length && !inc.some(w => text.includes(w))) return false;
    if (exc.some(w => text.includes(w))) return false;
    return true;
  });
}

async function insertItems(env: Env, s: Source, items: RawItem[], now: number): Promise<number> {
  if (!items.length) return 0;
  const stmts = items.map(it => env.DB.prepare(
    `INSERT OR IGNORE INTO items
       (url, source_id, source_name, category, title, snippet, extra, published_at, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    normalizeUrl(it.url), s.id, s.name, s.category, it.title, it.snippet || null,
    it.extra ? JSON.stringify(it.extra) : null, Math.round(it.publishedAt), now,
  ));
  const res = await env.DB.batch(stmts);
  return res.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
}

async function saveState(env: Env, id: string, ts: number, status: string, error: string | null, added: number) {
  await env.DB.prepare(
    `INSERT INTO source_state (source_id, last_fetched_at, last_status, last_error, last_added)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(source_id) DO UPDATE SET
       last_fetched_at=excluded.last_fetched_at, last_status=excluded.last_status,
       last_error=excluded.last_error, last_added=excluded.last_added`,
  ).bind(id, ts, status, error, added).run();
}

export async function sourceStatus(env: Env) {
  const { results } = await env.DB.prepare('SELECT * FROM source_state').all<Record<string, unknown>>();
  const map = new Map(results.map(r => [r.source_id as string, r]));
  return SOURCES.map(s => ({ id: s.id, name: s.name, category: s.category, url: s.url, ...(map.get(s.id) ?? {}) }));
}
