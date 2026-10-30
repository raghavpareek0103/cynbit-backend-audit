# Cynbit Backend Audit

Backend technical audit of **[cynbit.in](https://www.cynbit.in)**, submitted for the *Backend Developer Intern* assessment at Cynbit Technologies.

> Only passive, authorized observation was used: a normal browser, Chrome DevTools, `curl -I` (HEAD requests) and public scanners. No exploitation, fuzzing, scanning, authentication attempts or load testing.

## TL;DR

Cynbit.in is a **Next.js App Router app on Vercel** with good static caching and a sound HTTPS setup. The biggest wins are:

| # | Finding | Severity | Fix |
|---|---|---|---|
| ARCH-01 | Dynamic requests from India are executed in **`iad1` (US East)**: `x-vercel-id: bom1::iad1::…` | High | `"regions": ["bom1"]` |
| PERF-02 | Mobile Core Web Vitals **fail** for real users (LCP 4.2 s, TTFB 1.4 s) | High | Static LCP headline, lazy animation |
| SEC-01 | 5 security headers missing → securityheaders.com grade **D** | Medium | `headers()` in `next.config.js` |
| SEC-02 | `Access-Control-Allow-Origin: *` on every response | Medium | Scoped, allow-listed CORS in middleware |
| PERF-01 | `cynbit.in` → `www` is a **307 Temporary** redirect | Medium | 308 Permanent + single canonical host |

Full list of 11 findings with evidence, impact and fixes: **[report/AUDIT_REPORT.md](report/AUDIT_REPORT.md)**

## Repository structure

```
cynbit-backend-audit/
├── README.md
├── report/
│   ├── AUDIT_REPORT.md      # Architecture analysis, findings, roadmap
│   ├── raw-evidence.md      # Exact curl output and metrics
│   └── screenshots/         # 27 screenshots (headers, PageSpeed, DevTools, curl)
└── recommendations/         # Reference implementations (Next.js 14+/15, TypeScript)
    ├── vercel.json              # ARCH-01  function region -> Mumbai
    ├── next.config.js           # SEC-01/02/04, PERF-01  headers + 308 redirect
    ├── middleware.ts            # SEC-02/03  scoped CORS, /admin & /portal guard, nonce CSP
    ├── app/robots.ts            # SEC-03, CONF-01  clean robots.txt
    ├── app/sitemap.ts           # PERF-03  cached sitemap
    ├── app/api/contact/route.ts # API baseline: Zod validation, rate limit, error envelope
    └── components/Hero.tsx      # PERF-02  server-rendered LCP headline
```

## Methodology

1. Browsed the site normally in Chrome.
2. Scanned response headers with [securityheaders.com](https://securityheaders.com).
3. Collected lab + real-user (CrUX) metrics with [PageSpeed Insights](https://pagespeed.web.dev), mobile and desktop.
4. Inspected the request waterfall in Chrome DevTools → Network.
5. Ran `curl -I` against the apex domain, a non-existent route and `/sitemap.xml`; read `/robots.txt`.

Fewer than 10 manual requests were sent in total.

## Technical setup notes

The files in `recommendations/` are **drop-in reference snippets**, not a runnable app, because the Cynbit source code is not public. To use them in a Next.js App Router project:

```bash
npm install zod @upstash/ratelimit @upstash/redis
```

- Copy `vercel.json`, `next.config.js` and `middleware.ts` to the project root.
- Copy `app/*` and `components/*` into the matching folders.
- Environment variables: `SITE_URL=https://www.cynbit.in`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Deploy CSP as `Content-Security-Policy-Report-Only` first; switch to enforcing after reviewing violations.
- Verify after deploy:
  ```bash
  curl -I https://cynbit.in            # expect 308
  curl -I https://www.cynbit.in        # expect CSP, XFO, nosniff... and no ACAO: *
  curl -I https://www.cynbit.in/sitemap.xml   # expect x-vercel-cache: HIT, bom1 region
  ```

## Author

**Raghav Pareek**, applicant, Backend Developer Intern
