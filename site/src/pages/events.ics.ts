import type { APIRoute } from 'astro';
import { getEvents, type Event } from '../lib/directus';
import { parseESTDate } from '../lib/utils';

/**
 * ICS Calendar Endpoint
 * 
 * Generates a dynamic ICS (iCalendar) file from Directus Events collection
 * Accessible at: /events.ics
 * 
 * Features:
 * - RFC 5545 compliant ICS format
 * - Timezone information for America/New_York
 * - Cached for 15 minutes for performance
 * - Includes event metadata (title, description, location, RSVP URL)
 * - Properly escapes special characters
 * 
 * Usage:
 * - Subscribe to calendar: https://bitcoindistrict.org/events.ics
 * - Download and import into calendar apps
 * - Calendar apps typically poll every 15-30 minutes
 */

/**
 * Formats a date for ICS UTC format (YYYYMMDDTHHMMSSZ)
 */
function formatICSDateUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Formats a date in a given TZID for ICS (local time, no Z)
 * Example output: 20250805T180000
 */
function formatICSDateInTZID(date: Date, tzid: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tzid,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const lookup = (type: string) => parts.find(p => p.type === type)?.value || '';
  const [month, day, year] = [lookup('month'), lookup('day'), lookup('year')];
  const [hour, minute, second] = [lookup('hour'), lookup('minute'), lookup('second')];
  // Ensure YYYYMMDDTHHMMSS
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

/**
 * Escapes special characters for ICS format
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Folds a line to meet RFC 5545 requirements (max 75 characters per line)
 * Continuation lines are indented with a space
 */
function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  
  let result = '';
  let remaining = line;
  
  // First line can be up to 75 characters (including the \r that will be added)
  result += remaining.substring(0, 74) + '\r\n';
  remaining = remaining.substring(74);
  
  // Continuation lines start with a space and can be up to 74 characters total (75 - 1 for the space, minus 1 for \r)
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, 73);
    result += ' ' + chunk + '\r\n';
    remaining = remaining.substring(73);
  }
  
  // Remove the trailing \r\n since it will be added by the caller
  return result.slice(0, -2);
}

/**
 * Generates a unique identifier for ICS events
 */
function generateUID(event: Event): string {
  return `event-${event.id}@bitcoindistrict.org`;
}

/**
 * Extracts location string from Event location field
 */
function getLocationString(event: Event): string {
  if (!event.location) return '';
  
  if (typeof event.location === 'object' && event.location.name) {
    const name = event.location.name;
    const address = event.location.address || '';
    return address ? `${name}, ${address}` : name;
  }
  
  return '';
}

/**
 * Generates an ICS event component from a Directus Event
 */
function generateICSEvent(event: Event): string {
  const uid = generateUID(event);
  const tzid = 'America/New_York';
  
  // Parse dates from ISO strings, treating naive timestamps as EST/EDT
  const startDate = parseESTDate(event.start_date_time);
  const endDate = event.end_date_time ? parseESTDate(event.end_date_time) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours
  
  const dtstartLocal = formatICSDateInTZID(startDate, tzid);
  const dtendLocal = formatICSDateInTZID(endDate, tzid);
  const dtstamp = formatICSDateUTC(new Date()); // Current timestamp in UTC
  const summary = escapeICSText(event.title);
  
  // Build description with RSVP URL if available
  let description = escapeICSText(event.description);
  if (event.rsvp_url) {
    description += `\\n\\nRSVP: ${event.rsvp_url}`;
  }
  
  const location = getLocationString(event);
  const url = event.rsvp_url || '';
  
  // Get tag name for organizer
  const tagName = typeof event.tags === 'object' && event.tags ? event.tags.name : 'Bitcoin District';
  
  let icsEvent = `BEGIN:VEVENT\r\n`;
  icsEvent += foldLine(`UID:${uid}`) + `\r\n`;
  icsEvent += foldLine(`DTSTAMP:${dtstamp}`) + `\r\n`;
  icsEvent += foldLine(`DTSTART;TZID=${tzid}:${dtstartLocal}`) + `\r\n`;
  icsEvent += foldLine(`DTEND;TZID=${tzid}:${dtendLocal}`) + `\r\n`;
  icsEvent += foldLine(`SUMMARY:${summary}`) + `\r\n`;
  icsEvent += foldLine(`DESCRIPTION:${description}`) + `\r\n`;
  
  if (location) {
    icsEvent += foldLine(`LOCATION:${escapeICSText(location)}`) + `\r\n`;
  }
  
  if (url) {
    icsEvent += foldLine(`URL:${url}`) + `\r\n`;
  }
  
  // Add organizer information
  icsEvent += foldLine(`ORGANIZER;CN=${escapeICSText(tagName)}:mailto:events@bitcoindistrict.org`) + `\r\n`;
  
  // Add categories
  icsEvent += foldLine(`CATEGORIES:Bitcoin,Cryptocurrency,Meetup`) + `\r\n`;
  
  // Add status
  icsEvent += foldLine(`STATUS:CONFIRMED`) + `\r\n`;
  
  // Add transparency (show as busy)
  icsEvent += foldLine(`TRANSP:OPAQUE`) + `\r\n`;
  
  icsEvent += `END:VEVENT\r\n`;
  
  return icsEvent;
}

/**
 * Generates a complete ICS file content from Directus events
 */
function generateICSContent(events: Event[]): string {
  // ICS file header
  let icsContent = `BEGIN:VCALENDAR\r\n`;
  icsContent += `VERSION:2.0\r\n`;
  icsContent += foldLine(`PRODID:-//Bitcoin District//Bitcoin Events//EN`) + `\r\n`;
  icsContent += `CALSCALE:GREGORIAN\r\n`;
  icsContent += `METHOD:PUBLISH\r\n`;
  icsContent += foldLine(`X-WR-CALNAME:Bitcoin District Events`) + `\r\n`;
  icsContent += foldLine(`X-WR-CALDESC:Bitcoin and cryptocurrency events in the DC metro area`) + `\r\n`;
  icsContent += foldLine(`X-WR-TIMEZONE:America/New_York`) + `\r\n`;
  
  // Add timezone information for ET/EST
  icsContent += `BEGIN:VTIMEZONE\r\n`;
  icsContent += `TZID:America/New_York\r\n`;
  icsContent += `BEGIN:DAYLIGHT\r\n`;
  icsContent += `TZOFFSETFROM:-0500\r\n`;
  icsContent += `TZOFFSETTO:-0400\r\n`;
  icsContent += `TZNAME:EDT\r\n`;
  icsContent += `DTSTART:20070311T020000\r\n`;
  icsContent += `RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\n`;
  icsContent += `END:DAYLIGHT\r\n`;
  icsContent += `BEGIN:STANDARD\r\n`;
  icsContent += `TZOFFSETFROM:-0400\r\n`;
  icsContent += `TZOFFSETTO:-0500\r\n`;
  icsContent += `TZNAME:EST\r\n`;
  icsContent += `DTSTART:20071104T020000\r\n`;
  icsContent += `RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\n`;
  icsContent += `END:STANDARD\r\n`;
  icsContent += `END:VTIMEZONE\r\n`;
  
  // Add events
  events.forEach(event => {
    icsContent += generateICSEvent(event);
  });
  
  // ICS file footer
  icsContent += `END:VCALENDAR\r\n`;
  
  return icsContent;
}

/**
 * GET handler for /events.ics
 * Fetches events from Directus and returns ICS calendar file
 */
export const GET: APIRoute = async () => {
  try {
    // Fetch all published events from Directus
    const result = await getEvents();
    
    if (result.error || !result.data) {
      console.error('[ICS] Failed to fetch events from Directus:', result.error);
      return new Response('Error generating calendar file', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    const events = result.data;
    console.log(`[ICS] Generating calendar with ${events.length} event(s)`);
    
    // Generate ICS content
    const icsContent = generateICSContent(events);
    
    // Return ICS file with proper headers
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="bitcoin-district-events.ics"',
        // Cache for 5 minutes (300 seconds) - shorter cache since events can change
        // s-maxage is for CDN/shared caches, max-age is for browser cache
        // must-revalidate ensures fresh data after cache expires
        'Cache-Control': 'public, s-maxage=300, max-age=300, must-revalidate',
        // Allow calendar apps to know when the file was last updated
        'Last-Modified': new Date().toUTCString(),
      },
    });
  } catch (error) {
    console.error('[ICS] Error generating calendar:', error);
    return new Response('Error generating calendar file', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
};
