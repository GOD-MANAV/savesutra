import { existsSync } from 'node:fs';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { createGeminiAnalyzer, type Analyzer } from './ai/gemini.ts';
import type { Config } from './config.ts';
import { Store } from './db.ts';
import { createApi } from './http/api.ts';
import { createCloudApiSender, createWhatsAppWebhook, type SendText } from './http/whatsapp.ts';
import { Pipeline, type PipelineDeps } from './pipeline.ts';

export interface AppOptions {
  config: Config;
  store?: Store;
  analyzer?: Analyzer;
  send?: SendText;
  fetchMeta?: PipelineDeps['fetchMeta'];
  download?: PipelineDeps['download'];
  checkHost?: PipelineDeps['checkHost'];
}

/** Build the whole HTTP app. Kept separate from index.ts so tests can run it in memory. */
export function createApp(opts: AppOptions) {
  const { config } = opts;
  const store = opts.store ?? Store.open(config.dataDir);
  const analyzer = opts.analyzer ?? (config.gemini.apiKey ? createGeminiAnalyzer(config.gemini.apiKey, config.gemini.model) : undefined);
  const pipeline = new Pipeline({
    store,
    config,
    analyzer,
    fetchMeta: opts.fetchMeta,
    download: opts.download,
    checkHost: opts.checkHost,
    log: (msg, extra) => console.warn(`[pipeline] ${msg}`, extra ?? ''),
  });
  const send = opts.send ?? createCloudApiSender(config);
  const wa = createWhatsAppWebhook({ store, pipeline, config, send });

  const app = new Hono();
  app.use('*', secureHeaders());
  app.use('/api/*', cors({ origin: config.corsOrigins, allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
  app.use('/api/*', bodyLimit({ maxSize: 25 * 1024 * 1024 }));
  app.route('/api', createApi({ store, pipeline, config }));
  app.route('/webhooks/whatsapp', wa.app);

  if (config.webDist && existsSync(config.webDist)) {
    app.use('/*', serveStatic({ root: config.webDist }));
    app.get('*', serveStatic({ path: `${config.webDist}/index.html` }));
  } else {
    app.get('/', (c) => c.text('SaveSutra API is running. See /api/health.'));
  }
  return { app, store, pipeline, wa };
}
