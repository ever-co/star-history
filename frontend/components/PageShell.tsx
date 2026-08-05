/**
 * Page shell for the per-repo pages (Ever fork).
 *
 * Upstream wrapped these in a light-only slate gradient with a star-history.com
 * logo and a repo search box, so the page ignored the theme entirely and pushed
 * visitors toward looking up arbitrary repos — pointless here, where the allowlist
 * means only our own repos resolve. It now uses the same chrome as the rest of the
 * site: our header (brand + theme toggle) and our footer.
 *
 * The `header` slot is kept for compatibility but unused by our pages — the brand
 * lives in <Header /> now.
 */
import Header from "./header"
import Footer from "./footer"

export default function PageShell({ header, children }: { header?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-white text-gray-900 antialiased dark:bg-black dark:text-gray-100">
            <Header />
            <main className="flex w-full grow flex-col items-center px-4 py-8 md:py-10">
                {header}
                {children}
            </main>
            <Footer />
        </div>
    )
}
