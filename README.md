# Bitcoin District - Astro + Directus CMS

A modern, high-performance website built with Astro SSR and powered by Directus headless CMS. This project provides a flexible content management system with a lightning-fast frontend.

## 🚀 Technology Stack

- **Frontend**: [Astro](https://astro.build/) with SSR (Server-Side Rendering)
- **CMS**: [Directus](https://directus.io/) - Open-source headless CMS
- **Database**: PostgreSQL 15.6
- **Cache**: Redis 7.2
- **Infrastructure**: Docker & Docker Compose
- **SDK**: Directus JavaScript SDK for seamless API integration

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.x or higher
- **Docker**: Latest stable version
- **Docker Compose**: v2.x or higher
- **Git**: For version control

## 🏃 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bd-directus-astro
   ```

2. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Database
   POSTGRES_DB=directus
   POSTGRES_USER=directus
   POSTGRES_PASSWORD=your_secure_password
   
   # Directus
   DIRECTUS_KEY=your_random_key_here
   DIRECTUS_SECRET=your_random_secret_here
   DIRECTUS_ADMIN_EMAIL=admin@example.com
   DIRECTUS_ADMIN_PASSWORD=admin_password
   
   # Public URLs
   PUBLIC_DIRECTUS_URL=http://localhost:8055

   # Optional: Enable CMS-backed rendering (default: true)
   PUBLIC_CMS_ENABLED=true
   
   # Optional: Static token for RSS imports (create in Directus: Settings > Access Tokens)
   DIRECTUS_STATIC_TOKEN=your-static-token-here
   DIRECTUS_EVENTS_TOKEN=your-events-token-here
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the services**
   - **Website**: http://localhost:4321
   - **Directus Admin**: http://localhost:8055

5. **First-time setup**
   - Log into Directus at http://localhost:8055
   - Use the credentials from your `.env` file
   - Start creating content collections and content!

## 🌟 Key Features

### Core Infrastructure
- **Server-Side Rendering**: Fast page loads with Astro SSR
- **Headless CMS**: Flexible content management with Directus
- **Image Optimization**: Automatic image processing for Directus assets
- **Docker-based**: Consistent development and deployment environment
- **Redis Caching**: Improved performance with intelligent caching
- **Schema Version Control**: Track and deploy CMS schema changes
- **Health Checks**: Automatic service health monitoring and recovery

### Content Features
- **Automated Event Imports**: RSS feed integration with BitcoinOnly.events for DC, Maryland, and Virginia
- **Event Management**: Comprehensive event system with venues, tags, RSVP links, and image handling
- **Podcast Platform**: Full podcast episode management with audio player
- **BitPlebs Community Page**: Dedicated page for DC BitPlebs meetup events
- **iCalendar Export**: Subscribe to events via calendar applications (events.ics)
- **BTCMap Integration**: Interactive map of Bitcoin-accepting merchants
- **Newsletter Subscription**: Integrated newsletter signup
- **Contact Form**: Built-in contact form for community engagement

### Community Features
- **Multiple Meetup Pages**: Regional pages for DC BitDevs, Shenandoah, Southern Maryland, and more
- **Nostr Integration**: Social profile links and community connections
- **Book Club**: Dedicated page for Bitcoin book club events

## 📁 Project Structure

```
bd-directus-astro/
├── site/                       # Astro frontend application
│   ├── src/
│   │   ├── pages/             # Astro pages (routes)
│   │   │   ├── index.astro    # Homepage
│   │   │   ├── events.astro   # Events calendar
│   │   │   ├── events.ics.ts  # iCalendar feed
│   │   │   ├── bitplebs/      # DC BitPlebs pages
│   │   │   ├── podcast/       # Podcast pages
│   │   │   ├── bookclub.astro # Book club page
│   │   │   ├── contact.astro  # Contact form
│   │   │   └── nostr.astro    # Nostr info
│   │   ├── layouts/           # Layout components
│   │   ├── components/        # Reusable components
│   │   │   ├── EventsList.astro
│   │   │   ├── PodcastList.astro
│   │   │   ├── BTCMap.astro
│   │   │   └── sections/      # Page sections
│   │   ├── lib/               # Utilities and Directus client
│   │   │   ├── directus.ts    # Directus SDK client
│   │   │   └── utils.ts       # Helper functions
│   │   ├── config/            # Configuration
│   │   │   └── site.ts        # Site-wide settings
│   │   └── assets/            # Images and static assets
│   ├── astro.config.mjs       # Astro configuration
│   └── Dockerfile             # Astro container definition
├── scripts/                   # Utility scripts
│   ├── import-rss-events.js   # RSS event importer
│   ├── schema-snapshot.sh     # Export schema
│   ├── schema-apply.sh        # Apply schema
│   ├── backup-database.sh     # Database backup
│   └── directus-reset.sh      # Reset Directus
├── directus/
│   ├── extensions/            # Custom Directus extensions
│   ├── data/                  # Persistent database data (gitignored)
│   └── uploads/               # User-uploaded files (gitignored)
├── docker-compose.yml         # Service orchestration
├── schema.yaml                # Directus schema definition
├── snapshot.json              # Directus schema snapshot
└── README-*.md                # Additional documentation
```

## 🎯 Site Pages and Features

### Main Pages
- **Homepage** (`/`) - Featured events, stats, and community highlights
- **Events** (`/events`) - Full calendar of upcoming Bitcoin events
- **BitPlebs** (`/bitplebs`) - DC BitPlebs community meetup page
- **Podcast** (`/podcast`) - Episode archive with audio player
- **Meetups** (`/meetups`) - Regional meetup groups across DMV
- **Merchants** (`/merchants`) - BTCMap of Bitcoin-accepting businesses
- **Book Club** (`/bookclub`) - Community book club information
- **Contact** (`/contact`) - Get in touch with the community
- **Nostr** (`/nostr`) - Nostr integration and community links

### Special Features
- **iCalendar Feed** (`/events.ics`) - Subscribe to events in your calendar app
- **Dynamic Event Pages** (`/bitplebs/[id]`) - Detailed event information
- **Podcast Episodes** (`/podcast/[slug]`) - Individual episode pages with player
- **Newsletter Subscription** - Integrated throughout the site
- **Social Links** - X (Twitter), Nostr, GitHub integration

### Site Configuration

Site-wide settings are managed in `site/src/config/site.ts`:
- Navigation menu structure
- Footer links and sections
- Social media links
- Newsletter configuration
- Meetup group information

Edit this file to customize navigation, footer content, and social integrations.

## 📊 Automated Event Imports

This project includes an automated RSS import system for Bitcoin events:

```bash
# Import events from BitcoinOnly.events RSS feeds
npm run import-events
# OR
node scripts/import-rss-events.js
```

The import script:
- Fetches events from RSS feeds (DC, Maryland, Virginia)
- Parses event details (date, time, venue, description)
- Scrapes RSVP links from event pages (Luma, Meetup)
- Downloads and uploads event images to Directus
- Creates or updates venues automatically
- Tags events (e.g., "bitplebs" for DC BitPlebs events)
- Skips past events and duplicates
- Updates existing events with missing information

**Configuration**: Edit RSS_FEEDS array in `scripts/import-rss-events.js` to add/modify sources.

**Authentication**: Requires a Directus static token set in `.env`:
```env
DIRECTUS_EVENTS_TOKEN=your-token-here
# OR use:
DIRECTUS_STATIC_TOKEN=your-token-here
```

Generate a static token in Directus: **Settings > Access Tokens > Create New Token**

## 📚 Documentation

### Development
- **[Architecture Guide](README-ARCHITECTURE.md)**: Detailed technical architecture and design decisions
- **[Troubleshooting Guide](README-TROUBLESHOOTING.md)**: Common issues and solutions

### Production Deployment
- **[Quick Start Guide](DEPLOYMENT-QUICKSTART.md)**: 30-minute production setup ⚡
- **[Full Deployment Guide](README-DEPLOYMENT.md)**: Comprehensive deployment documentation
- **[Infrastructure Overview](INFRASTRUCTURE.md)**: Complete infrastructure reference
- **[Ansible Guide](ansible/README.md)**: Infrastructure automation with Ansible

## 🔧 Development

### Available Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up -d --build

# Access Astro container shell
docker-compose exec astro sh

# Access Directus container shell
docker-compose exec directus sh
```

### Schema Management

```bash
# Export current Directus schema to schema.yaml (recommended)
./scripts/schema-snapshot.sh

# Apply schema.yaml to Directus instance
./scripts/schema-apply.sh
```

### Content Management

```bash
# Import events from RSS feeds
node scripts/import-rss-events.js

# Backup database
./scripts/backup-database.sh

# Reset Directus (removes all data)
./scripts/directus-reset.sh
```

### Key Pages and Routes

- `/` - Homepage with featured content
- `/events` - Full event calendar with upcoming events
- `/events.ics` - iCalendar feed for calendar apps
- `/bitplebs` - DC BitPlebs community page
- `/bitplebs/[id]` - Individual BitPlebs event pages
- `/podcast` - Podcast episode list
- `/podcast/[slug]` - Individual episode pages with audio player
- `/bookclub` - Book club information
- `/meetups` - Regional meetup groups
- `/merchants` - BTCMap of Bitcoin-accepting merchants
- `/contact` - Contact form
- `/nostr` - Nostr community information

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Update documentation if needed
4. Test your changes locally
5. Submit a pull request

## 📝 License

[Add your license information here]

## 🆘 Need Help?

- Check the [Troubleshooting Guide](README-TROUBLESHOOTING.md)
- Review the [Architecture Documentation](README-ARCHITECTURE.md)
- Check Directus documentation: https://docs.directus.io
- Check Astro documentation: https://docs.astro.build

