import type { SaveItem } from './types.ts';
import { extractFirstUrl, platformLabel } from './url.ts';

/**
 * The WhatsApp bot is deliberately narrow: it saves links and searches the
 * user's own saves. It never answers open-ended questions, which keeps it
 * inside WhatsApp Business Platform rules on AI chatbots (effective 15 Jan 2026).
 */
export type BotCommand =
  | { type: 'save'; url: string; note?: string }
  | { type: 'find'; query: string }
  | { type: 'more'; seq: number }
  | { type: 'delete'; seq: number }
  | { type: 'recent' }
  | { type: 'help' }
  | { type: 'stop' }
  | { type: 'start' }
  | { type: 'unknown'; text: string };

export function parseBotCommand(input: string): BotCommand {
  const text = (input ?? '').trim();
  const url = extractFirstUrl(text);
  if (url) {
    const note = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { type: 'save', url, note: note.length >= 2 ? note.slice(0, 300) : undefined };
  }
  const lower = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = lower.match(/^(?:find|search|dhundo|dhoondo|khojo|search for|\?)\s+(.{1,100})$/))) return { type: 'find', query: m[1]!.trim() };
  if ((m = lower.match(/^(?:more|details|detail|open|show)\s*#?(\d{1,7})$/))) return { type: 'more', seq: Number(m[1]) };
  if ((m = lower.match(/^#?(\d{1,7})$/))) return { type: 'more', seq: Number(m[1]) };
  if ((m = lower.match(/^(?:delete|remove|del)\s*#?(\d{1,7})$/))) return { type: 'delete', seq: Number(m[1]) };
  if (/^(?:recent|latest|last|list)$/.test(lower)) return { type: 'recent' };
  if (/^(?:stop|unsubscribe|band karo|cancel)$/.test(lower)) return { type: 'stop' };
  if (/^(?:start|subscribe|join)$/.test(lower)) return { type: 'start' };
  if (/^(?:help|hi|hello|hey|namaste|menu|commands|\/start)$/.test(lower)) return { type: 'help' };
  return { type: 'unknown', text: text.slice(0, 200) };
}

const pad = (n: number) => `#${String(n).padStart(3, '0')}`;

function itemTitle(it: SaveItem): string {
  return it.analysis?.title ?? it.meta.title ?? it.url;
}

export const botReplies = {
  welcome(privacyUrl: string): string {
    return [
      '*Welcome to SaveSutra* 👋',
      'Send me any reel, video, post or link and I will save it with a short summary, the places and links inside, and a category.',
      '',
      'By sending a link you agree that SaveSutra processes it to build your notes. Details and how to delete your data:',
      privacyUrl,
      '',
      botReplies.help(),
    ].join('\n');
  },

  help(): string {
    return [
      '*Commands*',
      '• Send a link → save it',
      '• *find* goa cafés → search your saves',
      '• *more* 129 → full details of #129',
      '• *recent* → your last 5 saves',
      '• *delete* 129 → remove #129',
      '• *stop* → stop and delete your WhatsApp data',
    ].join('\n');
  },

  queued(seq: number): string {
    return `Got it. Saving as *${pad(seq)}* and analysing now. I'll message you when it's ready.`;
  },

  saved(it: SaveItem): string {
    const a = it.analysis;
    const places = a?.entities.filter((e) => e.type === 'place').length ?? 0;
    const links = a?.links.length ?? 0;
    const bits = [places && `${places} place${places > 1 ? 's' : ''}`, links && `${links} link${links > 1 ? 's' : ''}`].filter(Boolean);
    return [
      `*Saved ${pad(it.seq)} · ${a?.category ?? 'Other'}*`,
      itemTitle(it),
      a?.summary ? `_${a.summary}_` : '',
      bits.length ? `Found ${bits.join(' and ')}. Reply *more ${it.seq}* for details.` : `Reply *more ${it.seq}* for details.`,
    ]
      .filter(Boolean)
      .join('\n');
  },

  duplicate(it: SaveItem): string {
    return `You already saved this as *${pad(it.seq)}*: ${itemTitle(it)}. Reply *more ${it.seq}* to see it.`;
  },

  failed(seq: number, reason?: string): string {
    return `I saved the link as *${pad(seq)}*, but couldn't analyse it${reason ? ` (${reason})` : ''}. It's still searchable by its link and your note.`;
  },

  found(query: string, items: SaveItem[]): string {
    if (items.length === 0) return `No saves match “${query}”. Try fewer words, or *recent* to see your latest saves.`;
    const lines = items.slice(0, 5).map((it) => `${pad(it.seq)} ${itemTitle(it)} · ${platformLabel(it.platform)}`);
    return [`*${items.length} save${items.length > 1 ? 's' : ''} match “${query}”*`, ...lines, '', `Reply *more ${items[0]!.seq}* for details.`].join('\n');
  },

  recent(items: SaveItem[]): string {
    if (items.length === 0) return 'Nothing saved yet. Send me a link to start.';
    return ['*Your latest saves*', ...items.slice(0, 5).map((it) => `${pad(it.seq)} ${itemTitle(it)}`)].join('\n');
  },

  more(it: SaveItem): string {
    const a = it.analysis;
    const out = [`*${pad(it.seq)} · ${itemTitle(it)}*`, it.url];
    if (a?.summary) out.push('', a.summary);
    if (a?.keyPoints.length) out.push('', '*Key points*', ...a.keyPoints.slice(0, 5).map((k, i) => `${i + 1}. ${k}`));
    const places = a?.entities.filter((e) => e.type === 'place') ?? [];
    if (places.length) out.push('', '*Places*', ...places.slice(0, 6).map((p) => `📍 ${p.name}${p.detail ? ` – ${p.detail}` : ''}`));
    if (a?.links.length) out.push('', '*Links*', ...a.links.slice(0, 6).map((l) => `🔗 ${l.url}`));
    if (it.note) out.push('', `📝 ${it.note}`);
    if (a && a.engine !== 'rules') out.push('', '_AI-generated summary. Double-check important details._');
    return out.join('\n').slice(0, 3900);
  },

  notFound(seq: number): string {
    return `I couldn't find ${pad(seq)} in your saves.`;
  },

  deleted(seq: number): string {
    return `Deleted ${pad(seq)}.`;
  },

  stopped(): string {
    return 'Done. I deleted the saves you made over WhatsApp and won’t message you again. Send *start* any time to come back.';
  },

  started(): string {
    return 'Welcome back! Send me a link to save it.';
  },

  unknown(): string {
    return "I can only save links and search your saves. Send a link, or try *find* followed by a few words. Send *help* for all commands.";
  },

  rateLimited(): string {
    return 'You’re sending links very fast. Please wait a minute and try again.';
  },
};
