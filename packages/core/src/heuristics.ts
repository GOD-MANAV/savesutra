import { classify } from './classify.ts';
import {
  extractHashtags,
  extractIngredients,
  extractLinks,
  extractListLines,
  extractMentions,
  extractPlaces,
  extractPrices,
  truncateSentence,
} from './extract.ts';
import type { Analysis, Entity, LinkMetadata } from './types.ts';
import { detectPlatform, normalizeUrl } from './url.ts';

/**
 * Open Graph titles from social sites wrap the caption, e.g.
 * `Delhi Food Trail on Instagram: "3 hidden cafés…"`. Return the caption part.
 */
export function cleanSocialTitle(title: string | undefined): { title?: string; author?: string } {
  if (!title) return {};
  const t = title.trim();
  const m = t.match(/^(.{1,80}?) on (?:Instagram|Facebook|Threads|TikTok|X|Twitter|LinkedIn)\s*[:|-]\s*["“]?([\s\S]+?)["”]?\s*$/i);
  if (m) return { author: m[1]!.trim(), title: m[2]!.trim() };
  const yt = t.replace(/\s*-\s*YouTube$/i, '');
  return { title: yt };
}

function stripNoise(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[\p{L}\p{M}\p{N}_]+/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() ?? u.hostname;
    const words = decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').trim();
    if (words.length > 3 && /[a-z]{3}/i.test(words) && !/^[\w-]{8,14}$/.test(slug)) {
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
    return `${detectPlatform(url).label} from ${u.hostname.replace(/^www\./, '')}`;
  } catch {
    return 'Saved link';
  }
}

/**
 * Analyse a link with rules only: no network, no AI key. Pulls links,
 * hashtags, places, prices and list items out of the caption, and guesses a
 * category from keywords. Used offline and as the fallback when AI fails.
 */
export function analyzeWithRules(meta: LinkMetadata, transcript?: string): Analysis {
  const cleaned = cleanSocialTitle(meta.title);
  const caption = meta.description ?? '';
  const fullText = [cleaned.title, caption, transcript].filter(Boolean).join('\n');
  const hashtags = extractHashtags(fullText);
  const { category, confidence } = classify(fullText, hashtags);

  const firstCaptionLine = stripNoise(caption.split(/\n/).find((l) => stripNoise(l).length > 8) ?? '');
  let title = cleaned.title && cleaned.title.length > 3 ? cleaned.title : firstCaptionLine || titleFromUrl(meta.url);
  title = truncateSentence(stripNoise(title.split(/\n/)[0] ?? title) || title, 90);

  const body = stripNoise(caption);
  const summary = body
    ? truncateSentence(body, 240)
    : `${detectPlatform(meta.url).label}${meta.author ? ` by ${meta.author}` : ''}. Add an AI key in Settings for a full summary.`;

  const entities: Entity[] = [
    ...extractPlaces(fullText),
    ...extractIngredients(caption),
    ...extractPrices(fullText).slice(0, 5).map((p) => ({ type: 'price' as const, name: p })),
  ];
  const mentions = extractMentions(caption).slice(0, 3);
  for (const m of mentions) entities.push({ type: 'person', name: `@${m}` });

  let selfUrl = '';
  try {
    selfUrl = normalizeUrl(meta.url);
  } catch {
    /* keep empty */
  }
  const links = [...extractLinks(caption, 'caption'), ...extractLinks(transcript, 'audio')].filter(
    (l, i, arr) => l.url !== selfUrl && arr.findIndex((x) => x.url === l.url) === i,
  );

  const tags = [...new Set([...hashtags.slice(0, 8), ...(category !== 'Other' ? [category.toLowerCase()] : [])])];

  return {
    title,
    summary,
    keyPoints: extractListLines(caption, 6),
    category,
    tags,
    entities,
    links,
    transcriptExcerpt: transcript ? truncateSentence(transcript, 400) : undefined,
    engine: 'rules',
    confidence,
  };
}
