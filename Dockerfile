FROM node:22.22.2-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/safety/package.json packages/safety/package.json
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Docker Desktop's Linux VM can crash V8's optimizing compiler while TypeScript emits.
# Limit --jitless to TypeScript only: Prisma's generator requires WebAssembly.
ENV NODE_OPTIONS=--jitless
RUN npm run build --workspace @xinyu/contracts
RUN npm run build --workspace @xinyu/config
RUN npm run build --workspace @xinyu/ai
RUN npm run build --workspace @xinyu/safety
ENV NODE_OPTIONS=
RUN npm exec --workspace @xinyu/api prisma -- generate --schema prisma/schema.prisma
ENV NODE_OPTIONS=--jitless
RUN npm run build --workspace @xinyu/api
ENV NODE_OPTIONS=
RUN npm run build --workspace @xinyu/web -- --webpack

FROM build AS migrate
WORKDIR /app
ENV NODE_ENV=production

FROM node:22.22.2-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
RUN npm prune --omit=dev
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM node:22.22.2-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages ./packages
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
