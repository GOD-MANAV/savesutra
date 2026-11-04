import { cleanSocialTitle } from './heuristics.ts';
import type { LinkMetadata } from './types.ts';
import { detectPlatform } from './url.ts';

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Read Open Graph, Twitter card and standard meta tags from an HTML page. */
export function parseHtmlMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const head = html.slice(0, 400_000);
  for (const m of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0];
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
    if (key && content !== undefined && !(key in out)) out[key] = decodeEntities(content).trim();
  }
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) out['html:title'] = decodeEntities(title).replace(/\s+/g, ' ').trim();
  return out;
}

/** Visible article text for web pages (rough, no DOM), so articles can be summarised too. */
export function extractArticleText(html: string, max = 8000): string {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|br|div|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 40)
    .join('\n')
    .slice(0, max);
}

export function metaFromHtml(url: string, html: string): LinkMetadata & { articleText?: string } {
  const info = detectPlatform(url);
  const m = parseHtmlMeta(html);
  const rawTitle = m['og:title'] ?? m['twitter:title'] ?? m['html:title'];
  const cleaned = cleanSocialTitle(rawTitle);
  const description = m['og:description'] ?? m['twitter:description'] ?? m['description'];
  const kind = info.platform === 'web' && (m['og:type'] ?? '').includes('video') ? 'video' : info.kind;
  const meta: LinkMetadata & { articleText?: string } = {
    url,
    platform: info.platform,
    kind,
    title: cleaned.title ?? rawTitle,
    description,
    author: cleaned.author ?? m['author'] ?? m['article:author'] ?? m['twitter:creator'],
    thumbnailUrl: m['og:image'] ?? m['twitter:image'],
    siteName: m['og:site_name'],
    publishedAt: m['article:published_time'],
  };
  if (info.platform === 'web') meta.articleText = extractArticleText(html);
  return meta;
}

