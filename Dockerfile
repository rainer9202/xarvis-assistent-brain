# syntax=docker/dockerfile:1

# Debian-based (not alpine) on purpose: Prisma's query engine needs glibc/openssl,
# and musl (alpine) is a recurring source of native-binary mismatches.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# ---- deps: full dependency graph (needed to compile) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- development: hot-reload target used by docker-compose locally ----
FROM deps AS development
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ---- build: compile TypeScript + generate the Prisma client ----
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN pnpm build

# ---- prod-deps: production-only dependency graph ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- runtime: final image, this is what Dokploy builds and deploys ----
FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Prisma may emit non-.ts assets (query engine binaries) into the generated
# output dir; the compiler only copies .ts -> .js, so copy the generated
# folder over dist explicitly to make sure those assets ship too.
COPY --from=build /app/src/infrastructure/config/database/generated/prisma ./dist/infrastructure/config/database/generated/prisma
COPY package.json ./

USER app
EXPOSE 3000
CMD ["node", "dist/main"]
