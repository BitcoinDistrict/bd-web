# SSH Key Architecture

## Key Separation Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Secrets                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PRODUCTION_SSH_KEY_ROOT (private)                              │
│  └─> Used by: Infrastructure Job (Ansible)                      │
│      Connects as: root                                           │
│      Purpose: System setup, user management, packages            │
│                                                                  │
│  PRODUCTION_SSH_KEY_DEPLOY (private)                            │
│  └─> Used by: Deploy Job (Application)                          │
│      Connects as: deploy                                         │
│      Purpose: Docker operations, file sync, app updates          │
│                                                                  │
│  PRODUCTION_SSH_PUBLIC_KEY_DEPLOY (public)                      │
│  └─> Used by: Ansible (passed as env var)                       │
│      Installed to: /home/deploy/.ssh/authorized_keys            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────────────────────────┐
                              │                                     │
                              ▼                                     ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Infrastructure   │              │ Application      │
                    │ Job              │              │ Deploy Job       │
                    └──────────────────┘              └──────────────────┘
                              │                                     │
                              │                                     │
                    Uses ROOT_KEY                        Uses DEPLOY_KEY
                              │                                     │
                              ▼                                     ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ SSH as root      │              │ SSH as deploy    │
                    └──────────────────┘              └──────────────────┘
                              │                                     │
                              ▼                                     │
                    ┌──────────────────┐                           │
                    │ Run Ansible      │                           │
                    │ Playbook         │                           │
                    └──────────────────┘                           │
                              │                                     │
                              ├─────────────────────────┐           │
                              │                         │           │
                              ▼                         ▼           │
                    ┌──────────────┐        ┌──────────────────┐   │
                    │ Create/Update│        │ Install PUBLIC   │   │
                    │ deploy user  │        │ key to deploy    │   │
                    └──────────────┘        │ authorized_keys  │   │
                                           └──────────────────┘   │
                                                     │             │
                                                     └─────────────┤
                                                                   │
                                                                   ▼
                                                         ┌──────────────────┐
                                                         │ Deploy           │
                                                         │ Application      │
                                                         │ with Docker      │
                                                         └──────────────────┘
```

## Server-Side Key Layout

```
Server: your-droplet.digitalocean.com
├── /root/
│   └── .ssh/
│       └── authorized_keys
│           └── [Your laptop's public key]  ← For manual admin access
│           └── [Root private key's public] ← For GitHub Actions infrastructure
│
└── /home/deploy/
    └── .ssh/
        └── authorized_keys
            └── [Deploy public key] ← Installed by Ansible
                                     ← Used by GitHub Actions deploy job
```

## Access Matrix

| User   | Key Used              | Can Access Via        | Purpose                    |
|--------|-----------------------|-----------------------|----------------------------|
| root   | Your laptop key       | Your laptop           | Manual administration      |
| root   | ROOT private key      | GitHub Actions (infra)| Ansible infrastructure     |
| deploy | DEPLOY private key    | GitHub Actions (app)  | Application deployment     |
| deploy | Your laptop key       | Your laptop (optional)| Manual deployment testing  |

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     Root User Boundary                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • System package installation                          │ │
│  │ • User/group management                                │ │
│  │ • Firewall configuration                               │ │
│  │ • Service management (systemd)                         │ │
│  │ • Security updates                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Creates & Configures
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Deploy User Boundary                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • Docker container operations                          │ │
│  │ • Application file management                          │ │
│  │ • Environment configuration                            │ │
│  │ • Log access                                           │ │
│  │ • Application-level tasks                              │ │
│  │                                                        │ │
│  │ Note: Has sudo access via /etc/sudoers.d/deploy       │ │
│  │       (for Docker and app-specific needs)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Lifecycle

### Initial Setup (First Deployment)

1. **Before**: Server has only root access with your laptop key
2. **Infrastructure Job Runs**: 
   - Connects as root
   - Creates deploy user
   - Installs deploy public key
3. **After**: Server has both root and deploy access configured

### Normal Operations

1. **Code Change Pushed to Main**
2. **Infrastructure Job** (if Ansible files changed):
   - Connects as root
   - Updates system configuration
   - Ensures deploy user is properly configured
3. **Deploy Job** (always runs):
   - Connects as deploy
   - Syncs application files
   - Restarts Docker containers

### Key Rotation

1. **Generate New Key Pair**
2. **Update GitHub Secrets**:
   - PRODUCTION_SSH_KEY_DEPLOY (new private)
   - PRODUCTION_SSH_PUBLIC_KEY_DEPLOY (new public)
3. **Push Change to Trigger Ansible**
4. **Ansible Updates** `/home/deploy/.ssh/authorized_keys`
5. **Old Key Automatically Replaced**

## Troubleshooting Decision Tree

```
Can't connect to server?
│
├─ Infrastructure Job Failed?
│  │
│  ├─ Check: PRODUCTION_SSH_KEY_ROOT is correct
│  ├─ Test: ssh root@server from laptop works?
│  └─ Verify: Root key matches server's authorized_keys
│
└─ Deploy Job Failed?
   │
   ├─ First deployment?
   │  └─ Expected! Run infrastructure job first
   │
   └─ Infrastructure already ran?
      │
      ├─ Check: PRODUCTION_SSH_PUBLIC_KEY_DEPLOY is PUBLIC key
      ├─ Check: PRODUCTION_SSH_KEY_DEPLOY is PRIVATE key
      └─ Verify: ssh deploy@server shows key in authorized_keys
```

## Best Practices Implemented

✅ **Principle of Least Privilege**: Deploy user can't modify system configuration
✅ **Key Separation**: Different keys for different purposes
✅ **Audit Trail**: Clear separation shows which key did what
✅ **Defense in Depth**: Compromised deploy key doesn't give system access
✅ **Automation-Friendly**: No passphrases on CI/CD keys
✅ **Rotation-Ready**: Keys can be rotated independently
