/**
 * Fixes: SEC-02 (scoped CORS for /api only), SEC-03 (server-side protection
 * for /admin and /portal), and an optional strict nonce-based CSP (SEC-01).
 */
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://www.cynbit.in',
  'https://cynbit.in',
  // add partner domains explicitly, never '*'
]);

const PROTECTED_PREFIXES = ['/admin', '/portal'];
const SESSION_COOKIE = 'cynbit_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Protect admin & portal on the server, not via robots.txt
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const session = req.cookies.get(SESSION_COOKIE)?.value;
    if (!session) {
      const login = new URL('/login', req.url);
      login.searchParams.set('next', pathname);
      return NextResponse.redirect(login);
    }
    // Full session + role verification must ALSO happen in the route/handler;
    // middleware is the first gate, not the only one.
  }

  // 2) Scoped CORS: only API routes, only allow-listed origins
  if (pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin') ?? '';
    const allowed = ALLOWED_ORIGINS.has(origin);

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: allowed ? 204 : 403,
        headers: allowed ? corsHeaders(origin) : {},
      });
    }

    const res = NextResponse.next();
    if (allowed) {
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
    }
    return res;
  }

  // 3) Optional strict CSP with a per-request nonce (replaces 'unsafe-inline')
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce); // Next.js applies it to its own scripts

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy-Report-Only', csp);
  return res;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export const config = {
  // Skip static assets and prefetches for performance
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
