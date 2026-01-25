# Troubleshooting Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Lifecycle Management](#lifecycle-management)
- [Docker Operations](#docker-operations)
- [Database Operations](#database-operations)
- [Directus Operations](#directus-operations)
- [Astro Client Issues](#astro-client-issues)
- [RSS Event Import Issues](#rss-event-import-issues)
- [Podcast and Media Issues](#podcast-and-media-issues)
- [Networking Troubleshooting](#networking-troubleshooting)
- [Cache Issues](#cache-issues)
- [Common Error Messages](#common-error-messages)
- [Performance Issues](#performance-issues)
- [Clean Slate Procedures](#clean-slate-procedures)

## Getting Started

### Start All Services

```bash
# Start all services in detached mode
docker-compose up -d

# Start all services with logs in foreground
docker-compose up

# Start specific service
docker-compose up -d directus
```

### View Logs

```bash
# View all logs (follow mode)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f directus
docker-compose logs -f astro
docker-compose logs -f db
docker-compose logs -f cache

# View last 50 lines
docker-compose logs --tail=50 directus

# View logs with timestamps
docker-compose logs -f -t
```

### Check Service Status

```bash
# List running containers
docker-compose ps

# Detailed status with health checks
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' bd-directus-astro-directus-1
```

## Lifecycle Management

### Stop Services

```bash
# Stop all services (preserves containers)
docker-compose stop

# Stop specific service
docker-compose stop astro

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop and remove containers + networks (keeps volumes)
docker-compose down --remove-orphans
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart directus

# Restart with rebuild (picks up code changes)
docker-compose up -d --build astro
```

### Rebuild Containers

```bash
# Rebuild all containers
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# Rebuild and start specific service
docker-compose up -d --build astro

# Force recreate containers (even if unchanged)
docker-compose up -d --force-recreate
```

## Docker Operations

### Enter Running Container

```bash
# Access Astro container shell
docker-compose exec astro sh

# Access Directus container shell
docker-compose exec directus sh

# Access PostgreSQL container
docker-compose exec db psql -U directus -d directus

# Access Redis container
docker-compose exec cache redis-cli
```

### View Container Details

```bash
# Inspect container configuration
docker inspect bd-directus-astro-directus-1

# View resource usage
docker stats

# View container processes
docker-compose top

# View network details
docker network inspect bd-network
```

### Clean Up Docker Resources

```bash
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes (CAUTION: This deletes data!)
docker volume prune -f

# Remove unused networks
docker network prune -f

# Clean everything (CAUTION: Nuclear option!)
docker system prune -a --volumes
```

## Database Operations

### Access PostgreSQL

```bash
# Access PostgreSQL CLI
docker-compose exec db psql -U directus -d directus

# Run SQL query directly
docker-compose exec db psql -U directus -d directus -c "SELECT * FROM directus_users;"

# Access with different user
docker-compose exec db psql -U postgres
```

### Database Queries

```sql
-- Inside psql, list all tables
\dt

-- List all schemas
\dn

-- Describe table structure
\d directus_collections

-- Show database size
SELECT pg_size_pretty(pg_database_size('directus'));

-- List all connections
SELECT * FROM pg_stat_activity;

-- Exit psql
\q
```

### Backup Database

```bash
# Backup database to file
docker-compose exec db pg_dump -U directus directus > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
docker-compose exec db pg_dump -U directus directus | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup specific tables only
docker-compose exec db pg_dump -U directus -t directus_users -t directus_roles directus > users_backup.sql
```

### Restore Database

```bash
# Restore from backup (database must exist)
docker-compose exec -T db psql -U directus -d directus < backup_20240112_120000.sql

# Restore from compressed backup
gunzip -c backup_20240112_120000.sql.gz | docker-compose exec -T db psql -U directus -d directus

# Drop and recreate database before restore
docker-compose exec db psql -U postgres -c "DROP DATABASE directus;"
docker-compose exec db psql -U postgres -c "CREATE DATABASE directus OWNER directus;"
docker-compose exec -T db psql -U directus -d directus < backup_20240112_120000.sql
```

### Reset Database

```bash
# Stop all services
docker-compose down

# Remove database volume
rm -rf ./directus/data/db

# Restart services (database will be recreated)
docker-compose up -d
```

## Directus Operations

### Access Directus Admin

1. Open browser to http://localhost:8055
2. Login with credentials from `.env`:
   - Email: `DIRECTUS_ADMIN_EMAIL`
   - Password: `DIRECTUS_ADMIN_PASSWORD`

### Schema Operations

```bash
# Export current schema to schema.yaml (recommended)
./scripts/schema-snapshot.sh

# Apply schema.yaml (creates collections/fields)
./scripts/schema-apply.sh

# Manually export schema with Directus CLI
npx directus schema snapshot ../schema.yaml

# Apply schema with force flag (overwrite conflicts)
npx directus schema apply --yes ../schema.yaml
```

### Clear Directus Cache

```bash
# Clear cache via Redis
docker-compose exec cache redis-cli FLUSHALL

# Restart Directus (forces cache rebuild)
docker-compose restart directus

# Clear cache via Directus API (if logged in)
curl -X POST http://localhost:8055/utils/cache/clear \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### View Directus Logs

```bash
# Follow Directus logs
docker-compose logs -f directus

# Search for errors
docker-compose logs directus | grep -i error

# Search for specific collection
docker-compose logs directus | grep -i "blog_posts"
```

### Directus Environment Issues

```bash
# Verify environment variables are loaded
docker-compose exec directus env | grep DIRECTUS

# Check database connection
docker-compose exec directus node -e "console.log(process.env.DB_HOST)"

# Restart with fresh environment
docker-compose up -d --force-recreate directus
```

### Content Management Workflows

#### Creating a New Event

1. **Log into Directus**: http://localhost:8055
2. **Navigate to Events collection**
3. **Click "Create Item"**
4. **Fill in required fields**:
   - Title
   - Description (or custom_agenda for BitPlebs events)
   - Start date/time
   - End date/time
   - Location (select or create venue)
   - Image (upload event flyer/photo)
   - RSVP URL (link to Luma/Meetup/etc.)
   - Tags (e.g., "bitplebs" for BitPlebs events)
   - Status: Set to "published" to make visible
5. **Save**

**Event will appear on**:
- `/events` - Main events page
- `/bitplebs` - If tagged with "bitplebs"
- `/events.ics` - Calendar feed

#### Creating a Podcast Episode

1. **Prepare audio file** (MP3 recommended)
2. **Log into Directus**: http://localhost:8055
3. **Navigate to Podcast_Episodes collection**
4. **Click "Create Item"**
5. **Fill in fields**:
   - Title
   - Description
   - Slug (auto-generated from title, or custom)
   - Published date
   - Audio file (upload MP3)
   - Duration (format: "MM:SS" or "HH:MM:SS")
   - Episode number
   - Image (episode artwork)
   - Status: "published"
6. **Save**

**Episode will appear on**:
- `/podcast` - Episode list
- `/podcast/[slug]` - Individual episode page with audio player

#### Creating a Venue

1. **Navigate to Venues collection**
2. **Click "Create Item"**
3. **Fill in**:
   - Name
   - Address
   - Latitude/Longitude (optional, for maps)
   - Website (optional)
   - Description (optional)
4. **Save**

**Venue can then be**:
- Selected when creating events
- Referenced by multiple events

#### Managing Tags

1. **Navigate to tags collection**
2. **Create tags** for event categorization:
   - "bitplebs" - DC BitPlebs events
   - "bookclub" - Book club events
   - "meetup" - General meetups
   - Custom tags as needed
3. **Apply tags to events** for filtering

## Astro Client Issues

### Common Connection Errors

#### Error: "Failed to fetch" or "Network Error"

**Cause**: Astro can't reach Directus API

**Solutions**:

1. **Check environment variables**:
```bash
# View Astro environment
docker-compose exec astro env | grep DIRECTUS

# Should show:
# DIRECTUS_URL=http://directus:8055
# PUBLIC_DIRECTUS_URL=http://localhost:8055
```

2. **Verify Directus is running**:
```bash
docker-compose ps directus
# Should show "healthy" status
```

3. **Test connectivity from Astro container**:
```bash
# Access Astro container
docker-compose exec astro sh

# Test internal URL (SSR)
wget -O- http://directus:8055/server/health

# Expected: {"status":"ok"}
```

4. **Test from host machine**:
```bash
curl http://localhost:8055/server/health
# Expected: {"status":"ok"}
```

#### Error: "CORS policy blocked"

**Cause**: Client-side requests blocked by CORS

**Solutions**:

1. **Verify CORS is enabled in docker-compose.yml**:
```yaml
CORS_ENABLED: "true"
CORS_ORIGIN: "*"  # For development; restrict in production
```

2. **Restart Directus**:
```bash
docker-compose restart directus
```

3. **Check Directus logs for CORS errors**:
```bash
docker-compose logs directus | grep -i cors
```

#### Error: "getaddrinfo ENOTFOUND directus"

**Cause**: Astro container can't resolve 'directus' hostname

**Solutions**:

1. **Verify Docker network exists**:
```bash
docker network ls | grep bd-network
```

2. **Check container network membership**:
```bash
docker network inspect bd-network
# Both astro and directus should be listed
```

3. **Restart with network recreation**:
```bash
docker-compose down
docker-compose up -d
```

#### Error: "Connection refused" (ECONNREFUSED)

**Cause**: Service not listening on expected port

**Solutions**:

1. **Check if Directus is actually running**:
```bash
docker-compose ps directus
docker-compose logs directus --tail=50
```

2. **Verify port bindings**:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
# Should show: 0.0.0.0:8055->8055/tcp
```

3. **Wait for health checks to pass**:
```bash
# Watch status until healthy
watch -n 1 'docker-compose ps'
```

### Image Loading Issues from Directus

#### Images not loading or 404 errors

**Solutions**:

1. **Verify image domains in astro.config.mjs**:
```javascript
image: {
  domains: [
    'localhost',
    'directus',
    'api.bitcoindistrict.org',
  ],
}
```

2. **Check image URL format**:
```javascript
// Correct (uses PUBLIC_DIRECTUS_URL)
const imageUrl = `${import.meta.env.PUBLIC_DIRECTUS_URL}/assets/${fileId}`;

// Incorrect (hardcoded)
const imageUrl = `http://localhost:8055/assets/${fileId}`;
```

3. **Verify file exists in Directus**:
   - Check Directus admin > File Library
   - Note the file ID
   - Test URL directly: http://localhost:8055/assets/{fileId}

### SSR vs Client-Side URL Issues

**Problem**: Different behavior between initial load and client-side navigation

**Solution**: Always use environment variables correctly:

```javascript
// In .astro component (server-side)
const directusUrl = import.meta.env.DIRECTUS_URL || 'http://directus:8055';

// In client-side JavaScript
const publicDirectusUrl = import.meta.env.PUBLIC_DIRECTUS_URL;
```

### Astro Dev Server Issues

```bash
# Restart Astro service
docker-compose restart astro

# Rebuild Astro with fresh npm install
docker-compose build --no-cache astro
docker-compose up -d astro

# Check Astro logs for errors
docker-compose logs -f astro

# Clear Astro build cache
docker-compose exec astro rm -rf .astro
docker-compose restart astro
```

## RSS Event Import Issues

### Running the Import Script

```bash
# Run from project root
npm run import-events
# OR
node scripts/import-rss-events.js

# View detailed output with colored logging
# The script shows progress for each event and provides statistics
```

### Common Import Errors

#### Error: "No Directus authentication token found"

**Cause**: Missing authentication token in `.env` file

**Solution**:

1. **Create a static token in Directus**:
   - Log into Directus: http://localhost:8055
   - Go to **Settings > Access Tokens**
   - Click **Create New Token**
   - Give it a name (e.g., "RSS Import Token")
   - Set permissions: **Admin** or specific collection permissions
   - Copy the generated token

2. **Add token to `.env` file**:
```env
# Preferred (dedicated token for imports)
DIRECTUS_EVENTS_TOKEN=your-token-here

# OR use general-purpose token
DIRECTUS_STATIC_TOKEN=your-token-here
```

3. **Restart the import**:
```bash
npm run import-events
```

#### Error: "Failed to fetch RSS feed"

**Cause**: Network issue or RSS feed URL is down

**Solutions**:

1. **Test RSS feed URL manually**:
```bash
curl https://bitcoinonly.events/tag/washington-dc/feed/
```

2. **Check internet connectivity**:
```bash
ping bitcoinonly.events
```

3. **Verify proxy/firewall settings** (if in corporate network)

4. **Wait and retry** (site may be temporarily down)

#### Error: "Failed to create event" or "Permission denied"

**Cause**: Insufficient permissions on the static token

**Solutions**:

1. **Check token permissions in Directus**:
   - Settings > Access Tokens
   - Click on your token
   - Ensure it has **Create** and **Update** permissions for:
     - Events collection
     - Venues collection
     - tags collection
     - directus_files (for image uploads)

2. **Use admin token** (easier but less secure):
```env
DIRECTUS_EVENTS_TOKEN=admin-token-with-full-access
```

3. **Check Directus logs** for detailed error:
```bash
docker-compose logs directus | grep -i error
```

#### Error: "Failed to upload image"

**Cause**: Image download failed or Directus file permissions issue

**Solutions**:

1. **Check image URL** (script logs show the URL it's trying to download)

2. **Verify Directus file permissions**:
   - Ensure static token has access to `directus_files`

3. **Check Docker volume permissions**:
```bash
ls -la directus/uploads/
# Should be writable by Docker user
```

4. **Script will continue** even if image upload fails (logs warning and continues)

#### Events Import as Duplicates

**Cause**: External URL changed or not matching correctly

**Solution**:

The script uses `external_url` as the unique identifier. If events are duplicating:

1. **Check existing events in Directus**:
   - View Events collection
   - Look at `external_url` field
   - Compare with RSS feed item links

2. **Manually delete duplicates** in Directus admin

3. **Run import again** (it will skip already-existing events)

#### Events Not Tagged Correctly

**Cause**: Tag detection logic may need adjustment

**Solution**:

The script auto-tags events based on title keywords:
- "bitplebs" in title → adds "bitplebs" tag

**To add tags to existing events**:

1. **Manual tagging in Directus**:
   - Go to Events collection
   - Edit event
   - Add tags in the Tags field

2. **Re-run import with updates**:
   - Script checks for missing tags on existing events
   - Updates events that match keyword patterns

#### Venue Not Created or Incorrect

**Cause**: Venue parsing logic couldn't extract venue information

**Solution**:

1. **Check parsed venue fields**:
   - View event in Directus
   - Check `parsed_venue_name` and `parsed_venue_address`
   - These fields show what the script extracted

2. **Manually create venue**:
   - Go to Venues collection
   - Create new venue
   - Link it to the event

3. **Improve parsing** (for developers):
   - Edit `scripts/import-rss-events.js`
   - Adjust the `parseEventDetails()` function
   - Test with sample RSS content

### Import Best Practices

**Regular Imports**:
```bash
# Run weekly to catch new events
npm run import-events
```

**Monitor Output**:
- Script provides colored output with detailed logging
- Check for warnings (yellow) and errors (red)
- Review summary statistics at the end

**Handle Failed Imports**:
- Script continues even if some events fail
- Review failed events in the summary
- Check logs for specific error messages
- Fix issues and re-run

**Database Backup Before Large Imports**:
```bash
# Backup before import
./scripts/backup-database.sh

# Run import
npm run import-events

# Restore if needed
# (see Database Operations section)
```

## Podcast and Media Issues

### Podcast Episodes Not Loading

**Symptoms**: Empty podcast page or "No episodes found" message

**Solutions**:

1. **Verify CMS is enabled**:
```bash
# Check environment variable
docker-compose exec astro env | grep PUBLIC_CMS_ENABLED
# Should show: PUBLIC_CMS_ENABLED=true
```

2. **Check if episodes exist in Directus**:
   - Log into Directus: http://localhost:8055
   - Go to **Podcast_Episodes** collection
   - Verify episodes exist and are **published**

3. **Check episode status**:
   - Episodes must have `status: "published"` to appear on site
   - Draft episodes are hidden

4. **Verify Directus connection**:
```bash
# Test from Astro container
docker-compose exec astro wget -O- http://directus:8055/server/health
```

### Audio Player Not Working

**Symptoms**: Player shows but audio won't play, or player controls unresponsive

**Solutions**:

1. **Verify audio file exists**:
   - Check episode in Directus
   - Ensure `audio_file` field has a file
   - Test file URL directly: `http://localhost:8055/assets/{file-id}`

2. **Check audio file format**:
   - Supported: MP3, M4A, OGG, WAV
   - Browser compatibility: MP3 is most widely supported
   - Convert if necessary: `ffmpeg -i input.wav output.mp3`

3. **Check file permissions**:
   - Ensure audio file is readable
   - Verify `directus_files` permissions

4. **Browser console errors**:
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Look for CORS errors or 404s

5. **Audio file size**:
   - Very large files (>100MB) may load slowly
   - Consider compressing audio files
   - Use appropriate bitrate (128kbps for speech, 192-320kbps for music)

### Podcast Images Not Displaying

**Solutions**:

1. **Check image configuration** in `astro.config.mjs`:
```javascript
image: {
  domains: [
    'localhost',
    'directus',
    'api.bitcoindistrict.org',
  ],
}
```

2. **Verify image URL**:
   - Images should use `PUBLIC_DIRECTUS_URL`
   - Check browser Network tab for 404s

3. **Test image directly**:
```bash
# From browser
http://localhost:8055/assets/{image-id}

# Should display the image
```

### Episode Slugs Not Working

**Symptoms**: `/podcast/episode-name` returns 404

**Solutions**:

1. **Verify slug exists**:
   - Check episode in Directus
   - `slug` field must be populated
   - Slugs should be URL-safe (lowercase, hyphens, no spaces)

2. **Regenerate slugs**:
   - Episodes use auto-generated slugs from titles
   - Edit and save episode to regenerate

3. **Check slug uniqueness**:
   - Duplicate slugs will cause conflicts
   - Ensure each episode has a unique slug

### Podcast Duration Not Showing

**Solution**:

Duration is stored as a string (e.g., "45:30" or "1:23:45")

1. **Check duration field** in Directus
2. **Format should be**: `HH:MM:SS` or `MM:SS`
3. **Update episode** with correct duration

## Networking Troubleshooting

### Verify Docker Network

```bash
# List networks
docker network ls

# Inspect bd-network
docker network inspect bd-network

# Check which containers are connected
docker network inspect bd-network --format '{{range .Containers}}{{.Name}} {{end}}'
```

### Test Service Connectivity

```bash
# From astro container to directus
docker-compose exec astro wget -O- http://directus:8055/server/health

# From astro container to cache
docker-compose exec astro nc -zv cache 6379

# From astro container to database
docker-compose exec astro nc -zv db 5432

# From directus to database
docker-compose exec directus nc -zv db 5432

# From directus to cache
docker-compose exec directus nc -zv cache 6379
```

### Port Conflicts

**Error**: "Bind for 0.0.0.0:8055 failed: port is already allocated"

**Solutions**:

1. **Find process using the port**:
```bash
# Linux/Mac
sudo lsof -i :8055
sudo netstat -tulpn | grep 8055

# Windows (PowerShell)
netstat -ano | findstr :8055
```

2. **Kill the process**:
```bash
# Linux/Mac
sudo kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

3. **Change port in docker-compose.yml**:
```yaml
ports:
  - "8056:8055"  # Use different host port
```

### DNS Resolution Issues

```bash
# Test DNS resolution inside container
docker-compose exec astro nslookup directus
docker-compose exec astro ping -c 3 directus

# If ping fails, check network configuration
docker network inspect bd-network

# Recreate network
docker-compose down
docker network rm bd-network
docker-compose up -d
```

## Cache Issues

### Redis Not Responding

```bash
# Check Redis status
docker-compose ps cache

# Test Redis connection
docker-compose exec cache redis-cli ping
# Expected: PONG

# View Redis logs
docker-compose logs cache

# Restart Redis
docker-compose restart cache
```

### Clear Redis Cache

```bash
# Clear all cache
docker-compose exec cache redis-cli FLUSHALL

# Clear specific database (Directus uses DB 0)
docker-compose exec cache redis-cli -n 0 FLUSHDB

# View cached keys
docker-compose exec cache redis-cli KEYS '*'

# Check cache size
docker-compose exec cache redis-cli INFO memory
```

### Directus Cache Issues

```bash
# Disable cache temporarily (in docker-compose.yml)
# CACHE_ENABLED: "false"

# Restart Directus without cache
docker-compose up -d directus

# Monitor cache hit/miss rate
docker-compose exec cache redis-cli monitor
```

## Common Error Messages

### "Could not connect to Directus"

**Solutions**:
1. Check Directus is running: `docker-compose ps directus`
2. Check logs: `docker-compose logs directus`
3. Verify environment variables: `docker-compose exec directus env | grep DB_`
4. Test database connection: `docker-compose exec directus nc -zv db 5432`

### "Database connection failed"

**Solutions**:
1. Wait for database to be ready: `docker-compose ps db`
2. Check database health: `docker inspect --format='{{.State.Health.Status}}' bd-directus-astro-db-1`
3. Verify credentials in .env match docker-compose.yml
4. Check PostgreSQL logs: `docker-compose logs db`

### "Redis connection failed"

**Solutions**:
1. Check Redis is running: `docker-compose ps cache`
2. Test connection: `docker-compose exec cache redis-cli ping`
3. Restart cache: `docker-compose restart cache`
4. Disable cache temporarily if needed

### "Permission denied" on volumes

**Solutions**:
```bash
# Fix directory permissions
sudo chown -R $USER:$USER ./directus/data
sudo chmod -R 755 ./directus/data

# Or run with elevated permissions
sudo docker-compose up -d
```

### "Health check failed"

**Solutions**:
1. **Database health check failing**:
```bash
# Check if PostgreSQL is accepting connections
docker-compose exec db pg_isready -U directus

# Increase start_period in docker-compose.yml
healthcheck:
  start_period: 60s  # Give more time to start
```

2. **Cache health check failing**:
```bash
# Test Redis manually
docker-compose exec cache redis-cli ping

# Check Redis logs
docker-compose logs cache
```

3. **Directus health check failing with "EACCES: permission denied"**:

**Symptoms**: Directus returns 503 on `/server/health` with error about `/directus/uploads/directus-health-file`

**Cause**: Volume permissions mismatch between host and container

**Immediate Fix (on production server)**:
```bash
# SSH into server
ssh deploy@your-server

# Run the fix script
cd ~/bd-web
sudo ./scripts/fix-directus-permissions.sh
```

**Or using Ansible**:
```bash
# From your local machine
ansible-playbook -i ansible/inventory/production.yml \
  ansible/playbooks/fix-directus-permissions.yml
```

**Manual Fix**:
```bash
# On the server
sudo chown -R 1000:1000 /mnt/data/directus-uploads
sudo chmod -R 755 /mnt/data/directus-uploads

# Restart Directus
docker compose -f docker-compose.prod.yml restart directus
```

**See**: `docs/directus-permissions-fix.md` for detailed explanation

### "No BitPlebs events found"

**Cause**: No events tagged with "bitplebs" or CMS disabled

**Solutions**:

1. **Check CMS is enabled**:
```env
# In .env file
PUBLIC_CMS_ENABLED=true
```

2. **Verify events exist** in Directus:
   - Go to Events collection
   - Check events have `tags` field containing "bitplebs"

3. **Tag existing events**:
   - Edit events in Directus
   - Add "bitplebs" tag
   - Save

4. **Run import script** to auto-tag events:
```bash
npm run import-events
# Script auto-tags events with "bitplebs" in title
```

### "Event not showing on calendar"

**Cause**: Event is not published, is in the past, or has invalid dates

**Solutions**:

1. **Check event status**:
   - Must be `status: "published"`
   - Draft events won't appear

2. **Verify event date**:
   - `start_date_time` must be valid ISO datetime
   - Past events may be filtered out on some pages

3. **Check date format**:
   - Should be: `YYYY-MM-DDTHH:mm:ss`
   - Example: `2026-01-25T18:00:00`

4. **Rebuild Astro cache**:
```bash
docker-compose exec astro rm -rf .astro
docker-compose restart astro
```

### "iCalendar feed (.ics) not working"

**Cause**: Events API not accessible or calendar app issue

**Solutions**:

1. **Test .ics endpoint**:
```bash
curl http://localhost:4321/events.ics
# Should return iCalendar data starting with "BEGIN:VCALENDAR"
```

2. **Verify events exist**:
   - Check `/events` page loads
   - Ensure published events are present

3. **Calendar app subscription**:
   - Use `webcal://` protocol for subscription
   - Some apps may cache, try removing and re-adding
   - Example: `webcal://bitcoindistrict.org/events.ics`

4. **Check for errors** in Astro logs:
```bash
docker-compose logs astro | grep -i "events.ics"
```

## Performance Issues

### Slow Builds

```bash
# Clear Docker build cache
docker builder prune -a

# Build with more resources (if using Docker Desktop)
# Increase CPU/Memory in Docker Desktop settings

# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build
```

### Slow Database Queries

```sql
-- Inside PostgreSQL, enable query logging
-- Check slow queries in logs
ALTER DATABASE directus SET log_min_duration_statement = 1000; -- Log queries > 1s

-- View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM your_table;
```

### High Memory Usage

```bash
# Check container memory usage
docker stats

# Limit memory for specific service (in docker-compose.yml)
services:
  directus:
    mem_limit: 512m
    mem_reservation: 256m
```

### Astro Build Slow

```bash
# Clear Astro cache
docker-compose exec astro rm -rf .astro node_modules/.astro

# Rebuild with fresh dependencies
docker-compose exec astro rm -rf node_modules package-lock.json
docker-compose exec astro npm install

# Check for large dependencies
docker-compose exec astro du -sh node_modules/*
```

## Clean Slate Procedures

### Complete Clean Rebuild (Preserves Data)

```bash
# Stop all services
docker-compose down

# Remove containers, networks, and images
docker-compose down --rmi all --volumes --remove-orphans

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Watch logs to ensure everything starts correctly
docker-compose logs -f
```

### Nuclear Option (Deletes Everything Including Data)

⚠️ **WARNING**: This will delete ALL data, including database and uploads!

```bash
# Stop all services
docker-compose down

# Remove all containers, networks, volumes, images
docker-compose down --rmi all --volumes --remove-orphans

# Delete local data directories
rm -rf ./directus/data
rm -rf ./directus/uploads

# Delete Astro build artifacts
rm -rf ./site/.astro
rm -rf ./site/node_modules

# Rebuild from absolute scratch
docker-compose build --no-cache

# Start fresh (will create new database)
docker-compose up -d

# Initialize Directus with your schema
cd site
npm run schema:apply
```

### Clean Rebuild (Development Reset)

Good for when things are really broken:

```bash
#!/bin/bash
# Save as cleanup.sh

echo "Stopping services..."
docker-compose down

echo "Removing containers and volumes..."
docker-compose rm -f -s -v

echo "Removing data directories..."
rm -rf ./directus/data/db/*
rm -rf ./site/.astro

echo "Rebuilding containers..."
docker-compose build --no-cache

echo "Starting services..."
docker-compose up -d

echo "Waiting for services to be healthy..."
sleep 30

echo "Checking status..."
docker-compose ps

echo "Done! Check logs with: docker-compose logs -f"
```

Make executable and run:
```bash
chmod +x cleanup.sh
./cleanup.sh
```

### Partial Reset (Keep Database, Reset Everything Else)

```bash
# Stop services
docker-compose down

# Remove containers but keep volumes
docker-compose rm -f

# Rebuild and restart
docker-compose up -d --build
```

### Reset Only Directus (Keep Database Data)

```bash
# Stop and remove only Directus container
docker-compose stop directus
docker-compose rm -f directus

# Rebuild and restart Directus
docker-compose up -d --build directus

# Watch logs
docker-compose logs -f directus
```

## Advanced Debugging

### Enable Debug Logging

**Directus**:
```yaml
# In docker-compose.yml
environment:
  LOG_LEVEL: debug  # Options: fatal, error, warn, info, debug, trace
```

**Astro**:
```bash
# Add to site/package.json scripts
"dev:debug": "astro dev --verbose"
```

### Network Traffic Inspection

```bash
# Install tcpdump in container
docker-compose exec astro apk add tcpdump

# Capture traffic
docker-compose exec astro tcpdump -i eth0 -w /tmp/capture.pcap

# Analyze with Wireshark (copy file out first)
```

### Database Connection Pool

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection pool size
SELECT * FROM pg_stat_database WHERE datname = 'directus';
```

## Getting Help

If issues persist after trying these solutions:

1. **Check the logs first**: `docker-compose logs -f`
2. **Review architecture docs**: See README-ARCHITECTURE.md
3. **Search Directus docs**: https://docs.directus.io
4. **Search Astro docs**: https://docs.astro.build
5. **Check Docker logs**: `docker events`
6. **Create an issue** with:
   - Error message
   - Steps to reproduce
   - Output of `docker-compose ps`
   - Relevant logs from `docker-compose logs`
   - Output of `docker version` and `docker-compose version`

## Quick Reference Commands

### Docker Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f astro
docker-compose logs -f directus

# Check status
docker-compose ps

# Rebuild containers
docker-compose up -d --build

# Clean restart
docker-compose down && docker-compose up -d

# Nuclear clean (WARNING: deletes data)
docker-compose down --rmi all --volumes && docker-compose up -d --build
```

### Content Management
```bash
# Import events from RSS
npm run import-events

# Export Directus schema
./scripts/schema-snapshot.sh

# Apply Directus schema
./scripts/schema-apply.sh

# Backup database
./scripts/backup-database.sh

# Access Directus admin
# http://localhost:8055

# Access Astro site
# http://localhost:4321
```

### Debugging
```bash
# Enter Astro container
docker-compose exec astro sh

# Enter Directus container
docker-compose exec directus sh

# Access PostgreSQL
docker-compose exec db psql -U directus -d directus

# Access Redis CLI
docker-compose exec cache redis-cli

# Test Directus from Astro container
docker-compose exec astro wget -O- http://directus:8055/server/health

# Check environment variables
docker-compose exec astro env | grep DIRECTUS
docker-compose exec directus env | grep DB

# Clear Astro cache
docker-compose exec astro rm -rf .astro
docker-compose restart astro

# Clear Redis cache
docker-compose exec cache redis-cli FLUSHALL
```

### Common Troubleshooting Paths
```bash
# Site not loading → Check Astro logs
docker-compose logs -f astro

# Events not showing → Verify CMS is up and PUBLIC_CMS_ENABLED=true
docker-compose logs directus
docker-compose exec astro env | grep PUBLIC_CMS_ENABLED

# Import failing → Check token and Directus connection
npm run import-events

# Database issues → Check PostgreSQL
docker-compose logs db
docker-compose exec db pg_isready -U directus

# Network issues → Test connectivity
docker-compose exec astro wget -O- http://directus:8055/server/health
```

