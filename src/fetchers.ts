import type { RawItem, Source } from './types';

const UA = 'Mozilla/5.0 (compatible; bantin/0.1; personal news reader)';

export async function fetchSource(src: Source): Promise<RawItem[]> {
  const res = await fetch(src.url, {
    headers: {
      'User-Agent': UA,
      Accept: src.type === 'hn'
        ? 'application/json'
        : 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = src.type === 'hn' ? parseHN(await res.json()) : parseFeed(await res.text());
  return items.slice(0, src.maxItems ?? 30);
}

// ───────────────────────── Hacker News (Algolia) ─────────────────────────

interface HNHit {
  objectID: string; title?: string; url?: string; points?: number;
  num_comments?: number; created_at_i?: number; story_text?: string;
}

function parseHN(data: unknown): RawItem[] {
  const hits = ((data as { hits?: HNHit[] })?.hits ?? []);
  return hits.filter(h => h.title).map(h => {
    const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
    return {
      url: h.url || discussion,
      title: h.title!,
      snippet: h.story_text ? clean(h.story_text).slice(0, 400) : '',
      publishedAt: (h.created_at_i ?? Date.now() / 1000) * 1000,
      extra: { points: h.points ?? 0, comments: h.num_comments ?? 0, discussion },
    };
  });
}

// ───────────────────────── RSS / Atom (regex nhẹ, đủ dùng) ─────────────────────────

export function parseFeed(xml: string): RawItem[] {
  const blocks = matchAll(xml, /<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  const isAtom = blocks.length === 0;
  const list = isAtom ? matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi) : blocks;

  const out: RawItem[] = [];
  for (const b of list) {
    const title = getTag(b, ['title']);
    const url = isAtom ? atomLink(b) : (getTag(b, ['link']) || getTag(b, ['guid']));
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const desc = getTag(b, ['description', 'summary', 'content:encoded', 'content']);
    const dateStr = getTag(b, ['pubDate', 'published', 'updated', 'dc:date']);
    const ts = Date.parse(dateStr);
    out.push({
      url,
      title: title.slice(0, 300),
      snippet: desc.slice(0, 400),
      publishedAt: Number.isFinite(ts) ? ts : Date.now(),
    });
  }
  return out;
}

function matchAll(s: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(re)) out.push(m[1]);
  return out;
}

function getTag(block: string, names: string[]): string {
  for (const n of names) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i');
    const m = block.match(re);
    if (m) {
      const v = clean(m[1]);
      if (v) return v;
    }
  }
  return '';
}

function atomLink(block: string): string {
  let fallback = '';
  for (const m of block.matchAll(/<link\b([^>]*?)\/?>/gi)) {
    const attrs = m[1];
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const rel = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || rel === 'alternate') return decodeEntities(href);
    if (!fallback) fallback = decodeEntities(href);
  }
  return fallback;
}

/** Bỏ CDATA, giải mã entity, xoá thẻ HTML, gom khoảng trắng. */
export function clean(s: string): string {
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = decodeEntities(t);              // &lt;p&gt; -> <p>
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t);              // &amp;amp; còn sót
  return t.replace(/\s+/g, ' ').trim();
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Chuẩn hoá URL để khử trùng lặp: bỏ utm_*, fbclid, #hash. */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid|ref|ref_src|mc_cid|mc_eid)$/i.test(k)) url.searchParams.delete(k);
    }
    let s = url.toString();
    if (s.endsWith('/') && url.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return u.trim();
  }
}
