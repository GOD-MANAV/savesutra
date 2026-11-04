import { spawn } from 'node:child_process';
import { detectPlatform, isVideoKind, metaFromHtml, type LinkMetadata } from '@savesutra/core';

export { extractArticleText, metaFromHtml, parseHtmlMeta } from '@savesutra/core';
import { safeFetchText } from './safeFetch.ts';

interface YtDlpInfo {
  title?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  upload_date?: string;
  webpage_url?: string;
}

/** Run yt-dlp in metadata-only mode. Returns undefined if yt-dlp is missing or the site refuses. */
export function ytDlpInfo(url: string, bin = 'yt-dlp', timeoutMs = 25_000): Promise<YtDlpInfo | undefined> {
  return new Promise((resolveP) => {
    let out = '';
    let settled = false;
    const done = (v: YtDlpInfo | undefined) => {
      if (!settled) {
        settled = true;
        resolveP(v);
      }
    };
    let child;
    try {
      child = spawn(bin, ['--dump-single-json', '--skip-download', '--no-playlist', '--no-warnings', '--socket-timeout', '10', url], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return done(undefined);
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done(undefined);
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
      if (out.length > 5_000_000) child.kill('SIGKILL');
    });
    child.on('error', () => done(undefined));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return done(undefined);
      try {
        done(JSON.parse(out) as YtDlpInfo);
      } catch {
        done(undefined);
      }
    });
  });
}

/**
 * Gather what we can about a link before analysis. Video platforms go through
 * yt-dlp (title, description, duration); everything else through the page's
 * meta tags. Public content only: no cookies or logins are ever used.
 */
export async function fetchMetadata(url: string, opts: { ytDlpPath?: string } = {}): Promise<LinkMetadata & { articleText?: string }> {
  const info = detectPlatform(url);
  const base: LinkMetadata = { url, platform: info.platform, kind: info.kind };

  if (isVideoKind(info.kind) || info.platform === 'x' || info.platform === 'tiktok') {
    const y = await ytDlpInfo(url, opts.ytDlpPath);
    if (y) {
      return {
        ...base,
        title: y.title,
        description: y.description,
        author: y.uploader ?? y.channel,
        durationSec: y.duration,
        thumbnailUrl: y.thumbnail,
        publishedAt: y.upload_date ? `${y.upload_date.slice(0, 4)}-${y.upload_date.slice(4, 6)}-${y.upload_date.slice(6, 8)}` : undefined,
      };
    }
  }

  if (info.platform === 'youtube') {
    try {
      const r = await safeFetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { accept: 'application/json' });
      if (r.status === 200) {
        const j = JSON.parse(r.text) as { title?: string; author_name?: string; thumbnail_url?: string };
        return { ...base, title: j.title, author: j.author_name, thumbnailUrl: j.thumbnail_url };
      }
    } catch {
      /* fall through to HTML */
    }
  }

  try {
    const r = await safeFetchText(url);
    if (r.contentType.includes('html') || r.text.trimStart().startsWith('<')) return metaFromHtml(r.url, r.text);
    if (r.contentType.includes('pdf')) return { ...base, kind: 'doc', title: decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'PDF') };
    if (r.contentType.startsWith('image/')) return { ...base, kind: 'image' };
  } catch (err) {
    if ((err as Error).name === 'UnsafeUrlError') throw err;
  }
  return base;
}
