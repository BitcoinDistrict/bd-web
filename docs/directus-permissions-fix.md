# Directus Permissions Fix

## Problem

The Directus container was failing health checks with the error:
```
EACCES: permission denied, open '/directus/uploads/directus-health-file'
```

This occurred because the `/mnt/data/directus-uploads` directory on the host had incorrect ownership that didn't match the user running inside the Directus container.

## Root Cause

- **Host directory**: `/mnt/data/directus-uploads` was owned by UID:GID `999:999`
- **Container user**: Directus 11.14.1 runs as the `node` user with UID:GID `1000:1000`
- **Result**: Permission mismatch prevented Directus from writing files

## Solution

### Immediate Fix (Run on Server)

Run the Ansible playbook to fix permissions:

```bash
ansible-playbook -i ansible/inventory/production.yml \
  ansible/playbooks/fix-directus-permissions.yml
```

### Manual Fix (Alternative)

If you need to fix this manually on the server:

```bash
# SSH into the server
ssh deploy@your-server

# Fix the permissions
sudo chown -R 1000:1000 /mnt/data/directus-uploads
sudo chmod -R 755 /mnt/data/directus-uploads

# Restart Directus
cd ~/bd-web
docker compose -f docker-compose.prod.yml restart directus

# Check health
docker compose -f docker-compose.prod.yml ps
```

## Prevention

The following files have been updated to prevent this issue in the future:

1. **`ansible/roles/deploy-user/tasks/main.yml`**: Updated to create the directory with UID:GID `1000:1000`
2. **`ansible/playbooks/deploy.yml`**: Added a task to ensure correct permissions on every deployment

## Volume Configuration Standards

All persistent data volumes use `/mnt/data` as the base path:

| Service | Host Path | Container Path | UID:GID | Mode | Notes |
|---------|-----------|----------------|---------|------|-------|
| postgres | `/mnt/data/postgres` | `/var/lib/postgresql/data` | `70:70` | `0700` | PostgreSQL user |
| directus | `/mnt/data/directus-uploads` | `/directus/uploads` | `1000:1000` | `0755` | Node user |
| caddy | `/mnt/data/caddy-data` | `/data` | `deploy:deploy` | `0755` | TLS certificates |
| caddy | `/mnt/data/caddy-config` | `/config` | `deploy:deploy` | `0755` | Caddy config |

## Verification

After applying the fix, verify Directus is healthy:

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check Directus logs
docker compose -f docker-compose.prod.yml logs -f directus

# Test health endpoint
curl http://localhost:8055/server/health
```

You should see:
- Container status showing `(healthy)` instead of `(unhealthy)`
- Health endpoint returning HTTP 200 instead of 503
- No more `EACCES` errors in the logs
