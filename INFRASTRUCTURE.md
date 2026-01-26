# Infrastructure Overview

This document provides an overview of the Bitcoin District production infrastructure setup.

## Quick Links

- 🚀 [Quick Start Guide](DEPLOYMENT-QUICKSTART.md) - 30-minute setup guide
- 📖 [Full Deployment Guide](README-DEPLOYMENT.md) - Comprehensive documentation
- 🔧 [Ansible Documentation](ansible/README.md) - Infrastructure automation
- 🏗️ [Architecture Guide](README-ARCHITECTURE.md) - System architecture
- 🔍 [Troubleshooting Guide](README-TROUBLESHOOTING.md) - Common issues

## Infrastructure Components

### Server Configuration

- **Provider**: Digital Ocean
- **OS**: Ubuntu 24.04 LTS
- **IP**: YOUR_SERVER_IP
- **Domain**: bitcoindistrict.org
- **Storage**: 5GB volume at `/mnt/data`

### Application Stack

```
Internet → Cloudflare DNS → Caddy (Reverse Proxy) → Docker Containers
                                      ├─ Astro (SSR) - Port 4321
                                      └─ Directus (CMS) - Port 8055
                                          ├─ PostgreSQL (Database)
                                          └─ Redis (Cache)
```

### Services

| Service | Purpose | Port | URL |
|---------|---------|------|-----|
| Caddy | Reverse proxy, SSL/TLS | 80, 443 | - |
| Astro | Frontend application | 4321 | https://bitcoindistrict.org |
| Directus | Headless CMS | 8055 | https://cms.bitcoindistrict.org |
| PostgreSQL | Database | 5432 | Internal only |
| Redis | Cache | 6379 | Internal only |

## File Locations

### On Server

```
/home/deploy/
├── bd-directus-astro/           # Application code
│   ├── docker-compose.prod.yml
│   ├── Caddyfile
│   ├── .env                     # Production secrets
│   └── site/                    # Astro application
└── backups/                     # Deployment backups

/mnt/data/                       # 5GB volume
├── postgres/                    # Database files
├── directus-uploads/            # CMS uploads
├── caddy-data/                  # SSL certificates
└── swapfile                     # 2GB swap

/etc/caddy/
└── Caddyfile                    # Symlinked from app dir

/var/log/caddy/                  # Access logs
```

### In Repository

```
bd-directus-astro/
├── ansible/                     # Infrastructure automation
│   ├── playbooks/
│   ├── roles/
│   └── inventory/
├── .github/workflows/           # CI/CD pipelines
│   ├── deploy-production.yml
│   └── deploy-manual.yml
├── site/                        # Astro application
│   ├── Dockerfile              # Multi-stage build
│   └── src/
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
├── Caddyfile                   # Reverse proxy config
└── scripts/                    # Utility scripts
```

## Automation

### Initial Setup (Ansible)

Run once per server:
```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

Configures:
- System security (firewall, fail2ban)
- Docker installation
- Deploy user creation
- Caddy installation
- System optimizations

### Continuous Deployment (GitHub Actions)

**Automatic**: Every push to `main` branch
- Builds Docker images
- Syncs code to server
- Restarts containers
- Reloads Caddy

**Manual**: On-demand via GitHub UI
- Choose branch
- Force rebuild option
- Creates automatic backups

### Maintenance (Ansible)

Run monthly:
```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/maintenance.yml
```

Performs:
- System updates
- Docker cleanup
- Log rotation
- Health checks

## Security Features

### Network Security

- **UFW Firewall**: Only ports 22, 80, 443 allowed
- **Fail2ban**: SSH brute-force protection
- **SSH**: Key-only authentication, no passwords
- **SSL/TLS**: Automatic via Let's Encrypt (Caddy)

### Application Security

- **Docker Isolation**: Services in separate containers
- **Resource Limits**: CPU and memory constraints
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Secrets Management**: GitHub Secrets (never in code)

### Access Control

- **Root User**: SSH access only (emergency)
- **Deploy User**: Limited sudo, passwordless for docker
- **Admin Panel**: Password-protected Directus
- **API Tokens**: Separate tokens for different operations

## Monitoring

### View Logs

```bash
# Application logs
ssh deploy@YOUR_SERVER_IP
cd ~/bd-directus-astro
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f astro

# Caddy logs
sudo tail -f /var/log/caddy/access.log
```

### Check Status

```bash
# Container status
docker compose -f docker-compose.prod.yml ps

# System resources
docker stats
free -h
df -h

# Caddy status
sudo systemctl status caddy
```

### Health Checks

- Docker container health checks
- Astro responds on port 4321
- Directus responds on port 8055
- Caddy automatic retries on failure

## Backup Strategy

### Automatic Backups

Manual deployments create backups in `~/backups/`:
- Git commit hash
- .env file
- Keep last 5 backups

### Database Backups

```bash
ssh deploy@YOUR_SERVER_IP
cd ~/bd-directus-astro
./scripts/backup-database.sh
```

Set up cron for daily backups:
```bash
crontab -e
# Add: 0 2 * * * /home/deploy/bd-directus-astro/scripts/backup-database.sh
```

### What to Backup

1. **Database**: PostgreSQL data
2. **Uploads**: `/mnt/data/directus-uploads/`
3. **Environment**: `.env` file
4. **Configuration**: Caddyfile, docker-compose files

## Deployment Workflow

### Development → Production

```mermaid
graph LR
    Dev[Local Development] -->|git push| GitHub[GitHub Repository]
    GitHub -->|Triggers| Actions[GitHub Actions]
    Actions -->|SSH + rsync| Server[Production Server]
    Server -->|Docker Compose| Containers[Running Containers]
    Containers -->|Serves| Users[End Users]
```

### Deployment Steps

1. Developer pushes to `main` branch
2. GitHub Actions workflow triggers
3. Code synced to server via rsync
4. `.env` created from GitHub Secrets
5. Docker images built
6. Containers restarted
7. Caddy configuration reloaded
8. Health checks performed

## URLs and Access

### Public URLs

- **Main Site**: https://bitcoindistrict.org
- **Admin Panel**: https://cms.bitcoindistrict.org
- **Assets**: https://bitcoindistrict.org/assets/*

### SSH Access

```bash
# As deploy user (for deployments)
ssh deploy@YOUR_SERVER_IP

# As root (emergency only)
ssh root@YOUR_SERVER_IP
```

### GitHub Actions

- **Repository**: github.com/YOUR_USERNAME/bd-directus-astro
- **Actions**: github.com/YOUR_USERNAME/bd-directus-astro/actions
- **Secrets**: Settings → Secrets and variables → Actions

## Environment Variables

### Required for Production

See [DEPLOYMENT-QUICKSTART.md](DEPLOYMENT-QUICKSTART.md#4-add-github-secrets) for complete list.

Key variables:
- `PRODUCTION_HOST` - Server IP
- `PRODUCTION_SSH_KEY` - Deploy user SSH key
- Database credentials
- Directus configuration
- API tokens

### Where They're Used

1. **GitHub Secrets**: Stored securely in GitHub
2. **GitHub Actions**: Reads secrets, creates `.env`
3. **Server**: `.env` file in `/home/deploy/bd-directus-astro/`
4. **Docker**: Passed to containers via `docker-compose.prod.yml`

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| 502 Bad Gateway | Container not running | Restart: `docker compose -f docker-compose.prod.yml restart` |
| SSL error | DNS proxied or cert issue | Check Cloudflare, restart Caddy |
| Can't login to admin | Wrong credentials | Check GitHub Secrets, reset password |
| Out of space | Docker images/logs | Clean: `docker system prune -af` |
| Slow performance | Resource limits | Check: `docker stats`, increase limits |

## Performance Optimizations

### Implemented

- **Swap File**: 2GB on volume (prevents OOM)
- **Sysctl Tuning**: Network and file descriptor limits
- **Docker Logging**: Size limits prevent disk fill
- **Resource Limits**: CPU/memory constraints per container
- **Caching**: Redis for Directus, Caddy for assets
- **Log Rotation**: Automatic cleanup of old logs

### Future Improvements

- [ ] CDN for static assets
- [ ] Database connection pooling
- [ ] Image optimization pipeline
- [ ] Rate limiting (currently basic)
- [ ] Monitoring/alerting (Prometheus/Grafana)

## Scaling Considerations

### Vertical Scaling (Current)

Single server with resource limits:
- 1 CPU core per container
- 1GB RAM per container
- Can increase droplet size

### Horizontal Scaling (Future)

If needed:
- Multiple application servers behind load balancer
- Separate database server
- Shared file storage (S3/Spaces)
- Docker Swarm or Kubernetes

## Maintenance Schedule

### Daily (Automated)

- Log rotation
- Database backups (if configured)

### Weekly (Manual/Automated)

- Check disk space
- Review error logs
- Docker image cleanup

### Monthly (Ansible)

- System updates: `ansible-playbook ... maintenance.yml`
- Review security logs
- Update dependencies

### Quarterly

- Review security settings
- Rotate secrets/tokens
- Test backup restoration
- Review access logs

## Support Contacts

- **Documentation**: This repository
- **GitHub Actions**: Actions tab in repository
- **Server Access**: SSH to YOUR_SERVER_IP
- **DNS**: Cloudflare dashboard

## Version History

- **v1.0.0** (2026-01-20): Initial production infrastructure
  - Ansible automation
  - GitHub Actions CI/CD
  - Caddy reverse proxy
  - Docker Compose orchestration

---

**Last Updated**: 2026-01-20  
**Maintained By**: Bitcoin District Team  
**Server**: bitcoindistrict.org (YOUR_SERVER_IP)
