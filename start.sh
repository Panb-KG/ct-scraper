#!/bin/sh
echo "=== Starting ct-scraper ===" && \
echo "PORT: $PORT" && \
echo "HOSTNAME: $HOSTNAME" && \
echo "Starting Next.js..." && \
exec node server.js
