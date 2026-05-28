import rss from "@astrojs/rss";
import { siteConfig } from "../../config/site";
import { getEvents } from "../../lib/directus";
import {
  applyFeedHeaders,
  getEventFeedItems,
  getFeedCustomData,
} from "../../lib/rss";

export const GET = async () => {
  const result = await getEvents();
  if (result.error || !result.data) {
    return new Response("Error generating events RSS feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const items = getEventFeedItems(result.data);
  return applyFeedHeaders(
    rss({
      title: "Bitcoin District Events",
      description: "Upcoming and recent Bitcoin District events.",
      site: siteConfig.siteUrl,
      xmlns: {
        atom: "http://www.w3.org/2005/Atom",
      },
      customData: getFeedCustomData("/events/rss.xml"),
      items,
    })
  );
};
