export const GITHUB_REPO_URL_REG = /github.com\/(\S*?\/\S*)/

export const ANIMATION_DURATION = 1000

export const MIN_CHART_WIDTH = 600

export const EASTER_EGG_REPOS = new Set(["openclaw/openclaw"])

/**
 * Ever fork: build-time configurable so one static export can back a self-hosted
 * instance. Next inlines NEXT_PUBLIC_* at build time, which is what `output: "export"`
 * requires. Both unset = upstream behaviour, unchanged.
 *
 * NEXT_PUBLIC_API_URL="same-origin" makes every /svg call relative. That matters here:
 * ONE build serves three hostnames (stats-github.ever.co / .ever.works / .cloc.com) and
 * each must hit its OWN backend vhost, because the backend allowlists per Host header.
 * A baked absolute API URL would send ever.works' charts to ever.co's vhost and get 403.
 */
const SAME_ORIGIN = "same-origin"

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL
export const API_URL =
    rawApiUrl === undefined ? "https://api.star-history.com" : rawApiUrl === SAME_ORIGIN ? "" : rawApiUrl

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://star-history.com"
export const NEWSLETTER_URL = "https://newsletter.star-history.com/subscribe"

/**
 * Ever fork: the canonical URL for a path, always on SITE_URL.
 *
 * ONE static build serves stats-github.ever.co, .ever.works and .cloc.com, so without
 * a canonical the three hosts publish byte-identical pages and compete with each other
 * in search. SITE_URL (stats-github.ever.co in our build) is the canonical host.
 * It comes from the build-time constant, NEVER from window.location: a canonical
 * derived from the request host would make every host claim to be the original.
 *
 * Every indexable page sets its own via this helper, for its own path — there is
 * deliberately no site-wide canonical in _app, which would make every page claim to
 * be a duplicate of the home page, and would also land on the 404 page.
 */
export const canonicalUrl = (path: string): string => {
    const origin = SITE_URL.replace(/\/+$/, "")
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Ever fork: upstream's blog is star-history.com's editorial content, gated off by
 * default (see pages/blog/[slug].tsx). One flag, read by every blog surface.
 */
export const BLOG_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BLOG === "true"

/**
 * API_URL resolved to something absolute — for embed snippets the user copies into a
 * README, where a relative "/svg?..." would be useless. Browser-only; falls back to
 * API_URL during prerender.
 */
export const absoluteApiUrl = (): string => {
    if (API_URL) return API_URL
    return typeof window !== "undefined" ? window.location.origin : ""
}
