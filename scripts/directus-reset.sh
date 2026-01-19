#!/bin/bash

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                    ⚠️  DIRECTUS RESET ⚠️                       ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  This will reset Directus to a FRESH instance by:              ║${NC}"
echo -e "${RED}║  • Stopping all Docker services                                ║${NC}"
echo -e "${RED}║  • Removing Docker volumes (including uploads)                 ║${NC}"
echo -e "${RED}║  • Deleting local Postgres data at ./directus/data/db           ║${NC}"
echo -e "${RED}║  • Overwriting schema.yaml with a new baseline snapshot         ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  NOTE: This does NOT apply any community/template schema.       ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

read -r -p "Continue? (Y/N): " confirmation
if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
  echo -e "${GREEN}Cancelled. No changes made.${NC}"
  exit 0
fi

cd "$PROJECT_ROOT"

echo ""
echo -e "${YELLOW}→ Stopping services and removing volumes...${NC}"
docker compose down -v 2>/dev/null || true

echo -e "${YELLOW}→ Deleting local database files (./directus/data/db)...${NC}"
# Postgres data is bind-mounted (see docker-compose.yml), which can end up root-owned
# on the host and cause Permission denied. Wipe it via a one-off container (root),
# avoiding sudo/TTY issues.
DB_DIR="$PROJECT_ROOT/directus/data/db"
mkdir -p "$DB_DIR"
docker run --rm -v "$DB_DIR:/data" alpine:3.20 sh -lc 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true'

echo -e "${YELLOW}→ Starting database, cache, and Directus...${NC}"
docker compose up -d db cache directus

echo -e "${YELLOW}→ Waiting for Directus to finish bootstrapping...${NC}"
# Directus can start accepting connections before it has finished installing
# system tables and running migrations. The schema snapshot requires these tables.
BOOTSTRAP_OK="false"
for i in {1..180}; do
  TABLE_EXISTS="$(
    docker compose exec -T db sh -lc \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select 1 from information_schema.tables where table_schema='\''public'\'' and table_name='\''directus_collections'\'' limit 1;" 2>/dev/null' \
      || true
  )"

  if [[ "${TABLE_EXISTS}" == "1" ]]; then
    BOOTSTRAP_OK="true"
    break
  fi

  sleep 1
done

if [[ "${BOOTSTRAP_OK}" != "true" ]]; then
  echo -e "${RED}❌ Timed out waiting for Directus system tables to be created.${NC}"
  echo -e "${YELLOW}Check logs with: docker compose logs --tail=200 directus${NC}"
  exit 1
fi

echo -e "${YELLOW}→ Taking baseline schema snapshot to schema.yaml...${NC}"

BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"
if [ -f "./schema.yaml" ]; then
  cp ./schema.yaml "./schema.yaml.bak.${BACKUP_SUFFIX}"
  echo -e "${BLUE}  Backed up existing schema.yaml to schema.yaml.bak.${BACKUP_SUFFIX}${NC}"
fi

docker compose exec -T directus node /directus/cli.js schema snapshot /tmp/schema.yaml
docker compose cp directus:/tmp/schema.yaml ./schema.yaml
docker compose exec -T directus rm -f /tmp/schema.yaml >/dev/null 2>&1 || true

echo ""
echo -e "${GREEN}✅ Directus reset complete.${NC}"
echo -e "${GREEN}• Directus admin: http://localhost:8055${NC}"
echo -e "${GREEN}• Baseline schema written to: schema.yaml${NC}"

