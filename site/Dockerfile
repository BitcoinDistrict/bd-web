# Build stage
FROM node:20-slim AS builder
WORKDIR /app

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

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4321', (r) => {if (r.statusCode === 200) process.exit(0); else process.exit(1);})"

# Start the application in preview mode (SSR production)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]

# Development stage (used by docker-compose.yml)
FROM node:20-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host"]