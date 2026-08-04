# Ever fork of star-history

This fork exists to run star-history **on our own infrastructure, on our own GitHub PATs,
answering only for our own repos**. Everything Ever-specific lives in this `ever/` directory;
changes to upstream files are small, commented with `Ever fork:`, and additive — with the
allowlist unset and the `NEXT_PUBLIC_*` build args unset, this repo behaves exactly like
upstream.

Deployed at:

| Host | Serves |
|---|---|
| `stats-github.ever.co` | the 5 `ever-co` product repos |
| `stats-github.ever.works` | the 15 `ever-works` repos |
| `stats-github.cloc.com` | `cloc-co/zero` (activates when that repo goes public) |

One namespace (`star-history-prod` on `ever-k8s`), one Deployment pair, three Ingress hosts.

## Why a self-hosted instance at all

The public `api.star-history.com` is a shared free service: it rate-limits, it can be slow or
down, and every README badge in our orgs depended on it. Running our own instance means our
badges are backed by our own PAT quota and our own uptime.

## What changed vs upstream

| File | Change |
|---|---|
| `ever/allowlist.json` | **New.** The canonical per-Host repo allowlist. |
| `ever/seed-gh-data.mjs` | **New.** Builds `gh/data/*.json` from the allowlist via the GitHub REST API, replacing upstream's BigQuery pipeline (which we have no access to). |
| `ever/nginx.conf` | **New.** Serves the frontend's static export. |
| `backend/allowlist.ts` | **New.** Loads the allowlist and answers "may this Host see this repo". |
| `backend/main.ts` | Allowlist gate on `/svg`; allowlist status in `/healthz`; `PORT` is configurable; `Cache-Control` derives from the cache TTL. |
| `backend/cache.ts` | Cache TTL configurable via `CACHE_TTL_SECONDS`, with a **1 hour floor**. Default is unchanged at 24h. |
| `backend/token.ts` | Token file parsing tolerates trailing newlines, CRLF, blank lines and `#` comments. |
| `backend/Dockerfile` | Also copies `ever/allowlist.json`. |
| `frontend/Dockerfile` | **Rewritten** — see below. |
| `frontend/helpers/consts.tsx` | `SITE_URL` / `API_URL` are build-time configurable; adds `absoluteApiUrl()`. |
| `frontend/components/EmbedMarkdownSection.tsx` | Uses `absoluteApiUrl()` so copied embed snippets stay absolute. |
| `frontend/next-sitemap.config.js` | `siteUrl` follows `NEXT_PUBLIC_SITE_URL`. |
| `.dockerignore` | **New.** See below. |
| `.gitignore` | `gh/data/*.json` is now committed (we generate it, upstream doesn't). |
| `.github/workflows/k8s-build.yml` | **New.** Fleet-standard build to GHCR. |

### Two upstream bugs fixed on the way

1. **`frontend/Dockerfile` could not build.** It ran `pnpm i --frozen-lockfile --prod`, which
   drops the devDependencies `next build` needs, then `CMD ["node", "server.js"]` — a file this
   project never produces, because `next.config.js` sets `output: "export"`. Rewritten as a
   two-stage build (node → static export → nginx), with the build context at the **repo root**,
   which it has to be: the frontend resolves `@shared` → `../shared` and `@gh-data` → `../gh/data`.
2. **No `.dockerignore`.** `COPY backend/ ./backend/` and `COPY frontend/ ./frontend/` land
   *after* the `pnpm i` layers, so a developer's local `node_modules` overwrote the ones the
   image had just installed. With pnpm's symlink store that fails outright
   (`cannot copy to non-directory: .../node_modules/@eslint/eslintrc`); when it doesn't fail it
   silently ships host-built native modules into a linux image.

## The allowlist

`ever/allowlist.json` maps **Host → allowed repos**. The gate runs in `/svg` before any cache
lookup, GitHub call or render, so a rejected repo can never consume our PAT quota or land in the
cache. Rules:

- Matching is case-insensitive; `owner/*` wildcards work.
- A Host that isn't listed falls back to `default`, which is empty → **fails closed**.
- **Every** repo in a multi-repo request must be allowed, or the whole request is rejected.
- Corrupt JSON refuses to start rather than falling open.
- No allowlist file at all → allowlist disabled, upstream behaviour.

Editing the allowlist needs an image rebuild, because the UI's leaderboard and autocomplete are
baked at build time from the same file. For an emergency runtime-only change, point
`ALLOWLIST_FILE` at a mounted ConfigMap.

After changing the repo list, regenerate the UI data:

```bash
GITHUB_TOKEN=<pat-with-public_repo> node ever/seed-gh-data.mjs
```

Repos the token cannot see are skipped with a warning rather than failing the run — that is how
`cloc-co/zero` behaves while it is still private.

## Configuration

| Variable | Where | Meaning |
|---|---|---|
| `ENVPATH` | backend | Path to the token file, one PAT per line. |
| `ALLOWLIST_FILE` | backend | Override the allowlist path. |
| `CACHE_TTL_SECONDS` | backend | Cache TTL and emitted `max-age`. Floor 3600, default 86400. |
| `PORT` | backend | Listen port, default 8080. |
| `NEXT_PUBLIC_API_URL` | frontend build | `same-origin` in our deployment — see below. |
| `NEXT_PUBLIC_SITE_URL` | frontend build | Canonical/OG/sitemap origin. |

`NEXT_PUBLIC_API_URL=same-origin` is load-bearing. One static build serves all three hostnames,
and each must call **its own** backend vhost, because the backend allowlists per `Host`. A baked
absolute API URL would send `ever.works` charts at `ever.co`'s vhost and collect a 403.

`NEXT_PUBLIC_SITE_URL` can only hold one value for a shared build, so it points at
`stats-github.ever.co`. It only feeds canonical/OG tags and the sitemap, never chart rendering.

## Syncing upstream

```bash
git remote add upstream https://github.com/star-history/star-history.git
git fetch upstream && git merge upstream/main
```

Conflicts should be confined to the files in the table above. Re-run the seed script afterwards
if `gh/` changed.
