import type { Entity, ExtractedLink, LinkSource } from './types.ts';
import { normalizeUrl } from './url.ts';

const FULL_URL_G = /\bhttps?:\/\/[^\s<>"'`]+/gi;
// Bare links such as "linktr.ee/creator" or "bit.ly/3abc" that creators put in captions.
const BARE_LINK_G =
  /(?<![@\w.\/])(?:[a-z0-9-]+\.)+(?:com|in|io|ai|ee|ly|co|me|app|dev|org|net|gg|link|to|xyz|shop|store|page|site|tv|so)\/[^\s<>"'`]*/gi;
const TRAILING = /[),.;:!?\]}'"»”’]+$/;

function cleanUrl(raw: string): string | null {
  let s = raw.replace(TRAILING, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    return normalizeUrl(s);
  } catch {
    return null;
  }
}

/** Every link in a block of text, de-duplicated, in order of appearance. */
export function extractLinks(text: string | undefined, source: LinkSource): ExtractedLink[] {
  if (!text) return [];
  const found: ExtractedLink[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const url = cleanUrl(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      found.push({ url, source });
    }
  };
  for (const m of text.matchAll(FULL_URL_G)) push(m[0]);
  const withoutFull = text.replace(FULL_URL_G, ' ');
  for (const m of withoutFull.matchAll(BARE_LINK_G)) push(m[0]);
  return found;
}

/** Hashtags in any script (#delhi, #खाना), lower-cased, without the #. */
export function extractHashtags(text: string | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[^\p{L}\p{N}_&])#([\p{L}\p{M}\p{N}_]{2,40})/gu)) {
    out.add(m[1]!.toLowerCase());
  }
  return [...out];
}

export function extractMentions(text: string | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[^\w@.])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g)) {
    out.add(m[1]!);
  }
  return [...out];
}

const PRICE_G =
  /(?:₹\s?|rs\.?\s?|inr\s?)\d[\d,]*(?:\.\d+)?\s?(?:k|l|lakh|lac|cr|crore)?\b|\$\s?\d[\d,]*(?:\.\d+)?\s?k?\b|\b\d[\d,]*\s?(?:rupees|rs|inr)\b/gi;

/** Prices like ₹499, Rs. 1,200, ₹12k, $20 or "500 rupees". */
export function extractPrices(text: string | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(PRICE_G)) out.add(m[0].replace(/\s+/g, ' ').trim());
  return [...out];
}

const BULLET_RE = /^\s*(?:\d{1,2}[.)\]:-]|[-•*▪︎●◦✓✔☑➡→»]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?)\s*(.{3,160})$/u;

/** Numbered or bulleted lines from a caption: often the creator's own key points. */
export function extractListLines(text: string | undefined, max = 8): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(BULLET_RE);
    if (!m) continue;
    const item = m[1]!.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
    if (item.length >= 3 && !/^https?:\/\//.test(item)) out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** Places marked the way creators usually mark them: "📍 Name", "Location: …", "Address: …". */
export function extractPlaces(text: string | undefined): Entity[] {
  if (!text) return [];
  const out: Entity[] = [];
  const seen = new Set<string>();
  const re = /(?:📍|📌|\blocation\s*[:\-]|\baddress\s*[:\-]|\bwhere\s*[:\-])\s*([^\n#|]{3,80})/giu;
  for (const m of text.matchAll(re)) {
    const raw = m[1]!.trim().replace(/[,.;]+$/, '');
    const [name, ...rest] = raw.split(/\s[-–—]\s|,\s(?=[A-Z])/);
    const key = name!.toLowerCase();
    if (!seen.has(key) && name!.length >= 3) {
      seen.add(key);
      out.push({ type: 'place', name: name!.trim(), detail: rest.join(', ').trim() || undefined });
    }
  }
  return out;
}

/** Ingredient lines under an "Ingredients" heading. */
export function extractIngredients(text: string | undefined): Entity[] {
  if (!text) return [];
  const m = text.match(/ingredients?\s*[:\-]?\s*\n([\s\S]{3,800}?)(?:\n\s*\n|method|steps|instructions|recipe|$)/i);
  if (!m) return [];
  return m[1]!
    .split(/\n|,(?![^(]*\))/)
    .map((s) => s.replace(/^[\s\-•*\d.)]+/, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 60)
    .slice(0, 15)
    .map((name) => ({ type: 'ingredient' as const, name }));
}

/** Collapse whitespace and cut to a sentence boundary near `max` characters. */
export function truncateSentence(text: string, max = 220): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('। '));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`).trim();
}
