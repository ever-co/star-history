/**
 * Per-domain branding (Ever fork).
 *
 * ONE static build serves three hostnames, so the brand is resolved at RUNTIME from
 * window.location.hostname rather than baked in at build time. That keeps a single
 * image and a single deploy — the alternative (three builds) would triple CI and the
 * image count to change a logo.
 *
 * `data-brand` is stamped on <html> by an inline script in _document.tsx before first
 * paint, so the correct brand is styled immediately with no flash.
 */

export type BrandId = "ever-co" | "ever-works" | "cloc"

export interface Brand {
    id: BrandId
    /** Shown next to the logo. */
    name: string
    /** Company/product line under the chart heading. */
    tagline: string
    /** Marketing site this instance belongs to. */
    site: string
    /** GitHub org whose repos this host serves. */
    org: string
    /** Accent gradient, used for the logo mark and highlights. */
    accentFrom: string
    accentTo: string
    /**
     * Origin serving /tos, /privacy and /cookies. Usually the brand's own site, but
     * cloc.com currently answers every path with the under-construction Worker, so
     * Cloc points at ever.co — Ever Co. LTD is the legal entity behind all three
     * brands anyway (see the copyright line on ever.works). Repoint it when cloc.com
     * publishes its own policies.
     */
    legalSite: string
    social: { label: string; href: string }[]
}

const DISCORD = "https://discord.gg/msqRJ4w"
const X = "https://x.com/everplatform"
const LINKEDIN = "https://www.linkedin.com/company/everhq"

export const BRANDS: Record<BrandId, Brand> = {
    "ever-co": {
        id: "ever-co",
        name: "Ever",
        tagline: "Star history for Ever open-source platforms",
        site: "https://ever.co",
        org: "ever-co",
        accentFrom: "#5B33D6",
        accentTo: "#EC4899",
        legalSite: "https://ever.co",
        social: [
            { label: "GitHub", href: "https://github.com/ever-co" },
            { label: "X", href: X },
            { label: "LinkedIn", href: LINKEDIN },
            { label: "Discord", href: DISCORD },
        ],
    },
    "ever-works": {
        id: "ever-works",
        name: "Ever Works",
        tagline: "Star history for Ever Works projects",
        site: "https://ever.works",
        org: "ever-works",
        accentFrom: "#FF1CF7",
        accentTo: "#00F0FF",
        legalSite: "https://ever.works",
        social: [
            { label: "GitHub", href: "https://github.com/ever-works" },
            { label: "X", href: X },
            { label: "LinkedIn", href: LINKEDIN },
            { label: "Discord", href: DISCORD },
        ],
    },
    cloc: {
        id: "cloc",
        name: "Cloc",
        tagline: "Star history for Cloc projects",
        site: "https://cloc.com",
        org: "cloc-co",
        accentFrom: "#2DD4BF",
        accentTo: "#3B82F6",
        // cloc.com/tos etc. currently render the under-construction Worker, not policies.
        legalSite: "https://ever.co",
        social: [
            { label: "GitHub", href: "https://github.com/cloc-co" },
            { label: "X", href: X },
            { label: "LinkedIn", href: LINKEDIN },
            { label: "Discord", href: DISCORD },
        ],
    },
}

/** Same mapping the backend allowlist uses, keyed by hostname. */
export function brandFromHostname(hostname: string | undefined | null): Brand {
    const h = (hostname || "").toLowerCase()
    if (h.includes("ever.works")) return BRANDS["ever-works"]
    if (h.includes("cloc.com")) return BRANDS.cloc
    if (h.includes("ever.co")) return BRANDS["ever-co"]
    // Local dev / nip.io / anything unrecognised: fall back to the primary brand
    // rather than rendering an unbranded page.
    return BRANDS["ever-co"]
}

export function currentBrand(): Brand {
    if (typeof window === "undefined") return BRANDS["ever-co"]
    return brandFromHostname(window.location.hostname)
}

/** Where "Built with Star History" points. */
export const STAR_HISTORY_UPSTREAM = "https://github.com/star-history/star-history"
/** Our fork, shown in the footer. */
export const EVER_FORK_REPO = "https://github.com/ever-co/star-history"
