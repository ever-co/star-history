/**
 * Ever fork: exact star history from GitHub's aggregate endpoint.
 *
 * Why this exists
 * ---------------
 * In July 2026 GitHub limited `GET /repos/{owner}/{repo}/stargazers` (the per-user list that
 * upstream's sampler in api.tsx walks) to the repository's own admins and collaborators;
 * everyone else now gets 404. On 2026-09-04 it added
 * `GET /repos/{owner}/{repo}/stargazers/history`: public, no stargazer identities, stars per
 * calendar week with a Sunday-first per-day breakdown, newest week first, 30 weeks a page,
 * back to the week the repository was created.
 *
 * That endpoint gives the EXACT curve for any public repo in about `age / 30 weeks`
 * requests, with no collaborator access needed, so api.getRepoStarRecords() tries it first
 * and only falls back to upstream's sampler when it is unavailable.
 *
 * Counts are stars that still exist today (GitHub does not track unstars historically), so
 * the curve never goes down and its last point equals the repo's current star count.
 */
import axios from "axios"
import utils from "./utils"

const HISTORY_PER_PAGE = 30 // endpoint maximum
const HISTORY_MAX_PAGES = 100 // endpoint maximum page number (~57 years of weeks)
const HISTORY_PAGE_BATCH = 10 // parallel requests at a time, to stay clear of secondary limits
const REQUEST_TIMEOUT_MS = 15000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The frontend draws a dot per point, so the weekly curve is simplified to at most this
 * many points. Douglas-Peucker keeps the corners (a launch-day spike stays a spike), unlike
 * evenly spaced sampling, which smears it across the gap between samples.
 */
export const MAX_HISTORY_POINTS = 100

export interface StarHistoryWeek {
    /** Unix seconds of the first day (Sunday) of the week. */
    week: number
    total: number
    /** Stars created on each day of the week, Sunday first. */
    days: number[]
}

export interface StarRecord {
    date: string
    count: number
}

/** HTTP statuses that mean "do not retry another way": not found, auth, rate limit. */
const TERMINAL_STATUSES = new Set([401, 403, 404, 429])

const isWeek = (w: any): w is StarHistoryWeek =>
    w !== null && typeof w === "object" && typeof w.week === "number" && Array.isArray(w.days)

/** Every week of a repo's star history, oldest first. */
export async function getRepoStarHistoryWeeks(repo: string, token?: string): Promise<StarHistoryWeek[]> {
    const get = (page: number) =>
        axios.get(`https://api.github.com/repos/${repo}/stargazers/history?per_page=${HISTORY_PER_PAGE}&page=${page}`, {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: token ? `token ${token}` : "",
            },
            timeout: REQUEST_TIMEOUT_MS,
        })

    const first = await get(1)
    const last = /[?&]page=(\d+)>;\s*rel="last"/.exec(first.headers["link"] || "")
    const pageCount = Math.min(last ? Number(last[1]) : 1, HISTORY_MAX_PAGES)

    const responses = [first]
    const rest = utils.range(2, pageCount)
    for (let i = 0; i < rest.length; i += HISTORY_PAGE_BATCH) {
        responses.push(...(await Promise.all(rest.slice(i, i + HISTORY_PAGE_BATCH).map(get))))
    }

    const weeks: unknown[] = []
    for (const res of responses) {
        if (!Array.isArray(res.data)) throw new Error(`unexpected stargazers/history payload for ${repo}`)
        weeks.push(...res.data)
    }
    if (!weeks.every(isWeek)) throw new Error(`unexpected stargazers/history week for ${repo}`)

    return (weeks as StarHistoryWeek[]).sort((a, b) => a.week - b.week)
}

interface Point {
    t: number
    y: number
}

/** Perpendicular distance from p to the segment a-b, in normalised [0,1] coordinates. */
function distance(p: Point, a: Point, b: Point, sx: number, sy: number): number {
    const px = p.t * sx, py = p.y * sy
    const ax = a.t * sx, ay = a.y * sy
    const bx = b.t * sx, by = b.y * sy
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return Math.hypot(px - ax, py - ay)
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    return Math.hypot(px - (ax + u * dx), py - (ay + u * dy))
}

/**
 * Douglas-Peucker on a monotone series, loosened until it fits in maxPoints. Always run,
 * not only above the cap: it drops collinear points, so a young repo's flat year is a
 * line rather than a row of 50 dots, while every step corner is kept.
 */
export function simplify(points: Point[], maxPoints = MAX_HISTORY_POINTS): Point[] {
    if (points.length < 3) return points
    const first = points[0], last = points[points.length - 1]
    const sx = 1 / (last.t - first.t || 1)
    const sy = 1 / (last.y - first.y || 1)

    for (let epsilon = 0.002; ; epsilon *= 1.5) {
        const keep = new Array<boolean>(points.length).fill(false)
        keep[0] = keep[points.length - 1] = true
        const stack: [number, number][] = [[0, points.length - 1]]
        while (stack.length) {
            const [lo, hi] = stack.pop()!
            let worst = -1, worstDist = 0
            for (let i = lo + 1; i < hi; i++) {
                const d = distance(points[i], points[lo], points[hi], sx, sy)
                if (d > worstDist) {
                    worstDist = d
                    worst = i
                }
            }
            if (worst !== -1 && worstDist > epsilon) {
                keep[worst] = true
                stack.push([lo, worst], [worst, hi])
            }
        }
        const kept = points.filter((_, i) => keep[i])
        if (kept.length <= maxPoints) return kept
    }
}

/**
 * Weekly history -> cumulative chart records: the first starred day, the end of every week
 * after it, and today. Days after `now` (the rest of the current week) are dropped. An
 * empty result means the repo has no stars.
 */
export function starHistoryToRecords(weeks: StarHistoryWeek[], now = Date.now(), maxPoints = MAX_HISTORY_POINTS): StarRecord[] {
    const days: { t: number; n: number; weekDay: number }[] = []
    for (const w of [...weeks].sort((a, b) => a.week - b.week)) {
        w.days.forEach((n, weekDay) => {
            const t = w.week * 1000 + weekDay * DAY_MS
            if (t <= now) days.push({ t, n: Number(n) || 0, weekDay })
        })
    }

    const firstStar = days.findIndex((d) => d.n > 0)
    if (firstStar === -1) return []

    const points: Point[] = []
    let total = 0
    days.forEach((d, i) => {
        total += d.n
        if (i < firstStar) return
        if (i === firstStar || i === days.length - 1 || d.weekDay === 6) {
            // Stamp the END of the day: the count includes that whole day's stars.
            points.push({ t: Math.min(d.t + DAY_MS - 1000, now), y: total })
        }
    })

    return simplify(points, maxPoints).map((p) => ({ date: utils.getDateString(p.t), count: p.y }))
}

/**
 * Exact star records from the history endpoint, or null when the caller should fall back
 * to the sampler. Not-found, auth and rate-limit errors are rethrown unchanged, so the
 * callers' 404 handling and token rotation behave exactly as before. A repo with no stars
 * throws `{ status, data: [] }`, the shape upstream's sampler uses for the same case.
 */
export async function getRepoStarRecordsFromHistory(repo: string, token?: string): Promise<StarRecord[] | null> {
    try {
        const records = starHistoryToRecords(await getRepoStarHistoryWeeks(repo, token))
        if (records.length === 0) throw { status: 200, data: [] }
        return records
    } catch (error: any) {
        if (Array.isArray(error?.data) && error.data.length === 0) throw error
        if (TERMINAL_STATUSES.has(error?.response?.status)) throw error
        console.warn(`stargazers/history unavailable for ${repo} (${error?.response?.status ?? error?.message}); using the sampler`)
        return null
    }
}
