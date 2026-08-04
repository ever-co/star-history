FROM node:20-alpine

ARG GIT_COMMIT
LABEL org.opencontainers.image.revision=${GIT_COMMIT}
ENV GIT_COMMIT=${GIT_COMMIT}

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Set working directory
WORKDIR /app

# Copy and install root shared dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Copy and install backend dependencies
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
RUN cd backend && pnpm i

# Copy source code needed for build
COPY shared/ ./shared/
COPY backend/ ./backend/

# Copy gh data (committed in this fork — see ever/seed-gh-data.mjs)
COPY gh/data/repos.json ./gh/data/repos.json

# Ever fork: the per-Host repo allowlist. backend/allowlist.ts resolves this as
# process.cwd()/../ever/allowlist.json, i.e. /app/ever/allowlist.json, since the
# process runs with WORKDIR /app/backend. Override at runtime with ALLOWLIST_FILE.
COPY ever/allowlist.json ./ever/allowlist.json

# Expose port
EXPOSE 8080

# Start the application
WORKDIR /app/backend
CMD ["./node_modules/.bin/tsx", "main.ts"]
