import { useEffect, useState } from 'react';
import { CATEGORIES, ENTITY_TYPES, displayUrl, platformLabel, type Category, type Entity, type EntityType, type SaveItem } from '@savesutra/core';
import { ArrowLeft, ArrowUpRight, Bot, ExternalLink, Link2, MapPin, MoreHorizontal, Pin, PinOff, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryBadge, Eyebrow, Thumb, hostOf, itemTitle, seqLabel } from '@/components/bits';
import { Button, EmptyState, Menu, Modal, SectionLabel, Segmented, Textarea } from '@/components/ui';
import { library, useLibrary } from '@/lib/library';
import { openExternal, shareLink } from '@/lib/native';

const ENTITY_TITLES: Record<EntityType, string> = {
  place: 'Places mentioned',
  tool: 'Tools & apps',
  product: 'Products',
  person: 'People',
  book: 'Books',
  price: 'Prices',
  step: 'Steps',
  ingredient: 'Ingredients',
  date: 'Dates',
};

function entityHref(e: Entity, item: SaveItem): string | undefined {
  if (e.type === 'place') return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.name} ${e.detail ?? ''}`.trim())}`;
  if (e.type === 'tool' || e.type === 'product' || e.type === 'book') {
    const first = e.name.toLowerCase().split(/\s+/)[0]!;
    return item.analysis?.links.find((l) => (l.label ?? l.url).toLowerCase().includes(first))?.url ?? `https://www.google.com/search?q=${encodeURIComponent(e.name)}`;
  }
  return undefined;
}

const SOURCE_LABEL = { caption: 'caption', description: 'description', audio: 'said in video', screen: 'shown on screen', page: 'on page' } as const;

/** Full detail of one save: summary, key points, everything extracted, your note and status. Design artboard 02. */
export function ItemScreen({ id }: { id: string }) {
  const { items, loading } = useLibrary();
  const item = items.find((i) => i.id === id);
  const [note, setNote] = useState(item?.note ?? '');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setNote(item?.note ?? '');
  }, [item?.id, item?.note]);
  useEffect(() => {
    if (item && item.status === 'ready') void library.update(item.id, { lastOpenedAt: new Date().toISOString() }).catch(() => undefined);
    // Only when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!item) {
    return loading ? null : (
      <EmptyState icon={<Link2 size={22} />} title="This save doesn’t exist" action={<Button onClick={() => history.back()}>Go back</Button>}>
        It may have been deleted.
      </EmptyState>
    );
  }

  const a = item.analysis;
  const busy = item.status === 'queued' || item.status === 'processing';
  const isLocalImage = item.url.startsWith('local-image:');
  const groups = ENTITY_TYPES.map((t) => [t, (a?.entities ?? []).filter((e) => e.type === t)] as const).filter(([, list]) => list.length);
  const saved = new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const via = { app: 'in the app', share: 'from the share sheet', whatsapp: 'via WhatsApp', web: 'on the web', import: 'from an imported chat' }[item.channel];

  const saveNote = () => {
    if ((item.note ?? '') !== note) void library.update(item.id, { note: note.trim() || undefined }).then(() => toast.success('Note saved'));
  };

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button size="icon" aria-label="Back" onClick={() => history.back()}>
          <ArrowLeft size={20} />
        </Button>
        <span className="truncate text-[13px] font-bold text-muted">
          {seqLabel(item.seq)} · Saved {saved} {via}
        </span>
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="icon" aria-label="More actions">
              <MoreHorizontal size={20} />
            </Button>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item onSelect={() => library.update(item.id, { pinned: !item.pinned })}>
              {item.pinned ? <PinOff size={16} /> : <Pin size={16} />} {item.pinned ? 'Unpin' : 'Pin to top'}
            </Menu.Item>
            {!isLocalImage && (
              <Menu.Item onSelect={() => library.reanalyze(item.id).then(() => toast('Analysing again…'))}>
                <RefreshCw size={16} /> Analyse again
              </Menu.Item>
            )}
            <Menu.Separator />
            <Menu.Item danger onSelect={() => setConfirm(true)}>
              <Trash2 size={16} /> Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </div>

      <header className="flex gap-4">
        <Thumb item={item} tall className="h-32 w-24" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow item={item} />
          <h1 className="text-xl leading-tight font-extrabold tracking-tight md:text-2xl">{itemTitle(item)}</h1>
          {item.meta.author && <span className="text-sm text-muted">{item.meta.author.startsWith('@') ? item.meta.author : item.meta.author}</span>}
          {!isLocalImage && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand no-underline">
              Open on {item.platform === 'web' ? hostOf(item.url) : platformLabel(item.platform)} <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      </header>

      <Segmented
        label="Status"
        value={item.progress ?? 'inbox'}
        onChange={(v) => library.update(item.id, { progress: v })}
        options={[
          { value: 'inbox', label: 'Saved' },
          { value: 'todo', label: 'To try' },
          { value: 'done', label: 'Done' },
        ]}
      />

      {busy && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface p-4 text-sm text-muted" role="status">
          <RefreshCw size={18} className="animate-spin text-brand" /> Analysing: reading the caption, audio and on-screen text. This usually takes under a minute.
        </div>
      )}
      {item.error && !busy && <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{item.error}</p>}

      {a?.summary && (
        <section aria-labelledby="sum" className="rounded-2xl bg-surface-2 p-4">
          <SectionLabel className="mb-1.5">
            <span id="sum">Summary</span>
          </SectionLabel>
          <p className="text-[15px] leading-relaxed">{a.summary}</p>
        </section>
      )}

      {a && a.keyPoints.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Key points</SectionLabel>
          <ol className="flex flex-col gap-1.5">
            {a.keyPoints.map((k, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-snug">
                <span className="mt-0.5 font-mono text-xs font-semibold text-muted">{String(i + 1).padStart(2, '0')}</span>
                {k}
              </li>
            ))}
          </ol>
        </section>
      )}

      {groups.map(([type, list]) => (
        <section key={type} className="flex flex-col gap-2">
          <SectionLabel>
            {ENTITY_TITLES[type]} · {list.length}
          </SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((e, i) => {
              const link = entityHref(e, item);
              const body = (
                <>
                  <span className="font-mono text-xs font-semibold text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{e.name}</span>
                    {e.detail && <span className="truncate text-xs text-muted">{e.detail}</span>}
                  </span>
                  {link && (type === 'place' ? <MapPin size={16} className="text-brand" /> : <ExternalLink size={15} className="text-brand" />)}
                </>
              );
              return link ? (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-ink no-underline hover:bg-surface-2">
                  {body}
                </a>
              ) : (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {a && a.links.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Links found inside · {a.links.length}</SectionLabel>
          {a.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-ink no-underline hover:bg-surface-2">
              <Link2 size={18} className="shrink-0 text-brand" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold">{l.label ?? hostOf(l.url)}</span>
                <span className="truncate font-mono text-[11px] text-muted">{displayUrl(l.url, 48)}</span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-muted">{SOURCE_LABEL[l.source]}</span>
            </a>
          ))}
        </section>
      )}

      {a && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Category & tags</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="cat" className="sr-only">
              Category
            </label>
            <div className="relative">
              <select
                id="cat"
                value={a.category}
                onChange={(e) => library.update(item.id, { category: e.target.value as Category })}
                className="h-9 appearance-none rounded-lg border border-line bg-surface pr-7 pl-2.5 text-[13px] font-bold"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <CategoryBadge category={a.category} className="hidden" />
            {a.tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center rounded-full bg-accent-soft px-2.5 text-xs font-semibold text-[#7A2A0C] dark:text-[#ffc6ad]">
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}

      {a?.transcriptExcerpt && (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Transcript excerpt</summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.transcriptExcerpt}</p>
        </details>
      )}

      <section className="flex flex-col gap-2">
        <label htmlFor="note">
          <SectionLabel>Your note</SectionLabel>
        </label>
        <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Why did you save this? Add context, who it’s for, when to try it…" maxLength={2000} />
      </section>

      {a && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Bot size={15} className="mt-0.5 shrink-0" />
          {a.engine === 'rules'
            ? 'Organised with on-device rules from the caption. Add an AI key in Settings for a full summary.'
            : `AI-generated (${a.model ?? 'Gemini'}) from the ${a.engine === 'ai-video' ? 'caption, audio and on-screen text' : 'caption and page text'}. Double-check important details. The video itself is not stored.`}
        </p>
      )}

      <div className="sticky bottom-3 z-10 grid grid-cols-2 gap-2 rounded-2xl bg-bg/80 p-1 backdrop-blur safe-bottom">
        <Button
          onClick={() =>
            shareLink(itemTitle(item), isLocalImage ? (a?.summary ?? '') : item.url).then((r) => r === 'copied' && toast.success('Link copied'), () => undefined)
          }
        >
          <Share2 size={17} /> Share
        </Button>
        <Button variant="primary" disabled={isLocalImage} onClick={() => openExternal(item.url)}>
          <ArrowUpRight size={17} /> Open original
        </Button>
      </div>

      <Modal open={confirm} onOpenChange={setConfirm} title="Delete this save?" description="Its summary, extracted details and your note are removed. This can’t be undone.">
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              setConfirm(false);
              await library.remove(item.id);
              toast.success('Deleted');
              history.back();
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </article>
  );
}
