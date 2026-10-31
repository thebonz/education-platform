# syntax=docker/dockerfile:1
# HappyClass API – build nhiều stage, chạy bằng user không phải root.
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci -w @happyclass/api --include-workspace-root=false

FROM deps AS build
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npm run prisma:generate && npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci -w @happyclass/api --include-workspace-root=false --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma /app/apps/api/prisma
COPY --chown=node:node apps/api/package.json /app/apps/api/package.json
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# Không tự chạy migration/seed khi khởi động. Dùng service "migrate" và "seed" có chủ đích.
CMD ["node", "dist/main.js"]
