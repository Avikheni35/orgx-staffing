#!/usr/bin/env bash
# Seed the M1 database with demo data.
# Requires MongoDB running at localhost:27017.
set -e

echo "Seeding M1 — Staffing Platform..."
cd "$(dirname "$0")/.."

npm run seed -w server

echo "Done. Login credentials:"
echo "  Super admin : admin@platform.de / \$SEED_SUPER_PASSWORD"
echo "  Agency admin: agentur@demo.de   / \$SEED_DEMO_PASSWORD"
