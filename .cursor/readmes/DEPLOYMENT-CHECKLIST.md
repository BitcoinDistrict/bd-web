# Deployment Setup Checklist

Use this checklist to verify your two-key SSH setup is configured correctly.

## Pre-Deployment Setup

### 1. Generate Deploy Key Pair ✓

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
```

- [ ] Private key created: `~/.ssh/github_actions_deploy`
- [ ] Public key created: `~/.ssh/github_actions_deploy.pub`
- [ ] No passphrase set (press Enter when prompted)

### 2. Locate Your Root Key ✓

```bash
ls -la ~/.ssh/
```

- [ ] Found your existing root private key (e.g., `id_ed25519`, `id_rsa`)
- [ ] Can SSH to server as root: `ssh root@YOUR_SERVER_IP`

### 3. Configure GitHub Secrets ✓

Go to: Repository → Settings → Secrets and variables → Actions

#### Required Secrets:

- [ ] **PRODUCTION_SSH_KEY_ROOT**
  - Contains: Your root PRIVATE key (entire file including BEGIN/END)
  - Used for: Infrastructure changes (Ansible)
  
- [ ] **PRODUCTION_SSH_KEY_DEPLOY**
  - Contains: New deploy PRIVATE key (entire file including BEGIN/END)
  - Used for: Application deployments
  
- [ ] **PRODUCTION_SSH_PUBLIC_KEY_DEPLOY**
  - Contains: New deploy PUBLIC key (single line starting with ssh-ed25519)
  - Used for: Ansible to authorize deploy user

- [ ] **PRODUCTION_HOST**
  - Contains: Your server IP or hostname
  
- [ ] **Other secrets** (POSTGRES_*, DIRECTUS_*, etc.)

### 4. Verify Secret Contents ✓

Double-check each secret:

```bash
# Root private key should look like:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
-----END OPENSSH PRIVATE KEY-----

# Deploy private key should look like:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
-----END OPENSSH PRIVATE KEY-----

# Deploy public key should look like:
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJqL... github-actions-deploy
```

- [ ] Root private key has BEGIN and END markers
- [ ] Deploy private key has BEGIN and END markers
- [ ] Deploy public key is a single line (no line breaks)
- [ ] No extra spaces or characters in any secret

## First Deployment

### 5. Commit and Push Changes ✓

```bash
git add .
git commit -m "Configure two-key SSH setup for CI/CD"
git push origin main
```

- [ ] Changes pushed to main branch
- [ ] GitHub Actions workflow triggered

### 6. Monitor Infrastructure Job ✓

Watch: Actions tab → Your workflow → "Apply Infrastructure Changes" job

Expected flow:
1. ✅ Checkout code
2. ✅ Detect Ansible changes (should show changes detected)
3. ✅ Configure SSH for Infrastructure (Root Access)
4. ✅ Install Ansible
5. ✅ Validate Ansible syntax
6. ✅ Run Ansible in check mode
7. ✅ Apply Ansible changes
8. ✅ Clean up SSH keys

#### If Infrastructure Job Fails:

**Error**: "Permission denied (publickey)" on root connection
- [ ] Verify `PRODUCTION_SSH_KEY_ROOT` is correct
- [ ] Test: `ssh root@YOUR_SERVER_IP` from laptop
- [ ] Check: Root key matches server's `/root/.ssh/authorized_keys`

**Error**: "deploy_ssh_public_key is undefined"
- [ ] Verify `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY` secret exists
- [ ] Check: It contains the PUBLIC key (not private)

### 7. Monitor Deploy Job ✓

Watch: Actions tab → Your workflow → "Deploy Application" job

Expected flow:
1. ✅ Checkout code
2. ✅ Set up Docker Buildx
3. ✅ Configure SSH for Deployment (Deploy User)
4. ✅ Create production .env file
5. ✅ Sync files to server
6. ✅ Copy .env file to server
7. ✅ Deploy with Docker Compose
8. ✅ Verify deployment
9. ✅ Health check
10. ✅ Clean up SSH keys

#### If Deploy Job Fails:

**Error**: "Permission denied (publickey)" on deploy connection
- [ ] Infrastructure job completed successfully first?
- [ ] Verify `PRODUCTION_SSH_KEY_DEPLOY` is correct (private key)
- [ ] Check server: `ssh root@SERVER "cat /home/deploy/.ssh/authorized_keys"`
- [ ] Public key should be listed in authorized_keys

**Error**: "deploy user does not exist"
- [ ] Infrastructure job must run first
- [ ] Check: `ssh root@SERVER "id deploy"`

## Post-Deployment Verification

### 8. Verify Server Configuration ✓

```bash
# SSH as root (using your laptop key)
ssh root@YOUR_SERVER_IP

# Check deploy user exists
id deploy

# Check deploy user's SSH keys
cat /home/deploy/.ssh/authorized_keys
# Should show the deploy public key

# Check deploy user can run Docker
sudo -u deploy docker ps

# Exit root session
exit
```

- [ ] Deploy user exists
- [ ] Deploy user has correct SSH key
- [ ] Deploy user can run Docker commands

### 9. Test Deploy Key Manually ✓

```bash
# From your laptop, test the deploy key
ssh -i ~/.ssh/github_actions_deploy deploy@YOUR_SERVER_IP

# If successful, try a Docker command
docker ps

# Exit
exit
```

- [ ] Can connect as deploy user with new key
- [ ] Can run Docker commands
- [ ] Application containers are running

### 10. Verify Application is Running ✓

```bash
# Check the sites are accessible
curl -I https://staging.bitcoindistrict.org/
curl -I https://admin.bitcoindistrict.org/
```

- [ ] Main site returns 200 OK
- [ ] Admin panel returns 200 OK
- [ ] SSL certificates are valid

## Ongoing Operations

### For Future Deployments:

**Application Changes Only** (no Ansible changes):
- [ ] Push to main
- [ ] Infrastructure job skips (no Ansible changes)
- [ ] Deploy job runs with deploy key
- [ ] Application updates successfully

**Infrastructure Changes** (Ansible files modified):
- [ ] Push to main
- [ ] Infrastructure job runs with root key
- [ ] Deploy job runs with deploy key
- [ ] Both complete successfully

### Key Rotation (Future):

When you need to rotate the deploy key:
- [ ] Generate new key pair
- [ ] Update `PRODUCTION_SSH_KEY_DEPLOY` secret
- [ ] Update `PRODUCTION_SSH_PUBLIC_KEY_DEPLOY` secret
- [ ] Push change to trigger Ansible
- [ ] Ansible updates authorized_keys automatically
- [ ] Old key is replaced

## Troubleshooting Commands

```bash
# Check GitHub Actions logs
# Go to: Repository → Actions → Select workflow run → View logs

# Check server auth logs
ssh root@YOUR_SERVER_IP "tail -50 /var/log/auth.log"

# Check deploy user setup
ssh root@YOUR_SERVER_IP "ls -la /home/deploy/.ssh/"

# Check Docker containers
ssh deploy@YOUR_SERVER_IP "docker ps"

# Check Caddy logs
ssh deploy@YOUR_SERVER_IP "cd /home/deploy/bd-web && docker compose -f docker-compose.prod.yml logs caddy --tail=50"

# Check application logs
ssh deploy@YOUR_SERVER_IP "cd /home/deploy/bd-web && docker compose -f docker-compose.prod.yml logs astro directus --tail=50"
```

## Success Criteria

✅ All checkboxes above are checked
✅ Infrastructure job completes without errors
✅ Deploy job completes without errors
✅ Can SSH as deploy user with new key
✅ Application is accessible via HTTPS
✅ Both sites return 200 OK

## Need Help?

- Review: `SETUP-SSH-KEYS.md` for detailed setup instructions
- Review: `docs/ssh-key-architecture.md` for architecture diagrams
- Check: GitHub Actions logs for specific error messages
- Test: Manual SSH connections to isolate issues
