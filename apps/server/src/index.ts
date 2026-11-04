import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const { app } = createApp({ config });

if (!config.apiToken) console.warn('⚠ API_TOKEN is not set: the /api routes are disabled until you set one.');
if (!config.gemini.apiKey) console.warn('ℹ GEMINI_API_KEY is not set: saves are analysed with rules only.');

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`SaveSutra server listening on http://localhost:${info.port}`);
});
