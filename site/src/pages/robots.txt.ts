import { siteConfig } from "../config/site";

export const GET = async () => {
  const sitemapUrl = new URL("/sitemap.xml", siteConfig.siteUrl).toString();

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
};
