#!/usr/bin/env node

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { createDirectus, rest, readItems, createItem, updateItem, uploadFiles } from '@directus/sdk';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import 'dotenv/config';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// RSS Feed Configuration
const RSS_FEEDS = [
  {
    url: 'https://bitcoinonly.events/tag/washington-dc/feed/',
    source: 'washington-dc',
    name: 'Washington DC'
  },
  {
    url: 'https://bitcoinonly.events/tag/maryland/feed/',
    source: 'maryland',
    name: 'Maryland'
  },
  {
    url: 'https://bitcoinonly.events/tag/virginia/feed/',
    source: 'virginia',
    name: 'Virginia'
  }
];

// Initialize Directus client
const directusUrl = process.env.PUBLIC_DIRECTUS_URL || 'http://localhost:8055';
const directus = createDirectus(directusUrl).with(rest());

// Authentication token for API access
// Check for event-specific token first, then fall back to general tokens
const DIRECTUS_TOKEN = process.env.DIRECTUS_EVENTS_TOKEN || 
                        process.env.DIRECTUS_STATIC_TOKEN || 
                        process.env.DIRECTUS_ADMIN_TOKEN;

/**
 * Make authenticated request to Directus
 */
async function directusRequest(endpoint, options = {}) {
  const url = `${directusUrl}/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(JSON.stringify(error));
  }
  
  return await response.json();
}

// Initialize RSS parser
const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Scrape the event page to get the Website (RSVP) link
 */
async function scrapeEventRsvpLink(eventUrl) {
  try {
    log(`  → Scraping event page for RSVP link...`, colors.cyan);
    
    const response = await fetch(eventUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for the Website field with class "single_event_website"
    const websiteLink = $('.single_event_website a').attr('href');
    
    if (websiteLink) {
      log(`  ✓ Found RSVP link from event page: ${websiteLink}`, colors.green);
      return websiteLink;
    }
    
    log(`  ⚠ No Website field found on event page`, colors.yellow);
    return null;
  } catch (error) {
    log(`  ⚠ Failed to scrape event page: ${error.message}`, colors.yellow);
    return null;
  }
}

/**
 * Parse event details from HTML content
 */
function parseEventDetails(htmlContent) {
  const $ = cheerio.load(htmlContent);
  
  // Extract the blockquote content which contains date, time, and venue
  const blockquote = $('blockquote').first();
  const blockquoteHtml = blockquote.html();
  const blockquoteText = blockquote.text();
  
  if (!blockquoteText) {
    log('  ⚠ No blockquote found in content', colors.yellow);
    return null;
  }
  
  // Split blockquote by <br> tags to get individual lines
  const lines = blockquoteHtml ? blockquoteHtml.split(/<br\s*\/?>/i).map(line => {
    // Remove HTML tags and trim
    return cheerio.load(line).text().trim();
  }) : blockquoteText.split('\n').map(l => l.trim());
  
  let dateStr = null;
  let timeStr = null;
  let venueName = null;
  let venueAddress = null;
  
  // Parse each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for date line (contains day of week and year)
    if (!dateStr && /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*\d{4}/.test(line)) {
      // Remove emoji and extract date
      dateStr = line.replace(/^[^\w\s]+\s*/, '').trim();
    }
    
    // Look for time line
    if (!timeStr && /Time:/i.test(line)) {
      timeStr = line.replace(/^[^\w\s]+\s*Time:\s*/i, '').trim();
    }
    
    // Look for venue (line with location emoji or after "Time:" line)
    if (!venueName && i > 0 && /^[^\w\s]+/.test(line) && !line.includes('Time')) {
      // This is likely the venue name line (starts with emoji)
      venueName = line.replace(/^[^\w\s]+\s*/, '').trim();
      // Next line might be the address
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.includes('Time') && !/^[^\w\s]+/.test(nextLine)) {
          venueAddress = nextLine;
        }
      }
    }
  }
  
  // Extract main image
  const firstImg = $('img').first();
  const imageUrl = firstImg.attr('src');
  
  // Extract description (all <p> tags before blockquote, excluding images)
  const descriptionParts = [];
  $('p').each((i, el) => {
    const text = $(el).text().trim();
    // Stop when we hit the blockquote or travel/hotel sections
    if (text.includes('Time:') || text.includes('Find Hotels')) {
      return false;
    }
    if (text && !$(el).find('img').length) {
      descriptionParts.push(text);
    }
  });
  const description = descriptionParts.join('\n\n');
  
  // Extract RSVP URLs from content - prioritize Luma over Meetup
  // (This is a fallback in case scraping the event page fails)
  let rsvpUrl = null;
  let lumaUrl = null;
  let meetupUrl = null;
  
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    // Check for Luma URLs (lu.ma domain)
    if (href.includes('lu.ma/') && !lumaUrl) {
      lumaUrl = href;
      log(`  → Found Luma URL in content: ${href}`, colors.cyan);
    }
    
    // Check for Meetup URLs
    if ((href.includes('meetup.com/') || href.includes('meetu.ps/')) && !meetupUrl) {
      meetupUrl = href;
      log(`  → Found Meetup URL in content: ${href}`, colors.cyan);
    }
  });
  
  // Prioritize Luma over Meetup
  if (lumaUrl) {
    rsvpUrl = lumaUrl;
  } else if (meetupUrl) {
    rsvpUrl = meetupUrl;
  }
  
  return {
    dateStr,
    timeStr,
    venueName,
    venueAddress,
    imageUrl,
    description,
    rsvpUrl
  };
}

/**
 * Parse date and time strings into DateTime objects
 */
function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    log(`  ⚠ Missing date or time: ${dateStr} / ${timeStr}`, colors.yellow);
    return { startDateTime: null, endDateTime: null };
  }
  
  // Debug logging
  log(`  → Parsing date: "${dateStr}"`, colors.cyan);
  log(`  → Parsing time: "${timeStr}"`, colors.cyan);
  
  try {
    // Parse examples:
    // "Monday, January 26, 2026" + "6:00 PM — 10:00 PM EST"
    // "Tuesday, January 20, 2026" + "7:00 PM — 8:30 PM EST"
    
    // Extract start and end times (handle various dash types: —, –, -)
    const timeMatch = timeStr.match(/(\d+:\d+\s*[AP]M)\s*[—–\-]\s*(\d+:\d+\s*[AP]M)/i);
    
    if (!timeMatch) {
      log(`  ⚠ Could not parse time range: ${timeStr}`, colors.yellow);
      return { startDateTime: null, endDateTime: null };
    }
    
    const startTime = timeMatch[1].trim();
    const endTime = timeMatch[2].trim();
    
    log(`  → Start time: "${startTime}", End time: "${endTime}"`, colors.cyan);
    
    // Combine date and times
    const startDateTimeStr = `${dateStr} ${startTime}`;
    const endDateTimeStr = `${dateStr} ${endTime}`;
    
    log(`  → Combined start: "${startDateTimeStr}"`, colors.cyan);
    log(`  → Combined end: "${endDateTimeStr}"`, colors.cyan);
    
    // Use JavaScript Date parsing (more forgiving)
    const startDate = new Date(startDateTimeStr + ' EST');
    const endDate = new Date(endDateTimeStr + ' EST');
    
    if (isNaN(startDate) || isNaN(endDate)) {
      log(`  ⚠ Invalid date/time parsing`, colors.yellow);
      return { startDateTime: null, endDateTime: null };
    }
    
    // Convert to dayjs for formatting
    const startDateTime = dayjs(startDate);
    const endDateTime = dayjs(endDate);
    
    log(`  ✓ Parsed successfully: ${startDateTime.format('YYYY-MM-DD HH:mm')} - ${endDateTime.format('HH:mm')}`, colors.green);
    
    return {
      startDateTime: startDateTime.format('YYYY-MM-DDTHH:mm:ss'),
      endDateTime: endDateTime.format('YYYY-MM-DDTHH:mm:ss')
    };
  } catch (error) {
    log(`  ⚠ Error parsing date/time: ${error.message}`, colors.yellow);
    return { startDateTime: null, endDateTime: null };
  }
}

/**
 * Download image and upload to Directus
 */
async function downloadAndUploadImage(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    log(`    → Downloading image: ${imageUrl}`, colors.cyan);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Get filename from URL
    const urlPath = new URL(imageUrl).pathname;
    const filename = urlPath.split('/').pop() || 'event-image.jpg';
    
    // Upload to Directus using fetch directly with token
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: response.headers.get('content-type') || 'image/jpeg' });
    uploadFormData.append('file', blob, filename);
    
    const uploadResponse = await fetch(`${directusUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`
      },
      body: uploadFormData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.data?.id;
    
    log(`    ✓ Image uploaded: ${fileId}`, colors.green);
    return fileId;
  } catch (error) {
    log(`    ⚠ Failed to upload image: ${error.message}`, colors.yellow);
    return null;
  }
}

/**
 * Find or create a venue
 */
async function findOrCreateVenue(venueName, venueAddress) {
  if (!venueName) return null;
  
  try {
    // Check if venue already exists
    const response = await directusRequest(`items/Venues?filter[name][_eq]=${encodeURIComponent(venueName)}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      return response.data[0].id;
    }
    
    // Create new venue
    log(`    → Creating venue: ${venueName}`, colors.cyan);
    const createResponse = await directusRequest('items/Venues', {
      method: 'POST',
      body: JSON.stringify({
        name: venueName,
        address: venueAddress || ''
      })
    });
    
    log(`    ✓ Venue created: ${createResponse.data.id}`, colors.green);
    return createResponse.data.id;
  } catch (error) {
    log(`    ⚠ Failed to handle venue: ${error.message}`, colors.yellow);
    return null;
  }
}

/**
 * Find or create a tag
 */
async function findOrCreateTag(tagName) {
  if (!tagName) return null;
  
  try {
    // Check if tag already exists
    const response = await directusRequest(`items/tags?filter[name][_eq]=${encodeURIComponent(tagName)}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      return response.data[0].id;
    }
    
    // Create new tag
    log(`    → Creating tag: ${tagName}`, colors.cyan);
    const createResponse = await directusRequest('items/tags', {
      method: 'POST',
      body: JSON.stringify({
        name: tagName
      })
    });
    
    log(`    ✓ Tag created: ${createResponse.data.id}`, colors.green);
    return createResponse.data.id;
  } catch (error) {
    log(`    ⚠ Failed to handle tag: ${error.message}`, colors.yellow);
    return null;
  }
}

/**
 * Process a single RSS item
 */
async function processRSSItem(item, feedSource, feedName) {
  const title = item.title;
  const externalUrl = item.link;
  const externalId = item.guid;
  const categories = item.categories || [];
  
  log(`\n${colors.bright}${colors.blue}Processing: ${title}${colors.reset}`);
  log(`  URL: ${externalUrl}`, colors.cyan);
  
  // Parse the HTML content
  const parsed = parseEventDetails(item.contentEncoded);
  
  if (!parsed) {
    log(`  ✗ Failed to parse event details`, colors.red);
    return { status: 'failed', reason: 'parse_error' };
  }
  
  // Scrape the event page for the Website (RSVP) link
  // This is more reliable than parsing from RSS content
  const scrapedRsvpUrl = await scrapeEventRsvpLink(externalUrl);
  
  // Use scraped URL if available, otherwise fall back to parsed URL from content
  const rsvpUrl = scrapedRsvpUrl || parsed.rsvpUrl;
  
  if (rsvpUrl) {
    log(`  → Final RSVP URL: ${rsvpUrl}`, colors.cyan);
  } else {
    log(`  ⚠ No RSVP URL found`, colors.yellow);
  }
  
  // Parse date and time
  const { startDateTime, endDateTime } = parseDateTime(parsed.dateStr, parsed.timeStr);
  
  if (!startDateTime) {
    log(`  ✗ Failed to parse event date/time`, colors.red);
    return { status: 'failed', reason: 'date_parse_error' };
  }
  
  // Check if event is in the future
  const eventDate = dayjs(startDateTime);
  const now = dayjs();
  
  if (eventDate.isBefore(now)) {
    log(`  ⊙ Event is in the past (${eventDate.format('YYYY-MM-DD')}), skipping`, colors.yellow);
    return { status: 'skipped', reason: 'past_event' };
  }
  
  // Check if event already exists
  let existingEvent = null;
  try {
    const response = await directusRequest(`items/Events?filter[external_url][_eq]=${encodeURIComponent(externalUrl)}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      existingEvent = response.data[0];
      log(`  ⊙ Event already exists (ID: ${existingEvent.id})`, colors.yellow);
      
      const updatesNeeded = {};
      let needsUpdate = false;
      
      // Check if the existing event is missing an image and we have one to import
      if (!existingEvent.image && parsed.imageUrl) {
        log(`  → Event missing image, will re-import...`, colors.cyan);
        
        // Upload the image
        const imageId = await downloadAndUploadImage(parsed.imageUrl);
        
        if (imageId) {
          updatesNeeded.image = imageId;
          needsUpdate = true;
          log(`  ✓ Image will be added`, colors.green);
        }
      }
      
      // Check if the existing event is missing RSVP URL and we have one
      if (!existingEvent.rsvp_url && rsvpUrl) {
        log(`  → Event missing RSVP URL, will add...`, colors.cyan);
        updatesNeeded.rsvp_url = rsvpUrl;
        needsUpdate = true;
        log(`  ✓ RSVP URL will be added: ${rsvpUrl}`, colors.green);
      }
      
      // Check if title includes "bitplebs" and event is missing the tag
      if (/bitplebs/i.test(title) && !existingEvent.tags) {
        log(`  → Title contains "bitplebs" but event missing tag, will add...`, colors.cyan);
        const tagId = await findOrCreateTag('bitplebs');
        if (tagId) {
          updatesNeeded.tags = tagId;
          needsUpdate = true;
          log(`  ✓ BitPlebs tag will be added (ID: ${tagId})`, colors.green);
        }
      }
      
      // Update the event if needed
      if (needsUpdate) {
        try {
          await directusRequest(`items/Events/${existingEvent.id}`, {
            method: 'PATCH',
            body: JSON.stringify(updatesNeeded)
          });
          
          const updateMsg = Object.keys(updatesNeeded).join(', ');
          log(`  ✓ Updated existing event (${updateMsg})`, colors.green);
          return { status: 'updated', reason: 'fields_updated', id: existingEvent.id };
        } catch (error) {
          log(`  ⚠ Failed to update event: ${error.message}`, colors.yellow);
        }
      }
      
      return { status: 'skipped', reason: 'already_exists', id: existingEvent.id };
    }
  } catch (error) {
    log(`  ⚠ Error checking for existing event: ${error.message}`, colors.yellow);
  }
  
  // Upload image
  let imageId = null;
  if (parsed.imageUrl) {
    imageId = await downloadAndUploadImage(parsed.imageUrl);
  }
  
  // Find or create venue
  let venueId = null;
  if (parsed.venueName) {
    venueId = await findOrCreateVenue(parsed.venueName, parsed.venueAddress);
  }
  
  // Check if title includes "bitplebs" (case insensitive) and add tag
  let tagId = null;
  if (/bitplebs/i.test(title)) {
    log(`  → Title contains "bitplebs", adding tag...`, colors.cyan);
    tagId = await findOrCreateTag('bitplebs');
    if (tagId) {
      log(`  ✓ BitPlebs tag will be added (ID: ${tagId})`, colors.green);
    }
  }
  
  // Create the event
  try {
    log(`  → Creating event in Directus...`, colors.cyan);
    
    const eventData = {
      title: title,
      description: parsed.description || item.contentSnippet || '',
      start_date_time: startDateTime,
      end_date_time: endDateTime || startDateTime,
      location: venueId,
      image: imageId,
      external_url: externalUrl,
      external_id: externalId,
      rsvp_url: rsvpUrl || null,
      source_feed: feedSource,
      is_imported: true,
      raw_description: item.contentEncoded,
      parsed_venue_name: parsed.venueName,
      parsed_venue_address: parsed.venueAddress,
      tags: tagId,
      status: 'published'
    };
    
    if (rsvpUrl) {
      log(`  → Saving event with RSVP URL: ${rsvpUrl}`, colors.cyan);
    }
    
    const response = await directusRequest('items/Events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
    
    log(`  ${colors.green}${colors.bright}✓ Event created successfully (ID: ${response.data.id})${colors.reset}`);
    return { status: 'created', id: response.data.id };
  } catch (error) {
    log(`  ✗ Failed to create event: ${error.message}`, colors.red);
    try {
      const errorDetail = JSON.parse(error.message);
      log(`    Details: ${JSON.stringify(errorDetail, null, 2)}`, colors.red);
    } catch (e) {
      // error message wasn't JSON
    }
    return { status: 'failed', reason: 'create_error', error: error.message };
  }
}

/**
 * Process a single RSS feed
 */
async function processFeed(feedConfig) {
  log(`\n${'='.repeat(80)}`, colors.magenta);
  log(`${colors.bright}${colors.magenta}Fetching RSS Feed: ${feedConfig.name}${colors.reset}`);
  log(`URL: ${feedConfig.url}`, colors.cyan);
  log(`${'='.repeat(80)}`, colors.magenta);
  
  try {
    const feed = await parser.parseURL(feedConfig.url);
    
    log(`\nFound ${feed.items.length} items in feed`, colors.blue);
    
    const results = {
      total: feed.items.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };
    
    for (const item of feed.items) {
      const result = await processRSSItem(item, feedConfig.source, feedConfig.name);
      
      if (result.status === 'created') {
        results.created++;
      } else if (result.status === 'updated') {
        results.updated++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'failed') {
        results.failed++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log(`\n${colors.bright}Feed Results:${colors.reset}`);
    log(`  Created: ${results.created}`, colors.green);
    log(`  Updated: ${results.updated}`, colors.blue);
    log(`  Skipped: ${results.skipped}`, colors.yellow);
    log(`  Failed: ${results.failed}`, colors.red);
    
    return results;
  } catch (error) {
    log(`\n✗ Failed to process feed: ${error.message}`, colors.red);
    return {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function main() {
  log(`\n${'='.repeat(80)}`, colors.bright);
  log(`${colors.bright}${colors.cyan}  📅 BitcoinOnly Events RSS Importer 📅${colors.reset}`);
  log(`${'='.repeat(80)}\n`, colors.bright);
  
  log(`Directus URL: ${directusUrl}`, colors.blue);
  
  // Check for authentication token
  if (!DIRECTUS_TOKEN) {
    log(`\n${colors.red}✗ Error: No Directus authentication token found!${colors.reset}`, colors.red);
    log(`Please set one of these in your .env file:`, colors.yellow);
    log(`  - DIRECTUS_EVENTS_TOKEN (recommended - separate token for imports)`, colors.yellow);
    log(`  - DIRECTUS_STATIC_TOKEN (general purpose token)`, colors.yellow);
    log(`  - DIRECTUS_ADMIN_TOKEN (admin token)`, colors.yellow);
    log(`\nYou can generate a static token in Directus:`, colors.yellow);
    log(`  1. Go to Directus Settings > Access Tokens`, colors.yellow);
    log(`  2. Create a new token with admin permissions`, colors.yellow);
    log(`  3. Add it to your .env file as: DIRECTUS_EVENTS_TOKEN=your-token-here\n`, colors.yellow);
    process.exit(1);
  }
  
  log(`Authentication: ${DIRECTUS_TOKEN ? '✓ Token found' : '✗ No token'}`, colors.blue);
  log(`Feeds to process: ${RSS_FEEDS.length}\n`, colors.blue);
  
  const overallResults = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };
  
  for (const feedConfig of RSS_FEEDS) {
    const results = await processFeed(feedConfig);
    
    overallResults.total += results.total;
    overallResults.created += results.created;
    overallResults.updated += results.updated;
    overallResults.skipped += results.skipped;
    overallResults.failed += results.failed;
  }
  
  log(`\n${'='.repeat(80)}`, colors.bright);
  log(`${colors.bright}${colors.green}  ✅ IMPORT COMPLETE ✅${colors.reset}`);
  log(`${'='.repeat(80)}`, colors.bright);
  log(`\n${colors.bright}Overall Results:${colors.reset}`);
  log(`  Total items: ${overallResults.total}`, colors.blue);
  log(`  Created: ${overallResults.created}`, colors.green);
  log(`  Updated: ${overallResults.updated}`, colors.blue);
  log(`  Skipped: ${overallResults.skipped}`, colors.yellow);
  log(`  Failed: ${overallResults.failed}`, colors.red);
  log('');
}

// Run the script
main().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
