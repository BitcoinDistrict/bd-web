# Caddy Container Troubleshooting Guide

## Issue: Caddy Container Not Starting

### Symptoms

- Running `docker compose ps` shows no Caddy container
- `docker compose up` or `docker compose restart` doesn't start Caddy
- Other containers (astro, directus, db, cache) are running fine

### Root Causes

There were two configuration issues that prevented Caddy from starting:

#### 1. Strict Health Check Dependencies (FIXED)

**Problem:** The Caddy container had strict health check dependencies:

```yaml
depends_on:
  astro:
    condition: service_healthy
  directus:
    condition: service_healthy
```

This meant Caddy would only start if BOTH astro and directus containers passed their health checks. If either service took too long or had transient health check failures, Caddy would never start.

**Solution:** Changed to simple service dependencies without health checks:

```yaml
depends_on:
  - astro
  - directus
```

Caddy now starts as soon as the other containers exist, regardless of their health status. Caddy's own retry logic handles waiting for upstream services.

#### 2. Incorrect Ansible Playbook (FIXED)

**Problem:** The `ansible/playbooks/deploy.yml` had this command:

```yaml
- name: Reload Caddy configuration
  command: systemctl reload caddy
```

This attempted to reload Caddy as a systemd service, but Caddy is running as a Docker container. This command would fail silently.

**Solution:** Replaced with proper Docker container status check:

```yaml
- name: Check Caddy container status
  command: docker compose -f docker-compose.prod.yml ps caddy
```

## How to Fix on Your Server

### Quick Fix: Restart Caddy

```bash
cd ~/bd-web
./scripts/restart-caddy.sh
```

This script will:
1. Stop and remove the existing Caddy container
2. Start a fresh Caddy container
3. Verify it's running properly

### Manual Fix

If the script doesn't work, try these steps:

```bash
cd ~/bd-web

# 1. Check current status
docker compose -f docker-compose.prod.yml ps

# 2. Pull latest changes (if you've pushed the fixes)
git pull origin main

# 3. Stop all containers
docker compose -f docker-compose.prod.yml down

# 4. Start all containers fresh
docker compose -f docker-compose.prod.yml up -d

# 5. Verify all containers are running
docker compose -f docker-compose.prod.yml ps

# 6. Check Caddy logs
docker compose -f docker-compose.prod.yml logs caddy
```

### Verify Caddy is Working

```bash
# Check container status
docker ps | grep caddy

# Check Caddy logs for certificate provisioning
docker compose -f docker-compose.prod.yml logs caddy | grep -i certificate

# Test HTTP to HTTPS redirect
curl -I http://staging.bitcoindistrict.org

# Test HTTPS (should get 200 or valid response)
curl -I https://staging.bitcoindistrict.org
```

## Prevention

### For GitHub Actions Deployments

The GitHub workflow (`.github/workflows/deploy-production.yml`) now uses:

```bash
docker compose -f docker-compose.prod.yml up -d --build --force-recreate --remove-orphans
```

This ensures:
- `--force-recreate` forces recreation of all containers
- `--remove-orphans` removes any old/orphaned containers
- All services (including Caddy) are started together

### For Ansible Deployments

If you use the Ansible playbook (`ansible/playbooks/deploy.yml`), the incorrect systemctl command has been removed. The playbook now:

1. Runs `docker compose up -d --build`
2. Checks container status
3. Displays Caddy status for verification

## Directory Permissions

Caddy needs write access to its data directories:

```bash
# Ensure directories exist
sudo mkdir -p /mnt/data/caddy-data /mnt/data/caddy-config

# Set correct ownership (should be readable by deploy user)
sudo chown -R deploy:deploy /mnt/data/caddy-data /mnt/data/caddy-config

# Set correct permissions
sudo chmod 755 /mnt/data/caddy-data /mnt/data/caddy-config
```

## Common Issues

### Issue: Ports Already in Use

```bash
# Check what's using port 80 or 443
sudo ss -tulpn | grep ':80\|:443'

# If something else is using these ports, you'll need to stop it
# Common culprits: Apache, Nginx, standalone Caddy installation
```

### Issue: Caddyfile Syntax Error

```bash
# Validate Caddyfile syntax
docker run --rm -v $PWD/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2.8-alpine caddy validate --config /etc/caddy/Caddyfile
```

### Issue: Certificate Provisioning Failures

```bash
# Check Caddy logs for Let's Encrypt errors
docker compose -f docker-compose.prod.yml logs caddy | grep -i "error\|failed"

# Common causes:
# - DNS not pointing to server
# - Port 80 not accessible from internet
# - Rate limiting from Let's Encrypt
```

## Monitoring

### Real-time Logs

```bash
# Follow all Caddy logs
docker compose -f docker-compose.prod.yml logs -f caddy

# Follow specific log level
docker compose -f docker-compose.prod.yml logs -f caddy | grep -i error
```

### Health Check

Caddy now includes a health check using its admin API:

```bash
# Check health status
docker inspect bd-web-caddy | jq '.[0].State.Health'

# Manual health check
docker exec bd-web-caddy wget --no-verbose --tries=1 --spider http://localhost:2019/config/
```

## Additional Resources

- [Caddy Documentation](https://caddyserver.com/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- Project documentation: `README-TROUBLESHOOTING.md`
