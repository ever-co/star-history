import LRUCache from "lru-cache";
import utils from "../shared/common/utils.js";
import type { StarRecord } from "../shared/types/chart";

/**
 * A repo star data is type of RepoStarData, and its memory costs might be 896 bytes.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
 */
interface RepoData {
  starRecords: StarRecord[];
  starAmount: number;
  logoUrl: string;
}

// --- Hit/miss counters ---

type CacheName = "starData" | "svgChart" | "ogCard";

const counters: Record<CacheName, { hits: number; misses: number }> = {
  starData: { hits: 0, misses: 0 },
  svgChart: { hits: 0, misses: 0 },
  ogCard: { hits: 0, misses: 0 },
};

export function recordCacheHit(name: CacheName) {
  counters[name].hits++;
}

export function recordCacheMiss(name: CacheName) {
  counters[name].misses++;
}

// --- Human-readable byte formatting ---

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function cacheStats(name: CacheName, c: LRUCache<string, unknown>) {
  const { hits, misses } = counters[name];
  const total = hits + misses;
  return {
    entries: c.size,
    memory: formatBytes(c.calculatedSize),
    hits,
    misses,
    hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : "N/A",
  };
}

export function getAllCacheStats() {
  return {
    starData: cacheStats("starData", cache as LRUCache<string, unknown>),
    svgChart: cacheStats("svgChart", svgCache as LRUCache<string, unknown>),
    ogCard: cacheStats("ogCard", ogCardCache as LRUCache<string, unknown>),
  };
}

// --- Caches ---

/**
 * Cache TTL (Ever fork).
 *
 * Upstream hardcodes 24h. We keep that as the default but make it configurable via
 * CACHE_TTL_SECONDS, with a hard 1h floor: this instance backs public README badges,
 * so every chart must be served from cache for at least an hour rather than spending
 * our PAT's rate limit on every reader who loads a README.
 *
 * The same value drives the Cache-Control we emit, so the in-process LRU and any CDN
 * in front of us expire together.
 */
const MIN_TTL_SECONDS = 60 * 60;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

const parsedTtl = Number(process.env.CACHE_TTL_SECONDS);
export const CACHE_TTL_SECONDS = Number.isFinite(parsedTtl) && parsedTtl > 0
  ? Math.max(MIN_TTL_SECONDS, Math.floor(parsedTtl))
  : DEFAULT_TTL_SECONDS;

const TTL_24H = CACHE_TTL_SECONDS * 1000;

const cache = new LRUCache<string, RepoData>({
  max: 10000,
  maxSize: 1024 * 1024 * 1024,
  sizeCalculation: (value: RepoData) => utils.calcBytes(value),
  ttl: TTL_24H,
  updateAgeOnGet: false,
});

// Cache for rendered OG card SVGs, keyed by repo name.
export const ogCardCache = new LRUCache<string, string>({
  max: 1000,
  maxSize: 200 * 1024 * 1024,
  sizeCalculation: (value: string) => Buffer.byteLength(value),
  ttl: TTL_24H,
  updateAgeOnGet: false,
});

// Cache for rendered chart SVGs, keyed by normalized query string.
export const svgCache = new LRUCache<string, string>({
  max: 2000,
  maxSize: 400 * 1024 * 1024,
  sizeCalculation: (value: string) => Buffer.byteLength(value),
  ttl: TTL_24H,
  updateAgeOnGet: false,
});

export default cache;
