#!/bin/bash
# Restart Caddy container and verify it's running
# This script helps troubleshoot and restart the Caddy reverse proxy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Caddy Container Restart Script"
echo "=========================================="
echo ""

# Check if docker-compose.prod.yml exists
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: docker-compose.prod.yml not found"
    exit 1
fi

# Check if Caddy container exists
echo "1. Checking for existing Caddy container..."
if docker ps -a | grep -q bd-web-caddy; then
    echo "   ✓ Found Caddy container"
    
    # Show current status
    echo ""
    echo "2. Current Caddy container status:"
    docker ps -a | grep bd-web-caddy || true
    
    # Check logs
    echo ""
    echo "3. Recent Caddy logs:"
    docker compose -f docker-compose.prod.yml logs caddy --tail=20 || true
    
    echo ""
    echo "4. Stopping Caddy container..."
    docker compose -f docker-compose.prod.yml stop caddy
    
    echo ""
    echo "5. Removing Caddy container..."
    docker compose -f docker-compose.prod.yml rm -f caddy
else
    echo "   ! No existing Caddy container found"
fi

# Make sure other services are running
echo ""
echo "6. Checking other services status..."
docker compose -f docker-compose.prod.yml ps

# Start Caddy
echo ""
echo "7. Starting Caddy container..."
docker compose -f docker-compose.prod.yml up -d caddy

# Wait a bit
echo ""
echo "8. Waiting for Caddy to start..."
sleep 5

# Check status
echo ""
echo "9. Verifying Caddy is running..."
if docker ps | grep -q bd-web-caddy; then
    echo "   ✅ Caddy container is running!"
else
    echo "   ❌ Caddy container failed to start"
    echo ""
    echo "Recent logs:"
    docker compose -f docker-compose.prod.yml logs caddy --tail=30
    exit 1
fi

# Show final status
echo ""
echo "10. Final status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=========================================="
echo "✅ Caddy restart complete!"
echo "=========================================="
echo ""
echo "Monitor logs with:"
echo "  docker compose -f docker-compose.prod.yml logs -f caddy"
echo ""
echo "Check certificate provisioning:"
echo "  docker compose -f docker-compose.prod.yml logs caddy | grep -i certificate"
