# Frontend image for the Ever self-hosted star-history instance.
#
# Rewritten from upstream's version, which could not build: it ran
# `pnpm i --frozen-lockfile --prod` (dropping the devDependencies that `next build`
# needs) and then `node server.js`, a file this project does not produce — because
# next.config.js sets output: "export", so the build emits a static site in
# frontend/out.
#
# BUILD CONTEXT IS THE REPO ROOT, not frontend/ — the frontend imports @shared
# (../shared) and @gh-data (../gh/data) through next.config.js aliases.

FROM node:22-alpine AS build
WORKDIR /app

ARG GIT_COMMIT
# Same-origin so ONE build can serve all three hostnames, each hitting its own
# backend vhost. See frontend/helpers/consts.tsx.
ARG NEXT_PUBLIC_API_URL=same-origin
ARG NEXT_PUBLIC_SITE_URL=https://stats-github.ever.co
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Root workspace holds the shared deps (axios, d3, dayjs, lodash).
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Frontend deps first, so source edits don't re-run the install layer.
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm i --frozen-lockfile

# Sources the next.config.js aliases point at.
COPY shared/ ./shared/
COPY gh/data/ ./gh/data/
COPY frontend/ ./frontend/

RUN cd frontend && pnpm build

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source=https://github.com/ever-co/star-history
ARG GIT_COMMIT
LABEL org.opencontainers.image.revision=${GIT_COMMIT}

COPY --from=build /app/frontend/out /usr/share/nginx/html
COPY ever/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
