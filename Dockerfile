FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app-core.mjs ./
COPY scripts/api-server.mjs ./scripts/api-server.mjs
COPY scripts/lib ./scripts/lib

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "scripts/api-server.mjs"]
