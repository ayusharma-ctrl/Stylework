#!/bin/sh
set -e

echo "Starting migrations..."
node dist/database/cli.js migrate

echo "Migrations completed. Starting server..."
exec node dist/main.js