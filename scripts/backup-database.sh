#!/bin/bash

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  💾 BACKUP DATABASE 💾                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
DB_ONLY=false
if [[ "$1" == "--db-only" ]]; then
    DB_ONLY=true
    echo -e "${YELLOW}Running in database-only mode (skipping uploads)${NC}"
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Load environment variables
if [ -f .env ]; then
    # Export variables from .env file, properly handling comments and special characters
    # Filters out comment lines (starting with #), empty lines, and only processes KEY=VALUE pairs
    set -a
    # Use a temporary file to avoid process substitution issues
    TEMP_ENV=$(mktemp)
    grep -v '^[[:space:]]*#' .env | grep -v '^[[:space:]]*$' | grep '=' > "$TEMP_ENV" 2>/dev/null
    if [ -s "$TEMP_ENV" ]; then
        source "$TEMP_ENV"
    fi
    rm -f "$TEMP_ENV"
    set +a
fi

# Check if Directus is running
if ! docker compose ps directus | grep -q "Up"; then
    echo -e "${RED}✗ Directus container is not running${NC}"
    echo -e "${YELLOW}Start Directus with: docker compose up -d${NC}"
    exit 1
fi

# Create backups directory
mkdir -p db-backups

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}→ Backing up database...${NC}"

# PostgreSQL dump
docker compose exec -T db pg_dump \
    -U ${POSTGRES_USER:-directus} \
    -d ${POSTGRES_DB:-directus} \
    -F c \
    > db-backups/directus-db-${TIMESTAMP}.dump

if [ $? -eq 0 ]; then
    DB_SIZE=$(du -h db-backups/directus-db-${TIMESTAMP}.dump | cut -f1)
    echo -e "${GREEN}✓ Database backup complete: ${DB_SIZE}${NC}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    exit 1
fi

# Uploads backup (unless --db-only flag)
if [ "$DB_ONLY" = false ]; then
    echo ""
    echo -e "${YELLOW}→ Backing up uploads (this may take a while)...${NC}"
    
    # Get the actual volume name from docker compose
    VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep directus_uploads | head -1)
    
    if [ -z "$VOLUME_NAME" ]; then
        echo -e "${YELLOW}⚠ No uploads volume found (may be empty or not created yet)${NC}"
    else
        docker run --rm \
            -v ${VOLUME_NAME}:/uploads \
            -v $(pwd)/db-backups:/backup \
            alpine tar czf /backup/directus-uploads-${TIMESTAMP}.tar.gz -C /uploads . 2>/dev/null
        
        if [ $? -eq 0 ]; then
            if [ -f "db-backups/directus-uploads-${TIMESTAMP}.tar.gz" ]; then
                UPLOADS_SIZE=$(du -h db-backups/directus-uploads-${TIMESTAMP}.tar.gz | cut -f1)
                echo -e "${GREEN}✓ Uploads backup complete: ${UPLOADS_SIZE}${NC}"
            else
                echo -e "${YELLOW}⚠ Uploads volume is empty${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Uploads backup had issues (may be empty)${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ BACKUP COMPLETE! ✅                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Backups created in db-backups/:${NC}"
ls -lh db-backups/directus-*-${TIMESTAMP}* 2>/dev/null

echo ""
echo -e "${BLUE}To restore this backup later:${NC}"
echo -e "  ${YELLOW}# Example (database must exist):${NC}"
echo -e "  ${YELLOW}docker compose exec -T db pg_restore -U ${POSTGRES_USER:-directus} -d ${POSTGRES_DB:-directus} --clean --if-exists db-backups/directus-db-${TIMESTAMP}.dump${NC}"
echo ""
