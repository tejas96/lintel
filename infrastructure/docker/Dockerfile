# Multi-stage build for the Lintel API, worker, web app and migration job.
#   docker build -f infrastructure/docker/Dockerfile --target api -t lintel-api .
# Temporal's native worker needs glibc, so the base is Debian slim, not Alpine.
ARG NODE_IMAGE=node:22.22.3-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN NEXT_OUTPUT=standalone pnpm turbo run build --filter=@lintel/api... --filter=@lintel/worker... --filter=@lintel/web...
# Self-contained production folders with only runtime dependencies.
RUN pnpm deploy --filter=@lintel/api --prod --legacy /out/api \
 && pnpm deploy --filter=@lintel/worker --prod --legacy /out/worker \
 && pnpm deploy --filter=@lintel/database --prod --legacy /out/migrate

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM runtime AS api
COPY --from=build --chown=node:node /out/api ./
EXPOSE 4100
CMD ["node", "--enable-source-maps", "dist/main.js"]

FROM runtime AS worker
COPY --from=build --chown=node:node /out/worker ./
CMD ["node", "--enable-source-maps", "dist/main.js"]

FROM runtime AS migrate
COPY --from=build --chown=node:node /out/migrate ./
CMD ["node", "dist/migrate.cli.js"]

FROM runtime AS web
# Next.js standalone output (apps/web/next.config: output: 'standalone').
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
ENV PORT=3100 HOSTNAME=0.0.0.0
EXPOSE 3100
CMD ["node", "apps/web/server.js"]
