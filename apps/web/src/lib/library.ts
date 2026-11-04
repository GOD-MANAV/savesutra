import { useSyncExternalStore } from 'react';
import {
  createId,
  demoItems,
  detectPlatform,
  extractFirstUrl,
  normalizeUrl,
  nowIso,
  parseWhatsAppExport,
  type Category,
  type SaveChannel,
  type SaveItem,
} from '@savesutra/core';
import { analyzeOnDevice } from './analyze';
import { localDb, type LocalDb } from './db';
import { getSettings, type Settings } from './settings';

export interface SaveInput {
  url: string;
  note?: string;
  channel: SaveChannel;
  sharedAt?: string;
  image?: { base64: string; mimeType: string };
}

export type ItemPatch = Partial<Pick<SaveItem, 'note' | 'pinned' | 'progress' | 'board' | 'collections' | 'lastOpenedAt'>> & {
  category?: string;
  tags?: string[];
};

interface Snapshot {
  items: SaveItem[];
  loading: boolean;
  error: string | null;
  mode: Settings['mode'];
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The app's single source of truth. Works in two modes:
 * - local: IndexedDB on the device, analysis on the device;
 * - server: your own SaveSutra server (the same library the WhatsApp bot writes to).
 */
export class Library {
  private snap: Snapshot = { items: [], loading: true, error: null, mode: 'local' };
  private readonly listeners = new Set<() => void>();
  private poll: ReturnType<typeof setInterval> | undefined;
  private analysisChain: Promise<void> = Promise.resolve();

  constructor(private readonly db: LocalDb = localDb()) {}

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  private setItems(items: SaveItem[]): void {
    this.set({ items: [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    this.schedulePoll();
  }

  private upsertLocal(item: SaveItem): void {
    const items = this.snap.items.filter((i) => i.id !== item.id);
    items.push(item);
    this.setItems(items);
  }

  get settings(): Settings {
    return getSettings();
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { serverUrl, apiToken } = this.settings;
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new ApiError(body.error ?? `Server error ${res.status}`, res.status);
    return body;
  }

  async load(): Promise<void> {
    const mode = this.settings.mode;
    this.set({ loading: true, error: null, mode });
    try {
      if (mode === 'server') {
        const { items } = await this.api<{ items: SaveItem[] }>('/items?limit=2000');
        this.setItems(items);
      } else {
        this.setItems(await this.db.items.toArray());
        // Resume any analysis interrupted when the app was closed.
        for (const it of this.snap.items) if (it.status === 'queued' || it.status === 'processing') this.queueLocalAnalysis(it.id);
      }
      this.set({ loading: false });
    } catch (err) {
      this.set({ loading: false, error: (err as Error).message });
    }
  }

  /** Server mode: refresh while anything is still being analysed. */
  private schedulePoll(): void {
    const busy = this.snap.items.some((i) => i.status === 'queued' || i.status === 'processing');
    if (this.settings.mode === 'server' && busy && !this.poll) {
      this.poll = setInterval(async () => {
        try {
          const { items } = await this.api<{ items: SaveItem[] }>('/items?limit=2000');
          this.snap = { ...this.snap, items };
          for (const l of this.listeners) l();
          if (!items.some((i) => i.status === 'queued' || i.status === 'processing')) {
            clearInterval(this.poll);
            this.poll = undefined;
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    }
  }

  async testServer(url: string, token: string): Promise<{ ok: boolean; ai: boolean; whatsapp: boolean; message: string }> {
    try {
      const base = url.replace(/\/$/, '');
      const h = (await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) })).json()) as { ok: boolean; ai: boolean; whatsapp: boolean };
      const r = await fetch(`${base}/api/items?limit=1`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (r.status === 401) return { ok: false, ai: h.ai, whatsapp: h.whatsapp, message: 'Server reached, but the token is wrong.' };
      if (!r.ok) return { ok: false, ai: h.ai, whatsapp: h.whatsapp, message: `Server answered ${r.status}.` };
      return { ok: true, ai: h.ai, whatsapp: h.whatsapp, message: 'Connected.' };
    } catch (err) {
      return { ok: false, ai: false, whatsapp: false, message: `Could not reach the server (${(err as Error).message}).` };
    }
  }

  /** Save a link. Returns the existing save if the same link was saved before. */
  async add(input: SaveInput): Promise<{ item: SaveItem; duplicate: boolean }> {
    const screenshotOnly = !input.url.trim() && Boolean(input.image) && this.settings.mode === 'local';
    const found = screenshotOnly ? `local-image:${createId()}` : extractFirstUrl(input.url);
    if (!found) throw new Error('That does not look like a link. Paste a full https:// address.');
    if (this.settings.mode === 'server') {
      const res = await this.api<{ item: SaveItem; duplicate: boolean }>('/items', {
        method: 'POST',
        body: JSON.stringify({ url: found, note: input.note, channel: input.channel, image: input.image }),
      });
      this.upsertLocal(res.item);
      return res;
    }
    const url = screenshotOnly ? found : normalizeUrl(found);
    const existing = this.snap.items.find((i) => i.url === url);
    if (existing) return { item: existing, duplicate: true };
    const { platform, kind } = screenshotOnly ? { platform: 'web' as const, kind: 'image' as const } : detectPlatform(url);
    const seq = (await this.db.items.orderBy('seq').last())?.seq ?? 0;
    const now = nowIso();
    const item: SaveItem = {
      id: createId(),
      seq: seq + 1,
      url,
      platform,
      kind: input.image ? 'image' : kind,
      status: 'queued',
      channel: input.channel,
      meta: { url, platform, kind },
      note: input.note?.trim() || undefined,
      sharedAt: input.sharedAt,
      progress: 'inbox',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.items.add(item);
    this.upsertLocal(item);
    this.queueLocalAnalysis(item.id, input.image);
    return { item, duplicate: false };
  }

  /** Local analysis runs one at a time to respect free-tier AI rate limits. */
  private queueLocalAnalysis(id: string, image?: SaveInput['image']): void {
    this.analysisChain = this.analysisChain.then(() => this.analyzeLocal(id, image)).catch(() => undefined);
  }

  private async analyzeLocal(id: string, image?: SaveInput['image']): Promise<void> {
    let item = await this.db.items.get(id);
    if (!item) return;
    item = { ...item, status: 'processing', updatedAt: nowIso() };
    await this.db.items.put(item);
    this.upsertLocal(item);
    const s = this.settings;
    try {
      const { meta, analysis, warning } = await analyzeOnDevice(item.url, { geminiKey: s.geminiKey, geminiModel: s.geminiModel, image });
      const latest = (await this.db.items.get(id)) ?? item;
      const done: SaveItem = { ...latest, meta: { ...latest.meta, ...meta }, kind: image ? 'image' : meta.kind, analysis, status: 'ready', error: warning, updatedAt: nowIso() };
      await this.db.items.put(done);
      this.upsertLocal(done);
    } catch (err) {
      const failed: SaveItem = { ...item, status: 'failed', error: (err as Error).message, updatedAt: nowIso() };
      await this.db.items.put(failed);
      this.upsertLocal(failed);
    }
  }

  async update(id: string, patch: ItemPatch): Promise<void> {
    const cur = this.snap.items.find((i) => i.id === id);
    if (!cur) return;
    // Optimistic update so the UI feels instant.
    const next: SaveItem = { ...cur, ...patch, updatedAt: nowIso() };
    delete (next as ItemPatch).category;
    delete (next as ItemPatch).tags;
    if (next.analysis && (patch.category || patch.tags)) {
      next.analysis = { ...next.analysis, ...(patch.category ? { category: patch.category as Category } : {}), ...(patch.tags ? { tags: patch.tags } : {}) };
    }
    this.upsertLocal(next);
    if (this.settings.mode === 'server') {
      const { item } = await this.api<{ item: SaveItem }>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      this.upsertLocal(item);
    } else {
      await this.db.items.put(next);
    }
  }

  async remove(id: string): Promise<void> {
    this.setItems(this.snap.items.filter((i) => i.id !== id));
    if (this.settings.mode === 'server') await this.api(`/items/${id}`, { method: 'DELETE' });
    else await this.db.items.delete(id);
  }

  /** Delete every save (the right to erasure). */
  async removeAll(): Promise<number> {
    const n = this.snap.items.length;
    if (this.settings.mode === 'server') await this.api('/me', { method: 'DELETE' });
    else await this.db.items.clear();
    this.setItems([]);
    return n;
  }

  async reanalyze(id: string): Promise<void> {
    if (this.settings.mode === 'server') {
      const { item } = await this.api<{ item: SaveItem }>(`/items/${id}/reanalyze`, { method: 'POST' });
      this.upsertLocal(item);
      return;
    }
    this.queueLocalAnalysis(id);
  }

  /** Import a WhatsApp "Export chat" text file: every link, with the date it was shared. */
  async importWhatsApp(text: string): Promise<{ found: number; added: number; duplicates: number }> {
    if (this.settings.mode === 'server') {
      const r = await this.api<{ found: number; added: number; duplicates: number }>('/import/whatsapp', {
        method: 'POST',
        body: text,
        headers: { 'content-type': 'text/plain' },
        signal: AbortSignal.timeout(120_000),
      });
      await this.load();
      return r;
    }
    const links = parseWhatsAppExport(text);
    let added = 0;
    let duplicates = 0;
    for (const l of links.slice(0, 2000)) {
      try {
        const r = await this.add({ url: l.url, note: l.text, channel: 'import', sharedAt: l.sharedAt });
        r.duplicate ? duplicates++ : added++;
      } catch {
        /* skip bad links */
      }
    }
    return { found: links.length, added, duplicates };
  }

  /** Fill an empty local library with the sample saves so every view can be tried. */
  async loadDemo(): Promise<void> {
    const items = demoItems();
    await this.db.items.bulkPut(items);
    this.setItems([...this.snap.items.filter((i) => !i.id.startsWith('demo-')), ...items]);
  }

  async clearDemo(): Promise<void> {
    const ids = this.snap.items.filter((i) => i.id.startsWith('demo-')).map((i) => i.id);
    await this.db.items.bulkDelete(ids);
    this.setItems(this.snap.items.filter((i) => !i.id.startsWith('demo-')));
  }

  exportJson(): string {
    return JSON.stringify({ app: 'SaveSutra', version: 1, exportedAt: nowIso(), items: this.snap.items }, null, 2);
  }

  /** Restore from a SaveSutra JSON export (local mode). */
  async importJson(text: string): Promise<number> {
    const data = JSON.parse(text) as { items?: SaveItem[] };
    const items = (data.items ?? []).filter((i) => i && typeof i.id === 'string' && typeof i.url === 'string');
    if (this.settings.mode === 'server') {
      let n = 0;
      for (const it of items) {
        await this.add({ url: it.url, note: it.note, channel: 'import', sharedAt: it.sharedAt ?? it.createdAt });
        n++;
      }
      return n;
    }
    let seq = (await this.db.items.orderBy('seq').last())?.seq ?? 0;
    const existing = new Set(this.snap.items.map((i) => i.url));
    const fresh = items.filter((i) => !existing.has(i.url)).map((i) => ({ ...i, seq: ++seq }));
    await this.db.items.bulkPut(fresh);
    await this.load();
    return fresh.length;
  }
}

export const library = new Library();

export function useLibrary(): Snapshot {
  return useSyncExternalStore(library.subscribe, library.getSnapshot);
}
