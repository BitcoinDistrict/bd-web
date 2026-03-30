import { readItems } from "@directus/sdk";
import { siteConfig } from "../config/site";
import {
  getDirectusClient,
  getEventsByTag,
  getNews,
  getNewsSlug,
  getPodcastEpisodes,
} from "../lib/directus";
import { generateSlug } from "../lib/utils";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, siteConfig.siteUrl).toString();
}

function upsertEntry(map: Map<string, SitemapEntry>, pathname: string, lastmod?: string) {
  const loc = toAbsoluteUrl(pathname);
  const existing = map.get(loc);

  if (!existing) {
    map.set(loc, { loc, lastmod });
    return;
  }

  if (!existing.lastmod && lastmod) {
    map.set(loc, { ...existing, lastmod });
    return;
  }

  if (existing.lastmod && lastmod && new Date(lastmod) > new Date(existing.lastmod)) {
    map.set(loc, { ...existing, lastmod });
  }
}

async function getPublishedBlogUrls(): Promise<Array<{ pathname: string; lastmod?: string }>> {
  const client = getDirectusClient();
  if (!client) return [];

  try {
    const posts = await client.request(
      readItems("posts", {
        fields: ["slug", "date_updated", "published_at"],
        filter: { status: { _eq: "published" } },
        sort: ["-published_at", "-id"],
      })
    );

    return (posts as Array<{ slug?: string; date_updated?: string; published_at?: string }>)
      .filter((post) => typeof post.slug === "string" && post.slug.trim().length > 0)
      .map((post) => ({
        pathname: `/blog/${post.slug!.trim()}`,
        lastmod: toIsoDate(post.date_updated) ?? toIsoDate(post.published_at),
      }));
  } catch (error) {
    console.warn("[Sitemap] Skipping blog URLs due to CMS error:", error);
    return [];
  }
}

async function getPublishedPageUrls(): Promise<Array<{ pathname: string; lastmod?: string }>> {
  const client = getDirectusClient();
  if (!client) return [];

  try {
    const pages = await client.request(
      readItems("pages", {
        fields: ["permalink", "date_updated"],
        filter: { status: { _eq: "published" } },
        sort: ["permalink"],
      })
    );

    return (pages as Array<{ permalink?: string; date_updated?: string }>)
      .filter((page) => typeof page.permalink === "string" && page.permalink.trim().length > 0)
      .map((page) => ({
        pathname: page.permalink!.startsWith("/") ? page.permalink! : `/${page.permalink}`,
        lastmod: toIsoDate(page.date_updated),
      }));
  } catch (error) {
    // Some deployments may not expose a status field on this collection.
    console.warn("[Sitemap] Skipping CMS page URLs due to CMS error:", error);
    return [];
  }
}

export const GET = async () => {
  const entries = new Map<string, SitemapEntry>();

  const staticPaths = [
    "/",
    "/events",
    "/meetups",
    "/merchants",
    "/nostr",
    "/dcbitdevs",
    "/bookclub",
    "/podcast",
    "/news",
    "/bitplebs",
    "/feeds",
    "/contact",
    "/privacy",
    "/terms",
  ];

  staticPaths.forEach((pathname) => upsertEntry(entries, pathname));

  const [newsResult, podcastResult, bitplebsResult, blogUrls, pageUrls] = await Promise.all([
    getNews(),
    getPodcastEpisodes(),
    getEventsByTag("bitplebs"),
    getPublishedBlogUrls(),
    getPublishedPageUrls(),
  ]);

  if (newsResult.data) {
    newsResult.data.forEach((item) => {
      upsertEntry(
        entries,
        `/news/${getNewsSlug(item)}`,
        toIsoDate(item.date_updated) ?? toIsoDate(item.date) ?? toIsoDate(item.date_created)
      );
    });
  }

  if (podcastResult.data) {
    podcastResult.data.forEach((episode) => {
      const slug = generateSlug(episode.title);
      if (!slug) return;
      upsertEntry(entries, `/podcast/${slug}`, toIsoDate(episode.air_date));
    });
  }

  if (bitplebsResult.data) {
    bitplebsResult.data.forEach((event) => {
      upsertEntry(entries, `/bitplebs/${event.id}`, toIsoDate(event.start_date_time));
    });
  }

  blogUrls.forEach((entry) => upsertEntry(entries, entry.pathname, entry.lastmod));
  pageUrls.forEach((entry) => upsertEntry(entries, entry.pathname, entry.lastmod));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(entries.values())
  .sort((a, b) => a.loc.localeCompare(b.loc))
  .map((entry) => {
    const lastmodTag = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
    return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmodTag}</url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
};
