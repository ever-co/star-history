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
 * Ranks/percentiles are WITHIN the Ever set, not against all of GitHub.
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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = new Date();
const updated_at = NOW.toISOString().slice(0, 10);

const gh = async (path, { accept = "application/vnd.github+json", raw = false } = {}) => {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `token ${TOKEN}`, Accept: accept, "User-Agent": "ever-star-history-seed" },
    });
    // /stats/* endpoints return 202 while GitHub computes the series.
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return raw ? res : res.json();
  }
  throw new Error(`gave up waiting on ${url}`);
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

/** Stars gained in the last 7 days, counted from the final page of stargazers. */
const newStarsLastWeek = async (repo) => {
  const accept = "application/vnd.github.star+json";
  try {
    const first = await gh(`/repos/${repo}/stargazers?per_page=100`, { accept, raw: true });
    const link = first.headers.get("link");
    let page = await first.json();
    const lastMatch = link && /[?&]page=(\d+)>; rel="last"/.exec(link);
    if (lastMatch) {
      page = await gh(`/repos/${repo}/stargazers?per_page=100&page=${lastMatch[1]}`, { accept });
    }
    const cutoff = NOW.getTime() - WEEK_MS;
    return page.filter((s) => s.starred_at && new Date(s.starred_at).getTime() >= cutoff).length;
  } catch (err) {
    console.warn(`  ! new_stars for ${repo}: ${err.message} — recording 0`);
    return 0;
  }
};

const issuesClosedSince = async (repo, sinceISO) => {
  try {
    const q = encodeURIComponent(`repo:${repo} is:issue is:closed closed:>=${sinceISO}`);
    const res = await gh(`/search/issues?q=${q}&per_page=1`);
    return res.total_count ?? 0;
  } catch (err) {
    console.warn(`  ! issues_closed for ${repo}: ${err.message} — recording 0`);
    return 0;
  }
};

const pushesLast8Weeks = async (repo) => {
  try {
    const part = await gh(`/repos/${repo}/stats/participation`);
    const all = part?.all ?? [];
    return all.slice(-8).reduce((n, v) => n + v, 0);
  } catch (err) {
    console.warn(`  ! pushes for ${repo}: ${err.message} — recording 0`);
    return 0;
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
    console.log(`skipped (${err.message})`);
    continue;
  }
  const sinceISO = new Date(NOW.getTime() - 8 * WEEK_MS).toISOString().slice(0, 10);
  const [new_stars, contributors, issues_closed, pushes] = await Promise.all([
    newStarsLastWeek(name),
    countViaLastPage(`/repos/${name}/contributors`).catch(() => 0),
    issuesClosedSince(name, sinceISO),
    pushesLast8Weeks(name),
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
    _raw: { stars: meta.stargazers_count, new_stars, pushes, contributors, issues_closed, forks: meta.forks_count },
  });
  console.log(`${meta.stargazers_count}★ (+${new_stars}/wk)`);
}

if (collected.length === 0) {
  console.error("No repos resolved — refusing to write empty data files");
  process.exit(1);
}

// --- rank + percentile WITHIN the Ever set ------------------------------------

collected.sort((a, b) => b.stars_total - a.stars_total);

const METRICS = ["stars", "new_stars", "pushes", "contributors", "issues_closed", "forks"];
const sorted = Object.fromEntries(
  METRICS.map((m) => [m, collected.map((r) => r._raw[m]).sort((a, b) => a - b)])
);
const percentile = (ascending, value) => {
  if (ascending.length === 0) return 0;
  const below = ascending.filter((v) => v <= value).length;
  return Math.round((below / ascending.length) * 100);
};

const total_repos = collected.length;
const repos = collected.map((r, i) => {
  const { _raw, ...card } = r;
  return {
    ...card,
    rank: i + 1,
    total_repos,
    attributes: Object.fromEntries(METRICS.map((m) => [m, percentile(sorted[m], _raw[m])])),
  };
});

// --- star-count pyramid -------------------------------------------------------
// Thresholds kept only where they actually bucket one of our repos, so the pyramid
// never renders a run of empty tiers.
const TIERS = [
  { threshold: 0, label: "all" },
  { threshold: 10, label: "10+" },
  { threshold: 100, label: "100+" },
  { threshold: 500, label: "500+" },
  { threshold: 1000, label: "1k+" },
  { threshold: 2000, label: "2k+" },
  { threshold: 4000, label: "4k+" },
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
  repos: collected
    .map((r) => ({ name: r.name, new_stars: r._raw.new_stars, stars_total: r.stars_total }))
    .sort((a, b) => b.new_stars - a.new_stars),
});
write("star-count.json", { updated_at, tiers });

console.log(`Done — ${repos.length} repos seeded.`);
