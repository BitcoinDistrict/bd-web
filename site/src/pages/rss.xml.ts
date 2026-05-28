import rss from "@astrojs/rss";
import { siteConfig } from "../config/site";
import { getEvents, getNews, getPodcastEpisodes } from "../lib/directus";
import {
  applyFeedHeaders,
  getEventFeedItems,
  getFeedCustomData,
  getNewsFeedItems,
  getPodcastFeedItems,
  normalizeFeedItems,
} from "../lib/rss";

export const GET = async () => {
  const [newsResult, eventsResult, podcastResult] = await Promise.all([
    getNews(),
    getEvents(),
    getPodcastEpisodes(),
  ]);

  if (newsResult.error && eventsResult.error && podcastResult.error) {
    return new Response("Error generating RSS feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const mergedItems = normalizeFeedItems([
    ...(newsResult.data ? getNewsFeedItems(newsResult.data) : []),
    ...(eventsResult.data ? getEventFeedItems(eventsResult.data) : []),
    ...(podcastResult.data ? getPodcastFeedItems(podcastResult.data) : []),
  ]);

  return applyFeedHeaders(
    rss({
      title: "Bitcoin District Feed",
      description: "Combined news, events, and podcast updates from Bitcoin District.",
      site: siteConfig.siteUrl,
      xmlns: {
        atom: "http://www.w3.org/2005/Atom",
      },
      customData: getFeedCustomData("/rss.xml"),
      items: mergedItems,
    })
  );
};
