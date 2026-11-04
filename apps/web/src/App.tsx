import { useEffect, useState } from 'react';
import { FolderHeart, Library as LibraryIcon, Plus, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import { Logo } from '@/components/bits';
import { SaveSheet, type SaveDraft } from '@/components/SaveSheet';
import { Button } from '@/components/ui';
import { library, useLibrary } from '@/lib/library';
import { listenForShares, wireBackButton } from '@/lib/native';
import { href, useRoute, type Route } from '@/lib/router';
import { applyTheme, useSettings } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { CollectionScreen, CollectionsScreen } from '@/screens/CollectionsScreen';
import { ItemScreen } from '@/screens/ItemScreen';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { Onboarding } from '@/screens/Onboarding';
import { PrivacyScreen } from '@/screens/PrivacyScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

const NAV: Array<{ route: Route; label: string; icon: typeof LibraryIcon; match: Route['name'][] }> = [
  { route: { name: 'home' }, label: 'Library', icon: LibraryIcon, match: ['home', 'item'] },
  { route: { name: 'collections' }, label: 'Collections', icon: FolderHeart, match: ['collections', 'collection'] },
  { route: { name: 'settings' }, label: 'Settings', icon: SettingsIcon, match: ['settings', 'privacy'] },
];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'item':
      return <ItemScreen id={route.id} />;
    case 'collections':
      return <CollectionsScreen />;
    case 'collection':
      return <CollectionScreen id={route.id} />;
    case 'settings':
      return <SettingsScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    default:
      return <LibraryScreen />;
  }
}

export function App() {
  const settings = useSettings();
  const route = useRoute();
  const { items } = useLibrary();
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState<SaveDraft>();

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [settings.theme]);

  useEffect(() => {
    void library.load();
    wireBackButton();
    void listenForShares((s) => {
      setDraft({ text: s.text, image: s.image });
      setSaveOpen(true);
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, (route as { id?: string }).id]);

  const openSave = () => {
    setDraft(undefined);
    setSaveOpen(true);
  };

  if (!settings.onboarded || !settings.consentAt) {
    return (
      <>
        <Onboarding />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface p-5 md:flex">
        <a href={href({ name: 'home' })} className="flex items-center gap-2.5 text-ink no-underline">
          <Logo size={34} />
          <span className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight">SaveSutra</span>
            <span className="text-xs text-muted">{items.length} saves</span>
          </span>
        </a>
        <Button variant="accent" onClick={openSave}>
          <Plus size={18} /> Save something
        </Button>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = n.match.includes(route.name);
            return (
              <a key={n.label} href={href(n.route)} aria-current={active ? 'page' : undefined} className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold no-underline', active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2')}>
                <n.icon size={18} /> {n.label}
              </a>
            );
          })}
        </nav>
        <p className="mt-auto text-xs text-muted">{settings.mode === 'server' ? 'Synced with your server' : 'Stored on this device'}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur safe-top md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <a href={href({ name: 'home' })} className="flex items-center gap-2.5 text-ink no-underline">
              <Logo size={32} />
              <span className="flex flex-col leading-tight">
                <span className="text-[17px] font-extrabold tracking-tight">SaveSutra</span>
                <span className="text-xs text-muted">{items.length} saves</span>
              </span>
            </a>
            <a href={href({ name: 'settings' })} aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink">
              <SettingsIcon size={19} />
            </a>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Screen route={route} />
        </main>

        {/* Mobile bottom navigation + floating save button */}
        {route.name !== 'item' && (
          <Button variant="accent" size="lg" onClick={openSave} className="fixed right-4 bottom-[92px] z-30 h-14 rounded-2xl md:hidden" aria-label="Save something">
            <Plus size={20} /> Save
          </Button>
        )}
        <nav aria-label="Primary" className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface safe-bottom md:hidden', route.name === 'item' && 'hidden')}>
          <div className="grid h-[72px] grid-cols-3">
            {NAV.map((n) => {
              const active = n.match.includes(route.name);
              return (
                <a key={n.label} href={href(n.route)} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center justify-center gap-1 text-[11px] no-underline', active ? 'font-extrabold text-ink' : 'font-semibold text-muted')}>
                  <n.icon size={22} strokeWidth={active ? 2.4 : 2} /> {n.label}
                </a>
              );
            })}
          </div>
        </nav>
      </div>

      <SaveSheet open={saveOpen} onOpenChange={setSaveOpen} draft={draft} />
      <Toaster position="top-center" richColors closeButton theme={settings.theme === 'system' ? 'system' : settings.theme} />
    </div>
  );
}
