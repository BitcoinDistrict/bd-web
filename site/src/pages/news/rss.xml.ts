import rss from "@astrojs/rss";
import { siteConfig } from "../../config/site";
import { getNews } from "../../lib/directus";
import {
  applyFeedHeaders,
  getFeedCustomData,
  getNewsFeedItems,
} from "../../lib/rss";

export const GET = async () => {
  const result = await getNews();
  if (result.error || !result.data) {
    return new Response("Error generating news RSS feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const items = getNewsFeedItems(result.data);
  return applyFeedHeaders(
    rss({
      title: "Bitcoin District News",
      description: "Official news and updates from Bitcoin District.",
      site: siteConfig.siteUrl,
      xmlns: {
        atom: "http://www.w3.org/2005/Atom",
      },
      customData: getFeedCustomData("/news/rss.xml"),
      items,
    })
  );
};
