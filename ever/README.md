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
| `frontend/helpers/brand.ts` | **New.** Per-domain brand (name, tagline, legal site, socials), resolved from `window.location.hostname`. |
| `frontend/helpers/theme.ts` | **New.** Light/dark/system, plus the pre-paint boot script. |
| `frontend/helpers/starData.ts` | **New.** Fetches chart data from our `/api/star-data` instead of GitHub. |
| `frontend/components/BrandLogo.tsx` | **New.** The three brand marks. |
| `frontend/components/ThemeToggle.tsx` | **New.** light → dark → system. |
| `backend/main.ts` | Adds `GET /api/star-data` (allowlisted JSON star data). |
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
| `.github/workflows/ever-refresh-data.yml` | **New.** Daily: re-runs the seed script, commits `gh/data`, dispatches `k8s-build`. See "Data freshness". |
| `shared/common/star-history.ts` | **New.** Exact star curves from GitHub's public `stargazers/history` endpoint. See "GitHub's stargazer restriction". |
| `shared/common/api.tsx` | `getRepoStarRecords()` tries `star-history.ts` first; upstream's sampler is the fallback. |
| `shared/packages/card-landscape1.tsx` | Palette/theme/watermark; the "Weekly" row and contributor count show real counts (`weekly`, `contributors`) instead of percentiles. |
| `frontend/components/LeftSidebar.tsx` | Lists and pyramid show only the current host's org. |
| `frontend/pages/[...slug].tsx` | Prev/next links and "#n of N" stay within the repo's owner; meta description uses real counts. |
| `ever/test/` | **New.** `backend/node_modules/.bin/tsx --test ever/test/*.test.ts` |

## Branding: one build, three brands

The brand is resolved at **runtime** from `window.location.hostname`, so a single image
still serves all three domains — three forks would have tripled CI and the image count just
to change a logo. An inline script in `_document.tsx` stamps `data-brand` and the `dark`
class on `<html>` **before first paint**, so neither the brand nor the theme flashes (this is
a static export; there is no server to negotiate per host).

Consequences worth knowing:

- `NEXT_PUBLIC_API_URL` must stay `same-origin`. Each host has to call **its own** backend
  vhost, because the backend allowlists per `Host`; a baked absolute URL sends ever.works'
  charts at ever.co's vhost and earns a 403.
- Anything that must differ per host has to be **client-side**. The tab title goes through
  `<Head>` off brand state, not `document.title` — Next owns that element and overwrites a
  direct assignment.
- The D3 chart cannot see Tailwind's `dark:` classes (it draws into an SVG), so
  `StarXYChart` mirrors the `dark` class via `MutationObserver` and redraws.

Cloc has no published logo (cloc.com is still the under-construction page), so it gets a
typographic mark — swap it in `BrandLogo.tsx` when brand assets exist. Its legal links point
at ever.co for the same reason.

## No visitor token, ever

Upstream calls the GitHub API **from the browser** with a token the visitor pastes in. An
anonymous visitor gets 60 requests/hour, which one chart exceeds, so the first load showed
"Access Token Unauthorized" and no chart — fatal for a page linked from public READMEs.

`GET /api/star-data?repos=…` serves that data from our PATs instead, under the same
allowlist, sharing the 24h cache that backs `/svg`. The token dialog is gone because the
condition that raised it cannot occur. A 403 from this endpoint now means "not allowlisted
on this host", never "paste a token".

> 🛑 The Ingress must route **`/api`** to the backend alongside `/svg` and `/healthz`. Without
> it those calls fall through to the static frontend and return **HTML**, so the chart
> silently fails while the badge endpoint still looks healthy.

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
| `NEXT_PUBLIC_ENABLE_BLOG` | frontend build | `true` restores upstream's 92 blog posts. Off by default: they are star-history.com's editorial content and duplicate their pages on our domains. |

`NEXT_PUBLIC_API_URL=same-origin` is load-bearing. One static build serves all three hostnames,
and each must call **its own** backend vhost, because the backend allowlists per `Host`. A baked
absolute API URL would send `ever.works` charts at `ever.co`'s vhost and collect a 403.

`NEXT_PUBLIC_SITE_URL` can only hold one value for a shared build, so it points at
`stats-github.ever.co`. It only feeds canonical/OG tags and the sitemap, never chart rendering.

## Data freshness

The repo pages (`/owner/repo`), the home sidebar and the OG cards read `gh/data/*.json`,
which is **baked into both images at build time**. Charts (`/svg`, `/api/star-data`) are
live (24h cache); those files are not. They were generated once by hand on 2026-08-04 and
never again, so in October the ever-gauzy page still said **4.1k stars** while the chart
beside it said 8.4k.

`.github/workflows/ever-refresh-data.yml` now re-runs `ever/seed-gh-data.mjs` daily
(04:23 UTC) with CI's own `GITHUB_TOKEN`, commits `gh/data` (daily in practice: the files carry
`updated_at`) and dispatches `k8s-build` (a `GITHUB_TOKEN` push does not trigger workflows; a dispatch does).
Pages are therefore at most ~1 day old. Run it by hand from the Actions tab after adding a
repo to the allowlist.

The seed script fails the run instead of committing partial data when a public repo does not
resolve, keeps the previous run's value for a metric that fails (and fails the run when there
is none) so a flaky request never publishes a 0, and skips private repos even when the token
can see them, because this data is public.

What the card shows: `rank` / `total_repos` and the radar's percentiles are computed
**within the repo's owner** (each host serves one owner). `weekly` holds the real
last-7-days counts (stars, commits, issues closed) and `contributors_count` the real
contributor count; upstream prints the percentiles in those places.

## GitHub's stargazer restriction (July 2026) and the new history endpoint

- **June 30 / July 2026:** GitHub limited `GET /repos/{o}/{r}/stargazers`, the per-user list
  upstream's chart code samples, to the repo's own **admins and collaborators**. Everyone
  else gets **404**. This instance kept working only because our PAT is an admin on our repos.
- **2026-09-04:** GitHub added `GET /repos/{o}/{r}/stargazers/history`: public, no
  identities, stars per calendar week with a Sunday-first per-day breakdown, newest week
  first, 30 weeks a page, back to the repo's creation. star-history.com's hosted site was
  rebuilt on it, which is why it no longer asks for a token. Its open-source code (this
  fork's upstream) still uses the sampler.

`shared/common/star-history.ts` uses the history endpoint, so our curves are **exact**
(they end on the repo's live star count) and need no collaborator access. A chart costs
about `age / 30 weeks` requests (13 for ever-gauzy). Not-found, auth and rate-limit errors
propagate exactly as before; anything else falls back to the sampler. The endpoint counts
stars that still exist, so curves never go down.

## Syncing upstream

```bash
git remote add upstream https://github.com/star-history/star-history.git
git fetch upstream && git merge upstream/main
```

Conflicts should be confined to the files in the table above. Re-run the seed script afterwards
if `gh/` changed.
