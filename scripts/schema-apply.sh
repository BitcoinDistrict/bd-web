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
echo -e "${BLUE}║                  📋 APPLY DIRECTUS SCHEMA 📋                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

if [ ! -f "./schema.yaml" ]; then
  echo -e "${RED}❌ Error: schema.yaml not found in project root${NC}"
  exit 1
fi

if ! docker compose ps directus | grep -q "Up"; then
  echo -e "${RED}❌ Error: Directus container is not running${NC}"
  echo -e "${YELLOW}Start Directus with: docker compose up -d directus${NC}"
  exit 1
fi

echo -e "${YELLOW}→ Copying schema.yaml into container...${NC}"
docker compose cp "./schema.yaml" directus:/tmp/schema.yaml

echo -e "${YELLOW}→ Applying schema...${NC}"
docker compose exec -T directus node /directus/cli.js schema apply /tmp/schema.yaml --yes

docker compose exec -T directus rm -f /tmp/schema.yaml >/dev/null 2>&1 || true

echo ""
echo -e "${GREEN}✅ Schema applied successfully.${NC}"

