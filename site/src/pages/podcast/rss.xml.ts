import rss from "@astrojs/rss";
import { siteConfig } from "../../config/site";
import { getPodcastEpisodes } from "../../lib/directus";
import {
  applyFeedHeaders,
  getFeedCustomData,
  getPodcastFeedItems,
} from "../../lib/rss";

export const GET = async () => {
  const result = await getPodcastEpisodes();
  if (result.error || !result.data) {
    return new Response("Error generating podcast RSS feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const items = getPodcastFeedItems(result.data);
  return applyFeedHeaders(
    rss({
      title: "Bitcoin District Podcast",
      description: "Podcast episodes from Bitcoin District.",
      site: siteConfig.siteUrl,
      xmlns: {
        atom: "http://www.w3.org/2005/Atom",
      },
      customData: getFeedCustomData("/podcast/rss.xml"),
      items,
    })
  );
};
