# Cynbit.in: Backend Technical Audit

**Author:** Raghav Pareek, Backend Developer Intern applicant
**Date of observation:** 30 October 2026 (IST)
**Target:** `https://cynbit.in` / `https://www.cynbit.in`
**Scope:** Passive, unauthenticated observation only. No exploitation, fuzzing, brute-forcing, port scanning or load generation. Every request made was one a normal visitor or search engine would make.

---

## 1. Executive summary

Cynbit.in is a **Next.js (App Router) application deployed on Vercel**, with most pages prerendered and served from Vercel's edge cache. The foundation is sound: HTTPS is enforced with a two-year HSTS policy, the home page is a static cache hit, 404s return a real 404 status, and no stack traces or secrets leak.

The audit found **11 issues**, none critical. The most important ones are:

1. **Dynamic routes run in the US (`iad1`), not India.** Uncached requests from Indian users travel Mumbai edge → Washington D.C. function → back. This is the most likely backend cause of the **1.4 s mobile TTFB** seen in real-user data.
2. **Five standard security headers are missing site-wide** (securityheaders.com grade **D**), and every response carries `Access-Control-Allow-Origin: *`.
3. **The apex domain uses a `307 Temporary` redirect** to `www`, and `robots.txt` advertises the sitemap on the redirecting host, so every new visitor and crawler pays an extra round trip.
4. **Mobile Core Web Vitals fail for real users** (LCP 4.2 s field / 10.4 s lab), driven by an animated hero headline, render-blocking resources and ~121 KiB of unused JavaScript.
5. **`robots.txt` publicly lists `/admin/`, `/portal/` and `/api/`.** This is not a vulnerability by itself, but it tells anyone where the sensitive surfaces are.

All recommended fixes are configuration-level changes in `next.config.js`, `vercel.json` and `middleware.ts`, with an estimated effort of **under one engineering day** for the high-priority items. Reference implementations are in [`/recommendations`](../recommendations).

---

## 2. Methodology

| Step | Tool | What it showed |
|---|---|---|
| 1 | Chrome browser | Normal browsing of the home page |
| 2 | [securityheaders.com](https://securityheaders.com) | HTTP response headers + grade |
| 3 | [PageSpeed Insights](https://pagespeed.web.dev) | Lab (Lighthouse 13.6) **and** 28-day real-user (CrUX) metrics |
| 4 | Chrome DevTools → Network | Request waterfall, prefetch behaviour, third parties |
| 5 | `curl.exe -I` (HEAD) | Raw headers for redirect, 404, sitemap |
| 6 | `curl.exe` | Contents of public `robots.txt` |

Total requests sent manually: fewer than 10. All raw output is in [`raw-evidence.md`](raw-evidence.md), screenshots in [`screenshots/`](screenshots).

**Limitations.** Without source access, statements about internal architecture are *inferences from headers*, and are labelled as such. I did not submit any form, so no claims are made about form or API validation; section 7 gives a recommended pattern instead.

---

## 3. Observed architecture

```
                   ┌──────────────────────────────────────────────┐
  User (Jaipur) ──▶│ Vercel Edge Network  (bom1 = Mumbai PoP)       │
                   │                                              │
                   │  cynbit.in ──307──▶ www.cynbit.in             │
                   │                                              │
                   │  Edge cache HIT  ──▶ prerendered HTML / 404   │  ~fast
                   │  Edge cache MISS ──┐                          │
                   └────────────────────┼─────────────────────────┘
                                        ▼
                   ┌──────────────────────────────────────────────┐
                   │ Serverless Function  (iad1 = Washington D.C.) │  ~slow for India
                   │ Next.js App Router: RSC payloads, sitemap.xml │
                   └──────────────────────────────────────────────┘
```

How each part was identified:

| Evidence (header) | Inference |
|---|---|
| `server: Vercel`, `x-vercel-id` | Hosted on Vercel |
| `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300` | Next.js with static prerendering / ISR (5-minute client stale time) |
| `vary: rsc, next-router-state-tree, next-router-prefetch…` | **App Router** with React Server Components |
| `?_rsc=` requests in Network tab | RSC payload fetches used for client-side navigation and `<Link>` prefetching |
| `x-vercel-cache: HIT`, `age: 76031` | Home page served from edge cache (~21 h old copy) |
| `x-vercel-id: bom1::…` (my requests) vs `dub1::…` (scanner in EU) | Requests are served from the nearest edge PoP; Indian users hit **Mumbai** |
| `x-vercel-id: bom1::iad1::…` on `/sitemap.xml` | Edge Mumbai → **function executed in `iad1`** (US East, Vercel's default region) |
| `HTTP/2 103` | Early Hints enabled |
| `content-encoding: gzip` | Compression enabled |
| `x-matched-path: /404`, `x-next-error-status: 404` | Custom Next.js `not-found` page, statically cached |
| `Disallow: /api/ /admin/ /portal/` | Route handlers under `/api`, plus admin and portal areas (not visited) |
| `collect?…tid=G-…` | Google Analytics 4 |

### What is already done well

- HSTS with `max-age=63072000` (2 years) on every response.
- Static prerendering + edge caching for the home page and 404 page.
- Correct `404` status on unknown routes (no "soft 404"), and no stack trace, framework error or internal path in the body.
- HTTP/2, `103 Early Hints`, gzip compression and ETags for revalidation.
- `Cache-Control: max-age=0, must-revalidate` on HTML, so browsers always revalidate and deploys show up immediately while the CDN still caches.
- Low CLS (0 to 0.01) and SEO/Best-Practices scores of 100.

---

## 4. Findings summary

| ID | Title | Category | Severity | Effort |
|---|---|---|---|---|
| ARCH-01 | Serverless functions run in `iad1` (US) for an India-first audience | Architecture / Performance | **High** | Low |
| SEC-01 | Missing CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | Security | **Medium** | Low |
| SEC-02 | `Access-Control-Allow-Origin: *` on all responses | Security | **Medium** | Low |
| SEC-03 | `robots.txt` discloses `/admin/`, `/portal/`, `/api/` | Security / Info disclosure | Low | Low |
| SEC-04 | HSTS lacks `includeSubDomains` and `preload` | Security | Low | Low |
| PERF-01 | Apex → www uses `307 Temporary` redirect | Performance / SEO | **Medium** | Low |
| PERF-02 | Mobile Core Web Vitals fail (LCP 4.2 s field, 10.4 s lab) | Performance | **High** | Medium |
| PERF-03 | `sitemap.xml` is rendered dynamically on every request | Performance / Caching | Low | Low |
| PERF-04 | 9 RSC prefetches fire on page load | Performance / Bandwidth | Low | Low |
| PERF-05 | 121 KiB unused JS, 12 KiB legacy JS, 560 ms render-blocking | Performance | Medium | Medium |
| CONF-01 | Canonical host inconsistency (`robots.txt` points to apex) | Configuration / SEO | Low | Low |

Severity scale: **High** = measurable impact on real users or a likely attack precondition; **Medium** = defence-in-depth gap or significant inefficiency; **Low** = hygiene / best practice.

---

## 5. Detailed findings

### ARCH-01: Serverless functions run in the US (`iad1`) · High

**Evidence (E4):**
```
X-Vercel-Cache: MISS
X-Vercel-Id: bom1::iad1::d7slc-1793357816014-a05398270d53
```
The `x-vercel-id` format is `<edge-region>::<function-region>::<id>`. For a cache miss, my request entered at Mumbai (`bom1`) and was executed in **`iad1` (Washington D.C.)**, which is Vercel's default function region.

**Impact.** Every uncached request (ISR revalidation, RSC payloads for dynamic segments, `/api/*` route handlers, sitemap) crosses the globe twice. Mumbai ↔ US-East round-trip latency is typically ~200 to 250 ms, and a cold start adds more. This matches the real-user data: **mobile field TTFB is 1.4 s** (target < 0.8 s) while desktop is 0.4 s. If the API or admin backend talks to a database, the database region matters just as much.

**Recommendation.**
- Set the function region to **`bom1` (Mumbai)** in `vercel.json` (or Project → Settings → Functions).
- Keep the database in the same region as the functions (e.g. `ap-south-1`).
- For purely static content, prefer `export const dynamic = 'force-static'` or ISR so requests never reach a function.

Reference: [`recommendations/vercel.json`](../recommendations/vercel.json)

---

### SEC-01: Missing security headers site-wide · Medium

**Evidence (E5, E2, screenshots 02-05):** securityheaders.com grade **D**. Missing on the home page *and* on the 404 page, i.e. at the platform level:

| Header | Risk when missing |
|---|---|
| `Content-Security-Policy` | No browser-level containment if an XSS bug is ever introduced (e.g. via CMS/blog content or a compromised third-party script) |
| `X-Frame-Options` / `frame-ancestors` | Site can be framed by other origins → **clickjacking**, especially relevant for `/portal/` and `/admin/` |
| `X-Content-Type-Options: nosniff` | MIME-sniffing of user-supplied or mis-typed files |
| `Referrer-Policy` | Full URLs (possibly with query parameters) leak to third parties |
| `Permissions-Policy` | Camera, microphone, geolocation etc. not explicitly disabled |

Lighthouse's *Trust and Safety* section independently flags the same gaps (CSP, XFO, COOP, Trusted Types), screenshot 21.

**Recommendation.** Add all headers centrally in `next.config.js` `headers()` (applies to pages, assets and 404s). Roll out CSP in `Content-Security-Policy-Report-Only` mode first, collect violations for a week, then enforce. For a stricter CSP with inline scripts, use a per-request nonce generated in `middleware.ts`.

Reference: [`recommendations/next.config.js`](../recommendations/next.config.js), [`recommendations/middleware.ts`](../recommendations/middleware.ts)

---

### SEC-02: Wildcard CORS on every response · Medium

**Evidence:** `Access-Control-Allow-Origin: *` on the home page (E5) **and** the 404 page (E2), so it is applied globally (likely a catch-all rule in `next.config.js` or `vercel.json`).

**Impact.** For static marketing HTML this is harmless. The risk is that the same catch-all rule very likely also covers `/api/*` and `/portal/*`. Any website could then read responses from those endpoints from a visitor's browser. Browsers block `*` together with cookies, which limits impact, but token-in-header APIs, public data endpoints and future features remain exposed, and a later "fix" that reflects the `Origin` header with credentials would make it critical.

Note: I did not call any `/api` endpoint, so whether they inherit the header is **not verified**; it is flagged because the header is clearly global.

**Recommendation.** Remove the global header. Return CORS headers only on the specific API routes that need cross-origin access, against an explicit allow-list (`https://www.cynbit.in`, partner domains), and add `Vary: Origin`.

Reference: [`recommendations/middleware.ts`](../recommendations/middleware.ts)

---

### SEC-03: `robots.txt` advertises sensitive paths · Low

**Evidence (E3):** `Disallow: /api/`, `Disallow: /admin/`, `Disallow: /portal/`

**Impact.** `robots.txt` is a crawling hint, not access control. Listing these paths tells automated scanners exactly where the admin panel and APIs live. (I deliberately did **not** visit `/admin/` or `/portal/`, as that would go beyond passive testing.)

**Recommendation.**
- Remove `/admin/` and `/portal/` from `robots.txt`. Instead, send `X-Robots-Tag: noindex, nofollow` from those routes so they are never indexed.
- Ensure they are protected server-side in `middleware.ts` (session check → redirect to login), with rate-limited login, MFA for admins, and ideally an IP allow-list or Vercel deployment protection for `/admin`.
- `Crawl-delay` is ignored by Google; it can be removed.

Reference: [`recommendations/app/robots.ts`](../recommendations/app/robots.ts), [`recommendations/middleware.ts`](../recommendations/middleware.ts)

---

### SEC-04: HSTS not hardened · Low

**Evidence:** `Strict-Transport-Security: max-age=63072000` (no `includeSubDomains`, no `preload`).

**Recommendation.** After confirming every subdomain serves HTTPS, use `max-age=63072000; includeSubDomains; preload` and submit the domain to hstspreload.org. This protects the very first visit and all subdomains.

---

### PERF-01: Apex redirect is `307 Temporary` · Medium

**Evidence (E1):**
```
HTTP/1.1 307 Temporary Redirect
Location: https://www.cynbit.in/
```

**Impact.**
- Every first-time visitor typing `cynbit.in` (the address printed in the company's own materials) pays an extra DNS + TLS + HTTP round trip before any content loads. On mobile networks this is roughly 100 to 300 ms, contributing to the poor mobile TTFB/LCP.
- `307` tells search engines the move is temporary, so ranking signals are consolidated less reliably than with a permanent redirect.

**Recommendation.** In Vercel → Domains, set the apex redirect to **`308 Permanent`**. Better still, use one canonical host everywhere (sitemap, `robots.txt`, `<link rel="canonical">`, emails, social profiles) so the redirect is almost never hit.

Reference: [`recommendations/next.config.js`](../recommendations/next.config.js) (`redirects()`)

---

### PERF-02: Mobile Core Web Vitals failing · High

**Evidence (E6, screenshots 06-11):** Real-user (CrUX, 28 days) mobile assessment **Failed**: LCP **4.2 s** (good ≤ 2.5 s), FCP 3.0 s, TTFB 1.4 s. Lab: LCP **10.4 s**, Speed Index 5.7 s, the first four filmstrip frames are blank. Desktop passes.

**Root causes (from Lighthouse + observation):**
1. **Animated hero headline.** The headline word cycles ("Mobile apps" → "AI automation" → "Software dev." → "IT systems." → "Cloud solutions"). Each new render can become a new LCP candidate, pushing LCP out to the last animation frame.
2. **Backend latency:** apex redirect (PERF-01) + US function region (ARCH-01).
3. **Render-blocking requests** costing ~560 ms on mobile.
4. **Unused / legacy JavaScript** delaying hydration (PERF-05).

**Recommendation.**
- Server-render the **first headline word statically** and start the rotation only after hydration, so LCP is fixed at first paint.
- Fix PERF-01 and ARCH-01.
- Inline critical CSS / use `next/font` with `display: swap` to remove render-blocking font and CSS requests.
- Track field metrics continuously with `useReportWebVitals` → analytics, and set a performance budget in CI (e.g. Lighthouse CI LCP < 2.5 s).

Reference: [`recommendations/components/Hero.tsx`](../recommendations/components/Hero.tsx)

---

### PERF-03: `sitemap.xml` regenerated on every request · Low

**Evidence (E4):** `X-Vercel-Cache: MISS`, `Age: 0`, executed in `iad1`. The sitemap also carries the RSC `Vary` header, which fragments the cache key.

**Impact.** Unnecessary function invocations (cost) and slow responses to crawlers; if the sitemap queries a CMS/database, crawler traffic becomes database load.

**Recommendation.** Make `app/sitemap.ts` static or ISR (`export const revalidate = 3600`) and use one canonical host in all URLs.

Reference: [`recommendations/app/sitemap.ts`](../recommendations/app/sitemap.ts)

---

### PERF-04: Eager RSC prefetching · Low

**Evidence (E7, screenshot 24):** Nine `?_rsc=` requests fire on page load without any user interaction, up to **917 ms** each.

**Impact.** Wasted mobile data and bandwidth contention with critical resources during the most important first seconds. Prefetches that miss the cache also invoke functions in `iad1`.

**Recommendation.** For below-the-fold or rarely clicked links (footer, mega-menu), use `<Link prefetch={false}>` or prefetch on hover/intent. Keep default prefetching only for the 1-2 primary CTAs.

---

### PERF-05: JavaScript weight · Medium

**Evidence (E6, screenshots 10, 11, 18):** ~121 KiB unused JS, 12 KiB legacy polyfills, 3-4 long main-thread tasks, "forced reflow" warning, 76 requests / 4.2 MB uncompressed resources on the home page.

**Recommendation.**
- Load heavy, non-critical client components (animations, chat widgets) with `next/dynamic` after first paint.
- Keep components as Server Components by default; add `"use client"` only where interactivity is needed.
- Update `browserslist` to modern targets to drop legacy polyfills.
- Analyse bundles with `@next/bundle-analyzer` in CI.
- Load Google Analytics with `next/script` `strategy="afterInteractive"` (or `lazyOnload`).

---

### CONF-01: Canonical host inconsistency · Low

**Evidence (E1 + E3):** The site lives on `www.cynbit.in`, but `robots.txt` advertises `Sitemap: https://cynbit.in/sitemap.xml`, which itself redirects.

**Recommendation.** Generate `robots.txt` and the sitemap from a single `SITE_URL` environment variable (`https://www.cynbit.in`) so they can never drift.

---

## 6. Accessibility (secondary, frontend)

Lighthouse accessibility is 82-83. Issues reported: insufficient colour contrast, heading levels skipped, `<li>` elements outside `<ul>/<ol>`, and small touch targets. These are frontend fixes but are worth noting because they affect a measurable share of users and SEO.

---

## 7. Recommended backend patterns for the API surface

`robots.txt` confirms an `/api/` namespace (contact forms, job applications for "Join Us", BitElevate enrolment are likely). I did not submit forms, so the following is a **recommended baseline**, not a finding:

| Concern | Recommendation |
|---|---|
| Validation | Schema-validate every request body on the server (Zod), with length limits and an explicit allow-list of fields |
| Abuse | Per-IP rate limiting (e.g. Upstash Redis sliding window), honeypot field or Turnstile/reCAPTCHA on public forms |
| Body size | Reject bodies > 10 KB on JSON endpoints; validate file type and size for resume uploads, store in object storage, never on the function filesystem |
| Errors | Uniform JSON error envelope `{ error: { code, message } }`, correct status codes (400/401/403/404/409/422/429/500), never return stack traces |
| Observability | Structured JSON logs with a request ID (`x-vercel-id`), error tracking (Sentry), uptime checks on `/api/health` |
| Secrets | Server-only env vars (no `NEXT_PUBLIC_` prefix for keys), rotation policy |
| Auth for `/portal` & `/admin` | HttpOnly + Secure + SameSite=Lax session cookies, CSRF protection on mutations, role checks in both middleware and the route handler |

Reference implementation: [`recommendations/app/api/contact/route.ts`](../recommendations/app/api/contact/route.ts)

---

## 8. Prioritised roadmap

| Priority | Action | Findings | Effort |
|---|---|---|---|
| **P0** (this week) | Move functions to `bom1`; set apex redirect to 308 | ARCH-01, PERF-01 | < 1 hour |
| **P0** | Add security headers; remove global CORS | SEC-01, SEC-02 | 2-3 hours |
| **P1** | Static first headline word; lazy-load hero animation | PERF-02 | 2-4 hours |
| **P1** | Clean `robots.txt`; protect `/admin` & `/portal` in middleware; `noindex` header | SEC-03 | 1-2 hours |
| **P2** | Static sitemap; selective prefetch; bundle analysis | PERF-03/04/05, CONF-01 | 1 day |
| **P2** | Enforce CSP (after Report-Only period); HSTS preload | SEC-01, SEC-04 | 1-2 weeks elapsed |
| **Ongoing** | Lighthouse CI budgets, Web Vitals monitoring, API validation baseline | all | continuous |

**Expected outcome:** mobile TTFB from 1.4 s toward < 0.8 s, mobile LCP into the "good" range, securityheaders.com grade from **D to A**.

---

## 9. Appendix

- Raw command output and metrics: [`raw-evidence.md`](raw-evidence.md)
- Screenshots: [`screenshots/`](screenshots)
- Code: [`../recommendations/`](../recommendations)
