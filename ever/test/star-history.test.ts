/**
 * Ever fork: tests for shared/common/star-history.ts (the stargazers/history client).
 *
 * Run: backend/node_modules/.bin/tsx --test ever/test/*.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import axios from "axios"
import {
    getRepoStarHistoryWeeks,
    getRepoStarRecordsFromHistory,
    simplify,
    starHistoryToRecords,
    type StarHistoryWeek,
} from "../../shared/common/star-history"

const DAY = 24 * 60 * 60 * 1000
// 2026-10-11, a Sunday (00:00 UTC), as the endpoint's `week` field: unix seconds.
const SUNDAY = Date.UTC(2026, 9, 11) / 1000

const week = (weeksBack: number, days: number[]): StarHistoryWeek => ({
    week: SUNDAY - weeksBack * 7 * 86400,
    total: days.reduce((a, b) => a + b, 0),
    days,
})

/** Stub axios.get with a handler keyed on the requested page; returns the call log. */
function stubAxios(handler: (page: number, url: string) => { data: unknown; link?: string } | { status: number }) {
    const calls: string[] = []
    const original = axios.get
    ;(axios as any).get = async (url: string) => {
        calls.push(url)
        const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? 1)
        const res = handler(page, url)
        if ("status" in res) throw Object.assign(new Error(`HTTP ${res.status}`), { response: { status: res.status } })
        return { data: res.data, headers: res.link ? { link: res.link } : {} }
    }
    return { calls, restore: () => ((axios as any).get = original) }
}

test("cumulative counts end at the repo's total and never decrease", () => {
    const weeks = [week(0, [7, 8, 6, 9, 11, 2, 0]), week(1, [7, 29, 13, 8, 65, 46, 28]), week(2, [0, 0, 0, 0, 1, 0, 3])]
    // Friday 2026-10-16, midday: Saturday of the current week is still in the future.
    const now = Date.UTC(2026, 9, 16, 12)
    const records = starHistoryToRecords(weeks, now)
    const total = weeks.reduce((s, w) => s + w.total, 0)

    assert.equal(records[records.length - 1].count, total)
    for (let i = 1; i < records.length; i++) assert.ok(records[i].count >= records[i - 1].count)
    // First point is the first starred day (Thursday of the oldest week), counting its 1 star.
    assert.equal(records[0].count, 1)
    // Nothing is stamped after `now`.
    for (const r of records) assert.ok(new Date(r.date).getTime() <= now)
})

test("input order does not matter (the endpoint is newest-first)", () => {
    const weeks = [week(0, [1, 1, 1, 1, 1, 1, 1]), week(3, [2, 0, 0, 0, 0, 0, 0]), week(1, [0, 0, 5, 0, 0, 0, 0])]
    const now = SUNDAY * 1000 + 7 * DAY
    assert.deepEqual(starHistoryToRecords(weeks, now), starHistoryToRecords([...weeks].reverse(), now))
})

test("a repo with no stars yields no records", () => {
    assert.deepEqual(starHistoryToRecords([week(0, [0, 0, 0, 0, 0, 0, 0]), week(1, [0, 0, 0, 0, 0, 0, 0])]), [])
})

test("simplify caps the point count and keeps a one-week spike sharp", () => {
    // 380 flat weeks with a 3000-star week in the middle: gauzy's September 2026 shape.
    const points = Array.from({ length: 380 }, (_, i) => ({ t: i * 7 * DAY, y: i * 10 + (i >= 300 ? 3000 : 0) }))
    const kept = simplify(points, 100)
    assert.ok(kept.length <= 100, `kept ${kept.length}`)
    assert.deepEqual(kept[0], points[0])
    assert.deepEqual(kept[kept.length - 1], points[points.length - 1])
    // Both sides of the jump survive, so the curve still rises within one week.
    assert.ok(kept.some((p) => p.t === 299 * 7 * DAY), "point before the spike kept")
    assert.ok(kept.some((p) => p.t === 300 * 7 * DAY), "point after the spike kept")
})

test("fetches every page the Link header advertises", async () => {
    const stub = stubAxios((page) => ({
        data: [week(page - 1, [page, 0, 0, 0, 0, 0, 0])],
        link: page === 1 ? '<https://api.github.com/repositories/1/stargazers/history?per_page=30&page=2>; rel="next", <https://api.github.com/repositories/1/stargazers/history?per_page=30&page=3>; rel="last"' : undefined,
    }))
    try {
        const weeks = await getRepoStarHistoryWeeks("ever-co/ever-gauzy", "t")
        assert.equal(stub.calls.length, 3)
        assert.deepEqual(weeks.map((w) => w.days[0]), [3, 2, 1]) // oldest first
    } finally {
        stub.restore()
    }
})

test("not-found and rate-limit errors propagate unchanged", async () => {
    for (const status of [401, 403, 404, 429]) {
        const stub = stubAxios(() => ({ status }))
        try {
            await assert.rejects(getRepoStarRecordsFromHistory("ever-co/x", "t"), (e: any) => e.response.status === status)
        } finally {
            stub.restore()
        }
    }
})

test("other failures return null so the caller falls back to the sampler", async () => {
    for (const handler of [() => ({ status: 422 }), () => ({ status: 502 }), () => ({ data: { message: "nope" } })]) {
        const stub = stubAxios(handler as any)
        const warn = console.warn
        console.warn = () => {}
        try {
            assert.equal(await getRepoStarRecordsFromHistory("ever-co/x", "t"), null)
        } finally {
            console.warn = warn
            stub.restore()
        }
    }
})

test("a repo with no stars throws the sampler's no-history shape", async () => {
    const stub = stubAxios(() => ({ data: [week(0, [0, 0, 0, 0, 0, 0, 0])] }))
    try {
        await assert.rejects(getRepoStarRecordsFromHistory("ever-co/x", "t"), (e: any) => Array.isArray(e.data) && e.data.length === 0)
    } finally {
        stub.restore()
    }
})
