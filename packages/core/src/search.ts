import type { Category, Platform, SaveItem } from './types.ts';
import { CATEGORIES } from './types.ts';

export interface ParsedQuery {
  terms: string[];
  category?: Category;
  platform?: Platform;
  tag?: string;
}

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'and', 'that', 'with', 'wala', 'wali', 'jisme', 'mein', 'ka', 'ki', 'ke', 'about', 'reel', 'video', 'post']);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}₹$]+/gu) ?? []).filter(
    (t) => t.length > 1 || /\d/.test(t),
  );
}

function stem(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

/** Parse "cafes cat:food from:instagram #delhi" into terms and filters. */
export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { terms: [] };
  for (const part of q.trim().split(/\s+/)) {
    const lower = part.toLowerCase();
    if (lower.startsWith('cat:') || lower.startsWith('category:')) {
      const v = lower.split(':')[1] ?? '';
      const c = CATEGORIES.find((x) => x.toLowerCase().startsWith(v));
      if (c) out.category = c;
    } else if (lower.startsWith('from:')) {
      out.platform = lower.slice(5) as Platform;
    } else if (lower.startsWith('#') && lower.length > 2) {
      out.tag = lower.slice(1);
    } else {
      for (const t of tokenize(part)) if (!STOP.has(t)) out.terms.push(t);
    }
  }
  return out;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function fieldScore(term: string, tokens: string[]): number {
  const st = stem(term);
  let best = 0;
  for (const tok of tokens) {
    const s = stem(tok);
    if (s === st) return 1;
    if (st.length >= 3 && s.startsWith(st)) best = Math.max(best, 0.8);
    else if (st.length >= 4 && s[0] === st[0] && editDistanceAtMostOne(s, st)) best = Math.max(best, 0.6);
  }
  return best;
}

/** Everything about an item worth searching, joined. Also used to fill the server's FTS index. */
export function searchableFields(item: SaveItem): Record<string, string> {
  const a = item.analysis;
  return {
    title: a?.title ?? item.meta.title ?? '',
    tags: (a?.tags ?? []).join(' '),
    entities: (a?.entities ?? []).map((e) => `${e.name} ${e.detail ?? ''}`).join(' '),
    note: item.note ?? '',
    summary: `${a?.summary ?? ''} ${(a?.keyPoints ?? []).join(' ')}`,
    body: `${item.meta.description ?? ''} ${item.meta.author ?? ''} ${a?.transcriptExcerpt ?? ''} ${a?.category ?? ''}`,
    links: (a?.links ?? []).map((l) => `${l.url} ${l.label ?? ''}`).join(' '),
  };
}

const WEIGHTS: Record<string, number> = { title: 5, tags: 4, entities: 3, note: 3, summary: 2, body: 1, links: 1 };

export interface SearchHit {
  item: SaveItem;
  score: number;
}

/**
 * Ranked, typo-tolerant search over saved items, used on-device (the server
 * uses SQLite FTS5 instead). Every term should match somewhere; items that
 * match most terms still show, ranked lower.
 */
export function searchItems(items: SaveItem[], query: string): SearchHit[] {
  const q = parseQuery(query);
  const filtered = items.filter(
    (it) =>
      (!q.category || it.analysis?.category === q.category) &&
      (!q.platform || it.platform === q.platform) &&
      (!q.tag || (it.analysis?.tags ?? []).some((t) => t === q.tag || t.startsWith(q.tag!))),
  );
  if (q.terms.length === 0) {
    return filtered
      .map((item) => ({ item, score: 0 }))
      .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
  }
  const hits: SearchHit[] = [];
  const need = Math.max(1, Math.ceil(q.terms.length * 0.6));
  for (const item of filtered) {
    const fields = Object.entries(searchableFields(item)).map(([k, v]) => [k, tokenize(v)] as const);
    let score = 0;
    let matched = 0;
    for (const term of q.terms) {
      let termBest = 0;
      for (const [k, toks] of fields) termBest = Math.max(termBest, fieldScore(term, toks) * (WEIGHTS[k] ?? 1));
      if (termBest > 0) matched++;
      score += termBest;
    }
    if (matched >= need) hits.push({ item, score: score * (matched / q.terms.length) + (item.pinned ? 0.5 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt));
}
