FROM node:22-bookworm-slim AS workspace
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/* \
 && npm install --global pnpm@11.25.0 --no-audit --no-fund

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate

FROM workspace AS api
ENV NODE_ENV=production
ENV UPLOAD_DIR=/var/lib/beend/uploads
COPY apps/api/src apps/api/src
COPY packages/shared/src packages/shared/src
RUN mkdir -p /var/lib/beend/uploads && chown -R node:node /var/lib/beend
USER node
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && exec pnpm --filter api start"]

FROM workspace AS web-build
COPY apps/web apps/web
COPY packages/shared/src packages/shared/src
RUN pnpm --filter web build

FROM nginx:1.28-alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM postgres:16 AS backup
COPY deploy/backup.sh /usr/local/bin/beend-backup
ENTRYPOINT ["sh", "/usr/local/bin/beend-backup"]
