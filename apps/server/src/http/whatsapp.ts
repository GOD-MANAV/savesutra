import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { botReplies, parseBotCommand, type SaveItem } from '@savesutra/core';
import type { Config } from '../config.ts';
import { OWNER, type Store } from '../db.ts';
import { UnsafeUrlError } from '../fetch/safeFetch.ts';
import type { Pipeline } from '../pipeline.ts';
import { RateLimiter } from './rateLimit.ts';

export type SendText = (to: string, body: string) => Promise<void>;

/** Send a WhatsApp text message through the Cloud API. */
export function createCloudApiSender(config: Config): SendText {
  return async (to, body) => {
    const { token, phoneNumberId, graphVersion } = config.whatsapp;
    if (!token || !phoneNumberId) return;
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error('WhatsApp send failed', res.status, await res.text().catch(() => ''));
  };
}

/** Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export function verifySignature(rawBody: string, header: string | undefined, appSecret: string): boolean {
  if (!appSecret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(header.slice(7), 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { caption?: string };
  video?: { caption?: string };
}

/**
 * WhatsApp Cloud API webhook. The bot only saves links and searches the
 * sender's saves (no general-purpose chat). It replies inside the 24-hour
 * customer-service window opened by the user's own message.
 */
export function createWhatsAppWebhook(deps: { store: Store; pipeline: Pipeline; config: Config; send: SendText }) {
  const { store, pipeline, config, send } = deps;
  const app = new Hono();
  const limiter = new RateLimiter(Math.max(10, Math.floor(config.limits.savesPerHour / 2)), 60 * 60 * 1000);
  /** Items saved over WhatsApp → who to notify when analysis finishes. */
  const pending = new Map<string, string>();

  pipeline.onDone(async (_owner, item) => {
    const to = pending.get(item.id);
    if (!to) return;
    pending.delete(item.id);
    await send(to, item.analysis ? botReplies.saved(item) : botReplies.failed(item.seq));
  });

  const isAllowed = (waId: string) =>
    config.whatsapp.openToAll || waId === config.whatsapp.ownerNumber || config.whatsapp.allowedNumbers.includes(waId);
  const ownerFor = (waId: string) => (waId === config.whatsapp.ownerNumber ? OWNER : `wa:${waId}`);

  async function handle(msg: WaMessage): Promise<void> {
    const waId = msg.from.replace(/\D/g, '');
    if (!isAllowed(waId)) return; // Silently ignore numbers that are not on the allow-list.
    if (!store.markMessageSeen(msg.id)) return;

    const text = msg.text?.body ?? msg.image?.caption ?? msg.video?.caption ?? '';
    const cmd = parseBotCommand(text);
    let user = store.getWaUser(waId);
    const owner = ownerFor(waId);

    if (!user) {
      user = { waId, owner, consentAt: null, stoppedAt: null, createdAt: new Date().toISOString() };
      store.upsertWaUser(user);
      await send(waId, botReplies.welcome(config.privacyUrl));
      if (cmd.type !== 'save') return;
    }
    if (user.stoppedAt && cmd.type !== 'start') return;

    switch (cmd.type) {
      case 'save': {
        if (!limiter.take(waId)) return send(waId, botReplies.rateLimited());
        // Sending a link after the welcome notice is the user's consent to process it.
        if (!user.consentAt) store.upsertWaUser({ ...user, consentAt: new Date().toISOString() });
        try {
          const { item, duplicate } = await pipeline.save(owner, { url: cmd.url, note: cmd.note, channel: 'whatsapp' });
          if (duplicate) return send(waId, botReplies.duplicate(item));
          pending.set(item.id, waId);
          return send(waId, botReplies.queued(item.seq));
        } catch (err) {
          if (err instanceof UnsafeUrlError) return send(waId, `Sorry, I can't save that link: ${err.message}.`);
          return send(waId, 'Sorry, I could not save that link. Please check it and try again.');
        }
      }
      case 'find': {
        const hits = store.search(owner, cmd.query, 5);
        return send(waId, botReplies.found(cmd.query, hits));
      }
      case 'more': {
        const it = store.getBySeq(owner, cmd.seq);
        return send(waId, it ? botReplies.more(it) : botReplies.notFound(cmd.seq));
      }
      case 'delete': {
        const it = store.getBySeq(owner, cmd.seq);
        if (!it) return send(waId, botReplies.notFound(cmd.seq));
        store.delete(owner, it.id);
        return send(waId, botReplies.deleted(cmd.seq));
      }
      case 'recent':
        return send(waId, botReplies.recent(store.list(owner, { limit: 5 })));
      case 'stop': {
        store.deleteByChannel(owner, 'whatsapp');
        store.upsertWaUser({ ...user, stoppedAt: new Date().toISOString() });
        return send(waId, botReplies.stopped());
      }
      case 'start':
        store.upsertWaUser({ ...user, stoppedAt: null });
        return send(waId, botReplies.started());
      case 'help':
        return send(waId, botReplies.help());
      default:
        return send(waId, botReplies.unknown());
    }
  }

  // Meta calls this once when you set up the webhook.
  app.get('/', (c) => {
    const mode = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge') ?? '';
    if (mode === 'subscribe' && config.whatsapp.verifyToken && token === config.whatsapp.verifyToken) return c.text(challenge);
    return c.text('Forbidden', 403);
  });

  app.post('/', async (c) => {
    const raw = await c.req.text();
    if (!verifySignature(raw, c.req.header('x-hub-signature-256'), config.whatsapp.appSecret)) return c.text('Invalid signature', 401);
    let body: { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }> };
    try {
      body = JSON.parse(raw);
    } catch {
      return c.text('Bad JSON', 400);
    }
    const messages = body.entry?.flatMap((e) => e.changes?.flatMap((ch) => ch.value?.messages ?? []) ?? []) ?? [];
    // Acknowledge fast; Meta retries if we take longer than a few seconds.
    const work = Promise.all(messages.map((m) => handle(m).catch((err) => console.error('WhatsApp handler error', err))));
    if (process.env.NODE_ENV === 'test') await work;
    return c.text('OK');
  });

  return { app, handle, pendingCount: () => pending.size };
}

export type { SaveItem };
