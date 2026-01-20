# Ansible Infrastructure Automation

This directory contains Ansible playbooks and roles for automating the deployment and management of the Bitcoin District production infrastructure.

## Directory Structure

```
ansible/
├── ansible.cfg              # Ansible configuration
├── inventory/
│   └── production.yml       # Production server inventory
├── group_vars/
│   └── production.yml       # Production variables
├── playbooks/
│   ├── initial-setup.yml    # First-time server setup
│   ├── deploy.yml           # Application deployment
│   └── maintenance.yml      # Maintenance tasks
└── roles/
    ├── common/              # Base system configuration
    ├── security/            # Firewall and hardening
    ├── docker/              # Docker installation
    ├── deploy-user/         # Deploy user setup
    └── caddy/               # Reverse proxy setup
```

## Prerequisites

### Local Machine

Install Ansible:

```bash
# Ubuntu/Debian
sudo apt install ansible

# macOS
brew install ansible

# pip
pip install ansible
```

### Server

- Ubuntu 24.04 LTS
- SSH access as root
- SSH key authentication configured

## Quick Start

### 1. Configure Inventory

Edit `inventory/production.yml` if your server IP differs:

```yaml
production:
  hosts:
    bitcoindistrict:
      ansible_host: YOUR_SERVER_IP
```

### 2. Test Connection

```bash
ansible -i inventory/production.yml all -m ping
```

Expected output:
```
bitcoindistrict | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

### 3. Run Initial Setup

```bash
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

## Playbooks

### initial-setup.yml

**Purpose**: First-time server configuration and hardening.

**What it does:**
- Updates system packages
- Configures firewall (UFW)
- Sets up fail2ban
- Installs Docker
- Creates deploy user
- Installs and configures Caddy
- Creates swap file
- Applies system optimizations

**Usage:**
```bash
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

**Run this:** Once per server (fresh setup)

**Duration:** ~10-15 minutes

### deploy.yml

**Purpose**: Deploy or update the application.

**What it does:**
- Pulls latest code from GitHub
- Copies .env file
- Builds Docker images
- Restarts containers
- Reloads Caddy

**Usage:**
```bash
ansible-playbook -i inventory/production.yml playbooks/deploy.yml
```

**Run this:** For manual deployments (GitHub Actions is recommended)

**Duration:** ~5-10 minutes

### maintenance.yml

**Purpose**: Regular maintenance and cleanup.

**What it does:**
- Updates system packages
- Cleans up Docker images/volumes
- Checks disk usage
- Displays system status
- Rotates logs

**Usage:**
```bash
ansible-playbook -i inventory/production.yml playbooks/maintenance.yml
```

**Run this:** Monthly or as needed

**Duration:** ~5 minutes

## Roles

### common

Base system configuration:
- System updates
- Essential packages
- Timezone configuration
- Hostname setup
- Swap file creation
- Sysctl optimizations

### security

Security hardening:
- UFW firewall configuration
- Fail2ban for SSH protection
- SSH hardening (key-only auth)
- Automatic security updates

### docker

Docker installation:
- Removes old Docker versions
- Adds Docker repository
- Installs Docker Engine and Compose
- Configures Docker daemon
- Adds users to docker group

### deploy-user

Deploy user management:
- Creates deploy user and group
- Sets up SSH keys
- Creates application directory
- Configures sudo access
- Creates data directories

### caddy

Reverse proxy setup:
- Installs Caddy
- Configures systemd service
- Sets up log rotation
- Creates necessary directories

## Variables

Edit `group_vars/production.yml` to customize:

```yaml
# Server configuration
domain: staging.bitcoindistrict.org
server_hostname: bitcoindistrict-prod

# Paths
app_dir: /home/deploy/bd-directus-astro
data_mount: /mnt/data

# System
swap_size_mb: 2048

# Users
app_user: deploy
app_group: deploy
```

## Tags

Run specific parts of playbooks using tags:

```bash
# Run only common tasks
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml --tags common

# Run only security tasks
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml --tags security

# Run multiple tags
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml --tags "common,security"
```

Available tags:
- `common` - Base system setup
- `security` - Security configuration
- `docker` - Docker installation
- `deploy-user` - User management
- `caddy` - Reverse proxy

## Dry Run

Test playbooks without making changes:

```bash
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml --check
```

## Verbose Output

For debugging, use verbose mode:

```bash
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml -v
# or -vv, -vvv, -vvvv for more verbosity
```

## Common Tasks

### Check Server Status

```bash
ansible -i inventory/production.yml all -a "uptime"
ansible -i inventory/production.yml all -a "df -h"
ansible -i inventory/production.yml all -a "free -h"
```

### Run Single Role

```bash
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml --tags docker
```

### Update Only System Packages

```bash
ansible -i inventory/production.yml all -m apt -a "update_cache=yes upgrade=dist" --become
```

### Check Docker Status

```bash
ansible -i inventory/production.yml all -a "docker ps" --become-user deploy
```

## Troubleshooting

### Connection Issues

**Problem:** Can't connect to server

**Solution:**
```bash
# Verify SSH access
ssh root@YOUR_SERVER_IP

# Check inventory file
cat inventory/production.yml

# Test with explicit user
ansible -i inventory/production.yml all -m ping -u root
```

### Permission Errors

**Problem:** Permission denied errors

**Solution:**
```bash
# Use --become flag
ansible-playbook -i inventory/production.yml playbooks/maintenance.yml --become

# Or specify become-user
ansible-playbook -i inventory/production.yml playbooks/deploy.yml --become-user deploy
```

### Ansible Not Found

**Problem:** Command not found

**Solution:**
```bash
# Install Ansible
pip install ansible

# Or use system package manager
sudo apt install ansible
```

### Role Not Found

**Problem:** Role not found error

**Solution:**
Ensure you're running commands from the `ansible/` directory:
```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/initial-setup.yml
```

## Best Practices

1. **Always test with --check first**
   ```bash
   ansible-playbook ... --check
   ```

2. **Use tags for partial updates**
   ```bash
   ansible-playbook ... --tags security
   ```

3. **Keep inventory under version control**
   - But never commit passwords or keys

4. **Run maintenance regularly**
   - Monthly system updates
   - Weekly Docker cleanup

5. **Use GitHub Actions for deployments**
   - Ansible is for infrastructure
   - CI/CD for application deployments

## Security Notes

- Never commit sensitive data (passwords, keys)
- Use Ansible Vault for secrets (if needed)
- Keep SSH keys secure
- Regularly update Ansible: `pip install --upgrade ansible`

## Additional Resources

- [Ansible Documentation](https://docs.ansible.com/)
- [Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [Main Deployment Guide](../README-DEPLOYMENT.md)

## Support

For issues:
1. Check playbook output for error messages
2. Run with `-vvv` for detailed logs
3. Verify server connectivity
4. Check [README-DEPLOYMENT.md](../README-DEPLOYMENT.md) for common issues
