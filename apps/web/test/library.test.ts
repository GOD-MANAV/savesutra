import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node has no localStorage; the settings module needs one.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
// No network in tests: metadata falls back to what the URL says.
vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

const { Library } = await import('../src/lib/library');
const { LocalDb } = await import('../src/lib/db');

let n = 0;
async function fresh() {
  const lib = new Library(new LocalDb(`test-${n++}`));
  await lib.load();
  return lib;
}

async function settle(lib: InstanceType<typeof Library>) {
  for (let i = 0; i < 100 && lib.getSnapshot().items.some((x) => x.status !== 'ready' && x.status !== 'failed'); i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('Library (local mode)', () => {
  beforeEach(() => store.clear());

  it('saves, analyses with rules, and dedupes', async () => {
    const lib = await fresh();
    const a = await lib.add({ url: 'see https://www.instagram.com/reel/AbC/?igsh=1', channel: 'app', note: 'for goa' });
    expect(a.duplicate).toBe(false);
    expect(a.item.seq).toBe(1);
    await settle(lib);
    const item = lib.getSnapshot().items[0]!;
    expect(item.status).toBe('ready');
    expect(item.analysis?.engine).toBe('rules');
    const b = await lib.add({ url: 'https://instagram.com/reels/AbC', channel: 'share' });
    expect(b.duplicate).toBe(true);
  });

  it('edits, restores demo data and deletes everything', async () => {
    const lib = await fresh();
    await lib.loadDemo();
    const first = lib.getSnapshot().items[0]!;
    await lib.update(first.id, { progress: 'todo', category: 'Finance', note: 'x' });
    const edited = lib.getSnapshot().items.find((i) => i.id === first.id)!;
    expect(edited.progress).toBe('todo');
    expect(edited.analysis?.category).toBe('Finance');
    const json = lib.exportJson();
    expect(JSON.parse(json).items.length).toBe(lib.getSnapshot().items.length);
    expect(await lib.removeAll()).toBeGreaterThan(5);
    expect(lib.getSnapshot().items).toHaveLength(0);
    expect(await lib.importJson(json)).toBeGreaterThan(5);
  });

  it('imports a WhatsApp chat with original dates', async () => {
    const lib = await fresh();
    const r = await lib.importWhatsApp('12/10/23, 9:41 pm - Manav: https://youtu.be/XYZ\n13/10/23, 9:00 am - Maa: nice');
    expect(r).toEqual({ found: 1, added: 1, duplicates: 0 });
    expect(lib.getSnapshot().items[0]!.sharedAt?.startsWith('2023-10')).toBe(true);
  });

  it('rejects text with no link', async () => {
    const lib = await fresh();
    await expect(lib.add({ url: 'hello there', channel: 'app' })).rejects.toThrow(/link/);
  });
});
