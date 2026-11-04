# Security

SaveSutra fetches URLs that users (and WhatsApp messages) send it, so it treats every link and every piece of fetched content as untrusted.

| Threat | Control | Where |
|---|---|---|
| SSRF (fetching `169.254.169.254`, `localhost`, LAN) | Only public `http(s)` on ports 80/443, no credentials in URLs; **every redirect hop** is DNS-resolved and rejected if any address is private, loopback, link-local, CGNAT or multicast | `packages/core/src/url.ts`, `apps/server/src/fetch/safeFetch.ts` |
| Oversized or slow responses | 1.5 MB body cap, 10 s timeouts, video capped by length (240 s) and size (40 MB) | `safeFetch.ts`, `video.ts` |
| Forged WhatsApp webhooks | `X-Hub-Signature-256` HMAC-SHA256 over the raw body with the app secret, timing-safe compare; duplicate message ids ignored | `apps/server/src/http/whatsapp.ts` |
| Bot abuse / unknown senders | Owner number and allow-list only by default; per-sender rate limit; purpose-limited commands | `whatsapp.ts`, `core/src/bot.ts` |
| API access | Bearer token compared with `timingSafeEqual`; API disabled if no token is set; CORS allow-list; 25 MB body limit; per-hour save limit | `apps/server/src/http/api.ts`, `app.ts` |
| Prompt injection via captions | System prompt marks material as untrusted third-party data and forbids following instructions inside it; output is schema-validated (zod) and length-capped, never executed | `core/src/prompt.ts` |
| Spreadsheet formula injection in exports | Cells starting with `= + - @` are prefixed with `'` | `core/src/util.ts` |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict Content-Security-Policy, `rel="noopener noreferrer"` on all external links, thumbnails loaded with `referrerpolicy="no-referrer"` | `apps/web` |
| Secrets | Server secrets only in env vars (`.env` is git-ignored); the user's own Gemini key stays on their device; Android backups disabled | `.env.example`, `AndroidManifest.xml` |
| Stored media | None: temporary video files are deleted in a `finally` block and the Gemini file is deleted after each call | `pipeline.ts`, `ai/gemini.ts` |

## Reporting a vulnerability

Please open a private security advisory on GitHub (Security → Report a vulnerability) rather than a public issue.
