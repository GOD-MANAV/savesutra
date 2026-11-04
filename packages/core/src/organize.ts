import type { Category, EntityType, SaveItem } from './types.ts';
import { dayLabel } from './util.ts';

export type Period = 'day' | 'week' | 'month';

export interface DateGroup {
  key: string;
  label: string;
  items: SaveItem[];
}

/** The date a save belongs to: when it was first shared (imports) or when it was saved. */
export function itemDate(it: SaveItem): string {
  return it.sharedAt ?? it.createdAt;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

/** Group saves into a timeline by day, week or month, newest first. */
export function groupByPeriod(items: SaveItem[], period: Period, now: Date = new Date()): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  const sorted = [...items].sort((a, b) => itemDate(b).localeCompare(itemDate(a)));
  for (const it of sorted) {
    const d = new Date(itemDate(it));
    let key: string;
    let label: string;
    if (period === 'day') {
      key = d.toISOString().slice(0, 10);
      label = dayLabel(itemDate(it), now);
    } else if (period === 'week') {
      const s = startOfWeek(d);
      key = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      const thisWeek = startOfWeek(now).getTime() === s.getTime();
      label = thisWeek ? 'This week' : `Week of ${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    let g = groups.get(key);
    if (!g) {
      g = { key, label, items: [] };
      groups.set(key, g);
    }
    g.items.push(it);
  }
  return [...groups.values()];
}

export interface EntityRef {
  name: string;
  detail?: string;
  type: EntityType;
  /** Saves that mention this entity, newest first. */
  items: SaveItem[];
  /** A link for the entity if one of the saves found it. */
  url?: string;
  lastSeen: string;
}

/**
 * Every tool, place, book, product… mentioned across all saves, merged by name.
 * Powers collections like "All AI tools I've saved".
 */
export function entityIndex(items: SaveItem[], types: EntityType[]): EntityRef[] {
  const map = new Map<string, EntityRef>();
  for (const it of items) {
    for (const e of it.analysis?.entities ?? []) {
      if (!types.includes(e.type)) continue;
      const key = `${e.type}:${e.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}`;
      let ref = map.get(key);
      if (!ref) {
        const url = it.analysis?.links.find((l) => (l.label ?? l.url).toLowerCase().includes(e.name.toLowerCase().split(/\s+/)[0]!))?.url;
        ref = { name: e.name, detail: e.detail, type: e.type, items: [], url, lastSeen: itemDate(it) };
        map.set(key, ref);
      }
      if (!ref.items.includes(it)) ref.items.push(it);
      if (itemDate(it) > ref.lastSeen) ref.lastSeen = itemDate(it);
      ref.detail ??= e.detail;
    }
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length || b.lastSeen.localeCompare(a.lastSeen));
}

export interface SmartCollection {
  id: string;
  title: string;
  description: string;
  /** Saves in the collection, newest first. */
  items: SaveItem[];
  /** For entity collections: the merged list of things. */
  entities?: EntityRef[];
}

const ENTITY_COLLECTIONS: Array<{ id: string; title: string; description: string; types: EntityType[]; filter?: (it: SaveItem) => boolean }> = [
  { id: 'ai-tools', title: 'AI tools', description: 'Every AI tool and app mentioned in your saves', types: ['tool', 'product'], filter: (it) => it.analysis?.category === 'AI' },
  { id: 'tools', title: 'Tools & apps', description: 'Software, sites and apps from all your saves', types: ['tool'] },
  { id: 'places', title: 'Places', description: 'Cafés, trips and spots you wanted to visit', types: ['place'] },
  { id: 'books', title: 'Books', description: 'Books recommended in your saves', types: ['book'] },
  { id: 'recipes', title: 'Ingredients & recipes', description: 'Recipes and what you need for them', types: ['ingredient'] },
  { id: 'products', title: 'Products', description: 'Things to buy, with prices', types: ['product', 'price'] },
];

/** Auto-built collections. Nothing to maintain: they update as you save. */
export function smartCollections(items: SaveItem[]): SmartCollection[] {
  const ready = items.filter((i) => i.analysis);
  const out: SmartCollection[] = [];
  for (const c of ENTITY_COLLECTIONS) {
    const pool = c.filter ? ready.filter(c.filter) : ready;
    const entities = entityIndex(pool, c.types);
    const its = pool.filter((it) => it.analysis!.entities.some((e) => c.types.includes(e.type)));
    if (entities.length) out.push({ id: c.id, title: c.title, description: c.description, items: its, entities });
  }
  const todo = items.filter((i) => i.progress === 'todo');
  if (todo.length) out.unshift({ id: 'todo', title: 'To try', description: 'Saves you marked to try or watch', items: todo });
  const pinned = items.filter((i) => i.pinned);
  if (pinned.length) out.unshift({ id: 'pinned', title: 'Pinned', description: 'Your most important saves', items: pinned });
  const withLinks = ready.filter((i) => i.analysis!.links.length > 0);
  if (withLinks.length) out.push({ id: 'links', title: 'Links found inside', description: 'Saves with links in the caption, audio or on screen', items: withLinks });
  return out;
}

export interface Digest {
  from: string;
  to: string;
  total: number;
  byCategory: Array<{ category: Category; count: number }>;
  topTools: string[];
  topPlaces: string[];
  highlights: SaveItem[];
}

/** What you saved in the last `days` days: a weekly digest shown on the home screen. */
export function digest(items: SaveItem[], now: Date = new Date(), days = 7): Digest {
  const from = new Date(now.getTime() - days * 86_400_000);
  const recent = items.filter((i) => new Date(itemDate(i)) >= from && new Date(itemDate(i)) <= now);
  const counts = new Map<Category, number>();
  for (const it of recent) {
    const c = it.analysis?.category ?? 'Other';
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    total: recent.length,
    byCategory: [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    topTools: entityIndex(recent, ['tool']).slice(0, 5).map((e) => e.name),
    topPlaces: entityIndex(recent, ['place']).slice(0, 5).map((e) => e.name),
    highlights: [...recent].sort((a, b) => (b.analysis?.links.length ?? 0) + (b.analysis?.entities.length ?? 0) - ((a.analysis?.links.length ?? 0) + (a.analysis?.entities.length ?? 0))).slice(0, 3),
  };
}

/** Saves from the same calendar day in earlier months or years ("On this day"). */
export function onThisDay(items: SaveItem[], now: Date = new Date()): SaveItem[] {
  return items.filter((it) => {
    const d = new Date(itemDate(it));
    const sameDay = d.getDate() === now.getDate();
    const earlier = d.getFullYear() < now.getFullYear() || d.getMonth() < now.getMonth();
    return sameDay && earlier;
  });
}

/** Saves you haven't opened for a while, to resurface instead of forgetting. */
export function forgotten(items: SaveItem[], now: Date = new Date(), days = 30, max = 5): SaveItem[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return items
    .filter((it) => it.progress !== 'done' && new Date(it.lastOpenedAt ?? itemDate(it)).getTime() < cutoff)
    .slice(0, max);
}
