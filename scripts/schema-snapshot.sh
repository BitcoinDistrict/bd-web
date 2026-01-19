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

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                📸 SNAPSHOT DIRECTUS SCHEMA 📸                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

if ! docker compose ps directus | grep -q "Up"; then
  echo -e "${RED}❌ Error: Directus container is not running${NC}"
  echo -e "${YELLOW}Start Directus with: docker compose up -d directus${NC}"
  exit 1
fi

echo -e "${YELLOW}→ Waiting for Directus to finish bootstrapping...${NC}"
# The Directus API can come up before system tables/migrations are complete.
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

BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"
if [ -f "./schema.yaml" ]; then
  cp ./schema.yaml "./schema.yaml.bak.${BACKUP_SUFFIX}"
  echo -e "${BLUE}→ Backed up existing schema.yaml to schema.yaml.bak.${BACKUP_SUFFIX}${NC}"
fi

echo -e "${YELLOW}→ Creating schema snapshot inside container...${NC}"
docker compose exec -T directus node /directus/cli.js schema snapshot /tmp/schema.yaml

echo -e "${YELLOW}→ Copying schema snapshot to repo root (schema.yaml)...${NC}"
docker compose cp directus:/tmp/schema.yaml ./schema.yaml
docker compose exec -T directus rm -f /tmp/schema.yaml >/dev/null 2>&1 || true

echo ""
echo -e "${GREEN}✅ Schema snapshot complete: schema.yaml${NC}"

