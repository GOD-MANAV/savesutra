import { extractFirstUrl, normalizeUrl } from './url.ts';

export interface ImportedLink {
  url: string;
  /** ISO date-time of the message, if the export had one. */
  sharedAt?: string;
  sender?: string;
  /** The rest of the message, kept as the save's note. */
  text?: string;
}

// Android: "12/10/23, 9:41 pm - Manav: text"  ·  iOS: "[12/10/23, 9:41:22 PM] Manav: text"
const LINE_RE =
  /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}?):\s([\s\S]*)$/i;

function toIso(d: number, m: number, y: number, h: number, min: number, s: number, ampm?: string, monthFirst = false): string | undefined {
  let day = d;
  let month = m;
  if (monthFirst || month > 12) [day, month] = [month, day];
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  let hour = h;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(year, month - 1, day, hour, min, s);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Parse a WhatsApp "Export chat" .txt file and return every link that was
 * shared, with its date. Handles Android and iOS formats, 12- and 24-hour
 * clocks and multi-line messages. Dates are read day-first (India) unless
 * that is impossible.
 */
export function parseWhatsAppExport(text: string, opts: { monthFirst?: boolean } = {}): ImportedLink[] {
  const messages: Array<{ sharedAt?: string; sender?: string; body: string }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[‎‏‪-‮]/g, '');
    const m = line.match(LINE_RE);
    if (m) {
      const [, d, mo, y, h, mi, s, ampm, sender, body] = m;
      messages.push({
        sharedAt: toIso(Number(d), Number(mo), Number(y), Number(h), Number(mi), Number(s ?? 0), ampm, opts.monthFirst),
        sender: sender!.trim(),
        body: body ?? '',
      });
    } else if (messages.length) {
      messages[messages.length - 1]!.body += `\n${line}`;
    }
  }
  const out: ImportedLink[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    // A message may hold several links; take each one.
    let rest = msg.body;
    for (let guard = 0; guard < 10; guard++) {
      const url = extractFirstUrl(rest);
      if (!url) break;
      rest = rest.replace(url.replace(/\/$/, ''), ' ');
      let key = url;
      try {
        key = normalizeUrl(url);
      } catch {
        /* keep raw */
      }
      if (seen.has(key)) continue;
      seen.add(key);
      const note = msg.body.replace(/https?:\/\/\S+/g, '').replace(/<Media omitted>|This message was deleted/gi, '').trim();
      out.push({ url: key, sharedAt: msg.sharedAt, sender: msg.sender, text: note || undefined });
    }
  }
  return out;
}
