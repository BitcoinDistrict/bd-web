#!/bin/bash

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  📋 APPLY DIRECTUS SCHEMA 📋                   ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  This script will apply the schema.yaml to your Directus      ║${NC}"
echo -e "${BLUE}║  database using the Directus CLI.                             ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  Requirements:                                                 ║${NC}"
echo -e "${BLUE}║  • Directus container must be running                         ║${NC}"
echo -e "${BLUE}║  • schema.yaml must exist in the project root                 ║${NC}"
echo -e "${BLUE}║  • Directus environment variables must be configured          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if schema.yaml exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
if [ ! -f "$PROJECT_ROOT/schema.yaml" ]; then
    echo -e "${RED}❌ Error: schema.yaml not found in project root${NC}"
    echo -e "${YELLOW}Please ensure schema.yaml exists before running this script${NC}"
    exit 1
fi

# Check if Directus container is running
if ! docker compose ps directus | grep -q "Up"; then
    echo -e "${RED}❌ Error: Directus container is not running${NC}"
    echo -e "${YELLOW}Please start Directus with: docker compose up -d${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Applying schema to Directus database...${NC}"

# Copy schema.yaml to the Directus container
echo "→ Copying schema.yaml to Directus container..."
docker compose cp "$PROJECT_ROOT/schema.yaml" directus:/tmp/schema.yaml

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to copy schema.yaml to container${NC}"
    exit 1
fi

# Apply the schema using Directus CLI
echo "→ Applying schema..."
docker compose exec -T directus node /directus/cli.js schema apply /tmp/schema.yaml --yes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema applied successfully!${NC}"

    # Clean up the copied file
    docker compose exec -T directus rm /tmp/schema.yaml 2>/dev/null || true
else
    echo -e "${RED}❌ Failed to apply schema${NC}"
    echo -e "${YELLOW}Check the Directus logs for more details: docker compose logs directus${NC}"

    # Clean up the copied file
    docker compose exec -T directus rm /tmp/schema.yaml 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${GREEN}Schema application complete!${NC}"