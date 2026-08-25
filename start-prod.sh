#!/usr/bin/env sh
set -e
mkdir -p data  # otherwise docker creates it root-owned and uid 1000 can't write
# --pull so a rebuild also picks up upstream node base image patches
docker compose --profile prod build --pull
docker compose --profile prod up -d
