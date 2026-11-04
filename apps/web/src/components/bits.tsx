import { useState } from 'react';
import { CATEGORY_COLORS, formatDuration, platformLabel, type Category, type SaveItem } from '@savesutra/core';
import { AlertCircle, FileText, Globe, Image as ImageIcon, Loader2, MessageCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="SaveSutra">
      <rect width="32" height="32" rx="9" fill="#0B1220" />
      <path d="M11 8h10v16l-5-3.5L11 24z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 14c4-3 12 3 16 0" fill="none" stroke="#E2622F" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function categoryOf(item: SaveItem): Category {
  return item.analysis?.category ?? 'Other';
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold', className)} style={{ background: c.bg, color: c.fg }}>
      {category}
    </span>
  );
}

const kindNoun: Record<SaveItem['kind'], string> = {
  reel: 'Reel',
  video: 'Video',
  short: 'Short',
  post: 'Post',
  thread: 'Thread',
  article: 'Article',
  audio: 'Audio',
  image: 'Image',
  doc: 'Document',
  page: 'Page',
};

/** "INSTAGRAM REEL · AI" eyebrow above a title. */
export function Eyebrow({ item }: { item: SaveItem }) {
  const cat = categoryOf(item);
  const c = CATEGORY_COLORS[cat];
  const src = item.platform === 'web' ? (item.meta.siteName ?? hostOf(item.url)) : platformLabel(item.platform);
  return (
    <span className="truncate text-[11px] font-bold tracking-[0.04em] uppercase" style={{ color: `color-mix(in srgb, ${c.fg} 80%, var(--ink))` }}>
      {src} {kindNoun[item.kind]} · {cat}
    </span>
  );
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function KindIcon({ kind, size = 20 }: { kind: SaveItem['kind']; size?: number }) {
  if (kind === 'reel' || kind === 'video' || kind === 'short') return <Play size={size} fill="currentColor" />;
  if (kind === 'image') return <ImageIcon size={size} />;
  if (kind === 'article' || kind === 'doc') return <FileText size={size} />;
  if (kind === 'post' || kind === 'thread') return <MessageCircle size={size} />;
  return <Globe size={size} />;
}

/**
 * Thumbnail: the post's own image when we have one, else a calm coloured tile
 * with the content type. Remote images load with no referrer.
 */
export function Thumb({ item, className, tall }: { item: SaveItem; className?: string; tall?: boolean }) {
  const [broken, setBroken] = useState(false);
  const c = CATEGORY_COLORS[categoryOf(item)];
  const dur = formatDuration(item.meta.durationSec);
  const busy = item.status === 'queued' || item.status === 'processing';
  return (
    <div
      className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl', tall ? 'h-24 w-[72px]' : 'h-[72px] w-[72px]', className)}
      style={{ background: c.bg, color: c.fg }}
      aria-hidden="true"
    >
      {item.meta.thumbnailUrl && !broken ? (
        <img src={item.meta.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : busy ? (
        <Loader2 size={22} className="animate-spin" />
      ) : item.status === 'failed' ? (
        <AlertCircle size={22} />
      ) : (
        <KindIcon kind={item.kind} />
      )}
      {dur && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#0B1220] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{dur}</span>}
    </div>
  );
}

export function CountPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-2 px-2 text-[11px] font-semibold text-ink-2">{children}</span>;
}

export function itemTitle(item: SaveItem): string {
  if (item.analysis?.title) return item.analysis.title;
  if (item.meta.title) return item.meta.title;
  if (item.status === 'queued' || item.status === 'processing') return `Analysing ${platformLabel(item.platform)} ${kindNoun[item.kind].toLowerCase()}…`;
  return hostOf(item.url);
}

export function seqLabel(seq: number): string {
  return `#${String(seq).padStart(3, '0')}`;
}
