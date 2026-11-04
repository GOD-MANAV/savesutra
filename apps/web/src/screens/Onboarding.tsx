import { useState } from 'react';
import { ArrowRight, Check, LayoutGrid, Link2, Search, Sparkles } from 'lucide-react';
import { Logo } from '@/components/bits';
import { Button } from '@/components/ui';
import { library } from '@/lib/library';
import { updateSettings } from '@/lib/settings';
import { PrivacyNotice } from './PrivacyScreen';

/** First run: what it does → privacy notice and explicit consent → start empty or with samples. */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);

  const finish = async (withSamples: boolean) => {
    updateSettings({ onboarded: true });
    if (withSamples) await library.loadDemo();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg safe-top safe-bottom">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-8">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-xl font-extrabold tracking-tight">SaveSutra</span>
        </div>

        {step === 0 && (
          <>
            <div className="flex flex-col gap-3">
              <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-tight">Everything you save, finally makes sense.</h1>
              <p className="text-base leading-relaxed text-ink-2">
                Reels, videos, articles, tweets, AI tools, recipes, screenshots: share anything to SaveSutra. It understands it, files it by topic and date, and pulls out the links, tools and places inside.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                [Link2, 'Share from any app', 'Or forward links to the WhatsApp bot, or import an old chat.'],
                [Sparkles, 'It reads the whole thing', 'Caption, audio and on-screen text, not just the title.'],
                [Search, 'Find it the way you remember it', '“that AI tool for slides”, “café in hauz khas”.'],
                [LayoutGrid, 'Cards, table, board or timeline', 'Export to Excel any time.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Link2;
                return (
                  <li key={t as string} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <I size={18} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-extrabold">{t as string}</span>
                      <span className="text-sm text-muted">{d as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Button variant="accent" size="lg" className="mt-auto" onClick={() => setStep(1)}>
              Get started <ArrowRight size={18} />
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Before you start</h1>
            <div className="max-h-[52dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-4">
              <PrivacyNotice />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-1">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />
              <span className="text-sm">I’ve read the notice and agree that SaveSutra processes the links I save to build my notes. I can withdraw this any time in Settings.</span>
            </label>
            <div className="mt-auto flex gap-2">
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button
                variant="accent"
                className="flex-1"
                disabled={!agree}
                onClick={() => {
                  updateSettings({ consentAt: new Date().toISOString() });
                  setStep(2);
                }}
              >
                <Check size={18} /> I agree
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">How do you want to start?</h1>
            <button type="button" onClick={() => finish(true)} className="flex flex-col gap-1 rounded-2xl border-2 border-ink bg-surface p-4 text-left">
              <span className="text-base font-extrabold">Explore with sample saves</span>
              <span className="text-sm text-muted">12 example saves (AI tools, a café reel, a Goa trip, a PM framework post…) so you can try every view. Remove them in Settings.</span>
            </button>
            <button type="button" onClick={() => finish(false)} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 text-left">
              <span className="text-base font-extrabold">Start empty</span>
              <span className="text-sm text-muted">Go straight to saving your own links.</span>
            </button>
            <p className="text-sm text-muted">Tip: add a free Gemini key in Settings → AI for full summaries. Everything else works without one.</p>
          </>
        )}
      </div>
    </div>
  );
}
