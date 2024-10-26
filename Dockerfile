# TODO: upgrade to node 24 whenever it's released as it's LTS
FROM node:23-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    nano \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

FROM base AS prod
ENV NODE_ENV=production
CMD npm run migrate && npm start

FROM base AS dev
ENV NODE_ENV=development
CMD npm run migrate && npm run dev
