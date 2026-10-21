# tag, not a digest, so `docker compose build --pull` picks up node patches. 24 = active LTS
FROM node:24-slim AS deps
WORKDIR /app
# better-sqlite3 is native and .npmrc turns install scripts off, so build it here instead - from source,
# which keeps it inside the integrity-checked npm tarball (the default downloads a binary from GitHub)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
ENV npm_config_build_from_source=true
RUN npm ci --omit=dev && npm rebuild better-sqlite3 --ignore-scripts=false

FROM deps AS deps-dev
RUN npm ci && npm rebuild better-sqlite3 --ignore-scripts=false

FROM node:24-slim AS base
# Node's bundled CA list still trusted emSign ECC Root CA - G3 after the 2026-10 eMudhra intermediate compromise
# (https://emudhra.we-have-a-problem.com/) while Debian's had dropped it, so use Debian's (slim ships none)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_OPTIONS=--use-openssl-ca SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
RUN mkdir -p /app/data && chown node:node /app/data
USER node

FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
# exec so SIGTERM reaches node instead of the shell
CMD ["sh", "-c", "node src/db/migrate.js && exec node src/index.js"]

FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps-dev --chown=node:node /app/node_modules ./node_modules
CMD ["sh", "-c", "node src/db/migrate.js && exec node_modules/.bin/nodemon src/index.js"]
