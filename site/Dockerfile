# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Declare build arguments for PUBLIC_ variables that Astro needs at build time
ARG PUBLIC_CMS_ENABLED
ARG PUBLIC_DIRECTUS_URL
ARG DIRECTUS_URL
ARG DIRECTUS_STATIC_TOKEN

# Set them as environment variables so they're available during build
ENV PUBLIC_CMS_ENABLED=$PUBLIC_CMS_ENABLED
ENV PUBLIC_DIRECTUS_URL=$PUBLIC_DIRECTUS_URL
ENV DIRECTUS_URL=$DIRECTUS_URL
ENV DIRECTUS_STATIC_TOKEN=$DIRECTUS_STATIC_TOKEN

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the Astro application
RUN npm run build

# Production stage
FROM node:20-slim AS production
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage (includes standalone Node server)
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4321

# Set environment variable for host
ENV HOST=0.0.0.0
ENV PORT=4321

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4321', (r) => {if (r.statusCode >= 200 && r.statusCode < 500) process.exit(0); else process.exit(1);})"

# Start the built Node server directly (SSR production)
CMD ["node", "./dist/server/entry.mjs"]

# Development stage (used by docker-compose.yml)
FROM node:20-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host"]