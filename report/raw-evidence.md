# Raw Evidence

All data below was collected passively on **30 Oct 2026 (IST)** using a normal browser, `curl -I` (HEAD requests), and free public scanners. No authentication, fuzzing, scanning, or load testing was performed.

---

## E1. Apex domain redirect

```
> curl.exe -I https://cynbit.in

HTTP/1.1 307 Temporary Redirect
Cache-Control: public, max-age=0, must-revalidate
Content-Type: text/plain
Date: Fri, 30 Oct 2026 10:54:54 GMT
Location: https://www.cynbit.in/
Server: Vercel
Strict-Transport-Security: max-age=63072000
X-Vercel-Id: bom1::cxbf2-1793357694980-a8902e88e27c
```

## E2. Unknown route (404 handling)

```
> curl.exe -I https://www.cynbit.in/xyz123

HTTP/1.1 404 Not Found
Accept-Ranges: bytes
Access-Control-Allow-Origin: *
Age: 57210
Cache-Control: public, max-age=0, must-revalidate
Content-Disposition: inline; filename="404"
Content-Length: 15072
Content-Type: text/html; charset=utf-8
Date: Fri, 30 Oct 2026 10:55:07 GMT
Etag: "fa7fbe530587a530b4fa6a70e39f4d29"
Last-Modified: Thu, 29 Oct 2026 19:01:37 GMT
Server: Vercel
Strict-Transport-Security: max-age=63072000
X-Matched-Path: /404
X-Next-Error-Status: 404
X-Vercel-Cache: HIT
X-Vercel-Id: bom1::k85rn-1793357707744-b5136045ec64
```

## E3. robots.txt

```
> curl.exe https://www.cynbit.in/robots.txt

User-agent: *
Allow: /

# Sitemap Location
Sitemap: https://cynbit.in/sitemap.xml

# Crawl Delay
Crawl-delay: 1

# Disallow specific non-SEO pages
Disallow: /api/
Disallow: /admin/
Disallow: /portal/
```

## E4. sitemap.xml

```
> curl.exe -I https://www.cynbit.in/sitemap.xml

HTTP/1.1 200 OK
Age: 0
Cache-Control: public, max-age=0, must-revalidate
Content-Type: application/xml
Date: Fri, 30 Oct 2026 10:56:58 GMT
Server: Vercel
Strict-Transport-Security: max-age=63072000
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
X-Matched-Path: /sitemap.xml
X-Vercel-Cache: MISS
X-Vercel-Id: bom1::iad1::d7slc-1793357816014-a05398270d53
```

## E5. Homepage response headers (via securityheaders.com, scanned from Europe)

```
HTTP/2 103   (Early Hints)
HTTP/2 200
access-control-allow-origin: *
age: 76031
cache-control: public, max-age=0, must-revalidate
content-disposition: inline
content-encoding: gzip
content-type: text/html; charset=utf-8
etag: W/"babdce9795e4ef3d84461090987852d3"
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
x-vercel-cache: HIT
x-vercel-id: dub1::n2flw-1793355563155-77215bcdaed4
```

Grade: **D**. Missing: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
Screenshots: `screenshots/02` to `05`.

## E6. PageSpeed Insights (Lighthouse 13.6.0)

| Metric | Mobile | Desktop |
|---|---|---|
| Performance score | 68 | 86 |
| Accessibility | 83 | 82 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| **Field** Core Web Vitals (28-day CrUX) | **Failed** | Passed |
| Field LCP | **4.2 s** | 2.2 s |
| Field FCP | 3.0 s | 1.2 s |
| Field TTFB | **1.4 s** | 0.4 s |
| Field CLS | 0.01 | 0.01 |
| Lab FCP | 1.7 s | 0.5 s |
| Lab LCP | **10.4 s** | 2.0 s |
| Lab TBT | 160 ms | 160 ms |
| Lab Speed Index | 5.7 s | 1.0 s |
| Render-blocking savings | 560 ms | 160 ms |
| Unused JavaScript | 121 KiB | 122 KiB |
| Legacy JavaScript | 12 KiB | 12 KiB |

Note: PSI reported *"Showing results for URL: https://www.cynbit.in/"*, i.e. it followed the apex redirect.
Screenshots: `screenshots/06` to `23`.

## E7. Chrome DevTools Network panel (homepage, desktop viewport)

- 76 requests, 1.3 MB transferred, 4.2 MB resources, Finish 8.59 s, DOMContentLoaded 1.34 s
- Main document `www.cynbit.in`: 200, 16.1 kB, 284 ms
- 9 automatic `?_rsc=` prefetch requests fired on load without user interaction:
  `careers, impact, ai-agents-business-operations, contact, case-studies, bitelevate, paths, diaries, blog` (68 ms to 917 ms each; mix of 200 and 304)
- Google Analytics 4 beacon `collect?v=2&tid=G-...` (204)

Screenshots: `screenshots/24` to `26`.
