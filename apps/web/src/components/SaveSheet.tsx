import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { library } from '@/lib/library';
import { navigate } from '@/lib/router';
import { useSettings } from '@/lib/settings';
import { Button, Input, Label, Sheet, Textarea } from './ui';
import { seqLabel } from './bits';

export interface SaveDraft {
  text?: string;
  image?: { base64: string; mimeType: string };
}

async function fileToImage(file: File): Promise<{ base64: string; mimeType: string }> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP image');
  if (file.size > 6_000_000) throw new Error('Image must be under 6 MB');
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return { base64, mimeType: file.type };
}

/** "Save a link" bottom sheet: paste a link, add an optional note or screenshot. */
export function SaveSheet({ open, onOpenChange, draft }: { open: boolean; onOpenChange: (o: boolean) => void; draft?: SaveDraft }) {
  const settings = useSettings();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<SaveDraft['image']>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl(draft?.text ?? '');
      setImage(draft?.image);
      setNote('');
    }
  }, [open, draft]);

  const paste = async () => {
    try {
      setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      toast.error('Clipboard is not available. Long-press the field to paste.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const imgOnly = Boolean(image) && !/https?:\/\/|\w\.\w{2,}\//.test(url);
      if (imgOnly && settings.mode === 'server') throw new Error('Add the link too: your server needs a link for each save.');
      if (imgOnly && !settings.geminiKey) throw new Error('Reading screenshots needs an AI key (Settings → AI).');
      const { item, duplicate } = await library.add({ url: imgOnly ? '' : url, note, channel: 'app', image });
      onOpenChange(false);
      if (duplicate) toast.info(`Already saved as ${seqLabel(item.seq)}`, { action: { label: 'Open', onClick: () => navigate({ name: 'item', id: item.id }) } });
      else toast.success(`Saved as ${seqLabel(item.seq)}. Analysing…`, { action: { label: 'Open', onClick: () => navigate({ name: 'item', id: item.id }) } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Save something" description="Paste any link: a reel, video, article, tweet, tool or web page. Add a screenshot if you like.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-url">Link</Label>
          <div className="flex gap-2">
            <Input id="save-url" inputMode="url" autoComplete="off" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button size="icon" aria-label="Paste from clipboard" onClick={paste}>
              <ClipboardPaste size={18} />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-note" hint="Why are you saving this? It is searchable too.">
            Note (optional)
          </Label>
          <Textarea id="save-note" rows={2} placeholder="e.g. try this tool for the case competition" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="save-image"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImage(await fileToImage(f).catch((err: Error) => (toast.error(err.message), undefined)));
              e.target.value = '';
            }}
          />
          {image ? (
            <div className="flex items-center gap-3 rounded-xl border border-line p-2">
              <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Attached screenshot" className="h-14 w-14 rounded-lg object-cover" />
              <span className="flex-1 text-sm font-semibold">Screenshot attached</span>
              <Button size="icon" variant="ghost" aria-label="Remove screenshot" onClick={() => setImage(undefined)}>
                <X size={18} />
              </Button>
            </div>
          ) : (
            <Button variant="soft" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} /> Add a screenshot
            </Button>
          )}
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={busy || (!url.trim() && !image)}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : null} Save
        </Button>
        <p className="text-xs text-muted">
          {settings.mode === 'server'
            ? 'Your server analyses it: caption, audio and on-screen text. The video is deleted after analysis.'
            : settings.geminiKey
              ? 'Analysed on this phone with your Gemini key. YouTube videos are read in full.'
              : 'Analysed on this phone with smart rules. Add a free AI key in Settings for full summaries.'}
        </p>
      </form>
    </Sheet>
  );
}
