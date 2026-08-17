# NQS Frontend — static SPA build served over HTTP
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install

COPY . .

# Baked in at build time (Vite env vars are compile-time only).
# Points at a Cloudflare Tunnel into the user's own local backend/Postgres —
# see conversation notes: they explicitly rejected using Railway's Postgres.
ARG VITE_API_URL=https://married-establishment-expectations-ssl.trycloudflare.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN npm install -g serve

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
# serve -s enables SPA fallback (all routes resolve to index.html for React Router).
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
