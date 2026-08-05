import Document, { Html, Head, Main, NextScript } from "next/document"
import { THEME_BOOT_SCRIPT } from "../helpers/theme"

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head>
                    {/*
                     * Ever fork: resolve theme + brand BEFORE first paint.
                     * This is a static export, so without this a dark-mode visitor gets a
                     * white flash on every page load, and the brand would pop in after
                     * hydration. Inline and synchronous on purpose — it must run before
                     * the body renders.
                     */}
                    <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
                </Head>
                <body className="bg-white text-gray-900 dark:bg-black dark:text-gray-100">
                    <Main />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default MyDocument
