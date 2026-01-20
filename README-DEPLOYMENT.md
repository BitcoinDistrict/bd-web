# Deployment Guide - Bitcoin District

This guide walks you through deploying the Bitcoin District website to a Digital Ocean droplet with complete infrastructure automation.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Initial Server Setup](#initial-server-setup)
- [GitHub Configuration](#github-configuration)
- [DNS Configuration](#dns-configuration)
- [First Deployment](#first-deployment)
- [Ongoing Deployments](#ongoing-deployments)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Architecture Overview

The production infrastructure consists of:

- **Caddy**: Reverse proxy with automatic HTTPS (Let's Encrypt)
- **Docker Compose**: Container orchestration
- **Astro**: SSR web application (port 4321)
- **Directus**: Headless CMS (port 8055)
- **PostgreSQL**: Database (internal)
- **Redis**: Cache (internal)
- **GitHub Actions**: CI/CD automation

### URL Structure

- Main site: `https://staging.bitcoindistrict.org`
- Admin panel: `https://admin.staging.bitcoindistrict.org`
- Assets: `https://staging.bitcoindistrict.org/assets/*`

### Server Layout

```
/home/deploy/bd-directus-astro/    # Application code
/mnt/data/postgres/                 # Database files
/mnt/data/directus-uploads/         # User uploads
/mnt/data/caddy-data/              # SSL certificates
/mnt/data/swapfile                 # Swap file (2GB)
/etc/caddy/Caddyfile               # Caddy config (symlink)
/var/log/caddy/                    # Caddy logs
```

## Prerequisites

Before starting, ensure you have:

1. **Local Machine**:
   - Ansible installed: `pip install ansible`
   - SSH client
   - Git
   - Access to this repository

2. **Digital Ocean Droplet**:
   - Ubuntu 24.04 LTS
   - IP: YOUR_SERVER_IP
   - SSH access via root
   - 5GB volume mounted at `/mnt/data`

3. **Domain Access**:
   - Cloudflare account with bitcoindistrict.org
   - Ability to add DNS records

4. **GitHub Access**:
   - Repository access
   - Ability to add secrets
   - Ability to trigger workflows

## Initial Server Setup

### Step 1: Verify SSH Access

First, ensure you can SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

If you can't connect, add your SSH key:

```bash
ssh-copy-id root@YOUR_SERVER_IP
```

### Step 2: Verify Volume Mount

Check that your 5GB volume is mounted at `/mnt/data`:

```bash
ssh root@YOUR_SERVER_IP "df -h /mnt/data"
```

If not mounted, follow Digital Ocean's guide to mount the volume.

### Step 3: Run Ansible Initial Setup

From your local machine, navigate to the project directory and run:

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

This will:
- Update and secure the server
- Install Docker and Caddy
- Configure firewall (UFW)
- Set up fail2ban
- Create swap file
- Create deploy user
- Apply system optimizations

**Duration**: ~10-15 minutes

**Important**: If prompted about SSH configuration changes, review carefully before proceeding.

### Step 4: Generate SSH Key for GitHub Actions

Generate an ED25519 SSH key pair for GitHub Actions:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C "github-actions-deploy" -N ""
```

This creates two files:
- `~/.ssh/deploy_key` (private key - for GitHub)
- `~/.ssh/deploy_key.pub` (public key - for server)

### Step 5: Add Public Key to Deploy User

Copy the public key to the deploy user on the server:

```bash
ssh root@YOUR_SERVER_IP "cat >> /home/deploy/.ssh/authorized_keys" < ~/.ssh/deploy_key.pub
```

Verify the deploy user can be accessed:

```bash
ssh -i ~/.ssh/deploy_key deploy@YOUR_SERVER_IP "whoami"
```

Should output: `deploy`

## GitHub Configuration

### Step 1: Add GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

#### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PRODUCTION_HOST` | Server IP address | `YOUR_SERVER_IP` |
| `PRODUCTION_SSH_KEY` | Private SSH key for deploy user | Contents of `~/.ssh/deploy_key` |
| `POSTGRES_DB` | PostgreSQL database name | `directus` |
| `POSTGRES_USER` | PostgreSQL username | `directus` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Generate strong password |
| `DIRECTUS_KEY` | Directus encryption key (32+ chars) | Generate with `openssl rand -base64 32` |
| `DIRECTUS_SECRET` | Directus secret (32+ chars) | Generate with `openssl rand -base64 32` |
| `DIRECTUS_ADMIN_EMAIL` | Directus admin email | `admin@bitcoindistrict.org` |
| `DIRECTUS_ADMIN_PASSWORD` | Directus admin password | Generate strong password |
| `DIRECTUS_STATIC_TOKEN` | Directus API token (optional) | Generate in Directus after first deploy |
| `DIRECTUS_EVENTS_TOKEN` | Directus events import token (optional) | Generate in Directus after first deploy |

#### Generate Secure Secrets

```bash
# Generate strong passwords
openssl rand -base64 32

# Generate keys
openssl rand -hex 32
```

### Step 2: Add SSH Private Key

For `PRODUCTION_SSH_KEY`, copy the entire contents of your private key:

```bash
cat ~/.ssh/deploy_key
```

Copy from `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END OPENSSH PRIVATE KEY-----` (inclusive).

### Step 3: Verify Secrets

Double-check all secrets are added correctly. Missing secrets will cause deployment to fail.

## DNS Configuration

### Step 1: Log into Cloudflare

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and select `bitcoindistrict.org`.

### Step 2: Add A Records

Add two A records for the main site and admin subdomain:

**Main Site:**
1. Click **DNS** → **Records**
2. Click **Add record**
3. Configure:
   - **Type**: A
   - **Name**: staging
   - **IPv4 address**: YOUR_SERVER_IP
   - **Proxy status**: Proxied (orange cloud) ✅
   - **TTL**: Auto
4. Click **Save**

**Admin Subdomain:**
1. Click **Add record** again
2. Configure:
   - **Type**: A
   - **Name**: admin.staging
   - **IPv4 address**: YOUR_SERVER_IP
   - **Proxy status**: Proxied (orange cloud) ✅
   - **TTL**: Auto
3. Click **Save**

### Step 3: Configure Cloudflare SSL/TLS

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full** or **Full (strict)**
   - This ensures Cloudflare connects to Caddy over HTTPS
   - Caddy will still obtain Let's Encrypt certificates automatically

### Step 4: Verify DNS Propagation

Wait 1-5 minutes, then verify:

```bash
dig staging.bitcoindistrict.org +short
dig admin.staging.bitcoindistrict.org +short
```

Both should return Cloudflare IPs (not your server IP) when proxied, which is correct.

**Note**: Cloudflare proxy provides DDoS protection, caching, and other benefits. Caddy will still obtain valid Let's Encrypt certificates automatically.

## First Deployment

### Method 1: Automatic via Git Push (Recommended)

Simply push to the main branch:

```bash
git add .
git commit -m "Initial production deployment"
git push origin main
```

GitHub Actions will automatically:
1. Build the Docker images
2. Deploy to the server
3. Configure Caddy
4. Start all services
5. Verify deployment

Monitor progress at: `https://github.com/YOUR_USERNAME/bd-directus-astro/actions`

### Method 2: Manual via GitHub Actions

1. Go to **Actions** tab in GitHub
2. Select **Manual Deploy** workflow
3. Click **Run workflow**
4. Select branch: `main`
5. Check "Force rebuild Docker images"
6. Click **Run workflow**

### Method 3: Manual via Ansible (Fallback)

If GitHub Actions isn't working:

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/deploy.yml
```

## Verify Deployment

### Check Services

SSH into the server:

```bash
ssh deploy@YOUR_SERVER_IP
cd bd-directus-astro

# Check container status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Check Caddy status
sudo systemctl status caddy
```

### Test URLs

1. **Main site**: https://staging.bitcoindistrict.org
   - Should show the Bitcoin District homepage
   - Check browser console for errors

2. **Admin panel**: https://admin.staging.bitcoindistrict.org
   - Should show Directus login
   - Login with `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD`

3. **SSL Certificate**: Check for valid HTTPS
   ```bash
   curl -vI https://staging.bitcoindistrict.org 2>&1 | grep -i "SSL certificate"
   ```

### Generate Directus Tokens (First Time Only)

After first deployment, log into Directus to generate API tokens:

1. Go to https://admin.staging.bitcoindistrict.org
2. Login with admin credentials
3. Navigate to **Settings** → **Access Tokens**
4. Create two tokens:
   - **SSR Token**: Read access to all collections (for server-side rendering)
   - **Events Token**: Create/Update access to Events, Venues, Files (for RSS import)
5. Copy tokens and add to GitHub Secrets:
   - `DIRECTUS_STATIC_TOKEN`
   - `DIRECTUS_EVENTS_TOKEN`

## Ongoing Deployments

### Automatic Deployments

Every push to `main` branch triggers automatic deployment. The workflow:

1. Runs on every push to `main`
2. Skips if only documentation files changed
3. Takes ~5-10 minutes
4. Sends notification on failure

### Manual Deployments

For controlled deployments or emergency updates:

1. Go to **Actions** → **Manual Deploy**
2. Select branch and options
3. Click **Run workflow**

Options:
- **Branch**: Which branch to deploy
- **Rebuild**: Force rebuild Docker images (slower but ensures latest)

### Local Development

Continue using the development setup:

```bash
docker-compose up -d
```

Only production uses `docker-compose.prod.yml`.

## Monitoring & Maintenance

### View Logs

```bash
ssh deploy@YOUR_SERVER_IP

# Container logs
cd ~/bd-directus-astro
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f astro
docker compose -f docker-compose.prod.yml logs -f directus

# Caddy logs
sudo tail -f /var/log/caddy/access.log
sudo journalctl -u caddy -f
```

### Check Resource Usage

```bash
ssh deploy@YOUR_SERVER_IP

# Disk space
df -h

# Memory usage
free -h

# Docker stats
docker stats

# Specific volume usage
du -sh /mnt/data/*
```

### Database Backups

Run the backup script:

```bash
ssh deploy@YOUR_SERVER_IP
cd ~/bd-directus-astro
./scripts/backup-database.sh
```

Consider setting up a cron job for automated backups:

```bash
crontab -e
# Add: 0 2 * * * /home/deploy/bd-directus-astro/scripts/backup-database.sh
```

### System Maintenance

Run maintenance playbook monthly:

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/maintenance.yml
```

This will:
- Update system packages
- Clean up old Docker images
- Rotate logs
- Check disk usage

### Update Docker Images

To update Directus or other services:

1. Edit `docker-compose.prod.yml` with new version
2. Commit and push changes
3. Deployment will use new version

Example:
```yaml
directus:
  image: directus/directus:11.15.0  # Update version
```

## Troubleshooting

### Site Not Loading

1. **Check DNS**:
   ```bash
   dig staging.bitcoindistrict.org +short
   ```
   Should return server IP.

2. **Check Caddy**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "sudo systemctl status caddy"
   ```

3. **Check Containers**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "cd ~/bd-directus-astro && docker compose -f docker-compose.prod.yml ps"
   ```

4. **Check Firewall**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "sudo ufw status"
   ```
   Should show 80 and 443 allowed.

### SSL Certificate Issues

1. **Verify Cloudflare SSL/TLS mode**: Should be "Full" or "Full (strict)" in Cloudflare dashboard
2. **Check Caddy logs**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "sudo journalctl -u caddy -n 100"
   ```
3. **Restart Caddy**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "sudo systemctl restart caddy"
   ```
4. **If using Cloudflare proxy**: Ensure SSL/TLS encryption mode is set to "Full" (not "Flexible")

### Container Won't Start

1. **Check logs**:
   ```bash
   ssh deploy@YOUR_SERVER_IP
   cd ~/bd-directus-astro
   docker compose -f docker-compose.prod.yml logs [service-name]
   ```

2. **Check .env file**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "cat ~/bd-directus-astro/.env"
   ```

3. **Restart specific service**:
   ```bash
   docker compose -f docker-compose.prod.yml restart [service-name]
   ```

### Directus Admin Can't Login

1. **Reset admin password**:
   ```bash
   ssh deploy@YOUR_SERVER_IP
   cd ~/bd-directus-astro
   docker compose -f docker-compose.prod.yml exec directus \
     npx directus users update --email admin@bitcoindistrict.org --password newpassword
   ```

2. **Verify environment variables**:
   Check `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` in GitHub Secrets.

### Out of Disk Space

1. **Check usage**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "df -h && du -sh /mnt/data/*"
   ```

2. **Clean Docker**:
   ```bash
   ssh deploy@YOUR_SERVER_IP
   docker system prune -af
   docker volume prune -f
   ```

3. **Clean old backups**:
   ```bash
   ssh deploy@YOUR_SERVER_IP "rm -rf ~/backups/*"
   ```

### GitHub Actions Failing

1. **Check workflow logs** in GitHub Actions tab
2. **Common issues**:
   - Missing GitHub Secrets
   - SSH key mismatch
   - Server unreachable
   - Disk full on server

3. **Test SSH manually**:
   ```bash
   ssh -i ~/.ssh/deploy_key deploy@YOUR_SERVER_IP
   ```

## Rollback Procedures

### Automatic Rollback (Manual Deployments)

Manual deployments create automatic backups in `~/backups/`.

1. SSH into server:
   ```bash
   ssh deploy@YOUR_SERVER_IP
   ```

2. Find latest backup:
   ```bash
   ls -lt ~/backups/
   cat ~/backups/$(ls -t ~/backups | head -1)/commit.txt
   ```

3. Rollback to previous commit:
   ```bash
   cd ~/bd-directus-astro
   git checkout <commit-hash-from-backup>
   docker compose -f docker-compose.prod.yml up -d --build
   sudo systemctl reload caddy
   ```

### Manual Rollback

1. Find the commit to rollback to:
   ```bash
   git log --oneline -10
   ```

2. Trigger manual deployment with that branch/commit:
   - Go to **Actions** → **Manual Deploy**
   - Select branch
   - Run workflow

3. Or rollback via Ansible:
   ```bash
   cd ansible
   ansible-playbook -i inventory/production.yml playbooks/deploy.yml
   ```

### Emergency Rollback

If site is completely down:

1. SSH into server
2. Stop all containers:
   ```bash
   cd ~/bd-directus-astro
   docker compose -f docker-compose.prod.yml down
   ```

3. Checkout previous working version:
   ```bash
   git checkout <previous-commit>
   ```

4. Restore .env from backup:
   ```bash
   cp ~/backups/$(ls -t ~/backups | head -1)/.env .env
   ```

5. Restart:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   sudo systemctl restart caddy
   ```

## Additional Resources

- [README.md](README.md) - Project overview
- [README-ARCHITECTURE.md](README-ARCHITECTURE.md) - Technical architecture
- [README-TROUBLESHOOTING.md](README-TROUBLESHOOTING.md) - Common issues
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Directus Documentation](https://docs.directus.io/)
- [Ansible Documentation](https://docs.ansible.com/)

## Security Checklist

- [ ] SSH keys added (no password authentication)
- [ ] Firewall enabled (UFW)
- [ ] Fail2ban configured
- [ ] Strong passwords for all services
- [ ] GitHub Secrets properly configured
- [ ] DNS not proxied through Cloudflare (initially)
- [ ] Regular backups scheduled
- [ ] Security updates enabled
- [ ] Log monitoring in place

## Support

For issues or questions:
1. Check this documentation
2. Review GitHub Actions logs
3. Check server logs
4. Contact the development team

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
