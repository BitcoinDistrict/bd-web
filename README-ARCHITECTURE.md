# Architecture Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Directory Structure](#directory-structure)
- [Service Architecture](#service-architecture)
- [Astro Frontend](#astro-frontend)
- [Directus CMS](#directus-cms)
- [Content Collections](#content-collections)
- [Automated Event Imports](#automated-event-imports)
- [Docker Configuration](#docker-configuration)
- [Environment Variables](#environment-variables)
- [Data Flow](#data-flow)
- [Schema Management](#schema-management)
- [Networking](#networking)
- [Deployment](#deployment)

## Project Overview

This is a modern JAMstack application that combines:
- **Astro**: A modern SSR framework for building fast, content-focused websites
- **Directus**: An open-source headless CMS that wraps any SQL database with a REST/GraphQL API
- **PostgreSQL**: Robust relational database for Directus data storage
- **Redis**: In-memory cache for improved performance
- **Docker**: Containerized architecture for consistent environments

The architecture follows a microservices pattern where each component runs in its own container and communicates over a shared Docker network.

## Directory Structure

```
bd-directus-astro/
│
├── .cursor/                    # Cursor IDE configuration
│   └── rules/                  # AI coding agent rules
│       └── DOCS.md            # Documentation maintenance guidelines
│
├── site/                       # Astro frontend application (Node.js)
│   ├── public/                # Static assets (served directly)
│   │   └── favicon.svg       # Site favicon
│   ├── src/
│   │   ├── assets/           # Build-time processed assets
│   │   │   └── images/       # Logo images for meetups/partners
│   │   ├── components/       # Reusable Astro/React/Vue components
│   │   │   ├── EventsList.astro       # Event list component
│   │   │   ├── PodcastList.astro      # Podcast episode list
│   │   │   ├── PodcastPlayer.astro    # Audio player
│   │   │   ├── BTCMap.astro           # Bitcoin merchant map
│   │   │   ├── ContactForm.astro      # Contact form
│   │   │   ├── NewsletterSubscribe.astro # Newsletter signup
│   │   │   ├── Footer.astro           # Site footer
│   │   │   ├── PageHeader.astro       # Page header component
│   │   │   └── sections/              # Page sections
│   │   │       ├── EventsSection.astro
│   │   │       ├── UpcomingEventsSection.astro
│   │   │       ├── BookClubSection.astro
│   │   │       └── BitcoinStatsSection.astro
│   │   ├── layouts/          # Page layout templates
│   │   │   └── Layout.astro  # Main layout wrapper
│   │   ├── lib/              # Utilities and helper functions
│   │   │   ├── directus.ts   # Directus SDK client configuration
│   │   │   └── utils.ts      # Helper functions (slugs, dates)
│   │   ├── config/           # Configuration files
│   │   │   └── site.ts       # Site-wide settings (nav, footer, social)
│   │   ├── data/             # Static data
│   │   │   └── meetups.ts    # Regional meetup information
│   │   ├── styles/           # Global styles
│   │   │   └── theme.css     # CSS custom properties/theme
│   │   └── pages/            # File-based routing (pages)
│   │       ├── index.astro   # Homepage
│   │       ├── events.astro  # Events calendar
│   │       ├── events.ics.ts # iCalendar feed endpoint
│   │       ├── bitplebs/     # DC BitPlebs pages
│   │       │   ├── index.astro      # BitPlebs landing page
│   │       │   └── [slug].astro     # Individual event pages
│   │       ├── podcast/      # Podcast pages
│   │       │   ├── index.astro      # Episode list
│   │       │   └── [slug].astro     # Individual episode pages
│   │       ├── bookclub.astro       # Book club page
│   │       ├── meetups.astro        # Regional meetups page
│   │       ├── merchants.astro      # BTCMap page
│   │       ├── contact.astro        # Contact form page
│   │       ├── nostr.astro          # Nostr info page
│   │       ├── dcbitdevs.astro      # DC BitDevs page
│   │       ├── privacy.astro        # Privacy policy
│   │       ├── terms.astro          # Terms of service
│   │       └── [...slug].astro      # Dynamic CMS pages (future)
│   ├── .astro/               # Astro build cache (gitignored)
│   ├── astro.config.mjs      # Astro configuration
│   ├── tailwind.config.mjs   # Tailwind CSS configuration
│   ├── Dockerfile            # Container definition for Astro
│   ├── package.json          # Node dependencies and scripts
│   └── tsconfig.json         # TypeScript configuration
│
├── scripts/                   # Utility scripts
│   ├── import-rss-events.js  # RSS event importer (Node.js)
│   ├── schema-snapshot.sh    # Export schema to YAML
│   ├── schema-apply.sh       # Apply schema from YAML
│   ├── backup-database.sh    # PostgreSQL backup script
│   ├── reload-directus.sh    # Restart Directus service
│   └── directus-reset.sh     # Reset Directus (danger!)
│
├── directus/                  # Directus-related files
│   ├── data/                 # Persistent data (gitignored)
│   │   └── db/              # PostgreSQL data directory
│   ├── extensions/           # Custom Directus extensions
│   │   └── directus-extension-wpslug-interface/
│   └── uploads/              # User-uploaded files (gitignored)
│
├── docker-compose.yml         # Service orchestration configuration
├── schema.yaml               # Directus schema definition (YAML format)
├── snapshot.json             # Directus schema snapshot (JSON format)
├── package.json              # Root dependencies (extensions)
├── .gitignore                # Git ignore rules
├── .env                      # Environment variables (gitignored)
│
└── README-*.md               # Documentation files
```

### Key Directory Purposes

- **`/site`**: Complete Astro application with all frontend code
- **`/directus/data`**: Persistent database storage (not version controlled)
- **`/directus/extensions`**: Custom Directus interfaces, layouts, and modules
- **`schema.yaml` & `snapshot.json`**: Version-controlled CMS structure

## Service Architecture

The application consists of four interconnected Docker services:

### 1. Database Service (`db`)
- **Image**: `postgres:15.6`
- **Purpose**: Primary data store for Directus
- **Port**: 5432 (internal only)
- **Health Check**: `pg_isready` command every 10s
- **Data Persistence**: `./directus/data/db` volume

### 2. Cache Service (`cache`)
- **Image**: `redis:7.2-alpine`
- **Purpose**: Caching layer for Directus queries
- **Port**: 6379 (internal only)
- **Health Check**: Redis PING command every 5s
- **Data Persistence**: In-memory (ephemeral)

### 3. Directus Service (`directus`)
- **Image**: `directus/directus:11.14.0`
- **Purpose**: Headless CMS and API server
- **Port**: 8055 (exposed to host)
- **Dependencies**: Waits for `db` and `cache` to be healthy
- **Data Persistence**: 
  - `directus_uploads` volume for user files
  - `./directus/extensions` for custom extensions

### 4. Astro Service (`astro`)
- **Build**: Custom Dockerfile from `./site`
- **Purpose**: SSR web application server
- **Port**: 4321 (exposed to host)
- **Dependencies**: Depends on `directus` service
- **Development Mode**: Hot-reload enabled with volume mounting

### Service Dependencies Flow
```
┌─────────────┐
│   astro     │  ← Port 4321 (public)
└──────┬──────┘
       │ depends on
       ↓
┌─────────────┐
│  directus   │  ← Port 8055 (public)
└──────┬──────┘
       │ depends on
       ├─────────────┐
       ↓             ↓
┌──────────┐   ┌─────────┐
│    db    │   │  cache  │
└──────────┘   └─────────┘
```

## Astro Frontend

### Configuration

**SSR Mode**: The Astro site runs in Server-Side Rendering mode, not static generation.

**Adapter**: Node.js standalone adapter (`@astrojs/node`)
- Creates a self-contained Node.js server
- Handles dynamic routes and API endpoints
- Enables server-side data fetching from Directus

### Image Handling

Astro is configured to process remote images from Directus:

```javascript
// astro.config.mjs
image: {
  domains: [
    'localhost',      // Local development
    'directus',       // Internal Docker network (SSR)
    'api.bitcoindistrict.org',  // Production
  ],
  remotePatterns: [
    // HTTP patterns for development
    // HTTPS patterns for production
  ],
}
```

**Why Two URLs?**
- **Server-side (SSR)**: Uses `http://directus:8055` (internal Docker network)
- **Client-side**: Uses `PUBLIC_DIRECTUS_URL` (public URL, e.g., `http://localhost:8055`)

### Environment Variables in Astro

- **`DIRECTUS_URL`**: Internal URL for server-side rendering
- **`PUBLIC_DIRECTUS_URL`**: Public URL for client-side JavaScript

Variables prefixed with `PUBLIC_` are exposed to the browser.

### Development Workflow

1. Code changes in `/site` are mounted into the container
2. Astro dev server detects changes and hot-reloads
3. The server runs on `0.0.0.0:4321` (accessible from host via Docker port mapping)

### Key Pages and Features

**Events System**:
- `/events` - Full event calendar with CMS-powered events
- `/events.ics` - iCalendar feed (subscribe in calendar apps)
- Event filtering by date (upcoming/past)
- Venue information with links
- RSVP buttons linking to Luma/Meetup

**BitPlebs Community**:
- `/bitplebs` - Landing page with featured event and event history
- `/bitplebs/[id]` - Individual event pages with detailed information
- Filters events by "bitplebs" tag
- Custom agenda support for recurring meetup format

**Podcast**:
- `/podcast` - Episode list with latest episodes first
- `/podcast/[slug]` - Individual episode pages with audio player
- HTML5 audio player with play/pause, seek, volume controls
- Episode metadata (duration, publish date, episode number)

**Community Pages**:
- `/bookclub` - Book club information and schedule
- `/meetups` - Regional meetup groups (DC, Virginia, Maryland)
- `/merchants` - BTCMap integration showing Bitcoin-accepting merchants
- `/contact` - Contact form with email integration
- `/nostr` - Nostr community information and links

**Static Pages**:
- `/` - Homepage with featured content sections
- `/dcbitdevs` - DC BitDevs developer meetup information
- `/privacy` - Privacy policy
- `/terms` - Terms of service

### Component Architecture

**Reusable Components**:
- `EventsList.astro` - Displays events with filtering and sorting
- `PodcastList.astro` - Grid/list of podcast episodes
- `PodcastPlayer.astro` - HTML5 audio player with custom controls
- `BTCMap.astro` - Embedded BTCMap iframe
- `ContactForm.astro` - Form with validation
- `NewsletterSubscribe.astro` - Email signup form
- `Footer.astro` - Site footer with links and newsletter
- `PageHeader.astro` - Consistent page headers

**Section Components**:
- `EventsSection.astro` - Events calendar widget
- `UpcomingEventsSection.astro` - Next few events preview
- `BookClubSection.astro` - Book club call-to-action
- `BitcoinStatsSection.astro` - Real-time Bitcoin data

### Data Fetching

**CMS Integration**:
The site uses the Directus SDK to fetch content:

```typescript
// lib/directus.ts
import { createDirectus, rest, staticToken } from "@directus/sdk";

// Server-side: uses DIRECTUS_URL (internal Docker network)
// Client-side: uses PUBLIC_DIRECTUS_URL (public URL)
const client = getDirectusClient();

// Fetch events
const events = await client.request(readItems("Events", { ... }));

// Fetch podcasts
const podcasts = await client.request(readItems("Podcast_Episodes", { ... }));
```

**Graceful Degradation**:
- `PUBLIC_CMS_ENABLED` flag controls CMS features
- Pages work with empty state when CMS is down
- Error messages inform users when content unavailable
- Static content always loads (meetups, footer, etc.)

### iCalendar Export

**Endpoint**: `/events.ics`

**Implementation**: Dynamic route that generates RFC 5545 compliant iCalendar data

**Features**:
- Exports all published future events
- Includes event details (title, description, location, time)
- Subscribe in calendar apps (Google Calendar, Apple Calendar, Outlook)
- Updates automatically when users refresh calendar

**Example Usage**:
```
webcal://bitcoindistrict.org/events.ics
```

## Directus CMS

### What is Directus?

Directus is an open-source headless CMS that:
- Wraps your SQL database with a REST + GraphQL API
- Provides an admin UI for content management
- Manages users, roles, and permissions
- Handles file uploads and transformations
- Supports custom extensions

### Directus in This Project

**Admin Interface**: http://localhost:8055
- Create and manage content collections
- Configure relationships between collections
- Set up user roles and permissions
- Manage media assets

**API Endpoint**: Used by Astro to fetch content
- REST API: `http://directus:8055/items/{collection}`
- GraphQL: `http://directus:8055/graphql`

### CORS Configuration

```yaml
CORS_ENABLED: "true"
CORS_ORIGIN: "*"
```

This allows the Astro frontend (both SSR and client-side) to access the Directus API.

### Caching Strategy

Directus is configured to use Redis for caching:
```yaml
CACHE_ENABLED: "true"
CACHE_STORE: "redis"
REDIS: "redis://cache:6379"
```

Benefits:
- Faster API responses
- Reduced database load
- Improved scalability

## Content Collections

The project uses several Directus collections to manage content:

### Events Collection

**Purpose**: Store and manage Bitcoin community events

**Key Fields**:
- `title` (string): Event name
- `description` (text): Event description
- `custom_agenda` (text): Optional custom agenda/schedule
- `start_date_time` (datetime): Event start
- `end_date_time` (datetime): Event end
- `location` (M2O → Venues): Venue relationship
- `image` (file): Event featured image
- `rsvp_url` (string): Link to RSVP (Luma, Meetup, etc.)
- `external_url` (string): Source event page URL
- `external_id` (string): Unique ID from source
- `source_feed` (string): RSS feed source identifier
- `is_imported` (boolean): Flag for auto-imported events
- `tags` (M2M → tags): Event categorization
- `status` (string): Publication status (draft, published)

**Special Fields for Imports**:
- `raw_description` (text): Original RSS content
- `parsed_venue_name` (string): Extracted venue name
- `parsed_venue_address` (string): Extracted address

**Tags**: Events can be tagged (e.g., "bitplebs") for filtered views

### Venues Collection

**Purpose**: Store event location information

**Key Fields**:
- `name` (string): Venue name
- `address` (text): Full address
- `latitude` (decimal): GPS coordinate
- `longitude` (decimal): GPS coordinate
- `website` (string): Venue website
- `description` (text): Venue details

**Relationships**: One venue can have many events

### Tags Collection

**Purpose**: Categorize events for filtered pages

**Key Fields**:
- `name` (string): Tag name (e.g., "bitplebs", "bookclub")
- `slug` (string): URL-safe identifier

**Usage**: The BitPlebs page filters events by the "bitplebs" tag

### Podcast Episodes Collection

**Purpose**: Manage podcast content

**Key Fields**:
- `title` (string): Episode title
- `description` (text): Episode description
- `slug` (string): URL-safe identifier
- `published_date` (datetime): Publication date
- `audio_file` (file): MP3/audio file
- `duration` (string): Episode length
- `episode_number` (integer): Episode sequence
- `image` (file): Episode artwork
- `status` (string): Publication status

**Features**:
- Individual episode pages with audio player
- Automatic slug generation from title
- Chronologically sorted episode list

### Pages Collection

**Purpose**: Dynamic page content (future use)

**Key Fields**:
- `title` (string): Page title
- `permalink` (string): URL path
- `content` (blocks): Page content builder
- `seo_title` (string): SEO title
- `seo_description` (text): SEO description

**Note**: Currently not widely used; most pages are static Astro components

## Automated Event Imports

### RSS Import System

**Location**: `scripts/import-rss-events.js`

**Purpose**: Automatically import events from BitcoinOnly.events RSS feeds

**Supported Feeds**:
1. Washington DC events (`/tag/washington-dc/feed/`)
2. Maryland events (`/tag/maryland/feed/`)
3. Virginia events (`/tag/virginia/feed/`)

### Import Workflow

```
1. Fetch RSS feed XML
   ↓
2. Parse RSS items with custom fields
   ↓
3. For each event item:
   - Parse HTML content (cheerio)
   - Extract date, time, venue from blockquote
   - Scrape event page for RSVP link
   - Extract main image URL
   - Parse description text
   ↓
4. Check if event already exists (by external_url)
   ↓
5. If exists: Update missing fields (image, RSVP, tags)
   If new: Create full event
   ↓
6. Download and upload image to Directus
   ↓
7. Find or create venue by name
   ↓
8. Auto-tag events (e.g., "bitplebs" in title)
   ↓
9. Save event to Directus Events collection
```

### Import Features

**Smart Deduplication**:
- Uses `external_url` as unique identifier
- Skips already-imported events
- Updates existing events with missing information

**Intelligent Parsing**:
- Extracts structured data from HTML content
- Handles various date/time formats
- Parses venue information from event descriptions

**RSVP Link Priority**:
1. Scrapes event page for Website field (most reliable)
2. Falls back to Luma links in RSS content
3. Falls back to Meetup links in RSS content

**Image Handling**:
- Downloads images from source
- Uploads to Directus file library
- Associates with event record
- Re-imports for events missing images

**Venue Management**:
- Automatically creates venues if they don't exist
- Matches by venue name to avoid duplicates
- Stores parsed address information

**Tagging System**:
- Auto-tags events based on title keywords
- Example: "bitplebs" in title → adds "bitplebs" tag
- Enables filtered views (BitPlebs page)

**Past Event Filtering**:
- Only imports future events
- Skips past events to keep database clean

### Running Imports

**Manual Execution**:
```bash
# Using npm script (recommended)
npm run import-events

# OR direct execution
node scripts/import-rss-events.js
```

**Authentication**:
Requires a Directus static token with appropriate permissions:
```env
DIRECTUS_EVENTS_TOKEN=your-token-here
# OR
DIRECTUS_STATIC_TOKEN=your-token-here
```

**Token Setup**:
1. Log into Directus admin (http://localhost:8055)
2. Navigate to Settings > Access Tokens
3. Create a new static token
4. Assign admin permissions or specific collection permissions
5. Copy token to `.env` file

**Output**:
- Colored console output with detailed logging
- Summary statistics (created, updated, skipped, failed)
- Error reporting for failed imports

### Future Automation

**Potential Enhancements**:
- [ ] Scheduled imports via cron job
- [ ] GitHub Actions workflow for periodic imports
- [ ] Webhook-triggered imports
- [ ] Import from additional RSS sources
- [ ] Email notifications for import failures

## Docker Configuration

### docker-compose.yml Structure

The `docker-compose.yml` defines a complete development environment:

```yaml
services:
  db:        # PostgreSQL database
  cache:     # Redis cache
  astro:     # Astro SSR frontend
  directus:  # Directus CMS

volumes:
  directus_uploads:  # Named volume for uploads

networks:
  bd-network:        # Shared network for all services
```

### Health Checks

Each service has health checks to ensure dependencies are ready:

**Database** (`db`):
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**Cache** (`cache`):
```yaml
healthcheck:
  test: ["CMD-SHELL", "redis-cli ping"]
  interval: 5s
  timeout: 3s
  retries: 10
  start_period: 20s
```

### Why Health Checks Matter

- `directus` won't start until `db` and `cache` are healthy
- Prevents startup race conditions
- Automatic restarts if services become unhealthy

### Volume Strategy

**Named Volumes** (managed by Docker):
- `directus_uploads`: User-uploaded files

**Bind Mounts** (local directories):
- `./directus/data/db`: Database persistence
- `./directus/extensions`: Custom Directus extensions
- `./site`: Astro source code (development hot-reload)

### Network Configuration

All services run on a custom bridge network (`bd-network`):
- Services can communicate using service names as hostnames
- Isolated from other Docker networks
- Internal DNS resolution (e.g., `http://directus:8055`)

## Environment Variables

### Required Variables

Create a `.env` file in the project root:

```env
# Database Configuration
POSTGRES_DB=directus              # Database name
POSTGRES_USER=directus            # Database user
POSTGRES_PASSWORD=secure_password # Database password (change this!)

# Directus Security
DIRECTUS_KEY=random_key_256_chars  # Encryption key (generate random)
DIRECTUS_SECRET=random_secret      # JWT secret (generate random)

# Directus Admin Account
DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=admin_password  # Change in production!

# Public URLs
PUBLIC_DIRECTUS_URL=http://localhost:8055  # Browser-accessible URL

# CMS Configuration
PUBLIC_CMS_ENABLED=true  # Enable/disable CMS features (default: true)

# Static Tokens (for server-side operations)
DIRECTUS_STATIC_TOKEN=your-static-token     # General-purpose server token
DIRECTUS_EVENTS_TOKEN=your-events-token     # Dedicated token for RSS imports
```

### Variable Purposes

| Variable | Used By | Purpose |
|----------|---------|---------|
| `POSTGRES_*` | db, directus | Database connection |
| `DIRECTUS_KEY` | directus | Encrypts sensitive data in DB |
| `DIRECTUS_SECRET` | directus | Signs JWT tokens |
| `DIRECTUS_ADMIN_*` | directus | Creates initial admin user |
| `PUBLIC_DIRECTUS_URL` | astro (client), scripts | Public-facing API URL |
| `DIRECTUS_URL` | astro (SSR) | Internal Docker network URL |
| `PUBLIC_CMS_ENABLED` | astro | Enables/disables CMS features |
| `DIRECTUS_STATIC_TOKEN` | astro (SSR), scripts | Server-side authentication |
| `DIRECTUS_EVENTS_TOKEN` | import-rss-events.js | Dedicated token for event imports |

### Security Notes

- **Never commit `.env`** to version control (it's in `.gitignore`)
- Generate random keys for `DIRECTUS_KEY` and `DIRECTUS_SECRET`
- Use strong passwords in production
- Rotate secrets periodically

## Data Flow

### Server-Side Rendering (SSR) Flow

```
1. Browser requests page
   ↓
2. Astro server receives request
   ↓
3. Astro fetches data from Directus API (http://directus:8055)
   ↓
4. Directus queries PostgreSQL (with Redis caching)
   ↓
5. Astro renders HTML with data
   ↓
6. Browser receives fully-rendered HTML
```

### Client-Side Hydration Flow

```
1. Page loads in browser
   ↓
2. JavaScript initializes
   ↓
3. Client-side code makes API calls to PUBLIC_DIRECTUS_URL
   ↓
4. Directus serves data via REST/GraphQL API
   ↓
5. JavaScript updates DOM dynamically
```

### Why Two URL Patterns?

- **SSR**: `http://directus:8055` (internal Docker network, faster)
- **Client**: `http://localhost:8055` (public URL, accessible from browser)

The Astro server runs inside Docker and can use service names, but the browser runs outside Docker and needs `localhost` or a public domain.

## Schema Management

### Understanding Schema vs. Data

**Schema** (Version Controlled):
- Collection definitions (like database tables)
- Field types and validation rules
- Relationships between collections
- Interface configurations
- Stored in `schema.yaml` and `snapshot.json`

**Data** (NOT Version Controlled):
- Actual content entries
- User-uploaded files
- User accounts (except initial admin)
- Stored in PostgreSQL database

### Schema Files

**`schema.yaml`**:
- Human-readable YAML format
- Created by `npm run schema:snapshot`
- Used by `npm run schema:apply`
- Ideal for diffs and version control

**`snapshot.json`**:
- JSON format with complete schema details
- Generated by Directus CLI
- More comprehensive than YAML

### Schema Workflow

**Exporting Schema** (after making changes in Directus):
```bash
cd site
npm run schema:snapshot
git add ../schema.yaml
git commit -m "Update schema: added blog collection"
```

**Applying Schema** (on a new environment):
```bash
cd site
npm run schema:apply
```

This creates collections and fields but doesn't populate data.

### Best Practices

1. **Export schema** after structural changes in Directus
2. **Commit schema** to Git for team collaboration
3. **Never commit** the actual database or data files
4. **Test schema changes** in development before production
5. **Document** major schema changes in commit messages

## Networking

### Internal Communication

Services communicate using Docker DNS:
- `http://db:5432` - PostgreSQL
- `http://cache:6379` - Redis
- `http://directus:8055` - Directus API
- `http://astro:4321` - Astro server

### External Access

From the host machine:
- `http://localhost:4321` - Astro website
- `http://localhost:8055` - Directus admin

### Network Isolation

The `bd-network` bridge network:
- Provides internal DNS
- Isolates services from other Docker networks
- Allows service-to-service communication
- Only exposes specified ports to host

## Deployment

### CI/CD Process

[Note: To be documented as CI/CD is implemented]

Typical workflow:
1. Push to `main` branch triggers CI/CD
2. Build Docker images
3. Run tests
4. Push images to registry
5. Deploy to staging/production
6. Apply schema migrations
7. Health checks verify deployment

### Production Considerations

**Environment Differences**:
- Use production URLs in `PUBLIC_DIRECTUS_URL`
- Set `output: 'server'` in Astro (already configured)
- Use strong, unique secrets
- Configure proper CORS origins (not `"*"`)
- Enable HTTPS/TLS
- Set up proper backup strategy

**Recommended Production Setup**:
- Managed PostgreSQL (AWS RDS, DigitalOcean Databases)
- Managed Redis (AWS ElastiCache, Redis Cloud)
- Container orchestration (Kubernetes, ECS, or Docker Swarm)
- CDN for static assets
- SSL/TLS certificates
- Regular database backups
- Monitoring and alerting

### Scaling Strategy

**Horizontal Scaling**:
- Multiple Astro instances behind load balancer
- Multiple Directus instances (stateless)
- Managed database with read replicas
- Centralized Redis cluster

**Vertical Scaling**:
- Increase database resources
- Increase Redis memory
- Optimize queries and caching

## Custom Extensions

### Directus Extensions

**Location**: `./directus/extensions/`

**Current Extensions**:
- `directus-extension-wpslug-interface`: WordPress-style slug interface

**Adding New Extensions**:
1. Install npm package in root `package.json`
2. Docker Compose mounts extensions directory
3. Restart Directus service
4. Extensions auto-load in admin UI

### Extension Types

- **Interfaces**: Custom field input components
- **Displays**: Custom field display formats
- **Layouts**: Custom collection view layouts
- **Modules**: Custom admin pages
- **Panels**: Dashboard widgets
- **Hooks**: Backend event handlers
- **Endpoints**: Custom API routes

## Development Best Practices

1. **Use schema management**: Export schema after CMS changes
2. **Test locally**: Always test in Docker before deploying
3. **Monitor logs**: Use `docker-compose logs -f` during development
4. **Clean rebuilds**: Occasionally rebuild containers with `--build` flag
5. **Update docs**: Keep READMEs current as architecture evolves
6. **Environment parity**: Keep dev/staging/prod configs similar
7. **Version pinning**: Use specific versions in docker-compose.yml
8. **Security**: Never commit secrets or `.env` files

## Implemented Features

Recent major additions to the architecture:
- [x] Automated RSS event imports from BitcoinOnly.events
- [x] Podcast episode management with audio player
- [x] BitPlebs community page with event filtering
- [x] iCalendar export for event subscriptions
- [x] BTCMap integration for merchant discovery
- [x] Newsletter subscription system
- [x] Contact form integration
- [x] Nostr community links
- [x] Event tagging and filtering system
- [x] Venue management with automatic creation
- [x] Image upload and processing from external sources
- [x] RSVP link scraping and integration

## Future Enhancements

Potential architecture improvements:
- [ ] GitHub Actions CI/CD pipeline
- [ ] Production Docker Compose configuration
- [ ] Kubernetes deployment manifests
- [ ] Automated schema migration testing
- [ ] Performance monitoring integration
- [ ] Scheduled automated RSS imports (cron job or GitHub Actions)
- [ ] Automated backups with retention policy
- [ ] Multi-environment configuration management
- [ ] E2E testing setup (Playwright, Cypress)
- [ ] Podcast RSS feed generation
- [ ] Event series/recurring event support
- [ ] Email notifications for new events
- [ ] User authentication and event submissions
- [ ] Admin dashboard for content moderation

