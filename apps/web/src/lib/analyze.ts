import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  analyzeWithRules,
  buildUserPrompt,
  detectPlatform,
  extractLinks,
  isSafePublicUrl,
  metaFromHtml,
  parseModelOutput,
  type Analysis,
  type LinkMetadata,
} from '@savesutra/core';

export type PageMeta = LinkMetadata & { articleText?: string };

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

/**
 * Read a public page's title, caption and image on the device. In the Android
 * app this uses native HTTP (no CORS limits). In a browser only CORS-friendly
 * sources work, so YouTube goes through the public oEmbed endpoint.
 */
export async function fetchMetaOnDevice(url: string): Promise<PageMeta> {
  const { platform, kind } = detectPlatform(url);
  const base: PageMeta = { url, platform, kind };
  if (!isSafePublicUrl(url)) return base;
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA, 'Accept-Language': 'en-IN,en;q=0.9' }, connectTimeout: 10_000, readTimeout: 10_000 });
      if (res.status < 400 && typeof res.data === 'string') return { ...metaFromHtml(res.url || url, res.data), url };
    } else if (platform === 'youtube') {
      const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
      const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string; error?: string };
      if (!j.error) return { ...base, title: j.title, author: j.author_name, thumbnailUrl: j.thumbnail_url };
    } else {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000), credentials: 'omit' });
      if (r.ok && (r.headers.get('content-type') ?? '').includes('html')) return { ...metaFromHtml(url, await r.text()), url };
    }
  } catch {
    /* CORS or network: fall back to what the URL tells us */
  }
  return base;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
  file_data?: { mime_type: string; file_uri: string };
}

/** Call the Gemini REST API straight from the device with the user's own key. */
export async function geminiAnalyze(
  meta: PageMeta,
  key: string,
  model: string,
  opts: { youtubeUrl?: string; image?: { base64: string; mimeType: string } } = {},
): Promise<Analysis> {
  const parts: GeminiPart[] = [];
  let engine: Analysis['engine'] = 'ai-text';
  if (opts.youtubeUrl) {
    parts.push({ file_data: { mime_type: 'video/*', file_uri: opts.youtubeUrl } });
    engine = 'ai-video';
  } else if (opts.image) {
    parts.push({ inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 } });
    engine = 'ai-video';
  }
  let prompt = buildUserPrompt(meta, { hasVideo: engine === 'ai-video' });
  if (meta.articleText) prompt += `\n\nPage text:\n<<<\n${meta.articleText}\n>>>`;
  parts.push({ text: prompt });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_RESPONSE_SCHEMA, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gemini error ${res.status}`);
  }
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no text');
  return parseModelOutput(text, engine, model);
}

/**
 * Full on-device analysis: metadata, then Gemini if a key is set (YouTube
 * videos are read in full from their URL), else rules. Links found in the
 * caption are always kept.
 */
export async function analyzeOnDevice(
  url: string,
  opts: { geminiKey?: string; geminiModel: string; image?: { base64: string; mimeType: string } },
): Promise<{ meta: LinkMetadata; analysis: Analysis; warning?: string }> {
  if (url.startsWith('local-image:')) {
    const meta: LinkMetadata = { url, platform: 'web', kind: 'image', title: 'Screenshot' };
    if (!opts.geminiKey || !opts.image) {
      return { meta, analysis: { ...analyzeWithRules(meta), title: 'Screenshot', summary: 'Add an AI key in Settings to read screenshots.' } };
    }
    const analysis = await geminiAnalyze(meta, opts.geminiKey, opts.geminiModel, { image: opts.image });
    return { meta, analysis };
  }
  const meta = await fetchMetaOnDevice(url);
  const cleanMeta: LinkMetadata = { ...meta };
  delete (cleanMeta as PageMeta).articleText;
  const rules = () => analyzeWithRules({ ...meta, description: [meta.description, meta.articleText].filter(Boolean).join('\n\n') });
  if (!opts.geminiKey) return { meta: cleanMeta, analysis: rules() };
  try {
    const analysis = await geminiAnalyze(meta, opts.geminiKey, opts.geminiModel, {
      youtubeUrl: meta.platform === 'youtube' ? url : undefined,
      image: opts.image,
    });
    const seen = new Set(analysis.links.map((l) => l.url));
    for (const l of extractLinks(meta.description, 'caption')) if (!seen.has(l.url) && l.url !== url) analysis.links.push(l);
    return { meta: cleanMeta, analysis };
  } catch (err) {
    return { meta: cleanMeta, analysis: rules(), warning: `AI analysis failed (${(err as Error).message}). Used smart rules instead.` };
  }
}
