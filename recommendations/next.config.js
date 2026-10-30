/**
 * Fixes: SEC-01 (missing headers), SEC-02 (global CORS), SEC-04 (HSTS),
 *        PERF-01 (307 -> 308 redirect), PERF-05 (legacy JS / bundle size)
 *
 * NOTE: a CSP that allows 'unsafe-inline' is a safe *first step* that will not
 * break the site. The strict, nonce-based CSP lives in middleware.ts.
 * Roll out as Report-Only first, then switch the header name to enforce.
 */

const SITE_HOST = 'www.cynbit.in';

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  // Start with Report-Only; rename to 'Content-Security-Policy' once clean.
  { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,

  async headers() {
    return [
      // Applies to every route, including the 404 page and static assets.
      // Deliberately NO global Access-Control-Allow-Origin (see middleware.ts).
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/(admin|portal)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },

  async redirects() {
    // Belt-and-braces: Vercel's domain setting should also be "308 Permanent".
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'cynbit.in' }],
        destination: `https://${SITE_HOST}/:path*`,
        permanent: true, // => 308
      },
    ];
  },

  experimental: {
    // Tree-shake large icon/animation libraries (adjust to actual deps)
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};
