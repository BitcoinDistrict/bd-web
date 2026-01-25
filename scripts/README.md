# Scripts Directory

Helper scripts for deployment and development.

## Available Scripts

### `restart-caddy.sh`

Restarts the Caddy reverse proxy container and verifies it's running properly.

**Usage:**

```bash
# On the server
./scripts/restart-caddy.sh
```

**What it does:**

1. Checks for existing Caddy container
2. Shows current status and recent logs
3. Stops and removes the existing Caddy container
4. Verifies other services are running
5. Starts a fresh Caddy container
6. Verifies successful startup

**When to use:**

- Caddy container is missing from `docker compose ps`
- Caddy container is not starting automatically
- After updating Caddyfile configuration
- After certificate provisioning issues
- When troubleshooting reverse proxy issues

**Troubleshooting:**

If Caddy still won't start, check:
- `/mnt/data/caddy-data` directory exists and is writable
- `/mnt/data/caddy-config` directory exists and is writable
- Ports 80 and 443 are not in use by other services
- Caddyfile syntax is valid

### `fix-directus-permissions.sh`

Fixes permission issues with the Directus uploads directory that cause health check failures.

**Usage:**

```bash
# On the server, run as root
sudo ./scripts/fix-directus-permissions.sh
```

**What it does:**

1. Sets correct ownership (UID:GID 1000:1000) on `/mnt/data/directus-uploads`
2. Sets correct permissions (755) recursively
3. Restarts the Directus container
4. Displays the container status

**When to use:**

- Directus container is unhealthy with "EACCES: permission denied" errors
- After initial server setup if Directus fails to start
- After manual changes to the data volume

**See also:**

- `docs/directus-permissions-fix.md` - Detailed documentation
- `ansible/playbooks/fix-directus-permissions.yml` - Ansible version

### `generate-deploy-key.sh`

Generates a new SSH key pair for GitHub Actions deployment and provides formatted output for adding to GitHub Secrets.

**Usage:**

```bash
./scripts/generate-deploy-key.sh
```

**What it does:**

1. Generates a new ED25519 SSH key pair at `~/.ssh/github_actions_deploy`
2. Displays the private key (for `PRODUCTION_SSH_KEY_DEPLOY` secret)
3. Displays the public key (for `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY` secret)
4. Provides instructions for finding your root key
5. Shows testing commands

**Output:**

- Private key: `~/.ssh/github_actions_deploy`
- Public key: `~/.ssh/github_actions_deploy.pub`

**When to use:**

- Initial setup of two-key SSH configuration
- Rotating the deploy key
- Setting up a new environment

**See also:**

- `SETUP-SSH-KEYS.md` - Detailed setup guide
- `DEPLOYMENT-CHECKLIST.md` - Verification checklist
- `docs/ssh-key-architecture.md` - Architecture documentation
