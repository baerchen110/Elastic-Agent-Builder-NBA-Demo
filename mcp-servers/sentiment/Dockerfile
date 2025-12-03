# =============================================================================
# Sentiment MCP Server Dockerfile
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built TypeScript output and source
COPY dist ./dist
COPY src ./src
COPY tsconfig.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser && \
    chown -R nodeuser:nodejs /app

USER nodeuser

# Health check - MCP servers communicate via stdio, so we just check the process is alive
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD ps aux | grep -v grep | grep -q node || exit 1

# Start the MCP server with stdin kept open
CMD ["sh", "-c", "tail -f /dev/null | node dist/index.js"]
