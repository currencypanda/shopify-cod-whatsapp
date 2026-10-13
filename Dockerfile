# -----------------------------------------------------------------------------
# Stage 1: Build Environment
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Copy Prisma schema and generate Prisma clients
COPY prisma ./prisma/
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npx prisma generate --schema=prisma/schema.postgresql.prisma

# Copy application source code and build Remix production bundle
COPY . .
RUN npm run build

# Prune development dependencies for compact production footprint
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl curl wget ca-certificates

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts and runtime dependencies from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Production Healthcheck Probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start production server
CMD ["npm", "run", "start"]
