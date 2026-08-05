/**
 * Footer for the Ever self-hosted instances.
 *
 * Replaces upstream's footer, which advertised unrelated third-party products
 * (pgconsole, pgschema, DBHub) and credited Bytebase's mailing list and RSS.
 *
 * Matches the ever.works footer's *structure and voice* rather than cloning it: the
 * real one carries 13 columns of marketing links, which on a stats utility would be
 * noise and would rot the moment marketing moves a URL. What's reproduced is the part
 * that is genuinely standard — copyright, the legal trio, socials, the trademark
 * line, and a build chip.
 */
import { useEffect, useState } from "react"
import { FaGithub, FaLinkedin, FaDiscord } from "react-icons/fa"
import { FaXTwitter } from "react-icons/fa6"
import BrandLogo from "./BrandLogo"
import { BRANDS, currentBrand, EVER_FORK_REPO, STAR_HISTORY_UPSTREAM, type Brand } from "../helpers/brand"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    GitHub: FaGithub,
    X: FaXTwitter,
    LinkedIn: FaLinkedin,
    Discord: FaDiscord,
}

const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA || "").slice(0, 7)

const Footer: React.FC = () => {
    const [brand, setBrand] = useState<Brand>(BRANDS["ever-co"])
    useEffect(() => setBrand(currentBrand()), [])

    const legal = [
        { label: "Terms of Service", href: `${brand.legalSite}/tos` },
        { label: "Privacy Policy", href: `${brand.legalSite}/privacy` },
        { label: "Cookie Policy", href: `${brand.legalSite}/cookies` },
    ]

    return (
        <footer className="mt-auto w-full border-t border-hairline bg-white dark:border-hairline-dark dark:bg-black">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-md">
                        <a
                            href={brand.site}
                            className="inline-flex items-center text-gray-800 transition-colors hover:text-black dark:text-gray-100 dark:hover:text-white"
                        >
                            <BrandLogo brandId={brand.id} />
                        </a>
                        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                            {brand.tagline}. Self-hosted, and served from our own GitHub API quota.
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Legal</h3>
                            <ul className="mt-3 space-y-2">
                                {legal.map((l) => (
                                    <li key={l.label}>
                                        <a
                                            href={l.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-gray-600 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                                        >
                                            {l.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open Source</h3>
                            <ul className="mt-3 space-y-2">
                                <li>
                                    <a
                                        href={EVER_FORK_REPO}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gray-600 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                                    >
                                        This instance
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={STAR_HISTORY_UPSTREAM}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gray-600 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                                    >
                                        Star History (upstream)
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={`https://github.com/${brand.org}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gray-600 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                                    >
                                        {brand.org} on GitHub
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Social</h3>
                            <div className="mt-3 flex items-center gap-3">
                                {brand.social.map((s) => {
                                    const Icon = ICONS[s.label] ?? FaGithub
                                    return (
                                        <a
                                            key={s.label}
                                            href={s.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={s.label}
                                            title={s.label}
                                            className="text-gray-500 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                                        >
                                            <Icon className="h-5 w-5" />
                                        </a>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 border-t border-hairline pt-6 dark:border-hairline-dark">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            Copyright © 2020-present. Ever Co. LTD. All Rights Reserved
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-600">
                            Built with{" "}
                            <a
                                href={STAR_HISTORY_UPSTREAM}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline-offset-2 hover:underline"
                            >
                                Star History
                            </a>
                            {BUILD_SHA ? ` · ${BUILD_SHA}` : ""}
                        </p>
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-gray-600">
                        *All product names, logos, and brands are property of their respective owners. All company,
                        product, and service names used in this website are for identification purposes only. Use of
                        these names, logos, and brands does not imply endorsement.
                    </p>
                </div>
            </div>
        </footer>
    )
}

export default Footer
