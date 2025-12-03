# =============================================================================
# MCP Aggregator Dockerfile (with integrated Sentiment MCP)
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /build

# Build MCP Aggregator
COPY backend/mcp-aggregator/package*.json ./aggregator/
WORKDIR /build/aggregator
RUN npm ci

COPY backend/mcp-aggregator/src ./src
COPY backend/mcp-aggregator/tsconfig.json ./
RUN npm run build

# Build Sentiment MCP Server
WORKDIR /build/sentiment
COPY mcp-servers/sentiment/package*.json ./
RUN npm ci

COPY mcp-servers/sentiment/src ./src
COPY mcp-servers/sentiment/tsconfig.json ./
RUN npm run build

# =============================================================================
# Production Image
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install production dependencies for aggregator
COPY backend/mcp-aggregator/package*.json ./
RUN npm ci --only=production

# Copy aggregator built output
COPY --from=builder /build/aggregator/dist ./dist
COPY backend/mcp-aggregator/src ./src
COPY backend/mcp-aggregator/tsconfig.json ./

# Create MCP servers directory
RUN mkdir -p /app/mcp-servers/sentiment/dist

# Copy built sentiment MCP server
COPY --from=builder /build/sentiment/dist /app/mcp-servers/sentiment/dist
COPY --from=builder /build/sentiment/package*.json /app/mcp-servers/sentiment/

# Install MCP server dependencies
WORKDIR /app/mcp-servers/sentiment
RUN npm ci --only=production

# Back to app root
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser && \
    chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "console.log('MCP Aggregator healthy')"

# Start the HTTP server
CMD ["node", "dist/http-server.js"]
