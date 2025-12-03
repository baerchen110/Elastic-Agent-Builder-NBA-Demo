# =============================================================================
# Next.js Frontend Dockerfile
# =============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy all dependencies (including devDependencies for build)
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create stub directory for MCP aggregator to satisfy imports during build
RUN mkdir -p backend/mcp-aggregator/dist && \
    echo 'export function getAggregator() { throw new Error("MCP Aggregator not available in Docker mode. Use backend service instead."); }' > backend/mcp-aggregator/dist/index.js

# Build Next.js application
ENV SKIP_ENV_VALIDATION=true
ENV NODE_ENV=production
RUN npm run build

# Prune to production dependencies only
RUN npm prune --production

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["npm", "start"]
