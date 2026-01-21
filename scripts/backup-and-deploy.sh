#!/bin/bash

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         📦 BACKUP LOCAL → DEPLOY TO PRODUCTION 📦              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
DB_ONLY=false
SKIP_CONFIRM=false
PRODUCTION_HOST=""
SSH_KEY=""
SSH_OPTS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --db-only)
            DB_ONLY=true
            shift
            ;;
        --yes)
            SKIP_CONFIRM=true
            shift
            ;;
        --host)
            PRODUCTION_HOST="$2"
            shift 2
            ;;
        --ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --db-only          Backup database only (skip files)"
            echo "  --yes               Skip confirmation prompts"
            echo "  --host HOST         Production server (user@host or just host)"
            echo "  --ssh-key PATH      SSH key to use (default: ~/.ssh/deploy_key)"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Use BD_WEB_HOST from .env"
            echo "  $0 --host deploy@192.168.1.100       # Specify host"
            echo "  $0 --ssh-key ~/.ssh/my_key          # Use custom SSH key"
            exit 1
            ;;
    esac
done

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

# Get production host
if [ -z "$PRODUCTION_HOST" ]; then
    if [ -n "$BD_WEB_HOST" ]; then
        PRODUCTION_HOST="$BD_WEB_HOST"
    elif [ -n "$PRODUCTION_HOST" ]; then
        PRODUCTION_HOST="$PRODUCTION_HOST"
    else
        echo -e "${RED}✗ Error: Production host not specified${NC}"
        echo ""
            echo "Set BD_WEB_HOST in .env or use --host option"
            echo "Example: $0 --host deploy@your-server-ip"
            echo ""
            echo "SSH key options:"
            echo "  --ssh-key PATH    Specify SSH key to use (default: ~/.ssh/deploy_key)"
            exit 1
    fi
fi

# Ensure host has user@ format
if [[ ! "$PRODUCTION_HOST" == *"@"* ]]; then
    PRODUCTION_HOST="deploy@${PRODUCTION_HOST}"
fi

# Detect SSH key to use
if [ -z "$SSH_KEY" ]; then
    # Try deploy_key first (same as GitHub Actions)
    if [ -f ~/.ssh/deploy_key ]; then
        SSH_KEY="$HOME/.ssh/deploy_key"
        echo -e "${GREEN}✓ Using deploy key: ~/.ssh/deploy_key${NC}"
    else
        # Fall back to default SSH keys
        SSH_KEY=""
        echo -e "${YELLOW}⚠ No deploy key found, using default SSH keys${NC}"
        echo -e "${YELLOW}  (You can specify with --ssh-key ~/.ssh/deploy_key)${NC}"
    fi
fi

# Build SSH options
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    # Verify key exists and has correct permissions
    if [ ! -f "$SSH_KEY" ]; then
        echo -e "${RED}✗ SSH key not found: $SSH_KEY${NC}"
        exit 1
    fi
    # Check key permissions
    KEY_PERMS=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || stat -f "%OLp" "$SSH_KEY" 2>/dev/null)
    if [ "$KEY_PERMS" != "600" ] && [ "$KEY_PERMS" != "400" ]; then
        echo -e "${YELLOW}⚠ Warning: SSH key permissions should be 600 or 400 (current: $KEY_PERMS)${NC}"
        echo -e "${YELLOW}  Fix with: chmod 600 $SSH_KEY${NC}"
    fi
else
    SSH_OPTS="-o StrictHostKeyChecking=no"
fi

echo -e "${BLUE}Production server: ${PRODUCTION_HOST}${NC}"
if [ -n "$SSH_KEY" ]; then
    echo -e "${BLUE}SSH key: ${SSH_KEY}${NC}"
fi
echo ""

# Confirm before proceeding
if [ "$SKIP_CONFIRM" = false ]; then
    echo -e "${YELLOW}This will:${NC}"
    echo "  1. Backup your local database and files"
    echo "  2. Transfer backups to production server"
    echo "  3. Restore backups on production (⚠ replaces existing data)"
    echo ""
    read -p "Continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Cancelled${NC}"
        exit 0
    fi
fi

# Step 1: Backup locally
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Creating local backup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$DB_ONLY" = true ]; then
    ./scripts/backup-database.sh --db-only
else
    ./scripts/backup-database.sh
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Get the latest backup timestamp
LATEST_BACKUP=$(ls -t db-backups/directus-db-*.dump 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo -e "${RED}✗ No backup file found${NC}"
    exit 1
fi

TIMESTAMP=$(basename "$LATEST_BACKUP" | sed 's/directus-db-\(.*\)\.dump/\1/')
echo -e "${GREEN}✓ Backup created with timestamp: ${TIMESTAMP}${NC}"

# Step 2: Transfer to production
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Transferring backups to production${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Create backups directory on production
echo -e "${YELLOW}→ Testing SSH connection...${NC}"
ssh $SSH_OPTS "$PRODUCTION_HOST" "mkdir -p ~/backups" 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ SSH connection failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check if SSH key is correct: $SSH_KEY"
    echo "  2. Verify server is accessible: ping $(echo $PRODUCTION_HOST | cut -d@ -f2)"
    echo "  3. Try manual connection: ssh $SSH_OPTS $PRODUCTION_HOST"
    echo "  4. If using deploy key, ensure it's added to server:"
    echo "     ssh-copy-id -i $SSH_KEY $PRODUCTION_HOST"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"

# Transfer database backup
echo -e "${YELLOW}→ Transferring database backup...${NC}"
scp $SSH_OPTS "db-backups/directus-db-${TIMESTAMP}.dump" "${PRODUCTION_HOST}:~/backups/"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Database transfer failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database backup transferred${NC}"

# Transfer uploads backup (if not --db-only)
if [ "$DB_ONLY" = false ]; then
    if [ -f "db-backups/directus-uploads-${TIMESTAMP}.tar.gz" ]; then
        echo -e "${YELLOW}→ Transferring uploads backup (this may take a while)...${NC}"
        scp $SSH_OPTS "db-backups/directus-uploads-${TIMESTAMP}.tar.gz" "${PRODUCTION_HOST}:~/backups/"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Uploads transfer failed${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Uploads backup transferred${NC}"
    else
        echo -e "${YELLOW}⚠ Uploads backup not found, skipping...${NC}"
    fi
fi

# Step 3: Restore on production
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Restoring on production server${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Determine production app directory (check both possible locations)
PROD_APP_DIR=""
if ssh $SSH_OPTS "$PRODUCTION_HOST" "[ -d ~/bd-web ]" 2>/dev/null; then
    PROD_APP_DIR="~/bd-web"
elif ssh $SSH_OPTS "$PRODUCTION_HOST" "[ -d ~/bd-directus-astro ]" 2>/dev/null; then
    PROD_APP_DIR="~/bd-directus-astro"
elif ssh $SSH_OPTS "$PRODUCTION_HOST" "[ -d /home/deploy/bd-web ]" 2>/dev/null; then
    PROD_APP_DIR="/home/deploy/bd-web"
else
    # Default to bd-web (production standard)
    PROD_APP_DIR="~/bd-web"
    echo -e "${YELLOW}⚠ Could not detect production directory, using default: ${PROD_APP_DIR}${NC}"
fi

echo -e "${BLUE}Production app directory: ${PROD_APP_DIR}${NC}"

# Copy restore script and schema.yaml to production
echo -e "${YELLOW}→ Ensuring restore script exists on production...${NC}"
scp $SSH_OPTS scripts/restore-database.sh "${PRODUCTION_HOST}:${PROD_APP_DIR}/scripts/" 2>/dev/null || \
    ssh $SSH_OPTS "$PRODUCTION_HOST" "mkdir -p ${PROD_APP_DIR}/scripts && cat > ${PROD_APP_DIR}/scripts/restore-database.sh" < scripts/restore-database.sh

ssh $SSH_OPTS "$PRODUCTION_HOST" "chmod +x ${PROD_APP_DIR}/scripts/restore-database.sh"

# Transfer schema.yaml for version-controlled schema
if [ -f "schema.yaml" ]; then
    echo -e "${YELLOW}→ Transferring schema.yaml for version control...${NC}"
    scp $SSH_OPTS schema.yaml "${PRODUCTION_HOST}:${PROD_APP_DIR}/" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Schema.yaml transferred${NC}"
    else
        echo -e "${YELLOW}⚠ Schema.yaml transfer failed (will skip schema application)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ schema.yaml not found locally, skipping schema transfer${NC}"
fi

# Run restore on production
# Always use --yes when running remotely via SSH (non-interactive)
echo -e "${YELLOW}→ Running restore on production...${NC}"
RESTORE_CMD="cd ${PROD_APP_DIR} && ./scripts/restore-database.sh --timestamp ${TIMESTAMP} --backup-dir ~/backups --apply-schema --yes"
if [ "$DB_ONLY" = true ]; then
    RESTORE_CMD="${RESTORE_CMD} --db-only"
fi

ssh $SSH_OPTS "$PRODUCTION_HOST" "$RESTORE_CMD"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Restore failed on production${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ DEPLOYMENT COMPLETE! ✅                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Backup timestamp: ${TIMESTAMP}${NC}"
echo -e "${BLUE}Production server: ${PRODUCTION_HOST}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Verify the site: https://staging.bitcoindistrict.org"
echo "  2. Check admin panel: https://admin.bitcoindistrict.org"
echo "  3. Verify content and files are restored correctly"
echo "  4. Schema.yaml has been applied to ensure version-controlled schema"
echo ""
echo -e "${BLUE}To verify files were restored:${NC}"
echo -e "  ${YELLOW}# Check file count in production uploads directory${NC}"
echo -e "  ${YELLOW}ssh $SSH_KEY_ARG $PRODUCTION_HOST 'find /mnt/data/directus-uploads -type f | wc -l'${NC}"
echo ""
echo -e "  ${YELLOW}# Compare with local backup file count${NC}"
echo -e "  ${YELLOW}tar -tzf db-backups/directus-uploads-${TIMESTAMP}.tar.gz | grep -v '/$' | wc -l${NC}"
echo ""
