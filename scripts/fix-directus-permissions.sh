#!/bin/bash
#
# Fix Directus uploads directory permissions
# This script fixes permission issues that cause Directus health checks to fail
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DATA_MOUNT="/mnt/data"
DIRECTUS_UPLOADS_DIR="${DATA_MOUNT}/directus-uploads"
DIRECTUS_UID="1000"
DIRECTUS_GID="1000"

echo -e "${YELLOW}=== Directus Permissions Fix ===${NC}"
echo

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root or with sudo${NC}"
  exit 1
fi

# Check if directory exists
if [ ! -d "$DIRECTUS_UPLOADS_DIR" ]; then
  echo -e "${YELLOW}Directory $DIRECTUS_UPLOADS_DIR does not exist. Creating it...${NC}"
  mkdir -p "$DIRECTUS_UPLOADS_DIR"
fi

# Get current ownership
CURRENT_OWNER=$(stat -c '%u:%g' "$DIRECTUS_UPLOADS_DIR")
echo "Current ownership: $CURRENT_OWNER"
echo "Target ownership:  $DIRECTUS_UID:$DIRECTUS_GID"
echo

# Fix ownership
echo -e "${YELLOW}Fixing ownership of $DIRECTUS_UPLOADS_DIR...${NC}"
chown -R "${DIRECTUS_UID}:${DIRECTUS_GID}" "$DIRECTUS_UPLOADS_DIR"

# Fix permissions
echo -e "${YELLOW}Fixing permissions of $DIRECTUS_UPLOADS_DIR...${NC}"
chmod -R 755 "$DIRECTUS_UPLOADS_DIR"

# Verify changes
NEW_OWNER=$(stat -c '%u:%g' "$DIRECTUS_UPLOADS_DIR")
NEW_PERMS=$(stat -c '%a' "$DIRECTUS_UPLOADS_DIR")

echo
echo -e "${GREEN}Permissions fixed successfully!${NC}"
echo "New ownership:  $NEW_OWNER"
echo "New permissions: $NEW_PERMS"
echo

# Check if Docker Compose is available
if command -v docker &> /dev/null; then
  # Check if we're in the application directory
  if [ -f "docker-compose.prod.yml" ]; then
    echo -e "${YELLOW}Restarting Directus container...${NC}"
    docker compose -f docker-compose.prod.yml restart directus
    
    echo
    echo -e "${YELLOW}Waiting for Directus to start (30 seconds)...${NC}"
    sleep 30
    
    echo
    echo -e "${YELLOW}Checking container status...${NC}"
    docker compose -f docker-compose.prod.yml ps directus
    
    echo
    echo -e "${GREEN}Done! Check the container status above.${NC}"
    echo -e "If still unhealthy, check logs with: ${YELLOW}docker compose -f docker-compose.prod.yml logs -f directus${NC}"
  else
    echo -e "${YELLOW}Note: Run this script from the application directory to automatically restart Directus${NC}"
  fi
else
  echo -e "${YELLOW}Docker not found. Please manually restart the Directus container.${NC}"
fi
