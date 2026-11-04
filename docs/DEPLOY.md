# Deploy the server

You only need a server for the **WhatsApp bot** and for **deep video analysis** of Instagram, X and TikTok. The app works fully without one.

## Option A: Render (one click)

1. Fork or use this repo, then open <https://render.com/deploy?repo=https://github.com/GOD-MANAV/savesutra>.
2. Render reads `render.yaml`: a Docker web service with a 1 GB disk at `/data`.
3. Fill in `GEMINI_API_KEY` (free from <https://aistudio.google.com/apikey>) and, if you want the bot, the `WHATSAPP_*` values ([guide](WHATSAPP_SETUP.md)).
4. Copy the generated `API_TOKEN` from the dashboard.
5. In the app: **Settings → Library → My server**, then paste the service URL and token and tap **Test & connect**.

## Option B: Any Docker host (Railway, Fly.io, a VPS, Azure/DigitalOcean credits from the GitHub Student Pack)

```bash
docker build -f apps/server/Dockerfile -t savesutra .
docker run -d --name savesutra -p 8787:8787 -v savesutra-data:/data \
  -e API_TOKEN=$(openssl rand -hex 32) \
  -e GEMINI_API_KEY=your-key \
  savesutra
curl http://localhost:8787/api/health
```

Put it behind HTTPS (Caddy, Cloudflare Tunnel or your host's TLS). WhatsApp webhooks require HTTPS.

## Option C: Run locally

```bash
cp apps/server/.env.example apps/server/.env   # set API_TOKEN at least
npm run dev:server
```

Requires Node 22+. Install `yt-dlp` and `ffmpeg` for video analysis (`pip install yt-dlp`, `apt install ffmpeg`).

## Environment variables

See [`apps/server/.env.example`](../apps/server/.env.example). The important ones:

| Variable | Required | Purpose |
|---|---|---|
| `API_TOKEN` | yes | Bearer token the app uses; the API is disabled without it |
| `GEMINI_API_KEY` | recommended | AI analysis; without it, rules only |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |
| `MAX_VIDEO_SECONDS` / `MAX_VIDEO_MB` | no | Caps for temporary video downloads |
| `WHATSAPP_*` | for the bot | See the WhatsApp guide |
| `CORS_ORIGINS` | no | Origins allowed to call the API |

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | Status (public) |
| GET | `/api/items?q=&category=&limit=` | List or search |
| POST | `/api/items` | `{ url, note?, image? }` → 201 (new) or 200 (duplicate) |
| GET / PATCH / DELETE | `/api/items/:id` | Read, edit (`note`, `progress`, `pinned`, `category`, `tags`, `board`), delete |
| POST | `/api/items/:id/reanalyze` | Run analysis again |
| POST | `/api/import/whatsapp` | Body: exported chat `.txt` |
| GET | `/api/export?format=csv\|json` | Export |
| DELETE | `/api/me` | Erase everything |
| GET / POST | `/webhooks/whatsapp` | Meta verification and messages |
