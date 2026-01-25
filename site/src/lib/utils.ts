/**
 * Generates a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Maps source_feed value to state indicator image filename
 * Returns null if no matching image exists
 */
export function getStateIndicatorImage(sourceFeed: string | null | undefined): string | null {
  if (!sourceFeed) return null;
  
  const normalized = sourceFeed.toLowerCase().trim();
  
  // Handle both stored values and display labels
  if (normalized === 'washington-dc' || normalized === 'washington dc' || normalized === 'dc') {
    return 'dc_round.png';
  }
  if (normalized === 'maryland' || normalized === 'md') {
    return 'md_round.png';
  }
  if (normalized === 'virginia' || normalized === 'va') {
    return 'va_round.png';
  }
  
  return null;
}

/**
 * Parse a naive timestamp string as EST/EDT
 * 
 * Since event times are stored in Directus as naive timestamps (no timezone indicator)
 * like "2026-01-26T18:00:00", JavaScript's Date constructor would interpret them as
 * local time (likely UTC on the server). This function explicitly treats them as
 * EST/EDT times by appending the appropriate timezone offset.
 * 
 * @param dateStr - ISO 8601 datetime string, optionally with timezone info
 * @returns Date object representing the time in EST/EDT
 */
export function parseESTDate(dateStr: string): Date {
  // If the string already has timezone info (Z or +/-), use it directly
  if (dateStr.includes('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateStr);
  }
  
  // Parse the date to determine if it's in DST period (EDT) or not (EST)
  // EDT is typically March-November, EST is November-March
  const naiveDate = new Date(dateStr + 'Z'); // Parse as UTC first to get the date
  const month = naiveDate.getUTCMonth() + 1; // 1-12
  
  // Simple DST check: March (3) through October (10) are typically EDT (-04:00)
  // November (11) through February (2) are EST (-05:00)
  // This is a simplification - actual DST dates vary by year
  // (DST starts 2nd Sunday in March, ends 1st Sunday in November)
  const isDST = month >= 3 && month <= 10;
  const offset = isDST ? '-04:00' : '-05:00';
  
  return new Date(dateStr + offset);
}
