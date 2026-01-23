# Summary of Changes: Two-Key SSH Setup Implementation

## Overview

Implemented Option A: Separate SSH keys for infrastructure (root) and deployment (deploy user) operations.

## Files Modified

### 1. `.github/workflows/deploy-production.yml`

#### Infrastructure Job Changes:
- **SSH Configuration**: Changed to use `PRODUCTION_SSH_KEY_ROOT` instead of generic `PRODUCTION_SSH_KEY`
  - Key file renamed from `deploy_key` to `root_key`
  - SSH config explicitly sets `User root`
  - Added descriptive step name: "Configure SSH for Infrastructure (Root Access)"

- **Ansible Execution**: Added `DEPLOY_SSH_PUBLIC_KEY` environment variable
  - Passed to both check mode and apply steps
  - Allows Ansible to install the deploy public key

- **Verification Step**: Updated to use `root_key` instead of `deploy_key`
  - Connects as root user for infrastructure verification

- **Cleanup**: Updated to remove `root_key` instead of `deploy_key`

#### Deploy Job Changes:
- **SSH Configuration**: Changed to use `PRODUCTION_SSH_KEY_DEPLOY`
  - Added explicit SSH config block
  - Sets `User deploy` for deployment operations
  - Added descriptive step name: "Configure SSH for Deployment (Deploy User)"

- **Cleanup**: Updated step name to "Clean up SSH keys" (plural)

### 2. `ansible/group_vars/production.yml`

Added new configuration section:

```yaml
# SSH Key Configuration
# Public key for CI/CD deploy user (GitHub Actions, etc.)
deploy_ssh_public_key: "{{ lookup('env', 'DEPLOY_SSH_PUBLIC_KEY') }}"
```

This variable:
- Reads from environment variable set by GitHub Actions
- Used by Ansible to authorize the deploy user
- Contains the PUBLIC key (not private)

### 3. `ansible/roles/deploy-user/tasks/main.yml`

Replaced the SSH key setup tasks:

**Before** (lines 27-36):
```yaml
- name: Copy SSH authorized keys from root to deploy user
  copy:
    src: /root/.ssh/authorized_keys
    dest: "/home/{{ app_user }}/.ssh/authorized_keys"
    ...
```

**After** (lines 27-33):
```yaml
- name: Add CI/CD SSH public key to deploy user
  authorized_key:
    user: "{{ app_user }}"
    key: "{{ deploy_ssh_public_key }}"
    state: present
    comment: "CI/CD Deploy Key (GitHub Actions)"
```

Key improvements:
- Uses `authorized_key` module (proper way to manage SSH keys)
- Installs specific deploy public key (not copying from root)
- Adds descriptive comment to the key
- Only runs when `deploy_ssh_public_key` is defined

## New Documentation Files

### 4. `SETUP-SSH-KEYS.md`
Comprehensive guide covering:
- Step-by-step key generation
- GitHub Secrets configuration
- Testing procedures
- Troubleshooting guide
- Security benefits explanation

### 5. `docs/ssh-key-architecture.md`
Technical architecture documentation with:
- Visual diagrams of key flow
- Access matrix
- Security boundaries
- Key lifecycle management
- Troubleshooting decision tree

### 6. `DEPLOYMENT-CHECKLIST.md`
Practical checklist including:
- Pre-deployment setup steps
- First deployment monitoring
- Post-deployment verification
- Ongoing operations guide
- Troubleshooting commands

## GitHub Secrets Required

### New Secrets (Need to Add):

1. **PRODUCTION_SSH_KEY_ROOT**
   - Type: Private key
   - Content: Your existing root SSH private key
   - Used by: Infrastructure job (Ansible)
   - Connects as: root

2. **PRODUCTION_SSH_KEY_DEPLOY**
   - Type: Private key
   - Content: New deploy SSH private key (generate new)
   - Used by: Deploy job (Application)
   - Connects as: deploy

3. **PRODUCTION_SSH_PUBLIC_KEY_DEPLOY**
   - Type: Public key
   - Content: New deploy SSH public key (matching above)
   - Used by: Ansible (to authorize deploy user)
   - Installed to: `/home/deploy/.ssh/authorized_keys`

### Existing Secrets (Keep):
- `PRODUCTION_HOST`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DIRECTUS_KEY`, `DIRECTUS_SECRET`, etc.

## How It Works Now

### Workflow Sequence:

1. **Code pushed to main branch**

2. **Infrastructure Job** (if Ansible files changed):
   ```
   GitHub Actions
   → Uses PRODUCTION_SSH_KEY_ROOT
   → Connects as root
   → Runs Ansible playbook
   → Ansible creates/updates deploy user
   → Ansible installs PRODUCTION_SSH_PUBLIC_KEY_DEPLOY to deploy user
   ```

3. **Deploy Job** (always runs):
   ```
   GitHub Actions
   → Uses PRODUCTION_SSH_KEY_DEPLOY
   → Connects as deploy
   → Syncs application files
   → Runs Docker Compose
   → Deploys application
   ```

## Security Improvements

✅ **Separation of Concerns**
- Infrastructure changes use root access
- Application deployments use limited deploy user

✅ **Reduced Attack Surface**
- Compromised deploy key can't modify system configuration
- Deploy user has limited sudo access (only what's needed)

✅ **Better Audit Trail**
- Clear distinction between infrastructure and deployment operations
- Different keys show different purposes in logs

✅ **Independent Key Rotation**
- Can rotate deploy key without affecting infrastructure access
- Can rotate root key without affecting deployments

✅ **Principle of Least Privilege**
- Deploy user only has permissions needed for application deployment
- Root access only used when system changes are required

## Migration Steps

1. **Generate new deploy key pair**:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
   ```

2. **Add three new GitHub Secrets**:
   - PRODUCTION_SSH_KEY_ROOT (your existing root private key)
   - PRODUCTION_SSH_KEY_DEPLOY (new deploy private key)
   - PRODUCTION_SSH_PUBLIC_KEY_DEPLOY (new deploy public key)

3. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "Implement two-key SSH setup for CI/CD"
   git push origin main
   ```

4. **Monitor first deployment**:
   - Infrastructure job should complete successfully
   - Deploy job should complete successfully
   - Verify application is accessible

## Rollback Plan

If issues occur, you can temporarily rollback by:

1. Reverting to single-key setup:
   - Change `PRODUCTION_SSH_KEY_ROOT` back to `PRODUCTION_SSH_KEY`
   - Change `PRODUCTION_SSH_KEY_DEPLOY` back to `PRODUCTION_SSH_KEY`
   - Revert changes to workflow file

2. Or manually authorize the deploy key on server:
   ```bash
   ssh root@YOUR_SERVER
   cat >> /home/deploy/.ssh/authorized_keys << EOF
   [paste your deploy public key here]
   EOF
   chmod 600 /home/deploy/.ssh/authorized_keys
   chown deploy:deploy /home/deploy/.ssh/authorized_keys
   ```

## Testing Checklist

Before considering this complete:

- [ ] Generate deploy key pair locally
- [ ] Add all three secrets to GitHub
- [ ] Verify secret contents (no extra spaces, complete keys)
- [ ] Push changes to trigger workflow
- [ ] Infrastructure job completes successfully
- [ ] Deploy job completes successfully
- [ ] Can SSH as deploy user with new key
- [ ] Application is accessible via HTTPS
- [ ] Review logs for any warnings

## Next Steps

1. Follow `SETUP-SSH-KEYS.md` to configure secrets
2. Use `DEPLOYMENT-CHECKLIST.md` to verify setup
3. Reference `docs/ssh-key-architecture.md` for understanding
4. Monitor first deployment closely
5. Test manual SSH with both keys

## Questions or Issues?

- Check GitHub Actions logs for specific errors
- Review server's `/var/log/auth.log` for SSH connection issues
- Verify key permissions (private: 600, public: 644)
- Ensure no extra whitespace in GitHub Secrets
- Test manual SSH connections to isolate problems
