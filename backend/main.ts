import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { optimize } from 'svgo';
import { JSDOM } from "jsdom";
import XYChart from "../shared/packages/xy-chart.js";
import { convertDataToChartData, getRepoData } from "../shared/common/chart.js";
import { ChartMode } from "../shared/types/chart.js";
import logger from "./logger.js";
import cache, { ogCardCache, svgCache, recordCacheHit, recordCacheMiss, getAllCacheStats, CACHE_TTL_SECONDS } from "./cache.js";
import {
  getChartWidthWithSize,
  fixJsdomSvgCasing,
  getBase64Image,
} from "./utils.js";
import { getNextToken, markTokenExhausted, initTokenFromEnv } from "./token.js";
import { initAllowlist, rejectedRepos, allowedFor, isAllowlistEnabled } from "./allowlist.js";
import { CHART_SIZES, MAX_REQUEST_AMOUNT, MAX_REPOS_PER_REQUEST } from "./const.js";
import { initOgAssets, renderOgCard } from "./og-card.js";
import { loadRepos } from "../shared/common/repo-data.js";

// Derived from CACHE_TTL_SECONDS so the LRU and any CDN in front of us agree.
// stale-while-revalidate keeps README badges serving instantly while a chart refreshes.
const SVG_HEADERS = {
  "Content-Type": "image/svg+xml;charset=utf-8",
  "Cache-Control":
    `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=${CACHE_TTL_SECONDS}, ` +
    `stale-while-revalidate=${CACHE_TTL_SECONDS}`,
} as const;

const startServer = async () => {
  await initTokenFromEnv();
  initAllowlist();
  initOgAssets();
  const repoStore = loadRepos();

  const app = new Hono();
  app.use(cors());
  app.use(compress());

  // Request logging middleware
  app.use(async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
  });

  app.onError((err, c) => {
    logger.error(`server error: ${err.stack || err}`);
    return c.text("Internal Server Error", 500);
  });

  // Health check endpoint with cache stats
  app.get("/healthz", (c) => {
    return c.json({
      status: "OK",
      commit: process.env.GIT_COMMIT || "unknown",
      cache: getAllCacheStats(),
      allowlist: {
        enabled: isAllowlistEnabled(),
        // Scoped to the requesting Host so a probe shows exactly what this vhost serves.
        host: c.req.header("host") ?? null,
        allowed: allowedFor(c.req.header("host")),
      },
    }, 200);
  });

  /**
   * JSON star data for the interactive UI (Ever fork).
   *
   * Upstream's frontend calls the GitHub API straight from the browser using a token
   * the VISITOR has to paste in, so an anonymous visitor immediately hits the 60/hr
   * unauthenticated limit and gets an "Access Token Unauthorized" dialog — the chart
   * never renders. Serving the data here instead means:
   *   - visitors never need a token, and never see that dialog
   *   - the same per-Host allowlist applies as for /svg
   *   - it shares the 24h LRU with /svg, so an interactive view is usually free
   */
  app.get("/api/star-data", async (c) => {
    const reposParam = c.req.query("repos");
    if (!reposParam) {
      return c.json({ error: "Repo name required" }, 400);
    }
    const repos = reposParam.split(",").map((r) => r.trim()).filter(Boolean);
    if (repos.length > MAX_REPOS_PER_REQUEST) {
      return c.json({ error: `Too many repos: max ${MAX_REPOS_PER_REQUEST} per request` }, 400);
    }

    const host = c.req.header("host");
    const rejected = rejectedRepos(host, repos);
    if (rejected.length > 0) {
      return c.json(
        {
          error: `Not allowed on this host: ${rejected.join(", ")}`,
          allowed: allowedFor(host),
        },
        403
      );
    }

    const data: { repo: string; starRecords: unknown; logoUrl: string }[] = [];
    const missing: string[] = [];
    for (const repo of repos) {
      const hit = cache.get(repo);
      if (hit) {
        recordCacheHit("starData");
        data.push({ repo, starRecords: hit.starRecords, logoUrl: hit.logoUrl });
      } else {
        recordCacheMiss("starData");
        missing.push(repo);
      }
    }

    if (missing.length > 0) {
      const token = getNextToken();
      if (!token) {
        return c.json({ error: "All GitHub API tokens are rate-limited, try again later" }, 503);
      }
      try {
        const fetched = await getRepoData(missing, token, MAX_REQUEST_AMOUNT);
        await Promise.all(
          fetched.map(async (d) => {
            d.logoUrl = await getBase64Image(`${d.logoUrl}&size=22`);
            cache.set(d.repo, {
              starRecords: d.starRecords,
              starAmount: d.starRecords[d.starRecords.length - 1].count,
              logoUrl: d.logoUrl,
            });
            data.push(d);
          })
        );
      } catch (error: any) {
        const status = error.status || 400;
        if (status === 403) markTokenExhausted(token);
        return c.json({ error: error.message || "Failed to fetch star data", repo: error.repo }, status);
      }
    }

    // Order the response the way the caller asked for, so chart series colours are stable.
    const byRepo = new Map(data.map((d) => [d.repo.toLowerCase(), d]));
    const ordered = repos.map((r) => byRepo.get(r.toLowerCase())).filter(Boolean);

    return c.json({ data: ordered }, 200, {
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
    });
  });

  // Normalize /svg query params for CDN cache efficiency.
  // Redirects to the canonical URL so Cloudflare caches one entry per unique chart.
  app.get("/svg", async (c, next) => {
    const url = new URL(c.req.url);
    const params = url.searchParams;
    const repos = params.get("repos");
    if (!repos) {
      return await next();
    }

    // Lowercase repo names (GitHub is case-insensitive)
    const normalized = repos.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean).join(",");
    if (normalized !== repos) {
      params.set("repos", normalized);
      return c.redirect(`${url.pathname}?${params.toString()}`, 301);
    }

    return await next();
  });

  // Example request link:
  // /svg?repos=star-history/star-history&type=timeline&logscale&legend=bottom-right
  app.get("/svg", async (c) => {
    const reposParam = c.req.query("repos");
    if (!reposParam) {
      return c.text("Repo name required", 400);
    }
    const repos = reposParam.split(",").filter(Boolean);
    if (repos.length > MAX_REPOS_PER_REQUEST) {
      return c.text(`Too many repos: max ${MAX_REPOS_PER_REQUEST} per request`, 400);
    }

    // Allowlist gate — BEFORE any cache lookup, GitHub call or render, so a rejected
    // repo can never consume one of our PAT's rate-limit units or land in the cache.
    const host = c.req.header("host");
    const rejected = rejectedRepos(host, repos);
    if (rejected.length > 0) {
      logger.warn(`403 ${host ?? "(no host)"} — not allowlisted: ${rejected.join(", ")}`);
      return c.text(
        `Not allowed on this host: ${rejected.join(", ")}\n` +
          `${host ?? "this host"} serves only: ${allowedFor(host).join(", ") || "(nothing)"}\n`,
        403
      );
    }

    // Landscape1 card: returns a 1200x630 SVG with radar chart and attributes
    const style = c.req.query("style") ?? "";
    if (style === "landscape1") {
      const repo = repos[0];
      const cardData = repoStore.getRepo(repo);
      if (!cardData) {
        return c.text(`Repo not found in gh dataset: ${repo}`, 404);
      }

      // Ever fork: the card now varies by theme AND by host (the watermark), so both
      // must be in the cache key — keying on repo alone would serve one brand's card,
      // or the wrong palette, to everyone.
      const cardTheme: "light" | "dark" = c.req.query("theme") === "dark" ? "dark" : "light";
      const cardCacheKey = `${host ?? ""}|${repo}|${cardTheme}`;

      const cachedCard = ogCardCache.get(cardCacheKey);
      if (cachedCard) {
        recordCacheHit("ogCard");
        return c.body(cachedCard, 200, SVG_HEADERS);
      }
      recordCacheMiss("ogCard");

      const token = getNextToken();
      if (!token) {
        return c.text("All GitHub API tokens are rate-limited, try again later", 503);
      }
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { Authorization: `token ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 403) {
          markTokenExhausted(token);
        }
        if (!res.ok) {
          return c.text(`GitHub API: ${res.statusText}`, res.status as any);
        }
        const gh = (await res.json()) as any;
        const avatarBase64 = await getBase64Image(`${gh.owner.avatar_url}&s=200`);
        const svg = await renderOgCard({
          name: gh.full_name,
          description: gh.description,
          stars: gh.stargazers_count,
          forks: gh.forks_count,
          language: gh.language,
          license: gh.license?.spdx_id || null,
          created_at: gh.created_at,
          avatarBase64,
          attributes: cardData.attributes,
          rank: cardData.rank,
          watermark: (host ?? "").replace(/:\d+$/, "") || undefined,
          // Ever fork: ?theme=dark renders a dark card. Read locally — the shared
          // `theme` const below belongs to the chart branch and is not in scope here.
          theme: cardTheme,
        });
        ogCardCache.set(cardCacheKey, svg);
        return c.body(svg, 200, SVG_HEADERS);
      } catch (error: any) {
        const status = error.status || 500;
        return c.text(`Failed to generate card: ${error.message}`, status);
      }
    }

    // --- Star history chart params (only relevant when style is not set) ---
    const theme = c.req.query("theme") ?? "";
    const transparent = c.req.query("transparent") ?? "";
    const typeParam = c.req.query("type") ?? "";
    const logscaleParam = c.req.query("logscale");
    const legendParam = c.req.query("legend") ?? "";
    let type: ChartMode = "Date";
    let size = c.req.query("size") ?? "";

    if (typeParam) {
      const lowerType = typeParam.toLowerCase();
      if (lowerType === "timeline") {
        type = "Timeline";
      } else if (lowerType === "date") {
        type = "Date";
      }
    } else if (c.req.query("timeline") !== undefined) {
      type = "Timeline";
    } else if (c.req.query("date") !== undefined) {
      type = "Date";
    }

    const useLogScale = logscaleParam !== undefined && logscaleParam !== "false";

    let legendPosition: "top-left" | "bottom-right" = "top-left";
    if (legendParam === "bottom-right") {
      legendPosition = "bottom-right";
    }

    if (!CHART_SIZES.includes(size)) {
      size = "laptop";
    }

    // Check rendered SVG cache before any data fetching or rendering.
    // host is part of the key because the watermark is host-derived (Ever fork) —
    // without it a chart cached for one brand could be served under another.
    const svgCacheKey = `${host ?? ""}|${repos.join(",")}|${type}|${size}|${theme}|${transparent}|${legendPosition}|${useLogScale}`;
    const cachedSvg = svgCache.get(svgCacheKey);
    if (cachedSvg) {
      recordCacheHit("svgChart");
      return c.body(cachedSvg, 200, SVG_HEADERS);
    }
    recordCacheMiss("svgChart");

    const repoData = [];
    const nodataRepos = [];

    for (const repo of repos) {
      const cacheData = cache.get(repo);

      if (cacheData) {
        recordCacheHit("starData");
        repoData.push({
          repo,
          starRecords: cacheData.starRecords,
          logoUrl: cacheData.logoUrl,
        });
      } else {
        recordCacheMiss("starData");
        nodataRepos.push(repo);
      }
    }

    if (nodataRepos.length > 0) {
      const token = getNextToken();
      if (!token) {
        return c.text("All GitHub API tokens are rate-limited, try again later", 503);
      }

      try {
        const data = await getRepoData(nodataRepos, token, MAX_REQUEST_AMOUNT);

        // Fetch all logos in parallel (bounded by MAX_REPOS_PER_REQUEST)
        await Promise.all(data.map(async (d) => {
          d.logoUrl = await getBase64Image(`${d.logoUrl}&size=22`);
          cache.set(d.repo, {
            starRecords: d.starRecords,
            starAmount: d.starRecords[d.starRecords.length - 1].count,
            logoUrl: d.logoUrl,
          });
          repoData.push(d);
        }));
      } catch (error: any) {
        const status = error.status || 400;
        const message =
          error.message || "Some unexpected error happened, try again later";

        if (status === 403) {
          markTokenExhausted(token);
        }

        return c.text(message, status);
      }
    }

    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    const body = dom.window.document.querySelector("body");
    const svg = dom.window.document.createElement(
      "svg"
    ) as unknown as SVGSVGElement;

    if (!dom || !body || !svg) {
      return c.text("Failed to mock dom with JSDOM", 500);
    }

    body.append(svg);
    svg.setAttribute("width", `${getChartWidthWithSize(size)}`);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    try {
      XYChart(
        svg,
        {
          title: "Star History",
          xLabel: type === "Date" ? "Date" : "Timeline",
          yLabel: "GitHub Stars",
          data: convertDataToChartData(repoData, type),
          showDots: false,
          transparent: transparent.toLowerCase() === "true",
          theme: theme === "dark" ? "dark" : "light",
          // Ever fork: brand the badge with the host that served it.
          watermark: (host ?? "").replace(/:\d+$/, "") || undefined,
        },
        {
          xTickLabelType: type === "Date" ? "Date" : "Number",
          chartWidth: getChartWidthWithSize(size),
          useLogScale: useLogScale,
          legendPosition: legendPosition,
        }
      );
    } catch (error) {
      return c.text(`Failed to generate chart, ${error}`, 500);
    }

    const svgContent = fixJsdomSvgCasing(svg.outerHTML);
    const optimized = optimize(svgContent, { multipass: true }).data;
    svgCache.set(svgCacheKey, optimized);

    return c.body(optimized, 200, SVG_HEADERS);
  });

  const banner = `
     _______.___________.    ___      .______          __    __   __       _______.___________.  ______   .______     ____    ____
    /       |           |   /   \\     |   _  \\        |  |  |  | |  |     /       |           | /  __  \\  |   _  \\    \\   \\  /   /
   |   (----\`---|  |----\`  /  ^  \\    |  |_)  |       |  |__|  | |  |    |   (----\`---|  |----\`|  |  |  | |  |_)  |    \\   \\/   /
    \\   \\       |  |      /  /_\\  \\   |      /        |   __   | |  |     \\   \\       |  |     |  |  |  | |      /      \\_    _/
.----)   |      |  |     /  _____  \\  |  |\\  \\----.   |  |  |  | |  | .----)   |      |  |     |  \`--'  | |  |\\  \\----.   |  |
|_______/       |__|    /__/     \\__\\ | _| \`._____|   |__|  |__| |__| |_______/       |__|      \\______/  | _| \`._____|   |__|
`;
  // Ever fork: PORT is configurable (default unchanged at 8080) so the server can run
  // where 8080 is taken or reserved.
  const port = Number(process.env.PORT) || 8080;
  serve({ fetch: app.fetch, port }, () => {
    console.log(banner);
    console.log(`  commit: ${process.env.GIT_COMMIT || "unknown"}\n`);
    logger.info(`server running on port ${port}`);
  });
};

startServer();
