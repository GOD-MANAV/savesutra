import type { ContentKind, Platform } from './types.ts';

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/i;
const BARE_URL_RE =
  /\b(?:www\.)?(?:instagram\.com|youtu\.be|youtube\.com|x\.com|twitter\.com|linkedin\.com|facebook\.com|fb\.watch|tiktok\.com|reddit\.com|threads\.net|pinterest\.com|pin\.it|open\.spotify\.com)\/[^\s<>"'`]+/i;
const TRAILING_PUNCT = /[),.;:!?\]}'"»”’]+$/;

/** Query parameters that only track the sharer and never change the content. */
const TRACKING_PARAMS = new Set([
  'igsh',
  'igshid',
  'si',
  'fbclid',
  'gclid',
  'mibextid',
  'ref',
  'ref_src',
  'ref_url',
  'feature',
  's',
  't_ref',
  'share_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'rdt',
  'sharing_id',
  'trackingId',
  'rcm',
]);

/**
 * Pull the first link out of free text. Shared text often looks like
 * "Check this out! https://www.instagram.com/reel/abc/?igsh=xyz", and some
 * apps share links without the scheme.
 */
export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(URL_RE) ?? text.match(BARE_URL_RE);
  if (!m) return null;
  let raw = m[0].replace(TRAILING_PUNCT, '');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

/**
 * Canonical form of a link so the same reel shared twice is saved once:
 * strips tracking parameters, fragments and mobile hosts, and rewrites short
 * links (youtu.be, twitter.com) to their canonical address.
 */
export function normalizeUrl(input: string): string {
  const u = new URL(input.trim());
  u.hash = '';
  u.username = '';
  u.password = '';
  let host = u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');

  if (host === 'twitter.com') host = 'x.com';
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    const out = new URL('https://www.youtube.com/watch');
    if (id) out.searchParams.set('v', id);
    return out.toString();
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return `https://www.youtube.com/shorts/${shorts[1]}`;
    const v = u.searchParams.get('v');
    if (u.pathname === '/watch' && v) return `https://www.youtube.com/watch?v=${v}`;
  }
  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/);
    if (m) {
      const kind = m[1] === 'p' ? 'p' : m[1] === 'tv' ? 'tv' : 'reel';
      return `https://www.instagram.com/${kind}/${m[2]}/`;
    }
  }

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) u.searchParams.delete(key);
  }
  const keepWww = ['youtube.com', 'instagram.com', 'linkedin.com', 'facebook.com', 'reddit.com', 'pinterest.com'];
  u.hostname = keepWww.includes(host) ? `www.${host}` : host;
  let out = u.toString();
  if (u.pathname !== '/' && out.endsWith('/') && !u.search && host !== 'instagram.com') out = out.slice(0, -1);
  return out;
}

export interface PlatformInfo {
  platform: Platform;
  kind: ContentKind;
  /** Display label, e.g. "Instagram reel". */
  label: string;
}

const LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  threads: 'Threads',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
  web: 'Web',
};

export function platformLabel(p: Platform): string {
  return LABELS[p];
}

/** Work out the platform and content kind from a URL. */
export function detectPlatform(url: string): PlatformInfo {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { platform: 'web', kind: 'page', label: 'Link' };
  }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');
  const path = u.pathname;
  const make = (platform: Platform, kind: ContentKind, noun: string): PlatformInfo => ({
    platform,
    kind,
    label: `${LABELS[platform]} ${noun}`.trim(),
  });

  if (host.endsWith('instagram.com')) {
    if (/^\/(?:[\w.]+\/)?reels?\//.test(path)) return make('instagram', 'reel', 'reel');
    if (/^\/(?:[\w.]+\/)?tv\//.test(path)) return make('instagram', 'video', 'video');
    return make('instagram', 'post', 'post');
  }
  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    if (path.startsWith('/shorts/')) return make('youtube', 'short', 'Short');
    return make('youtube', 'video', 'video');
  }
  if (host === 'x.com' || host === 'twitter.com') return make('x', 'post', 'post');
  if (host.endsWith('linkedin.com')) {
    if (path.startsWith('/pulse/')) return make('linkedin', 'article', 'article');
    return make('linkedin', 'post', 'post');
  }
  if (host.endsWith('facebook.com') || host === 'fb.watch') {
    if (/\/(reel|watch|videos)\b/.test(path) || host === 'fb.watch') return make('facebook', 'reel', 'reel');
    return make('facebook', 'post', 'post');
  }
  if (host.endsWith('tiktok.com')) return make('tiktok', 'video', 'video');
  if (host.endsWith('reddit.com') || host === 'redd.it') return make('reddit', 'thread', 'thread');
  if (host.endsWith('threads.net') || host.endsWith('threads.com')) return make('threads', 'post', 'post');
  if (host.endsWith('pinterest.com') || host === 'pin.it') return make('pinterest', 'post', 'pin');
  if (host === 'open.spotify.com') return make('spotify', 'audio', 'track');
  return { platform: 'web', kind: 'article', label: host };
}

/** Video-first platforms where the audio and frames carry most of the meaning. */
export function isVideoKind(kind: ContentKind): boolean {
  return kind === 'reel' || kind === 'video' || kind === 'short';
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/** True for loopback, private, link-local and other non-public addresses (IPv4 or IPv6 literals). */
export function isPrivateAddress(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4ToInt(h.startsWith('::ffff:') ? h.slice(7) : h);
  if (v4 !== null) {
    return PRIVATE_V4.some(([base, bits]) => {
      const b = ipv4ToInt(base)!;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return ((v4 & mask) >>> 0) === ((b & mask) >>> 0);
    });
  }
  if (h.includes(':')) {
    return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h);
  }
  return false;
}

/**
 * Guard against SSRF: only plain public http(s) URLs on standard ports are
 * fetched. The server repeats this check on the resolved IP address.
 */
export function isSafePublicUrl(input: string): boolean {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== '80' && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }
  if (isPrivateAddress(host)) return false;
  if (!host.includes('.') && !host.includes(':')) return false;
  return true;
}

/** Short display form of a URL: "instagram.com/reel/C7x…". */
export function displayUrl(url: string, max = 42): string {
  try {
    const u = new URL(url);
    const s = (u.hostname.replace(/^www\./, '') + u.pathname + u.search).replace(/\/$/, '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return url;
  }
}
