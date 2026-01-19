# Documentation Guidelines

## Overview
This project maintains comprehensive documentation across multiple README files in the root directory. As you work on this codebase, you are expected to keep these documents up-to-date and accurate.

## Documentation Files

### 1. README.md (Main Project README)
**Purpose**: High-level overview and quick start guide

**Required Content**:
- Project name and brief description
- Technology stack overview (Astro, Directus, PostgreSQL, Redis, Docker)
- Prerequisites (Node.js version, Docker, Docker Compose)
- Quick start instructions (getting started in 5 minutes or less)
- Key features and capabilities
- Links to other documentation files
- Basic project structure overview
- Contributing guidelines (if applicable)
- License information

**When to Update**:
- When adding major new features or capabilities
- When prerequisites change (new dependencies, version requirements)
- When the quick start process changes
- When the overall architecture shifts significantly

### 2. README-ARCHITECTURE.md (Detailed Architecture)
**Purpose**: In-depth technical documentation of the project structure and design

**Required Content**:
- **Project Directory Structure**: Detailed breakdown of all major directories and their purposes
- **Astro Site Configuration**: 
  - Location (`/site` directory)
  - SSR setup with Node.js adapter
  - Environment variables and configuration
  - Image handling for remote Directus assets
- **Directus CMS**:
  - Role as headless CMS
  - How it integrates with Astro
  - Schema vs. Database distinction (schema.yaml vs. actual data)
  - Admin interface access and configuration
- **Docker Compose Setup**:
  - Service architecture (db, cache, astro, directus)
  - Network configuration (bd-network)
  - Volume management (database data, uploads)
  - Health checks and service dependencies
  - Port mappings and internal vs. external URLs
- **Environment Variables**:
  - Complete list of required variables
  - Purpose of each variable
  - Example values (non-sensitive)
- **Data Flow**:
  - How client-side requests flow through the system
  - How server-side rendering works with Directus
  - Caching strategy (Redis)
- **CI/CD Process**:
  - GitHub workflows
  - Deployment process
  - Environment-specific configurations
- **Schema Management**:
  - How to snapshot Directus schema
  - How to apply schema changes
  - Difference between schema and data
  - Version control approach

**When to Update**:
- When adding new services to docker-compose.yml
- When modifying the directory structure
- When adding new environment variables
- When changing how Astro integrates with Directus
- When implementing CI/CD pipelines
- When adding new Docker volumes or networks
- When changing the data flow or caching strategy

### 3. README-TROUBLESHOOTING.md (Operational Guide)
**Purpose**: Comprehensive guide for running, managing, and troubleshooting the application

**Required Content**:
- **Getting Started Commands**:
  - Starting the full stack
  - Starting individual services
  - Viewing logs
- **Lifecycle Management**:
  - Stop services
  - Restart services
  - Rebuild containers
  - Clean rebuild from scratch (remove volumes, images, etc.)
- **Docker Operations**:
  - Viewing container status
  - Inspecting logs for specific services
  - Entering containers for debugging
  - Checking network connectivity between services
- **Database Operations**:
  - Accessing PostgreSQL directly
  - Backing up data
  - Restoring data
  - Resetting the database
- **Directus Operations**:
  - Accessing admin interface
  - Exporting schema
  - Importing schema
  - Clearing cache
  - Checking Directus logs
- **Astro Client Issues**:
  - Common connection errors to Directus
  - Environment variable misconfiguration
  - CORS issues
  - Image loading problems from Directus
  - SSR vs. client-side URL differences
  - Network connectivity in Docker
- **Networking Troubleshooting**:
  - Verifying Docker network exists
  - Testing connectivity between containers
  - Port conflict resolution
  - Debugging "connection refused" errors
  - Internal vs. external URL issues
- **Cache Issues**:
  - Redis connection problems
  - Clearing Redis cache
  - Verifying Redis is running
- **Common Error Messages**:
  - Specific error messages and their solutions
  - Health check failures
  - Container startup failures
- **Performance Issues**:
  - Slow builds
  - Memory issues
  - Database query optimization

**When to Update**:
- When discovering new common issues
- When adding new troubleshooting commands
- When the docker-compose.yml changes affect operations
- When new services are added that might have specific issues
- When users report recurring problems
- After resolving complex bugs (document the solution)

## Best Practices

### When Working on Code
1. **Before making significant changes**: Review relevant README sections to understand current architecture
2. **After implementing features**: Update documentation to reflect new capabilities
3. **When fixing bugs**: Add troubleshooting entries if the issue could recur
4. **When adding dependencies**: Update prerequisites in README.md
5. **When modifying Docker setup**: Update both README-ARCHITECTURE.md and README-TROUBLESHOOTING.md

### Documentation Quality
- **Be Specific**: Include actual commands, not just descriptions
- **Be Complete**: Cover both happy path and common error scenarios
- **Be Current**: Remove outdated information when architecture changes
- **Be Clear**: Use code blocks for commands, use headings for organization
- **Be Helpful**: Think about what a new developer would need to know

### Review Cycle
When completing any significant task:
1. Review what you changed
2. Identify which documentation files are affected
3. Update those files with new information
4. Verify that instructions are complete and accurate
5. Ensure cross-references between documents are maintained

## Documentation Maintenance Commands
When you need to verify or update documentation:
- Always read the current state of the file before updating
- Preserve existing useful content
- Add new sections as needed
- Reorganize for clarity when beneficial
- Keep formatting consistent (use markdown best practices)

## Critical: Schema vs. Data
Always emphasize the distinction:
- **Schema** (schema.yaml, snapshot.json): Structure of collections, fields, relations - version controlled
- **Data**: Actual content in the database - not typically version controlled
- Schema changes should be documented in README-ARCHITECTURE.md
- Data migration procedures should be in README-TROUBLESHOOTING.md

