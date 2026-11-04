import {
  analyzeWithRules,
  createId,
  detectPlatform,
  extractFirstUrl,
  extractLinks,
  isSafePublicUrl,
  isVideoKind,
  normalizeUrl,
  nowIso,
  type Analysis,
  type LinkMetadata,
  type SaveChannel,
  type SaveItem,
} from '@savesutra/core';
import type { Analyzer } from './ai/gemini.ts';
import type { Config } from './config.ts';
import type { Store } from './db.ts';
import { fetchMetadata } from './fetch/metadata.ts';
import { UnsafeUrlError, assertPublicHost } from './fetch/safeFetch.ts';
import { downloadVideo } from './fetch/video.ts';

export interface PipelineDeps {
  store: Store;
  config: Config;
  analyzer?: Analyzer;
  /** Injected in tests. */
  fetchMeta?: typeof fetchMetadata;
  download?: typeof downloadVideo;
  /** DNS-based SSRF check; injectable so tests can run offline. */
  checkHost?: (url: string) => Promise<void>;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

type Listener = (owner: string, item: SaveItem) => void | Promise<void>;

/** A tiny in-process job queue with a concurrency limit. Enough for a personal server. */
class Queue {
  private running = 0;
  private jobs: Array<() => Promise<void>> = [];
  constructor(private readonly limit: number) {}
  push(job: () => Promise<void>): void {
    this.jobs.push(job);
    this.pump();
  }
  private pump(): void {
    while (this.running < this.limit && this.jobs.length) {
      const job = this.jobs.shift()!;
      this.running++;
      job().finally(() => {
        this.running--;
        this.pump();
      });
    }
  }
  get idle(): boolean {
    return this.running === 0 && this.jobs.length === 0;
  }
}

/** Union of AI links and rule-found caption links, so nothing in the caption is ever lost. */
function mergeLinks(ai: Analysis, meta: LinkMetadata, selfUrl: string): Analysis {
  const extra = [...extractLinks(meta.description, 'caption')];
  const seen = new Set(ai.links.map((l) => l.url));
  for (const l of extra) if (!seen.has(l.url) && l.url !== selfUrl) ai.links.push(l);
  ai.links = ai.links.filter((l) => l.url !== selfUrl);
  return ai;
}

export class Pipeline {
  private readonly queue: Queue;
  private readonly listeners: Listener[] = [];
  constructor(private readonly deps: PipelineDeps) {
    this.queue = new Queue(deps.config.limits.concurrency);
  }

  onDone(fn: Listener): void {
    this.listeners.push(fn);
  }

  get idle(): boolean {
    return this.queue.idle;
  }

  /** Wait until all queued analysis has finished (used by tests). */
  async drain(): Promise<void> {
    while (!this.queue.idle) await new Promise((r) => setTimeout(r, 10));
  }

  /**
   * Create a save (or return the existing one for the same link) and queue its analysis.
   * Throws UnsafeUrlError for links that are not public http(s) URLs.
   */
  async save(
    owner: string,
    input: { url: string; note?: string; channel: SaveChannel; sharedAt?: string; image?: { base64: string; mimeType: string } },
  ): Promise<{ item: SaveItem; duplicate: boolean }> {
    const found = extractFirstUrl(input.url) ?? input.url;
    let url: string;
    try {
      url = normalizeUrl(found);
    } catch {
      throw new UnsafeUrlError('That does not look like a link');
    }
    if (!isSafePublicUrl(url)) throw new UnsafeUrlError('Only public http(s) links can be saved');
    await (this.deps.checkHost ?? assertPublicHost)(url);
    const existing = this.deps.store.findByUrl(owner, url);
    if (existing) return { item: existing, duplicate: true };

    const { platform, kind } = detectPlatform(url);
    const now = nowIso();
    const item: SaveItem = {
      id: createId(),
      seq: this.deps.store.nextSeq(owner),
      url,
      platform,
      kind,
      status: 'queued',
      channel: input.channel,
      meta: { url, platform, kind },
      note: input.note,
      sharedAt: input.sharedAt,
      progress: 'inbox',
      createdAt: now,
      updatedAt: now,
    };
    this.deps.store.insert(owner, item);
    this.queue.push(() => this.process(item.id, input.image));
    return { item, duplicate: false };
  }

  reanalyze(owner: string, id: string): SaveItem | undefined {
    const item = this.deps.store.get(owner, id);
    if (!item) return undefined;
    item.status = 'queued';
    item.updatedAt = nowIso();
    this.deps.store.update(owner, item);
    this.queue.push(() => this.process(id));
    return item;
  }

  private async process(id: string, image?: { base64: string; mimeType: string }): Promise<void> {
    const found = this.deps.store.getAny(id);
    if (!found) return;
    const { owner } = found;
    let item = found.item;
    const { config, analyzer } = this.deps;
    const log = this.deps.log ?? (() => undefined);
    item.status = 'processing';
    this.deps.store.update(owner, item);

    let meta: LinkMetadata & { articleText?: string } = item.meta;
    try {
      meta = await (this.deps.fetchMeta ?? fetchMetadata)(item.url, { ytDlpPath: config.video.ytDlpPath });
      item.meta = { ...meta, articleText: undefined } as LinkMetadata;
      if (meta.kind !== item.kind) item.kind = meta.kind;
    } catch (err) {
      log('metadata failed', { id, err: String(err) });
    }

    let analysis: Analysis | undefined;
    if (analyzer) {
      let video: Awaited<ReturnType<typeof downloadVideo>> | undefined;
      try {
        const isYouTube = item.platform === 'youtube';
        if (!isYouTube && !image && config.video.enabled && isVideoKind(item.kind)) {
          video = await (this.deps.download ?? downloadVideo)(item.url, {
            ytDlpPath: config.video.ytDlpPath,
            maxSeconds: config.video.maxSeconds,
            maxMb: config.video.maxMb,
          });
        }
        const youtubeOk = isYouTube && (!meta.durationSec || meta.durationSec <= config.video.maxSeconds * 8);
        analysis = await analyzer.analyze({
          meta,
          video: video ? { path: video.path, mimeType: video.mimeType } : undefined,
          youtubeUrl: youtubeOk ? item.url : undefined,
          image,
        });
        analysis = mergeLinks(analysis, meta, item.url);
      } catch (err) {
        log('ai analysis failed, using rules', { id, err: String(err) });
      } finally {
        await video?.cleanup();
      }
    }
    if (!analysis) analysis = analyzeWithRules({ ...meta, description: [meta.description, meta.articleText].filter(Boolean).join('\n\n') });

    // The item may have been edited while we worked; keep the user's changes.
    item = this.deps.store.get(owner, id) ?? item;
    item.meta = { ...item.meta, ...meta, articleText: undefined } as LinkMetadata;
    item.analysis = analysis;
    item.status = 'ready';
    item.error = undefined;
    item.updatedAt = nowIso();
    this.deps.store.update(owner, item);
    for (const fn of this.listeners) {
      try {
        await fn(owner, item);
      } catch (err) {
        log('listener failed', { id, err: String(err) });
      }
    }
  }
}
