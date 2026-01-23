# Security Configuration

## File System Permissions

### Container User IDs

Our Docker containers run as specific non-root users for security. The host filesystem permissions are configured to match these container UIDs:

| Service | Container User | UID:GID | Host Directory | Permissions | Rationale |
|---------|---------------|---------|----------------|-------------|-----------|
| PostgreSQL | `postgres` | 70:70 | `/mnt/data/postgres` | 0700 (drwx------) | Database files contain sensitive data and should only be accessible by the postgres user |
| Directus | `node` | 1000:1000 | `/mnt/data/directus-uploads` | 0755 (drwxr-xr-x) | Upload files need to be readable by web server but only writable by Directus |
| Caddy | `deploy` | varies | `/mnt/data/caddy-data` | 0755 (drwxr-xr-x) | SSL certificates and Caddy data, readable but protected |

### Why Not 777?

Using 777 permissions would allow ANY user on the system (or container) to read, write, and execute files. This is a security risk because:

1. **Lateral Movement**: If any container is compromised, attackers could modify data in other containers
2. **Data Exfiltration**: Unauthorized users could read sensitive database backups or uploaded files
3. **Malware Injection**: Attackers could inject malicious files into upload directories
4. **Compliance**: Violates security best practices and compliance requirements (PCI-DSS, SOC 2, etc.)

### Principle of Least Privilege

We follow the principle of least privilege:

- **0700** for PostgreSQL: Only the postgres user can access database files
- **0755** for Directus uploads: Directus can write, others can only read (for serving files)
- **Numeric UIDs**: We use numeric UIDs (1000, 70) instead of usernames to ensure consistency across host and container

### Verifying Permissions

To check current permissions on the server:

```bash
# Check data directory permissions
ls -la /mnt/data/

# Check what UID containers are running as
docker compose -f docker-compose.prod.yml exec directus id
docker compose -f docker-compose.prod.yml exec db id

# Check file ownership inside containers
docker compose -f docker-compose.prod.yml exec directus ls -la /directus/uploads
```

### Fixing Permissions

If permissions become misconfigured, run the maintenance playbook:

```bash
ansible-playbook -i ansible/inventory/production.yml \
  ansible/playbooks/maintenance.yml \
  --tags fix-permissions
```

Or manually on the server:

```bash
# Fix Directus uploads
sudo chown -R 1000:1000 /mnt/data/directus-uploads
sudo chmod 755 /mnt/data/directus-uploads
sudo find /mnt/data/directus-uploads -type f -exec chmod 644 {} \;
sudo find /mnt/data/directus-uploads -type d -exec chmod 755 {} \;

# Fix PostgreSQL data
sudo chown -R 70:70 /mnt/data/postgres
sudo chmod 700 /mnt/data/postgres
```

## Container Security

### Non-Root Containers

All our containers run as non-root users by default:

- **PostgreSQL**: Uses official postgres image (UID 70)
- **Directus**: Uses official directus image (runs as node, UID 1000)
- **Astro**: Custom image but runs as node user
- **Redis**: Official redis image (runs as redis user)

### Network Isolation

- Containers communicate via internal Docker network (`bd-network`)
- Only Caddy is exposed to the internet (ports 80/443)
- Directus and Astro only expose ports to localhost (127.0.0.1)
- Database is completely internal (no host port binding)

### Secret Management

Secrets are managed through:

1. `.env` file on server (not committed to git)
2. GitHub Actions secrets for CI/CD
3. Directus admin credentials and tokens
4. Environment variables in docker-compose.prod.yml

Never commit the `.env` file or expose secrets in logs.
