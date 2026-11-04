import { useMemo, useState } from 'react';
import { smartCollections, type EntityRef } from '@savesutra/core';
import { ArrowLeft, BookOpen, ChevronRight, Clock, ExternalLink, FolderHeart, Link2, MapPin, Pin, ShoppingBag, Sparkles, UtensilsCrossed, Wrench } from 'lucide-react';
import { SaveCard } from '@/components/SaveCard';
import { Button, EmptyState, SectionLabel } from '@/components/ui';
import { useLibrary } from '@/lib/library';
import { href } from '@/lib/router';

const ICONS: Record<string, React.ReactNode> = {
  pinned: <Pin size={18} />,
  todo: <Clock size={18} />,
  'ai-tools': <Sparkles size={18} />,
  tools: <Wrench size={18} />,
  places: <MapPin size={18} />,
  books: <BookOpen size={18} />,
  recipes: <UtensilsCrossed size={18} />,
  products: <ShoppingBag size={18} />,
  links: <Link2 size={18} />,
};

/** Smart collections, built automatically from what's inside every save. */
export function CollectionsScreen() {
  const { items } = useLibrary();
  const cols = useMemo(() => smartCollections(items), [items]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Collections</h1>
        <p className="mt-1 text-sm text-muted">Built for you from everything inside your saves. Nothing to organise.</p>
      </div>
      {cols.length === 0 ? (
        <EmptyState icon={<FolderHeart size={22} />} title="Collections appear as you save">
          Save a few reels, videos or articles. SaveSutra pulls out the tools, places, books and products inside them.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cols.map((c) => (
            <a key={c.id} href={href({ name: 'collection', id: c.id })} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-ink no-underline hover:shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">{ICONS[c.id] ?? <FolderHeart size={18} />}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-extrabold">{c.title}</span>
                <span className="truncate text-xs text-muted">{c.description}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-semibold">{c.entities?.length ?? c.items.length}</span>
                <span className="text-[11px] text-muted">{c.entities ? 'found' : 'saves'}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityRow({ e }: { e: EntityRef }) {
  const [open, setOpen] = useState(false);
  const search = e.type === 'place' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.name)}` : (e.url ?? `https://www.google.com/search?q=${encodeURIComponent(e.name)}`);
  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-sm font-bold">{e.name}</span>
          <span className="truncate text-xs text-muted">
            {e.detail ? `${e.detail} · ` : ''}in {e.items.length} save{e.items.length > 1 ? 's' : ''} · last {new Date(e.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </button>
        <a href={search} target="_blank" rel="noopener noreferrer" aria-label={`Open ${e.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-brand hover:bg-surface-2">
          {e.type === 'place' ? <MapPin size={17} /> : <ExternalLink size={16} />}
        </a>
      </div>
      {open && (
        <div className="flex flex-col gap-2 border-t border-line p-2">
          {e.items.map((it) => (
            <SaveCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </li>
  );
}

export function CollectionScreen({ id }: { id: string }) {
  const { items } = useLibrary();
  const c = useMemo(() => smartCollections(items).find((x) => x.id === id), [items, id]);
  if (!c) return <EmptyState icon={<FolderHeart size={22} />} title="Collection is empty" action={<Button onClick={() => history.back()}>Back</Button>} />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button size="icon" aria-label="Back" onClick={() => history.back()}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{c.title}</h1>
          <p className="text-sm text-muted">{c.description}</p>
        </div>
      </div>
      {c.entities ? (
        <>
          <SectionLabel>
            {c.entities.length} found across {c.items.length} saves
          </SectionLabel>
          <ul className="flex flex-col gap-2">
            {c.entities.map((e) => (
              <EntityRow key={`${e.type}:${e.name}`} e={e} />
            ))}
          </ul>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {c.items.map((it) => (
            <SaveCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
