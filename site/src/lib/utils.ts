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
