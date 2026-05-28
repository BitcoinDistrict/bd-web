import type { RSSFeedItem } from "@astrojs/rss";
import { siteConfig } from "../config/site";
import {
  getDirectusUrl,
  getNewsSlug,
  type Event,
  type NewsItem,
  type PodcastEpisode,
} from "./directus";
import { generateSlug, parseESTDate } from "./utils";

const DEFAULT_DESCRIPTION_LENGTH = 220;
const FEED_ITEM_LIMIT = 200;

export const FEED_CACHE_CONTROL = "public, s-maxage=300, max-age=300, must-revalidate";

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWordBoundary(value: string, maxLength = DEFAULT_DESCRIPTION_LENGTH): string {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) return `${truncated.slice(0, lastSpace)}...`;
  return `${truncated}...`;
}

function ensureDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function getFirstValidDate(candidates: Array<string | null | undefined>): Date {
  for (const candidate of candidates) {
    const date = ensureDate(candidate);
    if (date) return date;
  }
  return new Date();
}

function sortByPubDateDesc(items: RSSFeedItem[]): RSSFeedItem[] {
  return [...items]
    .filter((item) => item.pubDate instanceof Date && !Number.isNaN(item.pubDate.getTime()))
    .sort((a, b) => {
      const left = a.pubDate?.getTime() ?? 0;
      const right = b.pubDate?.getTime() ?? 0;
      return right - left;
    });
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, siteConfig.siteUrl).toString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGuid(kind: "news" | "events" | "podcast", id: number): string {
  return `${siteConfig.siteUrl}/feeds/${kind}/${id}`;
}

function getNewsCategories(type: NewsItem["type"]): string[] {
  if (Array.isArray(type)) {
    return type.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  }
  if (typeof type === "string" && type.length > 0) return [type];
  return ["news"];
}

function getNewsDescription(item: NewsItem): string {
  const subtitle = item.subtitle?.trim() ?? "";
  if (subtitle.length > 0) return truncateAtWordBoundary(subtitle);
  const plainContent = stripHtml(item.content ?? "");
  if (plainContent.length > 0) return truncateAtWordBoundary(plainContent);
  return "Latest update from Bitcoin District.";
}

function getEventDescription(event: Event): string {
  const plainDescription = stripHtml(event.description ?? "");
  if (plainDescription.length === 0) return "Upcoming Bitcoin District event.";
  return truncateAtWordBoundary(plainDescription);
}

function getPodcastDescription(episode: PodcastEpisode): string {
  const plainDescription = stripHtml(episode.description ?? "");
  if (plainDescription.length === 0) return `Listen to ${episode.title} on the Bitcoin District podcast.`;
  return truncateAtWordBoundary(plainDescription);
}

function getAudioMimeType(fileName?: string): string {
  const lower = fileName?.toLowerCase() ?? "";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "audio/mpeg";
}

function getPodcastEnclosure(episode: PodcastEpisode): RSSFeedItem["enclosure"] | undefined {
  if (!episode.audio_file) return undefined;

  const audioObject =
    typeof episode.audio_file === "object" && episode.audio_file !== null
      ? (episode.audio_file as Record<string, unknown>)
      : null;

  const audioId =
    typeof episode.audio_file === "string"
      ? episode.audio_file
      : typeof audioObject?.id === "string"
        ? audioObject.id
        : undefined;

  if (!audioId) return undefined;

  const directusUrl = getDirectusUrl();
  const url = toAbsoluteUrl(`${directusUrl}/assets/${audioId}`);
  const typeFromObject = typeof audioObject?.type === "string" ? audioObject.type : undefined;
  const typeFromName =
    typeof audioObject?.filename_disk === "string" ? getAudioMimeType(audioObject.filename_disk) : undefined;
  const length =
    typeof audioObject?.filesize === "number" && Number.isFinite(audioObject.filesize)
      ? audioObject.filesize
      : 0;

  return {
    url,
    length,
    type: typeFromObject ?? typeFromName ?? "audio/mpeg",
  };
}

export function getFeedCustomData(selfPath: string): string {
  const selfHref = escapeXml(toAbsoluteUrl(selfPath));
  return [
    "<language>en-us</language>",
    "<generator>Astro + @astrojs/rss</generator>",
    `<atom:link href="${selfHref}" rel="self" type="application/rss+xml" />`,
  ].join("");
}

export function normalizeFeedItems(items: RSSFeedItem[]): RSSFeedItem[] {
  return sortByPubDateDesc(items).slice(0, FEED_ITEM_LIMIT);
}

export async function applyFeedHeaders(feedResponsePromise: Promise<Response>): Promise<Response> {
  const response = await feedResponsePromise;
  response.headers.set("Cache-Control", FEED_CACHE_CONTROL);
  response.headers.set("Last-Modified", new Date().toUTCString());
  return response;
}

export function getNewsFeedItems(items: NewsItem[]): RSSFeedItem[] {
  return normalizeFeedItems(
    items.map((item) => {
      const pubDate = getFirstValidDate([item.date, item.date_updated, item.date_created]);
      return {
        title: item.title,
        description: getNewsDescription(item),
        pubDate,
        link: `/news/${getNewsSlug(item)}`,
        categories: getNewsCategories(item.type),
        customData: `<guid isPermaLink="false">${escapeXml(buildGuid("news", item.id))}</guid>`,
      };
    })
  );
}

export function getEventFeedItems(events: Event[]): RSSFeedItem[] {
  return normalizeFeedItems(
    events.map((event) => {
      const pubDate = parseESTDate(event.start_date_time);
      const eventTag = typeof event.tags === "object" && event.tags?.name ? event.tags.name : undefined;
      return {
        title: event.title,
        description: getEventDescription(event),
        pubDate,
        link: event.rsvp_url ? toAbsoluteUrl(event.rsvp_url) : "/events",
        categories: eventTag ? ["events", eventTag] : ["events"],
        customData: `<guid isPermaLink="false">${escapeXml(buildGuid("events", event.id))}</guid>`,
      };
    })
  );
}

export function getPodcastFeedItems(episodes: PodcastEpisode[]): RSSFeedItem[] {
  return normalizeFeedItems(
    episodes.map((episode) => {
      const pubDate = getFirstValidDate([episode.air_date, episode.date_updated, episode.date_created]);
      const slug = generateSlug(episode.title);
      return {
        title: episode.title,
        description: getPodcastDescription(episode),
        pubDate,
        link: `/podcast/${slug}`,
        categories: ["podcast"],
        enclosure: getPodcastEnclosure(episode),
        customData: `<guid isPermaLink="false">${escapeXml(buildGuid("podcast", episode.id))}</guid>`,
      };
    })
  );
}
