import { useRef, useState, type ReactNode } from 'react';
import { DEFAULT_GEMINI_MODEL } from '@savesutra/core';
import { Database, Download, ExternalLink, FileUp, KeyRound, Loader2, MessageCircle, Monitor, Moon, Server, ShieldCheck, Smartphone, Sparkles, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Label, Modal, Segmented } from '@/components/ui';
import { exportCsv, exportJson, exportXlsx } from '@/lib/exporters';
import { library, useLibrary } from '@/lib/library';
import { href } from '@/lib/router';
import { resetSettings, updateSettings, useSettings, type Mode, type Theme } from '@/lib/settings';

function Card({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">{icon}</span>
        <div>
          <h2 className="text-base font-extrabold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const { items } = useLibrary();
  const [serverUrl, setServerUrl] = useState(s.serverUrl);
  const [token, setToken] = useState(s.apiToken);
  const [key, setKey] = useState(s.geminiKey);
  const [model, setModel] = useState(s.geminiModel);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chatRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const hasDemo = items.some((i) => i.id.startsWith('demo-'));

  const switchMode = async (mode: Mode) => {
    updateSettings({ mode });
    await library.load();
  };

  const connect = async () => {
    setTesting(true);
    const r = await library.testServer(serverUrl, token);
    setTesting(false);
    if (!r.ok) return toast.error(r.message);
    updateSettings({ serverUrl: serverUrl.replace(/\/$/, ''), apiToken: token, mode: 'server' });
    await library.load();
    toast.success(`Connected. AI ${r.ai ? 'on' : 'off'} · WhatsApp bot ${r.whatsapp ? 'on' : 'off'}`);
  };

  const saveKey = () => {
    updateSettings({ geminiKey: key.trim(), geminiModel: model.trim() || DEFAULT_GEMINI_MODEL });
    toast.success(key.trim() ? 'AI key saved on this device' : 'AI key removed');
  };

  const importChat = async (file: File) => {
    setImporting(true);
    try {
      const r = await library.importWhatsApp(await file.text());
      toast.success(`Found ${r.found} links · added ${r.added}${r.duplicates ? ` · ${r.duplicates} already saved` : ''}. Analysing in the background.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>

      <Card icon={<Database size={18} />} title="Library" description="Where your saves live.">
        <Segmented<Mode>
          label="Library location"
          value={s.mode}
          onChange={switchMode}
          options={[
            { value: 'local', label: 'This device', icon: <Smartphone size={15} /> },
            { value: 'server', label: 'My server', icon: <Server size={15} /> },
          ]}
        />
        {s.mode === 'local' ? (
          <p className="text-sm text-muted">Private and offline-first. Connect your own server to use the WhatsApp bot and deep video analysis for Instagram, X and others.</p>
        ) : null}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="srv" hint="The URL where you deployed the SaveSutra server (see docs/DEPLOY.md).">
              Server URL
            </Label>
            <Input id="srv" inputMode="url" placeholder="https://savesutra.example.com" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tok">API token</Label>
            <Input id="tok" type="password" autoComplete="off" placeholder="The API_TOKEN you set on the server" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <Button variant="primary" onClick={connect} disabled={!serverUrl || !token || testing}>
            {testing && <Loader2 size={16} className="animate-spin" />} Test & connect
          </Button>
        </div>
      </Card>

      <Card icon={<Sparkles size={18} />} title="AI analysis" description="Summaries, key points and extraction. Without a key, smart rules still tag and pull out links.">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="gk"
            hint={
              <>
                Free key from{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
                  Google AI Studio
                </a>
                . Stored only on this device and sent only to Google.
              </>
            }
          >
            Gemini API key
          </Label>
          <Input id="gk" type="password" autoComplete="off" placeholder="AIza…" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gm" hint="“gemini-flash-latest” always uses Google’s current Flash model.">
            Model
          </Label>
          <Input id="gm" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <Button variant="primary" onClick={saveKey}>
          <KeyRound size={16} /> Save AI settings
        </Button>
        {s.mode === 'server' && <p className="text-xs text-muted">In server mode, analysis runs on your server with its own key.</p>}
      </Card>

      <Card icon={<MessageCircle size={18} />} title="Import from WhatsApp" description="Got years of links in a chat (say, with Maa)? In WhatsApp open the chat → ⋮ → More → Export chat → Without media, then pick the .txt file here.">
        <input ref={chatRef} type="file" accept=".txt,text/plain" className="sr-only" id="chat-file" onChange={(e) => e.target.files?.[0] && importChat(e.target.files[0])} />
        <Button onClick={() => chatRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} Choose exported chat (.txt)
        </Button>
        <p className="text-xs text-muted">Each link keeps the date it was shared, so it lands in the right place on your timeline. Only links are imported, not the chat.</p>
      </Card>

      <Card icon={<Download size={18} />} title="Export & backup" description={`${items.length} saves`}>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => exportXlsx(items).catch((e: Error) => toast.error(e.message))}>Excel</Button>
          <Button onClick={() => exportCsv(items).catch((e: Error) => toast.error(e.message))}>CSV</Button>
          <Button onClick={() => exportJson(library.exportJson()).catch((e: Error) => toast.error(e.message))}>JSON</Button>
        </div>
        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          id="json-file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              toast.success(`Restored ${await library.importJson(await f.text())} saves`);
            } catch (err) {
              toast.error(`Not a SaveSutra backup: ${(err as Error).message}`);
            }
          }}
        />
        <Button variant="ghost" onClick={() => jsonRef.current?.click()}>
          Restore from a JSON backup
        </Button>
      </Card>

      <Card icon={<Sun size={18} />} title="Appearance">
        <Segmented<Theme>
          label="Theme"
          value={s.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'System', icon: <Monitor size={15} /> },
            { value: 'light', label: 'Light', icon: <Sun size={15} /> },
            { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
          ]}
        />
      </Card>

      <Card icon={<ShieldCheck size={18} />} title="Privacy & data" description={s.consentAt ? `You accepted the privacy notice on ${new Date(s.consentAt).toLocaleDateString('en-IN')}.` : undefined}>
        <div className="flex flex-col gap-2">
          <a href={href({ name: 'privacy' })} className="inline-flex h-11 items-center justify-between rounded-xl border border-line px-4 text-sm font-bold text-ink no-underline hover:bg-surface-2">
            Read the privacy notice <ExternalLink size={15} />
          </a>
          {s.mode === 'local' && (
            <Button variant="soft" onClick={() => (hasDemo ? library.clearDemo() : library.loadDemo()).then(() => toast.success(hasDemo ? 'Sample saves removed' : 'Sample saves added'))}>
              {hasDemo ? 'Remove sample saves' : 'Add sample saves to explore'}
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete all my data
          </Button>
        </div>
      </Card>

      <p className="pb-4 text-center text-xs text-muted">
        SaveSutra {__APP_VERSION__} · © 2026 Manav Yadav. All rights reserved.
        <br />
        Not affiliated with Instagram, YouTube, WhatsApp, Meta or Google.
      </p>

      <Modal open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete all data?" description="Removes every save, note and setting, including your AI key and consent. This can’t be undone.">
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const n = await library.removeAll().catch(() => 0);
              resetSettings();
              setConfirmDelete(false);
              toast.success(`Deleted ${n} saves`);
              window.location.hash = '#/';
            }}
          >
            Delete everything
          </Button>
        </div>
      </Modal>
    </div>
  );
}
