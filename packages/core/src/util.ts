import type { Category, SaveItem } from './types.ts';

/** Random, URL-safe id (uses crypto.randomUUID where available). */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Colours per category: a light fill and a dark text colour that pass WCAG AA (≥ 4.5:1) together. */
export const CATEGORY_COLORS: Record<Category, { bg: string; fg: string; border: string }> = {
  AI: { bg: '#E8E4FF', fg: '#3A1FA8', border: '#C6BCFA' },
  Food: { bg: '#FDE7DA', fg: '#7A2A0C', border: '#F3C3A8' },
  Travel: { bg: '#FFF1C7', fg: '#5E4400', border: '#EED58A' },
  Tech: { bg: '#E3ECFF', fg: '#1F2D8A', border: '#B9C9FA' },
  Career: { bg: '#DDF3EA', fg: '#0B5A3F', border: '#A9DCC6' },
  Finance: { bg: '#E2F3F7', fg: '#0D5466', border: '#A8D8E4' },
  Fitness: { bg: '#F6E3F5', fg: '#6E1D6A', border: '#E2B7DF' },
  Learning: { bg: '#E6EEF9', fg: '#22406E', border: '#BACDEA' },
  Shopping: { bg: '#FFE3EA', fg: '#8A1538', border: '#F5B4C5' },
  Entertainment: { bg: '#FFE9D1', fg: '#7A3A00', border: '#F4C998' },
  Home: { bg: '#E9F1DD', fg: '#3B5414', border: '#C7DBA9' },
  Other: { bg: '#EEF0F3', fg: '#3A4150', border: '#D5D9E0' },
};

/** Relative day label used in lists: Today, Yesterday, 2 Nov. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

export function formatDuration(sec?: number): string | undefined {
  if (!sec || sec <= 0) return undefined;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** Flat rows for the table view and Excel/CSV export. */
export function toRows(items: SaveItem[]): Array<Record<string, string | number>> {
  return items.map((it) => ({
    '#': it.seq,
    Title: it.analysis?.title ?? it.meta.title ?? it.url,
    Category: it.analysis?.category ?? 'Other',
    Source: it.platform,
    Type: it.kind,
    Summary: it.analysis?.summary ?? '',
    Places: (it.analysis?.entities ?? []).filter((e) => e.type === 'place').map((e) => e.name).join('; '),
    'Links found': (it.analysis?.links ?? []).map((l) => l.url).join(' '),
    Tags: (it.analysis?.tags ?? []).join(', '),
    Tools: (it.analysis?.entities ?? []).filter((e) => e.type === 'tool').map((e) => e.name).join('; '),
    Status: it.progress ?? 'inbox',
    Note: it.note ?? '',
    URL: it.url,
    Saved: it.createdAt.slice(0, 10),
    'AI generated': it.analysis && it.analysis.engine !== 'rules' ? 'yes' : 'no',
  }));
}

/** RFC 4180 CSV with a BOM so Excel opens Hindi and ₹ correctly. */
export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '﻿';
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `﻿${[headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n')}`;
}
