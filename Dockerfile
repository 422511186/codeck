ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
USER root
ENV NODE_ENV=development
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
USER root
WORKDIR /app

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner
USER root
ENV NODE_ENV=production \
    CODEX_WEB_BIND_HOST=0.0.0.0 \
    CODEX_WEB_BIND_PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && mkdir -p /var/lib/codex-web/uploads /var/log/codex-web

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs

RUN chown -R node:node /var/lib/codex-web /var/log/codex-web

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
