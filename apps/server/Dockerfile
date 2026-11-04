# SaveSutra server: API + WhatsApp webhook + (optionally) the web app.
# Build from the repo root:  docker build -f apps/server/Dockerfile -t savesutra .
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

COPY packages/core packages/core
COPY apps/web apps/web
COPY apps/server apps/server
RUN npm run build -w @savesutra/web

ENV NODE_ENV=production PORT=8787 DATA_DIR=/data WEB_DIST=/app/apps/web/dist
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node
WORKDIR /app/apps/server
CMD ["npx", "tsx", "src/index.ts"]
