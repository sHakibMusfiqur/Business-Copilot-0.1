FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY packages/types/package.json ./packages/types/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
RUN npm ci --workspace=apps/api --include-workspace-root

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
RUN mkdir -p /app/uploads/settings /app/uploads/imports && chown -R nestjs:nodejs /app/uploads

USER nestjs
EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
