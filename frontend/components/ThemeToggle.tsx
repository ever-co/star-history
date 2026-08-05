/**
 * Light/dark toggle (Ever fork).
 *
 * Cycles light -> dark -> system. "System" is a real, selectable state rather than
 * just the initial default, so a visitor who wants to follow the OS can get back to
 * it after trying the other two.
 */
import { useEffect, useState } from "react"
import { FaMoon, FaSun, FaDesktop } from "react-icons/fa"
import { applyTheme, readThemePref, setThemePref, ThemePref } from "../helpers/theme"

const ORDER: ThemePref[] = ["light", "dark", "system"]
const LABEL: Record<ThemePref, string> = {
    light: "Light theme",
    dark: "Dark theme",
    system: "Follow system theme",
}

const ThemeToggle: React.FC = () => {
    // Start as "system" and correct after mount: the markup is prerendered at build
    // time, so rendering the real preference on the server would hydrate mismatched.
    const [pref, setPref] = useState<ThemePref>("system")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setPref(readThemePref())
        setMounted(true)
    }, [])

    // Keep following the OS while the preference is "system".
    useEffect(() => {
        if (pref !== "system" || typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-color-scheme: dark)")
        const onChange = () => applyTheme("system")
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [pref])

    const cycle = () => {
        const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
        setPref(next)
        setThemePref(next)
    }

    const Icon = pref === "light" ? FaSun : pref === "dark" ? FaMoon : FaDesktop

    return (
        <button
            type="button"
            onClick={cycle}
            title={LABEL[pref]}
            aria-label={LABEL[pref]}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-gray-600 transition-colors hover:bg-black/5 dark:border-hairline-dark dark:text-gray-300 dark:hover:bg-white/10"
        >
            {/* Render a stable icon until mounted so SSR and first paint agree. */}
            {mounted ? <Icon className="h-4 w-4" /> : <FaDesktop className="h-4 w-4 opacity-0" />}
        </button>
    )
}

export default ThemeToggle
