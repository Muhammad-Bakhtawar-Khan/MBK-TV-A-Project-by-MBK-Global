# MBK TV

MBK TV is a static television-discovery experience by MBK Global. The supplied design, channel directory, search, filters, favorites, recent history, profile view, and client-side HLS playback are preserved.

## Architecture

```text
index.html                    # Semantic document and external asset references only
src/styles/mbk-tv.css         # All MBK TV styling and responsive rules
src/js/main.js                # Browser module entry point
src/js/app.js                 # UI, routing, filtering, favorites, and player orchestration
src/js/channel-data.js        # Public, authorized channel catalogue
```

There is deliberately no backend: the current app has no login, private operation, or secret-dependent integration. Adding an empty server would not improve security. If a future feature needs a private API key, privileged media lookup, authentication, or server-side URL fetching, it must be implemented in a server/API route with validation, authorization, rate limits, explicit CORS, and server-only environment variables.

## Development

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

Deploy the generated `dist/` directory to a static host such as Cloudflare Pages, Netlify, Vercel static output, or GitHub Pages. No backend deployment is required for the current feature set.

## Security notes

- The browser files are public by design. Separating or minifying JavaScript does **not** hide it from visitors.
- No private API keys, credentials, passwords, or server-side secrets are present in the source or public bundle.
- Stream URLs are validated against an approved HTTPS host allowlist before playback; URLs with credentials are rejected.
- Dynamic directory content is created with DOM APIs and `textContent`, not untrusted HTML insertion.
- Production Vite builds minify assets and disable source maps (`build.sourcemap: false`). Minification is a delivery optimization, not a security control.
- HLS playback uses the existing jsDelivr dependency. For a restrictive production CSP, audit, pin, and self-host that dependency, then allow only the required script, font, image, and stream origins.
- Configure HTTPS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` at the hosting/CDN layer after validating required external origins.

## Verification

`pnpm build` passes. Runtime stream availability remains dependent on the external authorized providers and their CORS/network policies.

## SEO and Google Search Console

The public homepage is the sole canonical and indexable URL. `public/robots.txt` allows crawling and references `https://mbktv.vercel.app/sitemap.xml`; `public/sitemap.xml` contains only the canonical homepage. After deployment, add `https://mbktv.vercel.app/` as a Domain or URL-prefix property in Google Search Console, complete the ownership verification method Google provides, submit `https://mbktv.vercel.app/sitemap.xml`, and use URL Inspection to request crawling. This repository cannot confirm indexing, verification, or ranking.
