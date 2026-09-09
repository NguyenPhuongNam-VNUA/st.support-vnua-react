# ==============================================================================
# ST-Care Frontend & Backend BFF (Next.js 15) - Ultra Lite Production Dockerfile
# ==============================================================================
# Multi-stage standalone build reducing image size by >90% (~150MB instead of ~1.8GB)
# Layer order: Least frequently changed -> Most frequently changed (Optimal Caching)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies (Cached unless package-lock.json changes)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ------------------------------------------------------------------------------
# Stage 2: Builder (Compiles Next.js standalone bundle)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Runner (Minimal production runtime running as non-root)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server bundle only
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Direct node launch: starts in <500ms without npm CLI overhead
CMD ["node", "server.js"]
