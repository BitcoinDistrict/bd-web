#!/bin/bash
#
# Generate Deploy Key Pair for GitHub Actions
#
# This script generates a new SSH key pair for the deploy user
# and provides instructions for adding it to GitHub Secrets.
#

set -e

echo "=========================================="
echo "  Deploy Key Generator for GitHub Actions"
echo "=========================================="
echo ""

# Configuration
KEY_NAME="github_actions_deploy"
KEY_PATH="$HOME/.ssh/$KEY_NAME"
KEY_COMMENT="github-actions-deploy"

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
    echo "⚠️  Warning: Key already exists at $KEY_PATH"
    echo ""
    read -p "Do you want to overwrite it? (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        echo "Aborted. Using existing key."
        echo ""
    else
        echo "Removing existing key..."
        rm -f "$KEY_PATH" "$KEY_PATH.pub"
    fi
fi

# Generate the key if it doesn't exist
if [ ! -f "$KEY_PATH" ]; then
    echo "🔑 Generating new ED25519 key pair..."
    echo ""
    ssh-keygen -t ed25519 -C "$KEY_COMMENT" -f "$KEY_PATH" -N ""
    echo ""
    echo "✅ Key pair generated successfully!"
    echo ""
fi

# Display the keys
echo "=========================================="
echo "  Key Files Created"
echo "=========================================="
echo ""
echo "Private key: $KEY_PATH"
echo "Public key:  $KEY_PATH.pub"
echo ""

# Display GitHub Secrets instructions
echo "=========================================="
echo "  GitHub Secrets Configuration"
echo "=========================================="
echo ""
echo "Add the following secrets to your GitHub repository:"
echo "(Repository → Settings → Secrets and variables → Actions)"
echo ""

echo "1️⃣  PRODUCTION_SSH_KEY_DEPLOY (Private Key)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$KEY_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Copy the entire content above (including BEGIN and END lines)"
echo ""

echo "2️⃣  PRODUCTION_SSH_PUBLIC_KEY_DEPLOY (Public Key)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$KEY_PATH.pub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Copy the entire line above (single line starting with ssh-ed25519)"
echo ""

# Root key instructions
echo "=========================================="
echo "  Root Key Configuration"
echo "=========================================="
echo ""
echo "3️⃣  PRODUCTION_SSH_KEY_ROOT (Your Existing Root Key)"
echo ""
echo "This should be the private key you currently use to SSH into your server as root."
echo "Common locations:"
echo "  - ~/.ssh/id_ed25519"
echo "  - ~/.ssh/id_rsa"
echo "  - ~/.ssh/id_ecdsa"
echo ""
echo "To find your root key:"
echo "  ls -la ~/.ssh/"
echo ""
echo "To display your root private key:"
echo "  cat ~/.ssh/id_ed25519  # or whatever your key is named"
echo ""
echo "Copy the entire private key (including BEGIN and END lines) to GitHub Secret:"
echo "  PRODUCTION_SSH_KEY_ROOT"
echo ""

# Test instructions
echo "=========================================="
echo "  Testing the Deploy Key"
echo "=========================================="
echo ""
echo "After Ansible runs and sets up the deploy user, you can test the key:"
echo ""
echo "  ssh -i $KEY_PATH deploy@YOUR_SERVER_IP"
echo ""
echo "If successful, you should be logged in as the deploy user."
echo ""

# Next steps
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo ""
echo "1. Add the three secrets to GitHub (see above)"
echo "2. Verify secret contents (no extra spaces or line breaks)"
echo "3. Commit and push your changes to trigger deployment"
echo "4. Monitor GitHub Actions for successful deployment"
echo "5. Test manual SSH connection with the deploy key"
echo ""
echo "For detailed instructions, see:"
echo "  - SETUP-SSH-KEYS.md"
echo "  - DEPLOYMENT-CHECKLIST.md"
echo ""
echo "✅ Done!"
