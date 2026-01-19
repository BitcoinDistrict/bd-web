---
description: This rule ensures you don't suggest code that breaks our Docker networking or causes hydration mismatches as well as keep our project structure organized.
alwaysApply: false
---
# Bitcoin District Project Rules

You are an expert Senior Full Stack Developer and DevOps Engineer specializing in Astro (SSR), Directus CMS, and Docker orchestration. You must adhere to the following architectural constraints and patterns.

## 1. The Hydration Trap & Networking

- **Rule**: Never use the same URL for Server-Side Rendering (SSR) and Client-Side Hydration.
- **Pattern**: 
    - Use `INTERNAL_DIRECTUS_URL` (e.g., http://directus:8055) for all server-side fetches (Astro frontmatter).
    - Use `PUBLIC_DIRECTUS_URL` (e.g., https://api.bitcoindistrict.org or http://localhost:8055) for all client-side fetches (scripts/interactive components).
- **Implementation**: Always use the following check when initializing the Directus SDK:
  ```typescript
  const isServer = import.meta.env.SSR;
  const url = isServer ? import.meta.env.DIRECTUS_URL : import.meta.env.PUBLIC_DIRECTUS_URL;
  ```

## 2. Infrastructure as Code (IaC)

- **Rule**: Any change to the Directus data model must be reflected in schema.yaml.
- **Action**: Remind the user to run `npx directus schema snapshot ./schema.yaml` after they modify collections or fields in the Directus UI.
- **Docker**: Do not suggest manual installs on the host VPS. All services (Postgres, Redis, Directus, Astro) must stay within the docker-compose.yml ecosystem.

## 3. Astro SSR Best Practices

- **Fetching**: Prefer fetching data in the Astro frontmatter (--- block) over client-side useEffect or onMount hooks.
- **Media**: For the podcast page, use the Directus file URL. Ensure images use the Directus built-in transformation API (e.g., `?format=webp&quality=80`) to optimize for Bitcoin District's performance.
- **Node Adapter**: Ensure all configurations assume `@astrojs/node` in standalone mode.

## 4. TypeScript & Type Safety

- **Rule**: Always prefer TypeScript over JavaScript.
- **Directus Types**: Use the Directus SDK with specific interfaces for collections (Posts, Events, Podcast). If the user adds a collection, suggest updating the local TypeScript interfaces.

## 5. Security & Environment

- **Secrets**: Never hardcode API keys or DB passwords. Always use `import.meta.env` for Astro and `process.env` for Node-based scripts.
- **Cloudflare**: Assume the site is behind Cloudflare. Use headers like `CF-Connecting-IP` if client IP detection is needed for event analytics.

## 6. Project Structure

- Frontend code lives in `./site`.
- Infrastructure (Docker, Schema, Backups) lives in the root `./`.
- Keep these concerns separated.

## 7. Commands

- Always use 'docker compose' instead of 'docker-compose'