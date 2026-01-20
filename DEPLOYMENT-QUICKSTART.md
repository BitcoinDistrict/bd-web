# Deployment Quick Start

This is a condensed guide for deploying Bitcoin District to production. For detailed instructions, see [README-DEPLOYMENT.md](README-DEPLOYMENT.md).

## Prerequisites

- Ubuntu 24.04 LTS server (104.236.1.164)
- 5GB volume mounted at `/mnt/data`
- Ansible installed locally: `pip install ansible`
- SSH access to server as root
- Access to Cloudflare DNS for bitcoindistrict.org
- GitHub repository access

## Quick Setup (30 minutes)

### 1. Initial Server Configuration

```bash
# Test SSH access
ssh root@104.236.1.164

# Run Ansible setup from your local machine
cd ansible
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

### 2. Generate and Configure SSH Keys

```bash
# Generate key for GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C "github-actions-deploy" -N ""

# Add public key to server
ssh root@104.236.1.164 "cat >> /home/deploy/.ssh/authorized_keys" < ~/.ssh/deploy_key.pub

# Test deploy user access
ssh -i ~/.ssh/deploy_key deploy@104.236.1.164 "whoami"
```

### 3. Configure Cloudflare DNS

1. Log into Cloudflare
2. Go to bitcoindistrict.org DNS settings
3. Add A record:
   - Name: `staging`
   - IPv4: `104.236.1.164`
   - Proxy: **DNS only** (gray cloud)

### 4. Add GitHub Secrets

Go to GitHub repo → Settings → Secrets → Actions and add:

```bash
# Generate secure values
DIRECTUS_KEY=$(openssl rand -base64 32)
DIRECTUS_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
```

**Required Secrets:**
- `PRODUCTION_HOST` = `104.236.1.164`
- `PRODUCTION_SSH_KEY` = Contents of `~/.ssh/deploy_key` (private key)
- `POSTGRES_DB` = `directus`
- `POSTGRES_USER` = `directus`
- `POSTGRES_PASSWORD` = (generated above)
- `DIRECTUS_KEY` = (generated above)
- `DIRECTUS_SECRET` = (generated above)
- `DIRECTUS_ADMIN_EMAIL` = `admin@bitcoindistrict.org`
- `DIRECTUS_ADMIN_PASSWORD` = (create strong password)
- `DIRECTUS_STATIC_TOKEN` = (leave empty, generate after first deploy)
- `DIRECTUS_EVENTS_TOKEN` = (leave empty, generate after first deploy)

### 5. Deploy

```bash
git add .
git commit -m "Initial production deployment"
git push origin main
```

Monitor at: `https://github.com/YOUR_USERNAME/bd-directus-astro/actions`

### 6. Verify Deployment

```bash
# Check services
ssh deploy@104.236.1.164 "cd ~/bd-directus-astro && docker compose -f docker-compose.prod.yml ps"

# Test URLs (wait ~2 minutes for SSL)
curl -I https://staging.bitcoindistrict.org
curl -I https://staging.bitcoindistrict.org/admin
```

### 7. Complete Directus Setup

1. Visit https://staging.bitcoindistrict.org/admin
2. Login with `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD`
3. Go to Settings → Access Tokens
4. Create two tokens:
   - **SSR Token**: Read access to all collections
   - **Events Token**: Create/Update for Events, Venues, Files
5. Add tokens to GitHub Secrets:
   - `DIRECTUS_STATIC_TOKEN`
   - `DIRECTUS_EVENTS_TOKEN`

## Common Commands

```bash
# View logs
ssh deploy@104.236.1.164 "cd ~/bd-directus-astro && docker compose -f docker-compose.prod.yml logs -f"

# Restart service
ssh deploy@104.236.1.164 "cd ~/bd-directus-astro && docker compose -f docker-compose.prod.yml restart astro"

# Manual deployment
cd ansible
ansible-playbook -i inventory/production.yml playbooks/deploy.yml

# Maintenance
cd ansible
ansible-playbook -i inventory/production.yml playbooks/maintenance.yml
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Site not loading | Check firewall: `sudo ufw status`, check Caddy: `sudo systemctl status caddy` |
| SSL errors | Verify DNS not proxied, check: `sudo journalctl -u caddy` |
| Container won't start | Check logs: `docker compose -f docker-compose.prod.yml logs [service]` |
| Out of space | Clean Docker: `docker system prune -af` |

## Next Steps

- [ ] Set up automated backups (cron job)
- [ ] Configure monitoring (optional)
- [ ] Test RSS event imports
- [ ] Import existing content
- [ ] Update bitcoindistrict.org DNS when ready to go live

## Support

Full documentation: [README-DEPLOYMENT.md](README-DEPLOYMENT.md)

---

**Server**: 104.236.1.164  
**Domain**: staging.bitcoindistrict.org  
**Admin**: https://staging.bitcoindistrict.org/admin
