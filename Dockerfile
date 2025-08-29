# Use the official Node.js runtime as the base image
FROM node:20-alpine AS base

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S geminibot -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (skip prepare scripts like husky)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built application from base stage
COPY --from=base --chown=geminibot:nodejs /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R geminibot:nodejs logs

# Switch to non-root user
USER geminibot

# Expose health check port
EXPOSE 3001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]