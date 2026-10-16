#!/usr/bin/env node
/**
 * Generate gh/data/*.json for the Ever self-hosted star-history instance.
 *
 * Upstream builds these four files from a BigQuery pipeline over all of GitHub
 * (gh/star-fetch.ts + gh/star-generate.ts). We serve only our own repos, so the
 * global leaderboard is both unavailable to us and meaningless here. This script
 * builds the same four files straight from the GitHub REST API, scoped to the
 * repos in ever/allowlist.json:
 *
 *   repos.json          - per-repo cards (drives /[owner]/[repo] pages + autocomplete)
 *   leaderboard.json    - all-time star ranking across our repos
 *   weekly-ranking.json - new stars in the last 7 days
 *   star-count.json     - star-tier pyramid
 *
 * Run: GITHUB_TOKEN=<pat> node ever/seed-gh-data.mjs
 * Runs DAILY in CI (.github/workflows/ever-refresh-data.yml), which commits the result
 * and rebuilds the images — the pages bake this data in at build time, so without
 * that job every number on them freezes at the day this was last run by hand.
 *
 * Ranks and percentiles are WITHIN each GitHub owner (one owner per host), never across
 * hosts: stats-github.ever.co ranks the ever-co repos, not ever-works'.
 * Any public-repo token works, including CI's own GITHUB_TOKEN: nothing here needs
 * collaborator access since stars come from the public stargazers/history endpoint.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DATA_DIR = join(ROOT, "gh", "data");

const TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_TOKENS || "";
if (!TOKEN) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const NOW = new Date();
const updated_at = NOW.toISOString().slice(0, 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const gh = async (path, { accept = "application/vnd.github+json", raw = false } = {}) => {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `token ${TOKEN}`, Accept: accept, "User-Agent": "ever-star-history-seed" },
    });
    // /stats/* endpoints return 202 while GitHub computes the series.
    if (res.status === 202) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    // Primary or secondary rate limit (search allows 30/min): wait it out, capped, then retry.
    if ((res.status === 403 || res.status === 429) &&
        (res.headers.get("retry-after") || res.headers.get("x-ratelimit-remaining") === "0")) {
      const retryAfter = Number(res.headers.get("retry-after")) * 1000;
      const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
      const wait = Math.min(Math.max(retryAfter || reset || 0, 1000) + 1000, 70_000);
      console.warn(`  … rate-limited on ${url}, waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const err = new Error(`${res.status} ${res.statusText} for ${url}`);
      err.status = res.status;
      throw err;
    }
    return raw ? res : res.json();
  }
  throw new Error(`gave up waiting on ${url}`);
};

const lastPageOf = (res) => {
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(res.headers.get("link") || "");
  return m ? Number(m[1]) : 1;
};

/** Total item count for a paginated endpoint, read from the Link rel="last" header. */
const countViaLastPage = async (path, accept) => {
  const res = await gh(`${path}${path.includes("?") ? "&" : "?"}per_page=1`, { accept, raw: true });
  const link = res.headers.get("link");
  if (link) {
    const last = /[?&]page=(\d+)>; rel="last"/.exec(link);
    if (last) return Number(last[1]);
  }
  const body = await res.json();
  return Array.isArray(body) ? body.length : 0;
};

/**
 * Every day of a repo's star history, oldest first: [{ t: ms, n: stars that day }].
 * From GET /repos/{repo}/stargazers/history (public since 2026-09-04): weeks, newest first,
 * 30 a page, each with a Sunday-first `days` array. Days after now are dropped.
 */
const starHistoryDays = async (repo) => {
  const first = await gh(`/repos/${repo}/stargazers/history?per_page=30`, { raw: true });
  const pages = Math.min(lastPageOf(first), 100);
  const weeks = [...(await first.json())];
  for (let page = 2; page <= pages; page++) {
    weeks.push(...(await gh(`/repos/${repo}/stargazers/history?per_page=30&page=${page}`)));
  }
  const days = [];
  for (const w of weeks.sort((a, b) => a.week - b.week)) {
    w.days.forEach((n, d) => {
      const t = w.week * 1000 + d * DAY_MS;
      if (t <= NOW.getTime()) days.push({ t, n: Number(n) || 0 });
    });
  }
  return days;
};

const starsSince = (days, ms) => days.filter((d) => d.t >= NOW.getTime() - ms).reduce((s, d) => s + d.n, 0);

/**
 * Fallback only: stars in the last 7 days from the final page of the stargazer LIST.
 * GitHub restricted that list to the repo's admins/collaborators in July 2026 (CI's
 * GITHUB_TOKEN gets 404), and one page holds at most 100, so this undercounts any week
 * above 100 stars.
 */
const newStarsLastWeekFromList = async (repo) => {
  const accept = "application/vnd.github.star+json";
  const first = await gh(`/repos/${repo}/stargazers?per_page=100`, { accept, raw: true });
  const link = first.headers.get("link");
  let page = await first.json();
  const lastMatch = link && /[?&]page=(\d+)>; rel="last"/.exec(link);
  if (lastMatch) {
    page = await gh(`/repos/${repo}/stargazers?per_page=100&page=${lastMatch[1]}`, { accept });
  }
  const cutoff = NOW.getTime() - WEEK_MS;
  return page.filter((s) => s.starred_at && new Date(s.starred_at).getTime() >= cutoff).length;
};

/** New stars over the last 7 days and the last 8 weeks. */
const newStars = async (repo) => {
  try {
    const days = await starHistoryDays(repo);
    return { week: starsSince(days, WEEK_MS), eightWeeks: starsSince(days, 8 * WEEK_MS) };
  } catch (err) {
    console.warn(`  ! stargazers/history for ${repo}: ${err.message} — trying the stargazer list`);
    const week = await newStarsLastWeekFromList(repo);
    return { week, eightWeeks: week };
  }
};

const issuesClosedSince = async (repo, sinceISO) => {
  const q = encodeURIComponent(`repo:${repo} is:issue is:closed closed:>=${sinceISO}`);
  const res = await gh(`/search/issues?q=${q}&per_page=1`);
  return res.total_count ?? 0;
};

/**
 * Issues (not PRs) closed in the last 7 days, via the issues LIST rather than search, so
 * the run stays inside search's 30 requests/minute. `since` filters on updated_at, which
 * every close bumps, so filtering on closed_at afterwards is exact.
 */
const issuesClosedLastWeek = async (repo) => {
  const sinceISO = new Date(NOW.getTime() - WEEK_MS).toISOString();
  let count = 0;
  for (let page = 1; page <= 10; page++) {
    const items = await gh(`/repos/${repo}/issues?state=closed&since=${sinceISO}&per_page=100&page=${page}`);
    count += items.filter((i) => !i.pull_request && i.closed_at && i.closed_at >= sinceISO).length;
    if (items.length < 100) break;
  }
  return count;
};

/** Commits in the latest week and over the last 8 (stats/participation, oldest week first). */
const commits = async (repo) => {
  const all = (await gh(`/repos/${repo}/stats/participation`))?.all;
  if (!Array.isArray(all)) throw new Error("no participation series");
  return { week: all.at(-1) ?? 0, eightWeeks: all.slice(-8).reduce((n, v) => n + v, 0) };
};

// The previous run's output. A metric that fails today keeps yesterday's value instead of
// becoming a confident 0 on a public page; with nothing to keep, the run fails and commits
// nothing (the pages stay one day older, which is honest).
const previous = new Map();
try {
  for (const r of JSON.parse(readFileSync(join(DATA_DIR, "repos.json"), "utf-8")).repos ?? []) {
    previous.set(r.name.toLowerCase(), r);
  }
} catch {
  // first run: nothing to carry forward
}

const isCount = (v) => typeof v === "number" && Number.isFinite(v);
const metric = async (repo, label, fetchIt, kept) => {
  try {
    return await fetchIt();
  } catch (err) {
    const usable = kept !== undefined && (typeof kept === "object" ? Object.values(kept).every(isCount) : isCount(kept));
    if (!usable) throw new Error(`${label} for ${repo}: ${err.message} (no previous value to keep)`);
    console.warn(`  ! ${label} for ${repo}: ${err.message} — keeping the previous value ${JSON.stringify(kept)}`);
    return kept;
  }
};

// --- collect the allowlisted repos (union across hosts, deduped) ---------------

const allowlist = JSON.parse(readFileSync(join(HERE, "allowlist.json"), "utf-8"));
const wanted = [...new Set(Object.values(allowlist.hosts ?? {}).flat().map((r) => r.trim()))]
  .filter((r) => !r.endsWith("/*"));

console.log(`Seeding gh/data from ${wanted.length} allowlisted repos…`);

const collected = [];
for (const name of wanted) {
  process.stdout.write(`  ${name} … `);
  let meta;
  try {
    meta = await gh(`/repos/${name}`);
  } catch (err) {
    // A private repo (e.g. cloc-co/zero before it is opened) simply isn't in the UI yet.
    // Anything else (5xx, network) must FAIL the run: skipping it would drop the repo's
    // page from the next build, and CI would commit that as if it were real.
    if (err.status === 404) {
      console.log(`skipped (${err.message})`);
      continue;
    }
    console.log("failed");
    throw err;
  }
  // A token that CAN see a private repo (a maintainer's own PAT) must not publish it: this
  // data is baked into public pages. CI's GITHUB_TOKEN gets the 404 above instead.
  if (meta.private) {
    console.log("skipped (private)");
    continue;
  }
  const sinceISO = new Date(NOW.getTime() - 8 * WEEK_MS).toISOString().slice(0, 10);
  const prev = previous.get(name.toLowerCase());
  const [stars, contributors, issues_closed, issues_closed_week, pushes] = await Promise.all([
    metric(name, "new stars", () => newStars(name),
      prev && { week: prev.weekly?.new_stars, eightWeeks: prev.window_8w?.new_stars }),
    metric(name, "contributors", () => countViaLastPage(`/repos/${name}/contributors`), prev?.contributors_count),
    metric(name, "issues closed (8 weeks)", () => issuesClosedSince(name, sinceISO), prev?.window_8w?.issues_closed),
    metric(name, "issues closed (week)", () => issuesClosedLastWeek(name), prev?.weekly?.issues_closed),
    metric(name, "commits", () => commits(name),
      prev && { week: prev.weekly?.pushes, eightWeeks: prev.window_8w?.pushes }),
  ]);

  collected.push({
    name: meta.full_name,
    owner: meta.owner.login,
    stars_total: meta.stargazers_count,
    description: meta.description ?? null,
    language: meta.language ?? null,
    topics: meta.topics ?? [],
    license: meta.license?.spdx_id ?? null,
    homepage: meta.homepage || null,
    forks_count: meta.forks_count,
    open_issues_count: meta.open_issues_count,
    created_at: meta.created_at ?? null,
    archived: Boolean(meta.archived),
    size: meta.size,
    // Raw counts for the card's "Weekly" row. Upstream prints the percentiles below
    // under that label, which read as "100 stars this week" for whichever repo led.
    weekly: { new_stars: stars.week, pushes: pushes.week, issues_closed: issues_closed_week },
    contributors_count: contributors,
    // 8-week aggregates: the window upstream's percentiles use, kept so a failed metric
    // can carry forward next run.
    window_8w: { new_stars: stars.eightWeeks, pushes: pushes.eightWeeks, issues_closed },
    _raw: { stars: meta.stargazers_count, new_stars: stars.eightWeeks, pushes: pushes.eightWeeks, contributors, issues_closed, forks: meta.forks_count },
  });
  console.log(`${meta.stargazers_count}★ (+${stars.week}/wk)`);
}

if (collected.length === 0) {
  console.error("No repos resolved — refusing to write empty data files");
  process.exit(1);
}

// --- rank + percentile WITHIN each owner --------------------------------------
// Each host serves exactly one owner, so ranking across owners put ever-works repos into
// stats-github.ever.co's "#n of 20" and its prev/next links.

collected.sort((a, b) => b.stars_total - a.stars_total);

const METRICS = ["stars", "new_stars", "pushes", "contributors", "issues_closed", "forks"];
const percentile = (ascending, value) => {
  if (ascending.length === 0) return 0;
  const below = ascending.filter((v) => v <= value).length;
  return Math.round((below / ascending.length) * 100);
};

const byOwner = new Map();
for (const r of collected) {
  const key = r.owner.toLowerCase();
  if (!byOwner.has(key)) byOwner.set(key, []);
  byOwner.get(key).push(r);
}

const cards = new Map();
for (const group of byOwner.values()) {
  const sorted = Object.fromEntries(
    METRICS.map((m) => [m, group.map((r) => r._raw[m]).sort((a, b) => a - b)])
  );
  group.forEach((r, i) => {
    const { _raw, ...card } = r;
    cards.set(r.name, {
      ...card,
      rank: i + 1,
      total_repos: group.length,
      attributes: Object.fromEntries(METRICS.map((m) => [m, percentile(sorted[m], _raw[m])])),
    });
  });
}
const repos = collected.map((r) => cards.get(r.name));

// --- star-count pyramid -------------------------------------------------------
// Thresholds kept only where they actually bucket one of our repos, so the pyramid
// never renders a run of empty tiers. The sidebar recounts these per host.
const TIERS = [
  { threshold: 0, label: "all" },
  { threshold: 10, label: "10+" },
  { threshold: 100, label: "100+" },
  { threshold: 500, label: "500+" },
  { threshold: 1000, label: "1k+" },
  { threshold: 2000, label: "2k+" },
  { threshold: 4000, label: "4k+" },
  { threshold: 8000, label: "8k+" },
];
const tiers = TIERS.map((t) => ({
  ...t,
  count: repos.filter((r) => r.stars_total >= t.threshold).length,
})).filter((t) => t.threshold === 0 || t.count > 0);

mkdirSync(DATA_DIR, { recursive: true });
const write = (file, data) => {
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2) + "\n");
  console.log(`  wrote gh/data/${file}`);
};

write("repos.json", { min_stars: Math.min(...repos.map((r) => r.stars_total)), repos });
write("leaderboard.json", {
  updated_at,
  repos: repos.map((r) => ({ name: r.name, stars_total: r.stars_total })),
});
write("weekly-ranking.json", {
  updated_at,
  repos: repos
    .map((r) => ({ name: r.name, new_stars: r.weekly.new_stars, stars_total: r.stars_total }))
    .sort((a, b) => b.new_stars - a.new_stars),
});
write("star-count.json", { updated_at, tiers });

console.log(`Done — ${repos.length} repos seeded.`);
