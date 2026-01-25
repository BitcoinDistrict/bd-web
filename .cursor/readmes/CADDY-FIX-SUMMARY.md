# Caddy Container Fix - Summary

## What Was Wrong

Your Caddy container wasn't starting due to two configuration issues:

### 1. **Strict Health Check Dependencies** 
The Caddy service was waiting for both `astro` and `directus` to be "healthy" before starting. This is too restrictive - if either service has transient health check issues, Caddy won't start at all.

### 2. **Incorrect Ansible Command**
The `ansible/playbooks/deploy.yml` was trying to run `systemctl reload caddy`, treating Caddy as a systemd service instead of a Docker container.

## Changes Made

### Modified Files

1. **`docker-compose.prod.yml`**
   - Changed Caddy's `depends_on` from requiring health checks to simple dependencies
   - Added a proper health check for Caddy using its admin API
   - This allows Caddy to start and retry connecting to upstream services

2. **`ansible/playbooks/deploy.yml`**
   - Removed the incorrect `systemctl reload caddy` command
   - Added proper Docker container status checking

3. **New script: `scripts/restart-caddy.sh`**
   - Helper script to restart Caddy and verify it's running
   - Includes diagnostic output and troubleshooting info

4. **Updated: `scripts/README.md`**
   - Added documentation for the new restart-caddy.sh script

5. **New doc: `docs/caddy-troubleshooting.md`**
   - Comprehensive troubleshooting guide
   - Explains the root causes and solutions
   - Includes common issues and monitoring commands

## What You Need to Do Now

### On Your Local Machine

```bash
# 1. Review and commit the changes
git status
git add .
git commit -m "Fix Caddy container startup issues

- Remove strict health check dependencies from Caddy service
- Fix Ansible playbook systemctl command
- Add restart-caddy.sh helper script
- Add comprehensive troubleshooting documentation"

# 2. Push to production
git push origin main
```

### On Your Server

**Option A: Use the restart script (Recommended)**

```bash
cd ~/bd-web

# Pull latest changes
git pull origin main

# Run the restart script
./scripts/restart-caddy.sh
```

**Option B: Manual restart**

```bash
cd ~/bd-web

# Pull latest changes
git pull origin main

# Restart all containers with updated config
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verify Caddy is running
docker compose -f docker-compose.prod.yml ps
```

### Verify It's Working

After restarting, you should see Caddy in the container list:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                IMAGE                       ...    STATUS
bd-web-astro-1      bd-web-astro                ...    Up (healthy)
bd-web-cache-1      redis:7.2-alpine            ...    Up (healthy)
bd-web-caddy        caddy:2.8-alpine            ...    Up
bd-web-db-1         postgres:15.6               ...    Up (healthy)
bd-web-directus-1   directus/directus:11.14.1   ...    Up (healthy)
```

Test the sites:

```bash
# Should redirect to HTTPS
curl -I http://staging.bitcoindistrict.org

# Should return 200 OK
curl -I https://staging.bitcoindistrict.org

# Should return 200 OK
curl -I https://admin.bitcoindistrict.org/server/health
```

## Why This Happened

The most likely scenario is that during a previous deployment:

1. The Caddy container was removed or stopped
2. When trying to restart with `docker compose up`, the health check dependencies prevented Caddy from starting
3. The incorrect Ansible systemctl command couldn't fix it because Caddy isn't a system service
4. The container remained in a stopped state

## Prevention

Going forward, these issues won't happen because:

1. ✅ Caddy no longer depends on strict health checks
2. ✅ Ansible playbook uses correct Docker commands
3. ✅ GitHub Actions workflow uses `--force-recreate` and `--remove-orphans` flags
4. ✅ New helper scripts make troubleshooting easier

## Questions or Issues?

If Caddy still won't start after following these steps:

1. Check the troubleshooting guide: `docs/caddy-troubleshooting.md`
2. Review Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`
3. Check directory permissions: `/mnt/data/caddy-data` and `/mnt/data/caddy-config` must be writable
4. Verify ports 80 and 443 are not in use: `sudo ss -tulpn | grep ':80\|:443'`
