/**
 * Per-Host repo allowlist (Ever fork).
 *
 * Upstream star-history answers /svg for any repo on GitHub. This instance runs on
 * our own PATs, so it answers ONLY for repos we explicitly list, and only on the
 * host that owns them (stats-github.ever.co serves ever-co repos, .ever.works serves
 * ever-works, .cloc.com serves cloc-co).
 *
 * Config file: ever/allowlist.json (override the path with ALLOWLIST_FILE).
 * If no config is found the allowlist is DISABLED and every repo is allowed, which
 * preserves upstream behaviour for anyone running this fork without the file.
 */
import * as fs from "fs";
import * as path from "path";
import logger from "./logger.js";

interface AllowlistConfig {
  default?: string[];
  hosts?: Record<string, string[]>;
}

const DEFAULT_PATH = path.join(process.cwd(), "..", "ever", "allowlist.json");

let enabled = false;
let fallback: string[] = [];
const byHost = new Map<string, string[]>();

/** Strip port and lowercase, so "Stats-GitHub.Ever.co:443" matches "stats-github.ever.co". */
const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(/:\d+$/, "");

const normalizeRepo = (repo: string): string => repo.trim().toLowerCase();

export const initAllowlist = (): void => {
  const file = process.env.ALLOWLIST_FILE || DEFAULT_PATH;

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    logger.warn(
      `No allowlist at ${file} — allowlist DISABLED, every repo will be served. ` +
        `Set ALLOWLIST_FILE to enable it.`
    );
    return;
  }

  let config: AllowlistConfig;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    // Fail closed: a corrupt allowlist must never silently open the service up.
    logger.error(`Allowlist at ${file} is not valid JSON — refusing to start`, error);
    process.exit(-1);
  }

  fallback = (config.default ?? []).map(normalizeRepo);
  for (const [host, repos] of Object.entries(config.hosts ?? {})) {
    byHost.set(normalizeHost(host), repos.map(normalizeRepo));
  }

  enabled = true;
  // Array.from, not spread: this tsconfig's target predates downlevelIteration.
  const total = Array.from(byHost.values()).reduce((n, r) => n + r.length, 0);
  logger.info(
    `Allowlist enabled from ${file}: ${byHost.size} host(s), ${total} repo entr(ies), ` +
      `default=${fallback.length === 0 ? "DENY-ALL" : `${fallback.length} entr(ies)`}`
  );
};

const matches = (pattern: string, repo: string): boolean => {
  if (pattern === repo) return true;
  // "owner/*" allows every repo under that owner.
  if (pattern.endsWith("/*")) return repo.startsWith(pattern.slice(0, -1));
  return false;
};

/** Repos permitted on this Host. Empty array = nothing permitted. */
export const allowedFor = (host: string | undefined): string[] => {
  if (!enabled) return [];
  return byHost.get(normalizeHost(host ?? "")) ?? fallback;
};

export const isAllowlistEnabled = (): boolean => enabled;

/**
 * Returns the repos from `repos` that this Host may NOT be served.
 * Empty result = the whole request is permitted.
 */
export const rejectedRepos = (host: string | undefined, repos: string[]): string[] => {
  if (!enabled) return [];
  const patterns = allowedFor(host);
  return repos.filter((repo) => {
    const normalized = normalizeRepo(repo);
    return !patterns.some((pattern) => matches(pattern, normalized));
  });
};
