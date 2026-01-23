# Scripts Directory

Helper scripts for deployment and development.

## Available Scripts

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
