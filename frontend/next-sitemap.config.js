module.exports = {
    // Ever fork: follow NEXT_PUBLIC_SITE_URL so a self-hosted instance does not
    // publish a sitemap/robots.txt pointing at star-history.com. Unset = upstream.
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.star-history.com',
    outDir: 'out',
    // Ever fork: the blog is gated off unless NEXT_PUBLIC_ENABLE_BLOG=true, and a gated
    // /blog is an empty noindex page - it must not be advertised in the sitemap.
    exclude: process.env.NEXT_PUBLIC_ENABLE_BLOG === 'true' ? [] : ['/blog', '/blog/*'],
    generateRobotsTxt: true,
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', disallow: '/_next/' },
            { userAgent: '*', disallow: '/embed' },
        ],
    },
};
  