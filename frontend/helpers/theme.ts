/**
 * Light/dark theme (Ever fork).
 *
 * Tailwind runs in `darkMode: "class"`, so everything keys off a `dark` class on
 * <html>. The resolved theme is also applied pre-paint by an inline script in
 * _document.tsx — without that, a dark-mode visitor gets a white flash on every
 * navigation because this is a static export with no server to negotiate on.
 */

export type ThemePref = "light" | "dark" | "system"

export const THEME_KEY = "ever-star-history-theme"

export function systemPrefersDark(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

export function readThemePref(): ThemePref {
    if (typeof window === "undefined") return "system"
    const v = window.localStorage?.getItem(THEME_KEY)
    return v === "light" || v === "dark" ? v : "system"
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
    return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref
}

export function applyTheme(pref: ThemePref): void {
    if (typeof document === "undefined") return
    const resolved = resolveTheme(pref)
    document.documentElement.classList.toggle("dark", resolved === "dark")
    document.documentElement.style.colorScheme = resolved
}

export function setThemePref(pref: ThemePref): void {
    if (typeof window === "undefined") return
    if (pref === "system") window.localStorage?.removeItem(THEME_KEY)
    else window.localStorage?.setItem(THEME_KEY, pref)
    applyTheme(pref)
}

/**
 * Runs before first paint, inlined into <head>. Kept dependency-free and tiny, and
 * wrapped in try/catch because localStorage throws in some privacy modes — a theme
 * preference must never be able to break the page.
 */
export const THEME_BOOT_SCRIPT = `
(function(){try{
var k=${JSON.stringify(THEME_KEY)};
var s=window.localStorage.getItem(k);
var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
var h=location.hostname;
var b=h.indexOf("ever.works")>-1?"ever-works":h.indexOf("cloc.com")>-1?"cloc":"ever-co";
document.documentElement.setAttribute("data-brand",b);
}catch(e){}})();
`.trim()
