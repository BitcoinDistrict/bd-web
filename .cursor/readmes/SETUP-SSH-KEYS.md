# SSH Key Setup Guide for CI/CD

This guide explains how to set up separate SSH keys for infrastructure management (root) and application deployment (deploy user) in your GitHub Actions workflow.

## Overview

We use **two separate SSH key pairs** for security and separation of concerns:

1. **Root Key** - For Ansible infrastructure changes (system setup, user creation, package installation)
2. **Deploy Key** - For application deployments (Docker operations, file syncing, app updates)

## Step 1: Generate the Deploy Key Pair

On your local machine, generate a new SSH key pair specifically for CI/CD deployments:

```bash
# Generate a new ED25519 key pair (more secure than RSA)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# This creates two files:
# - ~/.ssh/github_actions_deploy (private key - for GitHub Secrets)
# - ~/.ssh/github_actions_deploy.pub (public key - for Ansible config)
```

**Important**: When prompted for a passphrase, press Enter (leave it empty) since this key will be used by automated systems.

## Step 2: Get Your Existing Root Key

You already have a root key that you use to access your Digital Ocean droplet. This is the key you created when setting up the droplet (or the one on your laptop that you use to SSH as root).

To find it:

```bash
# List your SSH keys
ls -la ~/.ssh/

# Common names: id_rsa, id_ed25519, id_ecdsa, or a custom name
# The .pub file is the public key, the file without extension is the private key
```

## Step 3: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Repository secrets

Add the following secrets:

### 3.1 PRODUCTION_SSH_KEY_ROOT

```bash
# Copy your existing root private key
cat ~/.ssh/id_ed25519  # or whatever your root key is named

# Copy the ENTIRE output (including BEGIN and END lines) and paste into GitHub secret
```

**Name**: `PRODUCTION_SSH_KEY_ROOT`
**Value**: Your root private key (the one you currently use to SSH into the droplet)

### 3.2 PRODUCTION_SSH_KEY_DEPLOY

```bash
# Copy the NEW deploy private key you just generated
cat ~/.ssh/github_actions_deploy

# Copy the ENTIRE output and paste into GitHub secret
```

**Name**: `PRODUCTION_SSH_KEY_DEPLOY`
**Value**: The new deploy private key from Step 1

### 3.3 PRODUCTION_SSH_PUBLIC_KEY_DEPLOY

```bash
# Copy the NEW deploy PUBLIC key
cat ~/.ssh/github_actions_deploy.pub

# Copy the ENTIRE line (should start with ssh-ed25519)
```

**Name**: `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY`
**Value**: The new deploy public key from Step 1 (the .pub file)

### 3.4 Verify Existing Secrets

Make sure you also have:
- `PRODUCTION_HOST` - Your server's IP address or hostname
- All other secrets (POSTGRES_*, DIRECTUS_*, etc.)

## Step 4: Test the Setup

After adding the secrets, trigger a deployment:

```bash
# Make a small change to trigger the workflow
git commit --allow-empty -m "Test SSH key setup"
git push origin main
```

Watch the GitHub Actions workflow:
1. The **infrastructure job** should connect as `root` using `PRODUCTION_SSH_KEY_ROOT`
2. Ansible will create/update the `deploy` user and add the public key
3. The **deploy job** should connect as `deploy` using `PRODUCTION_SSH_KEY_DEPLOY`

## How It Works

### Infrastructure Job (Ansible)
```
GitHub Actions → PRODUCTION_SSH_KEY_ROOT → Connects as root → Runs Ansible
  ↓
Ansible creates/updates deploy user
  ↓
Ansible adds PRODUCTION_SSH_PUBLIC_KEY_DEPLOY to /home/deploy/.ssh/authorized_keys
```

### Deploy Job (Application)
```
GitHub Actions → PRODUCTION_SSH_KEY_DEPLOY → Connects as deploy → Deploys app
```

## Security Benefits

✅ **Separation of Concerns**: Infrastructure changes use root, app deployments use deploy user
✅ **Reduced Blast Radius**: If deploy key is compromised, attacker can't modify system configuration
✅ **Better Audit Trail**: You know which key was used for what operation
✅ **Independent Rotation**: You can rotate keys separately without affecting the other

## Troubleshooting

### "Permission denied (publickey)" on infrastructure job

- Check that `PRODUCTION_SSH_KEY_ROOT` contains your root private key
- Verify you can SSH as root from your laptop: `ssh root@YOUR_SERVER_IP`
- Make sure the key in GitHub matches the key authorized on the server

### "Permission denied (publickey)" on deploy job

- This is expected on first run! The deploy user doesn't exist yet
- Run the infrastructure job first (it creates the deploy user)
- After infrastructure job completes, the deploy job should work

### Deploy user exists but still can't connect

- Check that `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY` contains the PUBLIC key (not private)
- SSH to server as root and check: `cat /home/deploy/.ssh/authorized_keys`
- The public key should be listed there

## Manual Testing

You can test the deploy key from your local machine:

```bash
# Test connecting as deploy user with the new key
ssh -i ~/.ssh/github_actions_deploy deploy@YOUR_SERVER_IP

# If it works, you're all set!
```

## Key Rotation

To rotate the deploy key in the future:

1. Generate a new key pair (Step 1)
2. Update `PRODUCTION_SSH_KEY_DEPLOY` and `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY` in GitHub
3. Push a change to trigger Ansible (it will update the authorized_keys)
4. Old key is automatically replaced

## Questions?

If you encounter issues, check:
1. GitHub Actions logs for specific error messages
2. Server logs: `ssh root@YOUR_SERVER /var/log/auth.log`
3. Verify key permissions: private keys should be 600, public keys 644
