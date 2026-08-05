import React, { useEffect, useState } from "react"
import Header from "../components/header"
import Footer from "../components/footer"
import LeftSidebar from "../components/LeftSidebar"
import RepoInputer from "../components/RepoInputer"
import type { NextPage } from "next"
import StarChartViewer from "../components/StarChartViewer"
import Head from "next/head"
import { SITE_URL } from "../helpers/consts"
import { BRANDS, currentBrand, type Brand } from "../helpers/brand"

const Index: NextPage = () => {
    const [isChartVisible, setChartVisibility] = useState(false)
    const [brand, setBrand] = useState<Brand>(BRANDS["ever-co"])

    useEffect(() => {
        const b = currentBrand()
        setBrand(b)
        // One static build serves three hostnames, so the tab title is branded at
        // runtime rather than baked in.
        document.title = `Star History · ${b.name}`
    }, [])

    const metadata = {
        title: "Star History",
        description: "Star history charts for our open-source projects.",
        imageURL: `${SITE_URL}/assets/star-history-preview.webp`,
    }

    return (
        <>
            <Head>
                <title>{metadata.title}</title>
                <meta name="description" content={metadata.description} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={SITE_URL} />
                <meta property="og:title" content={metadata.title} />
                <meta property="og:description" content={metadata.description} />
                <meta property="og:image" content={metadata.imageURL} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={metadata.title} />
                <meta name="twitter:description" content={metadata.description} />
                <meta name="twitter:image" content={metadata.imageURL} />
            </Head>

            <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white text-gray-900 dark:bg-black dark:text-gray-100">
                <Header />

                <main className="flex w-full grow flex-col">
                    <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-8 sm:px-6">
                        <div className="mb-8">
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Star History</h1>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{brand.tagline}.</p>
                        </div>

                        {/*
                         * Two columns, not three. Upstream's right-hand column was paid
                         * sponsor placements (Dify / Bytebase / SerpApi) — removed, since
                         * this is our own branded instance and we are not running their ads.
                         * The left column stays: it ranks OUR repos, which is useful here.
                         */}
                        <div className="w-full lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
                            <aside className="hidden lg:block">
                                <LeftSidebar />
                            </aside>

                            <div className="flex w-full min-w-0 flex-col justify-start">
                                <RepoInputer isChartVisible={isChartVisible} setChartVisibility={setChartVisibility} />
                                {isChartVisible && <StarChartViewer />}
                            </div>
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        </>
    )
}

export default Index
