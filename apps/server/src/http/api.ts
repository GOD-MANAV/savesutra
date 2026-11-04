import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context, type Next } from 'hono';
import { CATEGORIES, nowIso, parseWhatsAppExport, toCsv, toRows, type Category, type SaveItem } from '@savesutra/core';
import type { Config } from '../config.ts';
import { OWNER, type Store } from '../db.ts';
import { UnsafeUrlError } from '../fetch/safeFetch.ts';
import type { Pipeline } from '../pipeline.ts';
import { RateLimiter } from './rateLimit.ts';

function tokenOk(header: string | undefined, expected: string): boolean {
  if (!expected) return false;
  const got = (header ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const EDITABLE: Array<keyof SaveItem> = ['note', 'pinned', 'progress', 'board', 'collections', 'lastOpenedAt'];

/** REST API used by the app. Single-user: the bearer token identifies the owner. */
export function createApi(deps: { store: Store; pipeline: Pipeline; config: Config }) {
  const { store, pipeline, config } = deps;
  const api = new Hono();
  const limiter = new RateLimiter(config.limits.savesPerHour, 60 * 60 * 1000);

  const auth = async (c: Context, next: Next) => {
    if (!config.apiToken) return c.json({ error: 'Server has no API_TOKEN set. Add one to enable the API.' }, 503);
    if (!tokenOk(c.req.header('authorization'), config.apiToken)) return c.json({ error: 'Unauthorized' }, 401);
    await next();
  };

  api.get('/health', (c) =>
    c.json({ ok: true, version: '1.0.0', ai: Boolean(config.gemini.apiKey), model: config.gemini.apiKey ? config.gemini.model : null, whatsapp: Boolean(config.whatsapp.token) }),
  );

  api.use('/items/*', auth);
  api.use('/items', auth);
  api.use('/export', auth);
  api.use('/import/*', auth);
  api.use('/me', auth);

  api.get('/items', (c) => {
    const q = c.req.query('q');
    const category = c.req.query('category');
    const limit = Math.min(Number(c.req.query('limit') ?? 500) || 500, 2000);
    const items = q ? store.search(OWNER, q, limit) : store.list(OWNER, { limit, category: category || undefined });
    return c.json({ items: category && q ? items.filter((i) => i.analysis?.category === category) : items });
  });

  api.post('/items', async (c) => {
    if (!limiter.take(OWNER)) return c.json({ error: 'Too many saves this hour' }, 429);
    const body = await c.req.json<{ url?: string; note?: string; channel?: string; image?: { base64: string; mimeType: string } }>().catch(() => ({}) as Record<string, never>);
    if (!body.url || typeof body.url !== 'string' || body.url.length > 4000) return c.json({ error: 'Send { "url": "https://…" }' }, 400);
    if (body.image && (!/^image\/(png|jpe?g|webp)$/.test(body.image.mimeType) || body.image.base64.length > 8_000_000)) {
      return c.json({ error: 'Image must be PNG, JPEG or WebP under 6 MB' }, 400);
    }
    try {
      const { item, duplicate } = await pipeline.save(OWNER, {
        url: body.url,
        note: typeof body.note === 'string' ? body.note.slice(0, 2000) : undefined,
        channel: body.channel === 'share' ? 'share' : 'app',
        image: body.image,
      });
      return c.json({ item, duplicate }, duplicate ? 200 : 201);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return c.json({ error: err.message }, 400);
      if ((err as NodeJS.ErrnoException).code === 'ENOTFOUND') return c.json({ error: 'That website could not be found' }, 400);
      throw err;
    }
  });

  api.get('/items/:id', (c) => {
    const item = store.get(OWNER, c.req.param('id'));
    return item ? c.json({ item }) : c.json({ error: 'Not found' }, 404);
  });

  api.patch('/items/:id', async (c) => {
    const item = store.get(OWNER, c.req.param('id'));
    if (!item) return c.json({ error: 'Not found' }, 404);
    type Patch = Partial<SaveItem> & { category?: string; tags?: string[] };
    const patch: Patch = await c.req.json<Patch>().catch(() => ({}) as Patch);
    for (const k of EDITABLE) if (k in patch) (item as unknown as Record<string, unknown>)[k] = patch[k];
    if (item.analysis && patch.category && (CATEGORIES as readonly string[]).includes(patch.category)) {
      item.analysis.category = patch.category as Category;
    }
    if (item.analysis && Array.isArray(patch.tags)) item.analysis.tags = patch.tags.map(String).slice(0, 15);
    item.updatedAt = nowIso();
    store.update(OWNER, item);
    return c.json({ item });
  });

  api.post('/items/:id/reanalyze', (c) => {
    const item = pipeline.reanalyze(OWNER, c.req.param('id'));
    return item ? c.json({ item }) : c.json({ error: 'Not found' }, 404);
  });

  api.delete('/items/:id', (c) => (store.delete(OWNER, c.req.param('id')) ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)));

  /** Import a WhatsApp "Export chat" .txt (sent as text/plain). */
  api.post('/import/whatsapp', async (c) => {
    const text = await c.req.text();
    if (text.length > 20_000_000) return c.json({ error: 'File too large' }, 413);
    const links = parseWhatsAppExport(text);
    let added = 0;
    let duplicates = 0;
    const skipped: string[] = [];
    for (const l of links.slice(0, 2000)) {
      try {
        const r = await pipeline.save(OWNER, { url: l.url, note: l.text, channel: 'import', sharedAt: l.sharedAt });
        r.duplicate ? duplicates++ : added++;
      } catch {
        skipped.push(l.url);
      }
    }
    return c.json({ found: links.length, added, duplicates, skipped: skipped.length });
  });

  api.get('/export', (c) => {
    const items = store.list(OWNER, { limit: 100_000 });
    if (c.req.query('format') === 'csv') {
      c.header('content-type', 'text/csv; charset=utf-8');
      c.header('content-disposition', 'attachment; filename="savesutra.csv"');
      return c.body(toCsv(toRows(items)));
    }
    c.header('content-disposition', 'attachment; filename="savesutra.json"');
    return c.json({ exportedAt: nowIso(), items });
  });

  /** Right to erasure: delete every save on this server. */
  api.delete('/me', (c) => c.json({ deleted: store.deleteAll(OWNER) }));

  api.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Something went wrong' }, 500);
  });
  return api;
}
