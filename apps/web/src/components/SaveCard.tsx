import type { SaveItem } from '@savesutra/core';
import { CheckCircle2, Clock, Link2, MapPin, Pin, StickyNote, Wrench } from 'lucide-react';
import { href } from '@/lib/router';
import { CountPill, Eyebrow, Thumb, itemTitle } from './bits';

/** One save in the Cards view, matching design artboard 01. */
export function SaveCard({ item }: { item: SaveItem }) {
  const a = item.analysis;
  const busy = item.status === 'queued' || item.status === 'processing';
  const places = a?.entities.filter((e) => e.type === 'place').length ?? 0;
  const tools = a?.entities.filter((e) => e.type === 'tool').length ?? 0;
  const links = a?.links.length ?? 0;
  return (
    <a
      href={href({ name: 'item', id: item.id })}
      className={`group flex gap-3 rounded-2xl border bg-surface p-3 text-ink no-underline transition-shadow hover:shadow-card ${busy ? 'border-dashed border-line-strong' : 'border-line'}`}
    >
      <Thumb item={item} tall={item.kind === 'reel' || item.kind === 'short'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Eyebrow item={item} />
          {item.pinned && <Pin size={13} className="shrink-0 text-accent" aria-label="Pinned" />}
        </div>
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">{itemTitle(item)}</h3>
        {busy ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <span className="text-xs text-muted">{item.status === 'queued' ? 'Waiting to analyse…' : 'Reading caption, audio and on-screen text…'}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />
            </div>
          </div>
        ) : (
          a?.summary && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{a.summary}</p>
        )}
        {!busy && (places || links || tools || item.note || item.progress === 'todo' || item.progress === 'done') ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.progress === 'todo' && (
              <CountPill>
                <Clock size={12} /> To try
              </CountPill>
            )}
            {item.progress === 'done' && (
              <CountPill>
                <CheckCircle2 size={12} /> Done
              </CountPill>
            )}
            {tools > 0 && (
              <CountPill>
                <Wrench size={12} /> {tools} tool{tools > 1 ? 's' : ''}
              </CountPill>
            )}
            {places > 0 && (
              <CountPill>
                <MapPin size={12} /> {places} place{places > 1 ? 's' : ''}
              </CountPill>
            )}
            {links > 0 && (
              <CountPill>
                <Link2 size={12} /> {links} link{links > 1 ? 's' : ''}
              </CountPill>
            )}
            {item.note && (
              <CountPill>
                <StickyNote size={12} /> Note
              </CountPill>
            )}
          </div>
        ) : null}
      </div>
    </a>
  );
}
