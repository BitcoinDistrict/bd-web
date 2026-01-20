#!/bin/bash

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                🔄 RESTORE DATABASE & FILES 🔄                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
BACKUP_TIMESTAMP=""
DB_ONLY=false
SKIP_CONFIRM=false
BACKUP_DIR="db-backups"
APPLY_SCHEMA=false
UPDATE_ADMIN_CREDS=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --timestamp)
            BACKUP_TIMESTAMP="$2"
            shift 2
            ;;
        --db-only)
            DB_ONLY=true
            shift
            ;;
        --yes)
            SKIP_CONFIRM=true
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --apply-schema)
            APPLY_SCHEMA=true
            shift
            ;;
        --no-update-admin)
            UPDATE_ADMIN_CREDS=false
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 --timestamp TIMESTAMP [--db-only] [--yes] [--backup-dir DIR] [--apply-schema] [--no-update-admin]"
            exit 1
            ;;
    esac
done

if [ -z "$BACKUP_TIMESTAMP" ]; then
    echo -e "${RED}✗ Error: --timestamp is required${NC}"
    echo ""
            echo "Usage: $0 --timestamp TIMESTAMP [--db-only] [--yes] [--backup-dir DIR] [--apply-schema] [--no-update-admin]"
    echo ""
    echo "Example:"
    echo "  $0 --timestamp 20240120_143022"
    echo "  $0 --timestamp 20240120_143022 --backup-dir ~/backups"
    echo "  $0 --timestamp 20240120_143022 --apply-schema  # Apply schema.yaml after restore"
    echo "  $0 --timestamp 20240120_143022 --no-update-admin  # Skip updating admin credentials"
    echo ""
    echo "Available backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -1 "$BACKUP_DIR"/*.dump 2>/dev/null | sed "s|.*directus-db-\(.*\)\.dump|\1|" | sort -r | head -5
    elif [ -d "db-backups" ]; then
        ls -1 db-backups/*.dump 2>/dev/null | sed 's/.*directus-db-\(.*\)\.dump/\1/' | sort -r | head -5
    else
        echo "  No backups directory found"
    fi
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Detect if we're in production (check for docker-compose.prod.yml)
# If docker-compose.prod.yml exists, use it (production environment)
# Otherwise, fall back to docker-compose.yml (local development)
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${YELLOW}Detected production environment (using docker-compose.prod.yml)${NC}"
elif [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✗ Error: Neither docker-compose.yml nor docker-compose.prod.yml found${NC}"
    echo -e "${YELLOW}Current directory: $(pwd)${NC}"
    exit 1
fi

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

# Check if backup files exist
# Normalize backup directory (remove trailing slash, expand ~)
BACKUP_DIR="${BACKUP_DIR%/}"
# Expand ~ to home directory (handles both ~ and ~/user formats)
if [[ "$BACKUP_DIR" == ~* ]]; then
    BACKUP_DIR="${BACKUP_DIR/#\~/$HOME}"
fi

DB_BACKUP="${BACKUP_DIR}/directus-db-${BACKUP_TIMESTAMP}.dump"
UPLOADS_BACKUP="${BACKUP_DIR}/directus-uploads-${BACKUP_TIMESTAMP}.tar.gz"

if [ ! -f "$DB_BACKUP" ]; then
    echo -e "${RED}✗ Database backup not found: $DB_BACKUP${NC}"
    exit 1
fi

if [ "$DB_ONLY" = false ] && [ ! -f "$UPLOADS_BACKUP" ]; then
    echo -e "${YELLOW}⚠ Uploads backup not found: $UPLOADS_BACKUP${NC}"
    echo -e "${YELLOW}Continuing with database-only restore...${NC}"
    DB_ONLY=true
fi

# Confirm before proceeding
# Skip confirmation if --yes flag is set OR if running non-interactively (no TTY)
if [ "$SKIP_CONFIRM" = false ] && [ -t 0 ]; then
    echo -e "${RED}⚠ WARNING: This will replace the current database and files!${NC}"
    echo ""
    echo "Backup timestamp: ${BACKUP_TIMESTAMP}"
    echo "Database backup: ${DB_BACKUP}"
    if [ "$DB_ONLY" = false ]; then
        echo "Uploads backup: ${UPLOADS_BACKUP}"
    else
        echo "Uploads: Skipped (--db-only)"
    fi
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Restore cancelled${NC}"
        exit 0
    fi
elif [ "$SKIP_CONFIRM" = false ] && [ ! -t 0 ]; then
    # Running non-interactively (via SSH), skip confirmation
    echo -e "${YELLOW}Running non-interactively, skipping confirmation prompt${NC}"
fi

# Verify compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}✗ Error: Docker compose file not found: $COMPOSE_FILE${NC}"
    echo -e "${YELLOW}Current directory: $(pwd)${NC}"
    echo -e "${YELLOW}Expected location: $PROJECT_ROOT/$COMPOSE_FILE${NC}"
    exit 1
fi

# Stop services (except database for now)
echo ""
echo -e "${YELLOW}→ Stopping services...${NC}"
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml stop directus astro cache 2>/dev/null || true
else
    docker compose stop directus astro cache 2>/dev/null || true
fi

# Restore database
echo ""
echo -e "${YELLOW}→ Restoring database...${NC}"

# Start database if not running
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml up -d db
    sleep 5
else
    docker compose up -d db
    sleep 5
fi

# Drop and recreate database
echo -e "${YELLOW}  Dropping existing database...${NC}"
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml exec -T db psql \
        -U ${POSTGRES_USER:-directus} \
        -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-directus};" || true
    
    docker compose -f docker-compose.prod.yml exec -T db psql \
        -U ${POSTGRES_USER:-directus} \
        -c "CREATE DATABASE ${POSTGRES_DB:-directus};" || true
else
    docker compose exec -T db psql \
        -U ${POSTGRES_USER:-directus} \
        -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-directus};" || true
    
    docker compose exec -T db psql \
        -U ${POSTGRES_USER:-directus} \
        -c "CREATE DATABASE ${POSTGRES_DB:-directus};" || true
fi

# Restore database backup
echo -e "${YELLOW}  Restoring database from backup...${NC}"
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml exec -T db pg_restore \
        -U ${POSTGRES_USER:-directus} \
        -d ${POSTGRES_DB:-directus} \
        --clean --if-exists \
        < "$DB_BACKUP"
else
    docker compose exec -T db pg_restore \
        -U ${POSTGRES_USER:-directus} \
        -d ${POSTGRES_DB:-directus} \
        --clean --if-exists \
        < "$DB_BACKUP"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restore complete${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    exit 1
fi

# Restore uploads (unless --db-only flag)
if [ "$DB_ONLY" = false ]; then
    echo ""
    echo -e "${YELLOW}→ Restoring uploads...${NC}"
    
    if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
        # Production: restore to /mnt/data/directus-uploads
        UPLOADS_DIR="/mnt/data/directus-uploads"
        echo -e "${YELLOW}  Restoring to production directory: ${UPLOADS_DIR}${NC}"
        
        sudo mkdir -p "$UPLOADS_DIR"
        sudo chown -R 1000:1000 "$UPLOADS_DIR"
        
        # Clear existing uploads
        sudo rm -rf "${UPLOADS_DIR}"/*
        
        # Extract backup
        sudo tar xzf "$UPLOADS_BACKUP" -C "$UPLOADS_DIR"
        sudo chown -R 1000:1000 "$UPLOADS_DIR"
    else
        # Local: restore to Docker volume
        VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep directus_uploads | head -1)
        
        if [ -z "$VOLUME_NAME" ]; then
            echo -e "${YELLOW}⚠ No uploads volume found, creating new one...${NC}"
            docker compose up -d directus 2>/dev/null || true
            sleep 2
            VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep directus_uploads | head -1)
        fi
        
        if [ -n "$VOLUME_NAME" ]; then
            echo -e "${YELLOW}  Restoring to Docker volume: ${VOLUME_NAME}${NC}"
            # Convert BACKUP_DIR to absolute path for Docker volume mount
            ABS_BACKUP_DIR=$(cd "$BACKUP_DIR" 2>/dev/null && pwd || echo "$BACKUP_DIR")
            docker run --rm \
                -v ${VOLUME_NAME}:/uploads \
                -v "${ABS_BACKUP_DIR}:/backup" \
                alpine sh -c "rm -rf /uploads/* && tar xzf /backup/directus-uploads-${BACKUP_TIMESTAMP}.tar.gz -C /uploads"
        else
            echo -e "${RED}✗ Could not find or create uploads volume${NC}"
        fi
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Uploads restore complete${NC}"
    else
        echo -e "${YELLOW}⚠ Uploads restore had issues${NC}"
    fi
fi

# Start all services
echo ""
echo -e "${YELLOW}→ Starting all services...${NC}"
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml up -d
else
    docker compose up -d
fi

# Wait for Directus to be ready before applying schema or updating credentials
if [ "$APPLY_SCHEMA" = true ] || [ "$UPDATE_ADMIN_CREDS" = true ]; then
    echo ""
    echo -e "${YELLOW}→ Waiting for Directus to be ready...${NC}"
    sleep 10
    
    # Wait for Directus to respond (up to 60 seconds)
    MAX_WAIT=60
    WAITED=0
    while [ $WAITED -lt $MAX_WAIT ]; do
        if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
            docker compose -f docker-compose.prod.yml exec -T directus node /directus/cli.js users list >/dev/null 2>&1
        else
            docker compose exec -T directus node /directus/cli.js users list >/dev/null 2>&1
        fi
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Directus is ready${NC}"
            break
        fi
        sleep 2
        WAITED=$((WAITED + 2))
        echo -n "."
    done
    echo ""
fi

# Update admin credentials from environment variables
if [ "$UPDATE_ADMIN_CREDS" = true ] && [ -n "${DIRECTUS_ADMIN_EMAIL:-}" ] && [ -n "${DIRECTUS_ADMIN_PASSWORD:-}" ]; then
    echo ""
    echo -e "${YELLOW}→ Updating admin credentials from environment variables...${NC}"
    
    if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
        # Update admin user password using Directus CLI
        docker compose -f docker-compose.prod.yml exec -T directus \
            node /directus/cli.js users passwd \
            --email "${DIRECTUS_ADMIN_EMAIL}" \
            --password "${DIRECTUS_ADMIN_PASSWORD}" \
            2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Admin credentials updated successfully${NC}"
            echo -e "${BLUE}  Email: ${DIRECTUS_ADMIN_EMAIL}${NC}"
        else
            echo -e "${YELLOW}⚠ Could not update admin credentials via CLI${NC}"
            echo -e "${YELLOW}  You may need to update the password manually in Directus UI${NC}"
        fi
    else
        docker compose exec -T directus \
            node /directus/cli.js users passwd \
            --email "${DIRECTUS_ADMIN_EMAIL}" \
            --password "${DIRECTUS_ADMIN_PASSWORD}" \
            2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Admin credentials updated successfully${NC}"
            echo -e "${BLUE}  Email: ${DIRECTUS_ADMIN_EMAIL}${NC}"
        else
            echo -e "${YELLOW}⚠ Could not update admin credentials via CLI${NC}"
            echo -e "${YELLOW}  You may need to update the password manually in Directus UI${NC}"
        fi
    fi
elif [ "$UPDATE_ADMIN_CREDS" = true ]; then
    echo ""
    echo -e "${YELLOW}⚠ Skipping admin credential update (DIRECTUS_ADMIN_EMAIL or DIRECTUS_ADMIN_PASSWORD not set)${NC}"
fi

# Apply schema.yaml if requested (for version-controlled schema)
if [ "$APPLY_SCHEMA" = true ]; then
    if [ -f "schema.yaml" ]; then
        echo ""
        echo -e "${YELLOW}→ Applying schema.yaml (version-controlled schema)...${NC}"
        
        if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
            docker compose -f docker-compose.prod.yml cp schema.yaml directus:/tmp/schema.yaml 2>/dev/null
            if [ $? -eq 0 ]; then
                docker compose -f docker-compose.prod.yml exec -T directus node /directus/cli.js schema apply /tmp/schema.yaml --yes 2>/dev/null
                SCHEMA_RESULT=$?
                docker compose -f docker-compose.prod.yml exec -T directus rm -f /tmp/schema.yaml 2>/dev/null || true
            else
                SCHEMA_RESULT=1
            fi
        else
            docker compose cp schema.yaml directus:/tmp/schema.yaml 2>/dev/null
            if [ $? -eq 0 ]; then
                docker compose exec -T directus node /directus/cli.js schema apply /tmp/schema.yaml --yes 2>/dev/null
                SCHEMA_RESULT=$?
                docker compose exec -T directus rm -f /tmp/schema.yaml 2>/dev/null || true
            else
                SCHEMA_RESULT=1
            fi
        fi
        
        if [ $SCHEMA_RESULT -eq 0 ]; then
            echo -e "${GREEN}✓ Schema applied successfully${NC}"
        else
            echo -e "${YELLOW}⚠ Schema application had issues (schema may already be up to date)${NC}"
            echo -e "${YELLOW}  Check Directus logs if needed: docker compose logs directus${NC}"
        fi
    else
        echo ""
        echo -e "${YELLOW}⚠ schema.yaml not found, skipping schema application${NC}"
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ RESTORE COMPLETE! ✅                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Services restarted. Check status with:${NC}"
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    echo -e "  ${YELLOW}docker compose -f docker-compose.prod.yml ps${NC}"
else
    echo -e "  ${YELLOW}docker compose ps${NC}"
fi
echo ""
