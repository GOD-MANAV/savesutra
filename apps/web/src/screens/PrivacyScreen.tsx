import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

/** Plain-language privacy notice, shown before consent and any time from Settings. */
export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed">
      <section>
        <h3 className="font-extrabold">What SaveSutra processes</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
          <li>The links you save, your notes and the screenshots you attach.</li>
          <li>Public information about each link: its title, caption, author and image, and for videos the audio and on-screen text.</li>
          <li>If you use the WhatsApp bot: your WhatsApp number and the messages you send to the bot.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-extrabold">Why</h3>
        <p className="text-ink-2">Only to summarise, organise and search your saves. No ads, no profiling, no selling of data.</p>
      </section>
      <section>
        <h3 className="font-extrabold">Where it goes</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
          <li>
            <b>On this device</b> by default (IndexedDB). It never leaves your phone unless you add an AI key or connect your own server.
          </li>
          <li>
            <b>AI analysis</b> (optional): the post’s public text and media are sent to Google’s Gemini API with your own key. Google’s API terms apply.
          </li>
          <li>
            <b>Your server</b> (optional): if you connect one, saves are stored there. Videos are downloaded only to be analysed and are deleted straight after.
          </li>
        </ul>
      </section>
      <section>
        <h3 className="font-extrabold">Your rights</h3>
        <p className="text-ink-2">
          You can see, correct, export (Excel, CSV, JSON) and delete all your data at any time in Settings. You can withdraw consent the same way; it is as easy as giving it. On WhatsApp, send <b>stop</b>.
        </p>
      </section>
      <section>
        <h3 className="font-extrabold">Respecting creators</h3>
        <p className="text-ink-2">
          SaveSutra keeps notes and links, not copies of other people’s content. It works with public posts only and never logs in to any platform. Please use it for personal reference and respect each platform’s terms and creators’ rights.
        </p>
      </section>
      <section>
        <h3 className="font-extrabold">AI can be wrong</h3>
        <p className="text-ink-2">Every AI summary is labelled. Double-check important details like prices, addresses and dates.</p>
      </section>
      <p className="text-sm text-muted">
        Grievances and questions: open an issue at github.com/GOD-MANAV/savesutra. Written with India’s Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025 in mind. Not legal advice.
      </p>
    </div>
  );
}

export function PrivacyScreen() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button size="icon" aria-label="Back" onClick={() => history.back()}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-extrabold tracking-tight">Privacy notice</h1>
      </div>
      <PrivacyNotice />
    </div>
  );
}
