import { resolve } from 'node:path';

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All configuration comes from environment variables. See .env.example. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    port: num(env.PORT, 8787),
    dataDir: resolve(env.DATA_DIR ?? './data'),
    /** Bearer token the app sends. Required in production. */
    apiToken: env.API_TOKEN ?? '',
    publicUrl: env.PUBLIC_URL ?? '',
    privacyUrl: env.PRIVACY_URL ?? 'https://god-manav.github.io/savesutra/privacy.html',
    corsOrigins: list(env.CORS_ORIGINS ?? 'https://god-manav.github.io,capacitor://localhost,https://localhost,http://localhost:5173'),
    webDist: env.WEB_DIST ? resolve(env.WEB_DIST) : '',

    gemini: {
      apiKey: env.GEMINI_API_KEY ?? '',
      model: env.GEMINI_MODEL ?? 'gemini-flash-latest',
    },
    video: {
      ytDlpPath: env.YTDLP_PATH ?? 'yt-dlp',
      maxSeconds: num(env.MAX_VIDEO_SECONDS, 240),
      maxMb: num(env.MAX_VIDEO_MB, 40),
      enabled: env.VIDEO_ANALYSIS !== 'off',
    },
    whatsapp: {
      token: env.WHATSAPP_TOKEN ?? '',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
      verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? '',
      appSecret: env.WHATSAPP_APP_SECRET ?? '',
      graphVersion: env.WHATSAPP_GRAPH_VERSION ?? 'v23.0',
      /** Your own number (E.164 without +). Its saves go into the same library as the app. */
      ownerNumber: (env.WHATSAPP_OWNER_NUMBER ?? '').replace(/\D/g, ''),
      /** Optional allow-list. Empty = only the owner number may use the bot. */
      allowedNumbers: list(env.WHATSAPP_ALLOWED_NUMBERS).map((n) => n.replace(/\D/g, '')),
      openToAll: env.WHATSAPP_OPEN === 'true',
    },
    limits: {
      savesPerHour: num(env.SAVES_PER_HOUR, 60),
      concurrency: num(env.PIPELINE_CONCURRENCY, 2),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;
