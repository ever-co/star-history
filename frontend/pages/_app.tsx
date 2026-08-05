import { NextPage } from "next"
import { AppProps } from "next/app"
import "../global.css"
import "@fortawesome/fontawesome-free/css/all.css"
import Head from "next/head"
import ErrorBoundary from "../components/ErrorBoundary"
import { AppStateProvider } from "../store"

export type NextPageWithLayout = NextPage & {
    getLayout?: (_page: React.ReactElement) => React.ReactNode
}

type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout
}

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
    // Use the layout defined at the page level, if available
    const getLayout = Component.getLayout ?? ((page) => page)
    return (
        <>
            <Head>
                <link rel="icon" href="/assets/favicon.ico" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            {/*
             * Ever fork: upstream loaded Plausible with data-domain="star-history.com",
             * which reported OUR visitors' page views into a third party's analytics
             * account. Removed — a self-hosted instance must not phone home. If we want
             * analytics here, wire our own Umami (analytics.ever.co) instead.
             */}
            <AppStateProvider>
                <ErrorBoundary>
                    {getLayout(<Component {...pageProps} />)}
                </ErrorBoundary>
            </AppStateProvider>
        </>
    )
}

export default MyApp
