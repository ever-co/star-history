/**
 * Header for the Ever self-hosted instances.
 *
 * Replaces upstream's header wholesale. Gone: the Blog link, the "Add access token"
 * link (visitors never need a token now — the backend holds ours), the "How to use
 * this site" link, and the hamburger menu that only existed to hold those.
 *
 * What's here instead: the brand for THIS hostname, an honest "Built with Star
 * History" credit linking to the upstream project, and a theme toggle.
 */
import Link from "next/link"
import { useEffect, useState } from "react"
import { FaGithub } from "react-icons/fa"
import BrandLogo from "./BrandLogo"
import ThemeToggle from "./ThemeToggle"
import { BRANDS, currentBrand, STAR_HISTORY_UPSTREAM, type Brand } from "../helpers/brand"

const Header: React.FC = () => {
    // Resolved on the client: one static build serves all three hostnames.
    const [brand, setBrand] = useState<Brand>(BRANDS["ever-co"])
    useEffect(() => setBrand(currentBrand()), [])

    return (
        <header className="sticky top-0 z-50 w-full border-b border-hairline bg-white/80 backdrop-blur-md dark:border-hairline-dark dark:bg-black/80">
            <nav className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
                {/* Brand → the marketing site this instance belongs to. */}
                <a
                    href={brand.site}
                    className="flex items-center text-gray-800 transition-colors hover:text-black dark:text-gray-100 dark:hover:text-white"
                    title={`${brand.name} — ${brand.site.replace("https://", "")}`}
                >
                    <BrandLogo brandId={brand.id} />
                </a>

                <div className="flex items-center gap-2 sm:gap-4">
                    <Link
                        href="/"
                        className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-black sm:inline dark:text-gray-300 dark:hover:text-white"
                    >
                        Star History
                    </Link>

                    {/* Credit to the upstream project this is built on. */}
                    <a
                        href={STAR_HISTORY_UPSTREAM}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/5 hover:text-black sm:text-sm dark:border-hairline-dark dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                        title="Built with Star History — view the upstream project on GitHub"
                    >
                        <span className="whitespace-nowrap">Built with Star History</span>
                        <FaGithub className="h-4 w-4 shrink-0" />
                    </a>

                    <ThemeToggle />
                </div>
            </nav>
        </header>
    )
}

export default Header
