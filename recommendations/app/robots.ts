/**
 * Fixes: SEC-03 (don't advertise /admin and /portal), CONF-01 (canonical host)
 * /admin and /portal are hidden from search engines via the
 * `X-Robots-Tag: noindex` header (next.config.js) and protected in middleware.ts.
 */
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.SITE_URL ?? 'https://www.cynbit.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`, // same host as the site, no redirect
  };
}
