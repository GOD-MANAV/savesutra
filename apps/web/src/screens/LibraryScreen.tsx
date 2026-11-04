import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, digest, onThisDay, searchItems, type Category, type SaveItem } from '@savesutra/core';
import { CalendarDays, Clock, History, Inbox, LayoutGrid, Network, Pin, Search, Sparkles, Table2, X } from 'lucide-react';
import { CategoryBadge } from '@/components/bits';
import { Chip, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { useLibrary } from '@/lib/library';
import { href } from '@/lib/router';
import { updateSettings, useSettings, type Layout } from '@/lib/settings';
import { CardsView } from '@/views/CardsView';
import { TimelineView } from '@/views/TimelineView';

const BoardView = lazy(() => import('@/views/BoardView').then((m) => ({ default: m.BoardView })));
const TableView = lazy(() => import('@/views/TableView').then((m) => ({ default: m.TableView })));

type StatusFilter = 'all' | 'todo' | 'done' | 'pinned';

function DigestCard({ items }: { items: SaveItem[] }) {
  const d = useMemo(() => digest(items), [items]);
  const past = useMemo(() => onThisDay(items), [items]);
  if (d.total === 0 && past.length === 0) return null;
  return (
    <section aria-label="Your week" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {d.total > 0 && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-[13px] font-extrabold">
            <Sparkles size={16} className="text-accent" /> This week you saved {d.total}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {d.byCategory.slice(0, 4).map((c) => (
              <span key={c.category} className="inline-flex items-center gap-1">
                <CategoryBadge category={c.category} />
                <span className="text-xs font-bold text-ink-2">{c.count}</span>
              </span>
            ))}
          </div>
          {d.topTools.length > 0 && (
            <p className="text-xs text-muted">
              Tools: <span className="font-semibold text-ink-2">{d.topTools.join(', ')}</span>
            </p>
          )}
        </div>
      )}
      {past.length > 0 && (
        <a href={href({ name: 'item', id: past[0]!.id })} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4 text-ink no-underline hover:shadow-card">
          <div className="flex items-center gap-2 text-[13px] font-extrabold">
            <History size={16} className="text-brand" /> On this day
          </div>
          <p className="line-clamp-2 text-sm font-semibold">{past[0]!.analysis?.title ?? past[0]!.url}</p>
          <p className="text-xs text-muted">
            Saved {new Date(past[0]!.sharedAt ?? past[0]!.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            {past.length > 1 ? ` · +${past.length - 1} more` : ''}
          </p>
        </a>
      )}
    </section>
  );
}

/** Home: search, weekly digest, layout switch (cards, table, board, timeline) and filters. */
export function LibraryScreen() {
  const { items, loading, error } = useLibrary();
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const layout = settings.layout;
  const setLayout = (l: Layout) => updateSettings({ layout: l });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const it of items) {
      const c = it.analysis?.category ?? 'Other';
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const visible = useMemo(() => {
    let list = query.trim() ? searchItems(items, query).map((h) => h.item) : items;
    if (category) list = list.filter((i) => (i.analysis?.category ?? 'Other') === category);
    if (status === 'todo') list = list.filter((i) => i.progress === 'todo');
    if (status === 'done') list = list.filter((i) => i.progress === 'done');
    if (status === 'pinned') list = list.filter((i) => i.pinned);
    return list;
  }, [items, query, category, status]);


  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor="search" className="sr-only">
          Search your saves
        </label>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="search"
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search “AI tools for slides” or “café hauz khas”"
          className="h-12 w-full rounded-2xl border border-line bg-surface pr-20 pl-10 text-[15px] outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        ) : (
          <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted md:block">Ctrl K</kbd>
        )}
      </div>

      {!query && !category && layout === 'cards' && <DigestCard items={items} />}

      <Segmented
        label="Layout"
        value={layout}
        onChange={setLayout}
        options={[
          { value: 'cards', label: 'Cards', icon: <LayoutGrid size={15} /> },
          { value: 'table', label: 'Table', icon: <Table2 size={15} /> },
          { value: 'board', label: 'Board', icon: <Network size={15} /> },
          { value: 'timeline', label: 'Timeline', icon: <CalendarDays size={15} /> },
        ]}
      />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by category">
        <Chip active={!category} onClick={() => setCategory(null)}>
          All <span className="opacity-70">{items.length}</span>
        </Chip>
        {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {c} <span className="opacity-70">{counts.get(c)}</span>
          </Chip>
        ))}
      </div>
      <div className="flex gap-2" role="group" aria-label="Filter by status">
        {(
          [
            ['all', 'Everything', Inbox],
            ['todo', 'To try', Clock],
            ['pinned', 'Pinned', Pin],
            ['done', 'Done', Sparkles],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            aria-pressed={status === v}
            onClick={() => setStatus(v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${status === v ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2'}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl border border-[#F4B4AE] bg-[#FEF1F0] p-3 text-sm text-[#8A1C12] dark:border-[#5a2420] dark:bg-[#2a1312] dark:text-[#ffb4ab]">Couldn’t load your library: {error}. Check Settings → Library.</p>}

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox size={22} />} title="Nothing saved yet">
          Share a reel, video, article or any link to SaveSutra from another app, tap <b>Save</b>, or import an old WhatsApp chat from Settings.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No matches">
          Try fewer words, or filters like <code className="font-mono">cat:ai</code>, <code className="font-mono">from:youtube</code> or <code className="font-mono">#goa</code>.
        </EmptyState>
      ) : layout === 'table' ? (
        <Suspense fallback={<Skeleton className="h-96" />}>
          <TableView items={visible} />
        </Suspense>
      ) : layout === 'board' ? (
        <Suspense fallback={<Skeleton className="h-96" />}>
          <BoardView items={visible} />
        </Suspense>
      ) : layout === 'timeline' ? (
        <TimelineView items={visible} />
      ) : (
        <CardsView items={visible} />
      )}
    </div>
  );
}
