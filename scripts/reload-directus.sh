#!/bin/bash

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                    ⚠️  WARNING ⚠️                              ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  This script will PERMANENTLY DELETE:                         ║${NC}"
echo -e "${RED}║  • All Docker containers (db, cache, directus, astro)         ║${NC}"
echo -e "${RED}║  • All Redis cache data                                       ║${NC}"
echo -e "${RED}║  • All Directus uploads and configurations                    ║${NC}"
echo -e "${RED}║  • All Directus extensions                                    ║${NC}"
echo -e "${RED}║  • All Docker volumes (including directus_uploads)            ║${NC}"
echo -e "${RED}║  • Docker network (bd-network)                                ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  NOTE: Script uses sudo to remove database files              ║${NC}"
echo -e "${RED}║  DATABASE OPTION:                                             ║${NC}"
echo -e "${RED}║  Choose whether to keep or purge PostgreSQL data below       ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Do you want to PURGE the PostgreSQL database data? (Y/N):${NC} "
read -r purge_db

echo -e "${YELLOW}Do you want to continue with the cleanup? (Y/N):${NC} "
read -r confirmation

if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Cleanup cancelled. No changes were made.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting cleanup...${NC}"

# Stop all containers and remove them with volumes
echo "→ Stopping and removing Docker containers..."
docker compose down -v 2>/dev/null || true

# Remove the Docker network
echo "→ Removing Docker network..."
docker network rm bd-network 2>/dev/null || true

# Remove Directus data directories (conditionally for database)
if [[ "$purge_db" =~ ^[Yy]$ ]]; then
    echo "→ Removing ALL Directus data directories (including PostgreSQL database)..."
    sudo rm -rf ./directus/data
else
    echo "→ Removing Directus data directories (keeping PostgreSQL database)..."
    rm -rf ./directus/uploads
    rm -rf ./directus/extensions
    # Keep ./directus/data/db but remove other data files
    if [ -d "./directus/data" ]; then
        find ./directus/data -mindepth 1 -maxdepth 1 ! -name "db" -exec sudo rm -rf {} +
    fi
fi

# Remove any orphaned Docker volumes
echo "→ Cleaning up orphaned Docker volumes..."
docker volume prune -f

# Remove specific named volume if it still exists
echo "→ Removing named volumes..."
docker volume rm bd-directus-astro_directus_uploads 2>/dev/null || true

# Optional: Remove Docker images (uncomment to re-download fresh images)
echo "→ Removing Docker images..."
docker rmi directus/directus:11.14.1 directus/directus:11.14.0 postgres:15.6 redis:7.2-alpine 2>/dev/null || true

echo ""
if [[ "$purge_db" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓ Cleanup complete! All Directus data and PostgreSQL database has been wiped.${NC}"
else
    echo -e "${GREEN}✓ Cleanup complete! Directus data wiped, but PostgreSQL database preserved.${NC}"
fi
echo ""
echo -e "${YELLOW}To start fresh, run:${NC} docker compose up -d --build"