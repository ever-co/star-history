/**
 * Star data via OUR backend (Ever fork).
 *
 * Upstream fetches star history from the GitHub API directly in the browser, using a
 * token the visitor pastes in. Anonymous visitors get 60 requests/hour, and a single
 * chart burns far more than that, so the very first load showed "Access Token
 * Unauthorized" and no chart. That is unacceptable for a page linked from public
 * READMEs.
 *
 * Here the request goes to our own /api/star-data instead: the server holds the PATs,
 * applies the per-Host allowlist, and answers from the same 24h cache that backs the
 * /svg badges — so a visitor needs no token and usually gets a cache hit.
 */
import { API_URL } from "./consts"
import type { RepoData } from "@shared/types/chart"

export interface StarDataError extends Error {
    status: number
    repo?: string
}

const asError = (message: string, status: number, repo?: string): StarDataError => {
    const err = new Error(message) as StarDataError
    err.status = status
    if (repo) err.repo = repo
    return err
}

export async function fetchStarData(repos: string[]): Promise<RepoData[]> {
    if (repos.length === 0) return []

    // API_URL is "" in our deployment (same-origin), so this resolves to /api/star-data
    // on whichever branded host the visitor is on — which is what makes the per-Host
    // allowlist line up with the brand.
    const url = `${API_URL}/api/star-data?repos=${encodeURIComponent(repos.join(","))}`

    let res: Response
    try {
        res = await fetch(url, { headers: { Accept: "application/json" } })
    } catch {
        throw asError("Could not reach the star history service", 0)
    }

    let body: any = null
    try {
        body = await res.json()
    } catch {
        /* fall through to the status-based message below */
    }

    if (!res.ok) {
        throw asError(body?.error || `Request failed (${res.status})`, res.status, body?.repo)
    }

    return (body?.data ?? []) as RepoData[]
}
