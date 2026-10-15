# Security headers deployment

With `DJANGO_DEBUG=0`, Django requires `DJANGO_CORS_ALLOWED_ORIGINS` containing
explicit HTTPS frontend origins. `DJANGO_CSRF_TRUSTED_ORIGINS` defaults to that
list and can be set separately. Wildcards, HTTP production origins, credentials,
paths, queries, and fragments are rejected. Cookies are secure in production,
HTTP redirects to HTTPS, and HSTS starts at 300 seconds. Development retains
localhost HTTP defaults. Keep `DJANGO_ALLOWED_HOSTS` restricted to real API hosts.

## TLS proxy boundary

Set `DJANGO_HTTPS_TRUSTED_PROXIES` to the actual reverse proxy peer addresses/CIDRs.
The proxy must overwrite `X-Forwarded-Proto` with a single `https` or `http` value
and prevent clients reaching the application origin directly. Untrusted or
malformed forwarded protocol headers are stripped before HTTPS redirects,
SecurityMiddleware, and CSRF checks. TLS terminated directly by the application
does not require this setting. Rate-limit proxy configuration remains separate.

## CSP and frontend hosting

Django enforces a same-origin script policy through Django 6 CSP middleware.
Inline scripts and eval are blocked. Inline styles are permitted for admin
widgets. Framing and embedded objects are prohibited. The development policy
keeps the browsable API usable. Production API clients should request JSON;
the browsable API's inline scripting is intentionally restricted.

Build the frontend with an explicit HTTPS `VITE_API_URL` matching the real API origin;
missing values or HTTP URLs cause production builds to fail.
The build emits `_headers` for hosts supporting that format and
`security-headers.conf` for Nginx. Configure the chosen host to apply the emitted
headers on every SPA route and asset, including error responses. Vite preview
also applies the emitted build policy for local verification. HTTP loopback APIs
remain allowed for the development server, not production builds.

For Nginx, include `cache-headers.conf` in the `http` context, and include
`security-headers.conf` inside the frontend HTTPS server block;
serve `frontend/dist` with `try_files $uri $uri/ /index.html`. Configure a separate
port-80 server returning `308 https://<canonical-frontend-host>$request_uri` and
real TLS certificates. Apply Django's own policy to API/admin responses, rather
than replacing it with the frontend policy. If a nested location defines
`add_header`, it must include the security headers again because Nginx header
inheritance changes. Deny direct access to both generated `.conf` files.
Reload both files from the same build on each deployment. See
[caching deployment details](../reliability/caching.md) for HTML revalidation,
immutable asset rules, and host-specific fallback limitations.

The frontend CSP allows scripts/fonts from its own origin, API connections and
images from the configured API origin, and data/blob image previews. Styles permit
inline values required by React, Bootstrap, GSAP, and toast notifications. No
script `unsafe-inline`, `unsafe-eval`, wildcard origins, or third-party CDN sources
are allowed. Additional services require deliberate policy changes.

## HSTS rollout and release checks

Validate login/CSRF, admin forms, uploads, image previews, and checkout on staging
under enforced CSP. Inspect browser CSP errors and HTTPS headers on root, nested
SPA routes, assets, API, admin, and error responses. Then increase
`DJANGO_HSTS_SECONDS` and the frontend host HSTS duration together (for example
86400, then 31536000). Subdomain inclusion and preload stay disabled; enable them
only after every affected hostname is permanently HTTPS-ready. Confirm real
HTTP-to-HTTPS redirects and proxy headers at the deployed edge; repository tests
cannot confirm an external host's configuration.
