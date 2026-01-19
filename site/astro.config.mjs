import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',  // SSR mode
  adapter: node({
    mode: 'standalone'  // Self-contained Node server
  }),
  integrations: [
    tailwind({
      applyBaseStyles: false,  // We'll manage base styles ourselves
    })
  ],
  image: {
    // Allow remote images from Directus
    // This is required for Astro's <Image> component to process remote URLs
    domains: [
      'localhost',
      'directus',  // Internal Docker service name (for SSR)
      'api.bitcoindistrict.org',  // Production domain
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'directus',
      },
      {
        protocol: 'https',
        hostname: 'api.bitcoindistrict.org',
      },
    ],
  },
});