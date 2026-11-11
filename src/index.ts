import { cleanup, sendDigest } from './digest';
import { runPipeline, sourceStatus } from './pipeline';
import { int, type Env } from './types';
import { UI_HTML } from './ui';

const DIGEST_CRON = '0 0 * * *';

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === DIGEST_CRON) {
      ctx.waitUntil((async () => {
        try { console.log('digest', await sendDigest(env)); } catch (e) { console.error('digest', e); }
        console.log('cleanup', await cleanup(env));
      })());
    } else {
      ctx.waitUntil(runPipeline(env).then(r => console.log('pipeline', JSON.stringify(r))));
    }
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      return new Response(UI_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (!p.startsWith('/api/')) return new Response('Not found', { status: 404 });
    if (!authorized(req, env)) return json({ error: 'unauthorized' }, 401);

    try {
      if (req.method === 'GET' && p === '/api/items') return json(await listItems(env, url.searchParams));
      if (req.method === 'GET' && p === '/api/sources') return json(await sourceStatus(env));
      if (req.method === 'POST' && p === '/api/run') return json(await runPipeline(env, { force: url.searchParams.get('force') === '1' }));
      if (req.method === 'POST' && p === '/api/digest') return json(await sendDigest(env));

      const m = p.match(/^\/api\/items\/(\d+)\/(action|md)$/);
      if (m) {
        const id = Number(m[1]);
        if (req.method === 'POST' && m[2] === 'action') {
          const { action } = await req.json<{ action: string | null }>();
          if (action !== null && action !== 'saved' && action !== 'dismissed') return json({ error: 'action không hợp lệ' }, 400);
          await env.DB.prepare('UPDATE items SET user_action=?, acted_at=? WHERE id=?')
            .bind(action, action ? Date.now() : null, id).run();
          return json({ ok: true });
        }
        if (req.method === 'GET' && m[2] === 'md') {
          const it = await env.DB.prepare('SELECT * FROM items WHERE id=?').bind(id).first<ItemRow>();
          if (!it) return json({ error: 'không tìm thấy' }, 404);
          const fname = slug(it.title) + '.md';
          return new Response(toMarkdown(it), {
            headers: {
              'content-type': 'text/markdown; charset=utf-8',
              'content-disposition': `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
            },
          });
        }
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: (e as Error).message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ───────────────────────── helpers ─────────────────────────

interface ItemRow {
  id: number; url: string; source_id: string; source_name: string; category: string;
  title: string; snippet: string | null; extra: string | null; published_at: number; fetched_at: number;
  status: string; score: number | null; tags: string | null; summary: string | null; user_action: string | null;
}

async function listItems(env: Env, q: URLSearchParams) {
  const view = q.get('view') ?? 'top';
  const cat = q.get('cat') ?? '';
  const since = Date.now() - int(q.get('days') ?? undefined, 3) * 86_400_000;
  const where: string[] = [];
  const args: unknown[] = [];
  let order = 'published_at DESC';

  if (view === 'saved') {
    where.push(`user_action='saved'`);
    order = 'acted_at DESC';
  } else {
    where.push('fetched_at>=?'); args.push(since);
    where.push(`(user_action IS NULL OR user_action!='dismissed')`);
    if (view === 'top') {
      where.push(`status='scored' AND score>=?`); args.push(int(env.DIGEST_MIN_SCORE, 6));
      order = 'score DESC, published_at DESC';
    }
  }
  if (cat) { where.push('category=?'); args.push(cat); }

  const { results } = await env.DB.prepare(
    `SELECT id, url, source_name, category, title, snippet, extra, published_at, status, score, tags, summary, user_action
     FROM items WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 150`,
  ).bind(...args).all<ItemRow>();

  return results.map(r => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
    extra: r.extra ? JSON.parse(r.extra) : null,
  }));
}

function toMarkdown(it: ItemRow): string {
  const tags = ['bantin', it.category, ...(it.tags ? JSON.parse(it.tags) as string[] : [])];
  const date = new Date(it.published_at).toISOString().slice(0, 10);
  const yq = (s: string) => JSON.stringify(s);
  return [
    '---',
    `title: ${yq(it.title)}`,
    `source: ${yq(it.source_name)}`,
    `url: ${it.url}`,
    `date: ${date}`,
    `saved: ${new Date().toISOString().slice(0, 10)}`,
    `score: ${it.score ?? ''}`,
    `tags: [${tags.join(', ')}]`,
    '---',
    '',
    `# ${it.title}`,
    '',
    it.summary ? `> ${it.summary}\n` : '',
    it.snippet ? `${it.snippet}\n` : '',
    `[Đọc bài gốc](${it.url})`,
    '',
    '## Ghi chú',
    '',
  ].join('\n');
}

function slug(s: string): string {
  const base = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
  return base || 'bantin';
}

function authorized(req: Request, env: Env): boolean {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const want = env.ACCESS_TOKEN ?? '';
  if (!want || token.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= token.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
