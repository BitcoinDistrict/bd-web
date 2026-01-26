#!/bin/bash
# Script to verify CORS headers are properly configured for Directus assets
# Usage: ./scripts/verify-cors-headers.sh [asset-id]

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ASSET_ID="${1:-}"
ASSET_URL="https://admin.bitcoindistrict.org/assets"

if [ -z "$ASSET_ID" ]; then
    echo -e "${YELLOW}Usage: $0 <asset-id>${NC}"
    echo -e "${YELLOW}Example: $0 123e4567-e89b-12d3-a456-426614174000${NC}"
    echo ""
    echo "To get an asset ID:"
    echo "1. Visit https://admin.bitcoindistrict.org/admin"
    echo "2. Go to File Library"
    echo "3. Click on any file to see its ID"
    exit 1
fi

FULL_URL="${ASSET_URL}/${ASSET_ID}"

echo -e "${GREEN}Testing CORS headers for: ${FULL_URL}${NC}"
echo ""

# Test OPTIONS preflight request
echo -e "${YELLOW}1. Testing OPTIONS preflight request...${NC}"
OPTIONS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
    -H "Origin: https://staging.bitcoindistrict.org" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Range" \
    "$FULL_URL")

if [ "$OPTIONS_RESPONSE" = "204" ]; then
    echo -e "${GREEN}✓ OPTIONS request returned 204 (No Content)${NC}"
else
    echo -e "${RED}✗ OPTIONS request returned $OPTIONS_RESPONSE (expected 204)${NC}"
fi

echo ""

# Test GET request with CORS headers
echo -e "${YELLOW}2. Testing GET request with CORS headers...${NC}"
HEADERS=$(curl -s -I -H "Origin: https://staging.bitcoindistrict.org" "$FULL_URL")

# Check for required CORS headers
MISSING_HEADERS=0

if echo "$HEADERS" | grep -qi "access-control-allow-origin.*staging.bitcoindistrict.org"; then
    echo -e "${GREEN}✓ Access-Control-Allow-Origin header present${NC}"
else
    echo -e "${RED}✗ Access-Control-Allow-Origin header missing or incorrect${NC}"
    MISSING_HEADERS=$((MISSING_HEADERS + 1))
fi

if echo "$HEADERS" | grep -qi "access-control-allow-methods"; then
    echo -e "${GREEN}✓ Access-Control-Allow-Methods header present${NC}"
else
    echo -e "${RED}✗ Access-Control-Allow-Methods header missing${NC}"
    MISSING_HEADERS=$((MISSING_HEADERS + 1))
fi

if echo "$HEADERS" | grep -qi "access-control-allow-headers.*range"; then
    echo -e "${GREEN}✓ Access-Control-Allow-Headers (Range) header present${NC}"
else
    echo -e "${RED}✗ Access-Control-Allow-Headers (Range) header missing${NC}"
    MISSING_HEADERS=$((MISSING_HEADERS + 1))
fi

if echo "$HEADERS" | grep -qi "access-control-expose-headers"; then
    echo -e "${GREEN}✓ Access-Control-Expose-Headers header present${NC}"
else
    echo -e "${RED}✗ Access-Control-Expose-Headers header missing${NC}"
    MISSING_HEADERS=$((MISSING_HEADERS + 1))
fi

echo ""
echo -e "${YELLOW}Full response headers:${NC}"
echo "$HEADERS" | head -20

echo ""

if [ $MISSING_HEADERS -eq 0 ]; then
    echo -e "${GREEN}✓ All CORS headers are present!${NC}"
    exit 0
else
    echo -e "${RED}✗ Missing $MISSING_HEADERS required CORS header(s)${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure Caddy container has been restarted: docker-compose -f docker-compose.prod.yml restart caddy"
    echo "2. Check Caddy logs: docker-compose -f docker-compose.prod.yml logs caddy | tail -50"
    echo "3. Verify Caddyfile syntax: docker-compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile"
    exit 1
fi
