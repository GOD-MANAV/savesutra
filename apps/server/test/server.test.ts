import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '@savesutra/core';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Store } from '../src/db.ts';
import { metaFromHtml, parseHtmlMeta } from '../src/fetch/metadata.ts';
import { verifySignature } from '../src/http/whatsapp.ts';

const TOKEN = 'test-token-123';
const SECRET = 'app-secret';

function setup(withAi = true) {
  const config = loadConfig({
    API_TOKEN: TOKEN,
    WHATSAPP_APP_SECRET: SECRET,
    WHATSAPP_VERIFY_TOKEN: 'verify-me',
    WHATSAPP_OWNER_NUMBER: '919999900000',
    DATA_DIR: '/tmp/unused',
  } as NodeJS.ProcessEnv);
  const sent: Array<{ to: string; body: string }> = [];
  const analysis: Analysis = {
    title: '3 hidden cafés in Hauz Khas',
    summary: 'Three budget cafés.',
    keyPoints: ['Rooftop'],
    category: 'Food',
    tags: ['delhi', 'cafes'],
    entities: [{ type: 'place', name: 'Hauz Khas Village' }],
    links: [{ url: 'https://linktr.ee/x', source: 'screen' }],
    engine: 'ai-video',
    confidence: 0.9,
  };
  const ctx = createApp({
    config,
    store: new Store(':memory:'),
    analyzer: withAi ? { analyze: async () => structuredClone(analysis) } : undefined,
    fetchMeta: async (url) => ({ url, platform: 'instagram', kind: 'reel', title: 'x on Instagram: "cafés"', description: 'Best cafés #delhi bit.ly/abc' }),
    download: async () => undefined,
    checkHost: async () => undefined,
    send: async (to, body) => {
      sent.push({ to, body });
    },
  });
  const call = (path: string, init: RequestInit = {}) =>
    ctx.app.request(path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  return { ...ctx, call, sent, config };
}

describe('API', () => {
  it('requires the token', async () => {
    const { app } = setup();
    expect((await app.request('/api/items')).status).toBe(401);
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('saves, analyses, dedupes, searches, edits, exports and deletes', async () => {
    const { call, pipeline } = setup();
    const r1 = await call('/api/items', { method: 'POST', body: JSON.stringify({ url: 'look https://www.instagram.com/reel/ABC/?igsh=zz' }) });
    expect(r1.status).toBe(201);
    const { item } = (await r1.json()) as { item: { id: string; seq: number; url: string } };
    expect(item.url).toBe('https://www.instagram.com/reel/ABC/');
    expect(item.seq).toBe(1);
    await pipeline.drain();

    const got = (await (await call(`/api/items/${item.id}`)).json()) as { item: { status: string; analysis: Analysis } };
    expect(got.item.status).toBe('ready');
    expect(got.item.analysis.category).toBe('Food');
    // Caption links found by rules are merged into the AI result.
    expect(got.item.analysis.links.map((l) => l.url)).toEqual(['https://linktr.ee/x', 'https://bit.ly/abc']);

    const dup = await call('/api/items', { method: 'POST', body: JSON.stringify({ url: 'https://instagram.com/reels/ABC' }) });
    expect(dup.status).toBe(200);
    expect(((await dup.json()) as { duplicate: boolean }).duplicate).toBe(true);

    const search = (await (await call('/api/items?q=hauz')).json()) as { items: unknown[] };
    expect(search.items).toHaveLength(1);
    expect(((await (await call('/api/items?q=nothinghere')).json()) as { items: unknown[] }).items).toHaveLength(0);

    const patched = (await (await call(`/api/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ note: 'with Maa', progress: 'todo', category: 'Travel', seq: 99 }) })).json()) as {
      item: { note: string; progress: string; seq: number; analysis: Analysis };
    };
    expect(patched.item).toMatchObject({ note: 'with Maa', progress: 'todo', seq: 1 });
    expect(patched.item.analysis.category).toBe('Travel');
    expect(((await (await call('/api/items?q=maa')).json()) as { items: unknown[] }).items).toHaveLength(1);

    const csv = await (await call('/api/export?format=csv')).text();
    expect(csv).toContain('3 hidden cafés in Hauz Khas');

    expect(((await (await call('/api/me', { method: 'DELETE' })).json()) as { deleted: number }).deleted).toBe(1);
  });

  it('refuses private and non-http links', async () => {
    const { call } = setup();
    for (const url of ['http://127.0.0.1/admin', 'file:///etc/passwd', 'http://169.254.169.254/']) {
      expect((await call('/api/items', { method: 'POST', body: JSON.stringify({ url }) })).status, url).toBe(400);
    }
  });

  it('falls back to rules without an AI key', async () => {
    const { call, pipeline } = setup(false);
    const r = (await (await call('/api/items', { method: 'POST', body: JSON.stringify({ url: 'https://www.instagram.com/reel/XYZ/' }) })).json()) as { item: { id: string } };
    await pipeline.drain();
    const got = (await (await call(`/api/items/${r.item.id}`)).json()) as { item: { analysis: Analysis } };
    expect(got.item.analysis.engine).toBe('rules');
    expect(got.item.analysis.tags).toContain('delhi');
  });

  it('imports a WhatsApp chat export with original dates', async () => {
    const { call, pipeline } = setup(false);
    const txt = '12/10/23, 9:41 pm - Manav: https://www.instagram.com/reel/AAA/\n13/10/23, 9:00 am - Maa: https://youtu.be/BBB';
    const res = (await (await call('/api/import/whatsapp', { method: 'POST', body: txt, headers: { 'content-type': 'text/plain' } })).json()) as { added: number };
    expect(res.added).toBe(2);
    await pipeline.drain();
    const list = (await (await call('/api/items')).json()) as { items: Array<{ sharedAt: string; channel: string }> };
    expect(list.items.every((i) => i.channel === 'import' && i.sharedAt.startsWith('2023-10'))).toBe(true);
  });
});

describe('WhatsApp webhook', () => {
  const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
  const payload = (from: string, text: string, id: string) =>
    JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, type: 'text', text: { body: text } }] } }] }] });

  it('verifies the subscription and signatures', async () => {
    const { app } = setup();
    expect(await (await app.request('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42')).text()).toBe('42');
    expect((await app.request('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42')).status).toBe(403);
    const body = payload('919999900000', 'hi', 'm0');
    expect((await app.request('/webhooks/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=00' } })).status).toBe(401);
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it('runs the save → notify → find → more → stop flow', async () => {
    const { app, sent, pipeline } = setup();
    const post = async (text: string, id: string, from = '919999900000') => {
      const body = payload(from, text, id);
      return app.request('/webhooks/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body) } });
    };
    await post('https://www.instagram.com/reel/ABC/ for sunday', 'm1');
    await pipeline.drain();
    expect(sent.map((s) => s.body.split('\n')[0])).toEqual(['*Welcome to SaveSutra* 👋', 'Got it. Saving as *#001* and analysing now. I\'ll message you when it\'s ready.', '*Saved #001 · Food*']);

    await post('https://www.instagram.com/reel/ABC/', 'm1'); // retried delivery: ignored
    expect(sent).toHaveLength(3);

    await post('find cafes', 'm2');
    expect(sent.at(-1)!.body).toContain('#001 3 hidden cafés');
    await post('more 1', 'm3');
    expect(sent.at(-1)!.body).toContain('📍 Hauz Khas Village');
    await post('tell me a joke', 'm4');
    expect(sent.at(-1)!.body).toMatch(/only save links/);
    await post('stop', 'm5');
    expect(sent.at(-1)!.body).toMatch(/deleted/);
    await post('find cafes', 'm6');
    expect(sent.at(-1)!.body).toMatch(/deleted/); // no reply after stop

    const before = sent.length;
    await post('hi', 'm7', '911111111111'); // not on the allow-list
    expect(sent.length).toBe(before);
  });
});

describe('metadata parsing', () => {
  it('reads Open Graph tags from social pages', () => {
    const html = `<html><head><title>x</title>
      <meta property="og:title" content="Delhi Food Trail on Instagram: &quot;3 hidden caf&#xe9;s&quot;">
      <meta property="og:description" content="Best caf&eacute;s #delhi">
      <meta property="og:image" content="https://cdn/x.jpg"></head></html>`;
    expect(parseHtmlMeta(html)['og:image']).toBe('https://cdn/x.jpg');
    const m = metaFromHtml('https://www.instagram.com/reel/A/', html);
    expect(m).toMatchObject({ platform: 'instagram', kind: 'reel', title: '3 hidden cafés', author: 'Delhi Food Trail' });
  });
});
