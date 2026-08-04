module.exports = {
    // Ever fork: follow NEXT_PUBLIC_SITE_URL so a self-hosted instance does not
    // publish a sitemap/robots.txt pointing at star-history.com. Unset = upstream.
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.star-history.com',
    outDir: 'out',
    generateRobotsTxt: true,
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', disallow: '/_next/' },
            { userAgent: '*', disallow: '/embed' },
        ],
    },
};
  