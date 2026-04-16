FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS backend-deps
COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM base AS runner
COPY --from=backend-deps /app/node_modules ./backend/node_modules
COPY backend/ ./backend/

EXPOSE 6088
ENV PORT=6088
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["bun", "run", "src/server.ts"]
