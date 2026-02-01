/// <reference types="vite/client" />
import { createDirectus, readItems, readSingleton, rest, staticToken } from "@directus/sdk";
import { generateSlug } from "./utils";

export type CmsErrorCode =
  | "CMS_NOT_CONFIGURED"
  | "CMS_UNAVAILABLE"
  | "NOT_FOUND"
  | "UNKNOWN";

export type CmsResult<T> = { data: T | null; error: CmsErrorCode | null };

/**
 * Creates a Directus client with the appropriate URL based on execution context.
 * 
 * CRITICAL: This prevents the "Hydration Trap"
 * - Server-side (SSR): Uses DIRECTUS_URL (internal Docker network: http://directus:8055)
 * - Client-side: Uses PUBLIC_DIRECTUS_URL (public-facing URL: https://api.bitcoindistrict.org)
 * 
 * See .cursor/rules/RULES.md for more details on the Hydration Trap.
 */
function getConfiguredDirectusUrl(): string | null {
  const isServer = import.meta.env.SSR;
  const url = isServer ? import.meta.env.DIRECTUS_URL : import.meta.env.PUBLIC_DIRECTUS_URL;

  if (typeof url !== "string" || url.trim().length === 0) return null;
  return url;
}

export function getDirectusClient() {
  const url = getConfiguredDirectusUrl();
  if (!url) return null;

  // Use static token for server-side requests (SSR) - secure, never exposed to browser
  // Static tokens are associated with a user account and have their permissions
  // Chain staticToken BEFORE rest() - this is required for proper authentication
  if (import.meta.env.SSR && import.meta.env.DIRECTUS_STATIC_TOKEN) {
    return createDirectus(url)
      .with(staticToken(import.meta.env.DIRECTUS_STATIC_TOKEN))
      .with(rest());
  }
  
  // Client-side: no authentication (or use public permissions)
  return createDirectus(url).with(rest());
}

function isProbablyNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch|ECONNREFUSED|ENOTFOUND|network|timed out|timeout/i.test(message);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

/**
 * Gets the appropriate Directus URL for the current context.
 * Use this for constructing asset URLs (images, files, etc.)
 * 
 * IMPORTANT: Asset URLs must ALWAYS use the public URL since they will be
 * rendered in HTML and accessed by the browser, not the server.
 */
export function getDirectusUrl(): string {
  // Always use PUBLIC_DIRECTUS_URL for assets, even during SSR
  // The browser needs to be able to access these URLs
  const publicUrl = import.meta.env.PUBLIC_DIRECTUS_URL;
  if (typeof publicUrl === "string" && publicUrl.trim().length > 0) {
    return publicUrl;
  }
  
  // Fallback to the configured URL (but this shouldn't happen for assets)
  return getConfiguredDirectusUrl() ?? "";
}

export async function getPageData(slug: string): Promise<CmsResult<any>> {
    const client = getDirectusClient();
    if (!client) return { data: null, error: "CMS_NOT_CONFIGURED" };

    try {
      const pages = await withTimeout(
        client.request(
          readItems("pages", {
            fields: ["*", "blocks.*", "blocks.item.*.*.*.*"],
            filter: {
              permalink: {
                _eq: slug,
              },
            },
            limit: 1, // Fetch only one page
          })
        ),
        2500
      );
  
      if (pages.length === 0) {
        return { data: null, error: "NOT_FOUND" };
      }
  
      return {
        data: pages[0], // Return the first (and only) page
        error: null,
      };
    } catch (error) {
      console.error(`Failed to fetch page with slug "${slug}":`, error);
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }
  
  // NOTE: Navigation and Globals functions are commented out as these collections don't exist.
  // The site uses siteConfig directly instead of CMS-managed navigation/globals.
  // Uncomment if you add these collections to Directus in the future.
  
  /*
  interface NavigationItem {
    id: string;
    sort: number;
    title: string;
    type: "page" | "url" | "group";
    url?: string | null;
    page?: {
      id: string;
      sort: number;
      title: string;
      permalink: string;
    } | null;
    children?: Array<NavigationItem>;
  }
  
  interface NavigationResponse {
    id: string;
    title: string;
    is_active: boolean;
    items: Array<NavigationItem>;
  }
  
  interface NavigationData {
    data: Array<NavigationResponse>;
    error?: string;
  }
  export async function getNavigation(): Promise<CmsResult<Array<NavigationResponse>>> {
    const client = getDirectusClient();
    if (!client) return { data: [], error: "CMS_NOT_CONFIGURED" };

    try {
      const navigation = await withTimeout(
        client.request(
          readItems("navigation", {
            fields: ["*.*.*"],
          })
        ),
        2500
      );
  
      return {
        data: navigation as Array<NavigationResponse>,
        error: null,
      };
    } catch (error: any) {
      // Extract error message from Directus SDK error response
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (statusCode === 403) {
        console.error("❌ Navigation permission denied - Service user role needs Read access to 'navigation' collection");
        console.error("Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → navigation → Enable Read");
      } else {
        console.error("Failed to fetch navigation:", errorMessage);
      }
      
      return {
        data: [],
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }
  */
  
  export async function getPostData(slug: string): Promise<CmsResult<any>> {
    const client = getDirectusClient();
    if (!client) return { data: null, error: "CMS_NOT_CONFIGURED" };

    try {
      const posts = await withTimeout(
        client.request(
          readItems("posts", {
            fields: ["*", "image.*", "author.*"],
            filter: {
              slug: {
                _eq: slug,
              },
              status: {
                _eq: "published",
              },
            },
            limit: 1,
          })
        ),
        2500
      );
  
      if (posts.length === 0) {
        return { data: null, error: "NOT_FOUND" };
      }
  
      return {
        data: posts[0],
        error: null,
      };
    } catch (error) {
      console.error(`Failed to fetch post with slug "${slug}":`, error);
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Globals data interface - singleton collection containing site-wide content
   */
  export interface GlobalsData {
    id: number;
    title?: string;
    privacy_policy?: string;
    terms?: string;
    form_recaptcha_sitekey?: string;
    user_updated?: string;
    date_updated?: string;
  }

  /**
   * Fetches the Globals singleton containing site-wide content like privacy policy and terms
   */
  export async function getGlobals(): Promise<CmsResult<GlobalsData>> {
    const client = getDirectusClient();
    if (!client) return { data: null, error: "CMS_NOT_CONFIGURED" };

    try {
      const globals = await withTimeout(
        client.request(
          readSingleton("Globals", {
            fields: ["id", "title", "privacy_policy", "terms", "form_recaptcha_sitekey"],
          })
        ),
        2500
      );
  
      return {
        data: globals as GlobalsData,
        error: null,
      };
    } catch (error: any) {
      // Extract error message from Directus SDK error response
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (statusCode === 403) {
        console.error("❌ Globals permission denied - Service user role needs Read access to 'Globals' collection (singleton)");
        console.error("Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Globals → Enable Read");
      } else {
        console.error("Failed to fetch globals:", errorMessage);
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  export interface PodcastEpisode {
    id: number;
    title: string;
    description: string;
    status: string;
    air_date: string;
    // Can be either a UUID string or an expanded file object
    audio_file?: string | {
      id: string;
      filename_disk: string;
      title?: string;
    } | null;
    // Can be either a UUID string or an expanded file object
    cover_image?: string | {
      id: string;
      filename_disk: string;
      title?: string;
      width?: number;
      height?: number;
    } | null;
    date_created?: string;
    date_updated?: string;
  }

  /**
   * Fetches all published podcast episodes from Directus
   */
  export async function getPodcastEpisodes(): Promise<CmsResult<PodcastEpisode[]>> {
    const client = getDirectusClient();
    if (!client) {
      console.error("[Podcasts] Directus client not configured");
      return { data: null, error: "CMS_NOT_CONFIGURED" };
    }

    try {
      const episodes = await withTimeout(
        client.request(
          readItems("Podcasts", {
            // Explicitly specify fields to avoid permission issues with system fields
            fields: [
              "id",
              "title",
              "description",
              "status",
              "air_date",
              "audio_file.*",
              "cover_image.*"
            ],
            filter: {
              status: {
                _eq: "published",
              },
            },
            sort: ["-air_date", "-id"],
          })
        ),
        2500
      );

      console.log(`[Podcasts] Fetched ${episodes.length} published episode(s)`);
      
      // Debug logging to check what data we're getting
      if (episodes.length > 0) {
        const firstEpisode = episodes[0] as any;
        console.log(`[Podcasts] First episode data:`, {
          title: firstEpisode.title,
          audio_file_type: typeof firstEpisode.audio_file,
          audio_file_value: firstEpisode.audio_file,
          cover_image_type: typeof firstEpisode.cover_image,
          cover_image_value: firstEpisode.cover_image,
        });
      }
      
      return {
        data: episodes as PodcastEpisode[],
        error: null,
      };
    } catch (error: any) {
      // Extract error message from Directus SDK error response
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      console.error("[Podcasts] Failed to fetch podcast episodes:", errorMessage);
      if (statusCode) {
        console.error(`[Podcasts] HTTP Status: ${statusCode}`);
      }
      
      // Check for permission errors (403)
      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Podcasts] ❌ Permission denied - Service user role needs Read access to 'Podcasts' collection");
        console.error("[Podcasts] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Podcasts → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Fetches a single podcast episode by slug (generated from title)
   */
  export async function getPodcastEpisodeBySlug(slug: string): Promise<CmsResult<PodcastEpisode>> {
    const client = getDirectusClient();
    if (!client) return { data: null, error: "CMS_NOT_CONFIGURED" };

    try {
      const episodes = await withTimeout(
        client.request(
          readItems("Podcasts", {
            // Explicitly specify fields to avoid permission issues with system fields
            fields: [
              "id",
              "title",
              "description",
              "status",
              "air_date",
              "audio_file.*",
              "cover_image.*"
            ],
            filter: {
              status: {
                _eq: "published",
              },
            },
          })
        ),
        2500
      );

      // Find episode by matching slug generated from title
      const episode = (episodes as PodcastEpisode[]).find((ep) => {
        const episodeSlug = generateSlug(ep.title);
        return episodeSlug === slug;
      });

      if (!episode) {
        return { data: null, error: "NOT_FOUND" };
      }

      return {
        data: episode,
        error: null,
      };
    } catch (error) {
      console.error(`Failed to fetch podcast episode with slug "${slug}":`, error);
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  export interface Event {
    id: number;
    title: string;
    description: string;
    custom_agenda?: string | null;
    status: string;
    start_date_time: string;
    end_date_time?: string | null;
    rsvp_url?: string | null;
    capacity?: number | null;
    price?: number | null;
    // Can be either an integer or an expanded tag object
    tags?: number | {
      id: number;
      name: string;
    } | null;
    // Can be either an integer or an expanded venue object
    location?: number | {
      id: number;
      name: string;
      address: string;
    } | null;
    // Can be either a UUID string or an expanded file object
    image?: string | {
      id: string;
      filename_disk: string;
      title?: string;
      width?: number;
      height?: number;
    } | null;
    date_created?: string;
    date_updated?: string;
    source_feed?: string | null;
  }

  /**
   * Fetches all published events, sorted by start date (upcoming first)
   */
  export async function getEvents(): Promise<CmsResult<Event[]>> {
    const client = getDirectusClient();
    if (!client) {
      console.error("[Events] Directus client not configured");
      return { data: null, error: "CMS_NOT_CONFIGURED" };
    }

    try {
      const events = await withTimeout(
        client.request(
          readItems("Events", {
            fields: [
              "id",
              "title",
              "description",
              "status",
              "start_date_time",
              "end_date_time",
              "rsvp_url",
              "capacity",
              "price",
              "tags.id",
              "tags.name",
              "location.id",
              "location.name",
              "location.address",
              "image.*",
              "source_feed"
            ],
            filter: {
              status: {
                _eq: "published",
              },
            },
            sort: ["start_date_time", "id"],
          })
        ),
        2500
      );

      console.log(`[Events] Fetched ${events.length} published event(s)`);
      
      return {
        data: events as Event[],
        error: null,
      };
    } catch (error: any) {
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      console.error("[Events] Failed to fetch events:", errorMessage);
      if (statusCode) {
        console.error(`[Events] HTTP Status: ${statusCode}`);
      }
      
      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Events] ❌ Permission denied - Service user role needs Read access to 'Events' collection");
        console.error("[Events] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Events → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Fetches events filtered by tag name (e.g., "bitplebs")
   */
  export async function getEventsByTag(tagName: string): Promise<CmsResult<Event[]>> {
    const client = getDirectusClient();
    if (!client) {
      console.error("[Events] Directus client not configured");
      return { data: null, error: "CMS_NOT_CONFIGURED" };
    }

    try {
      // First, fetch the tag to get its ID
      const tags = await withTimeout(
        client.request(
          readItems("tags", {
            fields: ["id", "name"],
            filter: {
              name: {
                _eq: tagName,
              },
            },
            limit: 1,
          })
        ),
        2500
      );

      if (tags.length === 0) {
        console.log(`[Events] No tag found with name "${tagName}"`);
        return { data: [], error: null };
      }

      const tagId = (tags[0] as any).id;

      // Now fetch events with this tag
      const events = await withTimeout(
        client.request(
          readItems("Events", {
            fields: [
              "id",
              "title",
              "description",
              "custom_agenda",
              "status",
              "start_date_time",
              "end_date_time",
              "rsvp_url",
              "capacity",
              "price",
              "tags.id",
              "tags.name",
              "location.id",
              "location.name",
              "location.address",
              "image.*"
            ],
            filter: {
              status: {
                _eq: "published",
              },
              tags: {
                _eq: tagId,
              },
            },
            sort: ["start_date_time", "id"],
          })
        ),
        2500
      );

      console.log(`[Events] Fetched ${events.length} published event(s) with tag "${tagName}"`);
      
      return {
        data: events as Event[],
        error: null,
      };
    } catch (error: any) {
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      console.error("[Events] Failed to fetch events:", errorMessage);
      if (statusCode) {
        console.error(`[Events] HTTP Status: ${statusCode}`);
      }
      
      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Events] ❌ Permission denied - Service user role needs Read access to 'Events' collection");
        console.error("[Events] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Events → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Fetches a single event by slug (generated from title) with a specific tag
   */
  export async function getEventBySlugAndTag(slug: string, tagName: string): Promise<CmsResult<Event>> {
    const result = await getEventsByTag(tagName);
    
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    // Find event by matching slug generated from title
    const event = result.data.find((ev) => {
      const eventSlug = generateSlug(ev.title);
      return eventSlug === slug;
    });

    if (!event) {
      return { data: null, error: "NOT_FOUND" };
    }

    return {
      data: event,
      error: null,
    };
  }

  /**
   * Fetches a single event by ID with a specific tag
   */
  export async function getEventByIdAndTag(id: number, tagName: string): Promise<CmsResult<Event>> {
    const client = getDirectusClient();
    if (!client) return { data: null, error: "CMS_NOT_CONFIGURED" };

    try {
      // First, fetch the tag to get its ID
      const tags = await withTimeout(
        client.request(
          readItems("tags", {
            fields: ["id", "name"],
            filter: {
              name: {
                _eq: tagName,
              },
            },
            limit: 1,
          })
        ),
        2500
      );

      if (tags.length === 0) {
        console.log(`[Events] No tag found with name "${tagName}"`);
        return { data: null, error: "NOT_FOUND" };
      }

      const tagId = (tags[0] as any).id;

      // Now fetch the event with this ID and tag
      const events = await withTimeout(
        client.request(
          readItems("Events", {
            fields: [
              "id",
              "title",
              "description",
              "custom_agenda",
              "status",
              "start_date_time",
              "end_date_time",
              "rsvp_url",
              "capacity",
              "price",
              "tags.id",
              "tags.name",
              "location.id",
              "location.name",
              "location.address",
              "image.*"
            ],
            filter: {
              id: {
                _eq: id,
              },
              status: {
                _eq: "published",
              },
              tags: {
                _eq: tagId,
              },
            },
            limit: 1,
          })
        ),
        2500
      );

      if (events.length === 0) {
        return { data: null, error: "NOT_FOUND" };
      }

      console.log(`[Events] Fetched event ID ${id} with tag "${tagName}"`);
      
      return {
        data: events[0] as Event,
        error: null,
      };
    } catch (error: any) {
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      console.error("[Events] Failed to fetch event:", errorMessage);
      if (statusCode) {
        console.error(`[Events] HTTP Status: ${statusCode}`);
      }
      
      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Events] ❌ Permission denied - Service user role needs Read access to 'Events' collection");
        console.error("[Events] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Events → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Book interface matching the Books collection in Directus
   */
  export interface Book {
    id: number;
    title: string;
    author: string;
    date_bookclub_read?: string | null;
    cover_image?: string | {
      id: string;
      filename_disk: string;
      title?: string;
      width?: number;
      height?: number;
    } | null;
    purchase_url?: string | null;
    sort?: number | null;
  }

  /**
   * Fetches all books from the Books collection
   */
  export async function getBooks(): Promise<CmsResult<Book[]>> {
    const client = getDirectusClient();
    if (!client) {
      console.error("[Books] Directus client not configured");
      return { data: null, error: "CMS_NOT_CONFIGURED" };
    }

    try {
      const books = await withTimeout(
        client.request(
          readItems("Books", {
            fields: [
              "id",
              "title",
              "author",
              "date_bookclub_read",
              "cover_image.*",
              "purchase_url",
              "sort"
            ],
            sort: ["sort", "-date_bookclub_read"],
          })
        ),
        2500
      );

      console.log(`[Books] Fetched ${books.length} book(s)`);
      
      return {
        data: books as Book[],
        error: null,
      };
    } catch (error: any) {
      let errorMessage = "Unknown error";
      let statusCode = null;
      
      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      console.error("[Books] Failed to fetch books:", errorMessage);
      if (statusCode) {
        console.error(`[Books] HTTP Status: ${statusCode}`);
      }
      
      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Books] ❌ Permission denied - Service user role needs Read access to 'Books' collection");
        console.error("[Books] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Books → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }
      
      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }

  /**
   * Meetup interface matching the Meetups collection in Directus
   */
  export interface Meetup {
    id: number;
    status?: string;
    sort?: number | null;
    Name: string;
    description?: string | null;
    short_description?: string | null;
    address?: string | null;
    city?: string | null;
    website?: string | null;
    event_site_url?: string | null;
    logo?: string | {
      id: string;
      filename_disk?: string;
      width?: number;
      height?: number;
    } | null;
    social_links?: { platform: string; url: string }[] | null;
  }

  /**
   * Fetches all published meetups from the Meetups collection
   */
  export async function getMeetups(): Promise<CmsResult<Meetup[]>> {
    const client = getDirectusClient();
    if (!client) {
      console.error("[Meetups] Directus client not configured");
      return { data: null, error: "CMS_NOT_CONFIGURED" };
    }

    try {
      const meetups = await withTimeout(
        client.request(
          readItems("Meetups", {
            fields: [
              "id",
              "Name",
              "short_description",
              "address",
              "city",
              "website",
              "event_site_url",
              "logo.*",
              "social_links"
            ],
            filter: {
              status: {
                _eq: "published",
              },
            },
            sort: ["sort", "Name"],
          })
        ),
        2500
      );

      console.log(`[Meetups] Fetched ${meetups.length} published meetup(s)`);

      return {
        data: meetups as Meetup[],
        error: null,
      };
    } catch (error: any) {
      let errorMessage = "Unknown error";
      let statusCode: number | null = null;

      if (error?.response) {
        statusCode = error.response.status;
        const errorBody = error.response._data || error.response.data;
        if (errorBody?.errors?.[0]?.message) {
          errorMessage = errorBody.errors[0].message;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      console.error("[Meetups] Failed to fetch meetups:", errorMessage);
      if (statusCode) {
        console.error(`[Meetups] HTTP Status: ${statusCode}`);
      }

      if (statusCode === 403 || errorMessage.includes("permission") || errorMessage.includes("Forbidden")) {
        console.error("[Meetups] ❌ Permission denied - Service user role needs Read access to 'Meetups' collection");
        console.error("[Meetups] Fix: Settings → Users & Roles → Roles → [Your Role] → Permissions → Meetups → Enable Read");
        return { data: null, error: "CMS_UNAVAILABLE" };
      }

      return {
        data: null,
        error: isProbablyNetworkError(error) ? "CMS_UNAVAILABLE" : "UNKNOWN",
      };
    }
  }