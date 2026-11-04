import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeUrl, searchableFields, tokenize, type SaveItem } from '@savesutra/core';

/** The default library: the person who runs this server and uses the app. */
export const OWNER = 'me';

export interface WaUser {
  waId: string;
  owner: string;
  consentAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
}

/**
 * SQLite storage (Node's built-in driver, no native build). Each item is kept
 * as JSON plus an FTS5 index for search. Only notes and links are stored,
 * never downloaded media.
 */
export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(join(file, '..'), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        seq INTEGER NOT NULL,
        url_key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (owner, url_key),
        UNIQUE (owner, seq)
      );
      CREATE INDEX IF NOT EXISTS items_owner_created ON items(owner, created_at DESC);
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        item_id UNINDEXED, owner UNINDEXED, title, tags, entities, note, summary, body, links,
        tokenize = 'unicode61 remove_diacritics 2'
      );
      CREATE TABLE IF NOT EXISTS wa_users (
        wa_id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        consent_at TEXT,
        stopped_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wa_seen (
        message_id TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL
      );
    `);
  }

  static open(dataDir: string): Store {
    return new Store(join(dataDir, 'savesutra.db'));
  }

  private static urlKey(url: string): string {
    try {
      return normalizeUrl(url);
    } catch {
      return url;
    }
  }

  nextSeq(owner: string): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM items WHERE owner = ?').get(owner) as { n: number };
    return Number(row.n);
  }

  findByUrl(owner: string, url: string): SaveItem | undefined {
    const row = this.db.prepare('SELECT data FROM items WHERE owner = ? AND url_key = ?').get(owner, Store.urlKey(url)) as
      | { data: string }
      | undefined;
    return row ? (JSON.parse(row.data) as SaveItem) : undefined;
  }

  insert(owner: string, item: SaveItem): SaveItem {
    this.db
      .prepare('INSERT INTO items (id, owner, seq, url_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(item.id, owner, item.seq, Store.urlKey(item.url), JSON.stringify(item), item.createdAt, item.updatedAt);
    this.index(owner, item);
    return item;
  }

  update(owner: string, item: SaveItem): SaveItem {
    this.db
      .prepare('UPDATE items SET data = ?, updated_at = ? WHERE id = ? AND owner = ?')
      .run(JSON.stringify(item), item.updatedAt, item.id, owner);
    this.index(owner, item);
    return item;
  }

  private index(owner: string, item: SaveItem): void {
    this.db.prepare('DELETE FROM items_fts WHERE item_id = ?').run(item.id);
    const f = searchableFields(item);
    this.db
      .prepare('INSERT INTO items_fts (item_id, owner, title, tags, entities, note, summary, body, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(item.id, owner, f.title ?? '', f.tags ?? '', f.entities ?? '', f.note ?? '', f.summary ?? '', f.body ?? '', f.links ?? '');
  }

  get(owner: string, id: string): SaveItem | undefined {
    const row = this.db.prepare('SELECT data FROM items WHERE id = ? AND owner = ?').get(id, owner) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as SaveItem) : undefined;
  }

  /** Lookup without an owner, used only by the background pipeline. */
  getAny(id: string): { owner: string; item: SaveItem } | undefined {
    const row = this.db.prepare('SELECT owner, data FROM items WHERE id = ?').get(id) as { owner: string; data: string } | undefined;
    return row ? { owner: row.owner, item: JSON.parse(row.data) as SaveItem } : undefined;
  }

  getBySeq(owner: string, seq: number): SaveItem | undefined {
    const row = this.db.prepare('SELECT data FROM items WHERE owner = ? AND seq = ?').get(owner, seq) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as SaveItem) : undefined;
  }

  list(owner: string, opts: { limit?: number; offset?: number; category?: string } = {}): SaveItem[] {
    const rows = this.db
      .prepare('SELECT data FROM items WHERE owner = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(owner, opts.limit ?? 500, opts.offset ?? 0) as Array<{ data: string }>;
    const items = rows.map((r) => JSON.parse(r.data) as SaveItem);
    return opts.category ? items.filter((i) => i.analysis?.category === opts.category) : items;
  }

  /** Full-text search with BM25 ranking, weighting title and tags highest. */
  search(owner: string, query: string, limit = 50): SaveItem[] {
    const terms = tokenize(query).slice(0, 12);
    if (terms.length === 0) return this.list(owner, { limit });
    const match = terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
    const rows = this.db
      .prepare(
        `SELECT i.data AS data
           FROM items_fts f JOIN items i ON i.id = f.item_id
          WHERE items_fts MATCH ? AND f.owner = ?
          ORDER BY bm25(items_fts, 0, 0, 5.0, 4.0, 3.0, 3.0, 2.0, 1.0, 1.0)
          LIMIT ?`,
      )
      .all(match, owner, limit) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as SaveItem);
  }

  delete(owner: string, id: string): boolean {
    this.db.prepare('DELETE FROM items_fts WHERE item_id = ?').run(id);
    const res = this.db.prepare('DELETE FROM items WHERE id = ? AND owner = ?').run(id, owner);
    return Number(res.changes) > 0;
  }

  deleteAll(owner: string): number {
    this.db.prepare('DELETE FROM items_fts WHERE owner = ?').run(owner);
    const res = this.db.prepare('DELETE FROM items WHERE owner = ?').run(owner);
    return Number(res.changes);
  }

  /** Delete only the saves that arrived through WhatsApp (used by the "stop" command). */
  deleteByChannel(owner: string, channel: SaveItem['channel']): number {
    const ids = this.list(owner, { limit: 100_000 })
      .filter((i) => i.channel === channel)
      .map((i) => i.id);
    for (const id of ids) this.delete(owner, id);
    return ids.length;
  }

  countSince(owner: string, sinceIso: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM items WHERE owner = ? AND created_at >= ?').get(owner, sinceIso) as { n: number };
    return Number(row.n);
  }

  // WhatsApp users -----------------------------------------------------------

  getWaUser(waId: string): WaUser | undefined {
    const r = this.db.prepare('SELECT * FROM wa_users WHERE wa_id = ?').get(waId) as Record<string, string | null> | undefined;
    return r
      ? { waId: r.wa_id!, owner: r.owner!, consentAt: r.consent_at ?? null, stoppedAt: r.stopped_at ?? null, createdAt: r.created_at! }
      : undefined;
  }

  upsertWaUser(u: WaUser): void {
    this.db
      .prepare(
        `INSERT INTO wa_users (wa_id, owner, consent_at, stopped_at, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(wa_id) DO UPDATE SET owner = excluded.owner, consent_at = excluded.consent_at, stopped_at = excluded.stopped_at`,
      )
      .run(u.waId, u.owner, u.consentAt, u.stoppedAt, u.createdAt);
  }

  /** Meta retries webhooks, so each message id is processed once. Returns false if already seen. */
  markMessageSeen(messageId: string): boolean {
    const res = this.db.prepare('INSERT OR IGNORE INTO wa_seen (message_id, seen_at) VALUES (?, ?)').run(messageId, new Date().toISOString());
    this.db.prepare("DELETE FROM wa_seen WHERE seen_at < datetime('now', '-7 days')").run();
    return Number(res.changes) > 0;
  }
}
