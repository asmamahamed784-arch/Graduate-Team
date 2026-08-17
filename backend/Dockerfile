# NQS Backend — Render / Docker
FROM node:20-bookworm-slim

WORKDIR /app

# OpenSSL needed by Prisma on Debian slim
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.* ./

RUN npm install --omit=dev

COPY . .

# Generate Prisma client for the image
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5005

# Render sets PORT automatically
CMD ["sh", "-c", "npx prisma migrate deploy || true; node server.js"]
