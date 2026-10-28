# saleor-commerce — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | OpenNext on Workers + Static Assets, the commerce baseline's shape | The storefront is a Next.js App Router app: route handlers, server actions, middleware and `next/og` run in the Worker | `specs/epics/saleor-commerce/design.md` §2 |
| 2 | The incremental cache in R2, the tag cache (sharded) and the revalidation queue in Durable Objects — not the brief's D1 tag cache | The commerce baseline's proven shape: no database to provision or seed; tag revalidation needs strong consistency | design.md §3, risk SC-F |
| 3 | `experimental.useCache`, not `cacheComponents`; partial prerendering and Instant Navigations off; the five `instant`/`prefetch` route configs removed | A Cache Components page answers 500 then hangs under the adapter (opennextjs-cloudflare#1450); those configs are Cache Components options. Every `"use cache"` read, profile and tag is kept | design.md §4, risk SC-C |
| 4 | Next.js 16.3.8, not upstream's 16.4.1 | 16.4.x fails every request on @opennextjs/cloudflare 1.20.11, the newest on npm | risk SC-D |
| 5 | GraphQL types, codegen and the GraphQL lint read Saleor's published schema (`apps/web/schema.graphql`, 3.23.44), not the live API | The build, type check, lint and tests then need no store, before and after one is connected | design.md §5 |
| 6 | No store, no calls: one connection seam (`src/lib/saleor-connection.ts`); unconnected, no channels, every page redirects to `/`, `/` says "Connect your Saleor store" | A baseline goes live with no key the platform cannot broker, and Saleor has no public demo API; the template's own unconfigured state, made explicit | design.md §6 |
| 7 | The API URL and channel are OPTIONAL build secrets (`optionalSecretEnv`); the revalidation secrets and the app token are Worker secrets | The build inlines the URL (the browser's checkout calls it); the secrets are read at request time | design.md §6 |
| 8 | One store-name seam (`SITE_NAME`, `src/config/brand.ts`); the five places upstream spelled the name read it; the leak gate fails a sixth | The rename rewrites one line and has no sweep for the name | risk SC-H |
| 9 | Each environment builds for its own origin: `NEXT_PUBLIC_STOREFRONT_URL` = `SITE_URL` or the workers.dev URL | The storefront's canonical, Open Graph and redirect-allowlist URLs need an absolute origin | design.md §6 |
| 10 | Images unoptimized; Speed Insights only on Vercel | Workers has no Next.js image optimizer and Saleor's thumbnails are sized; the Speed Insights script 404s off Vercel | IMPLEMENTATION-STATUS |
| 11 | The lockfile seeded from upstream's (its importer moved to `apps/web`), direct ranged dependencies at upstream's locked versions | Upstream's tested resolutions, not a fresh drift | IMPLEMENTATION-STATUS |
| 12 | The e2e connects a stand-in Saleor (`testing/lib/fake-saleor.mjs`): graphql-js over the published schema, one default resolver by type and name | It answers every query the storefront sends without a list of them, so it cannot drift from the storefront | design.md §7 |
| 13 | stack-tectonic 0.19.0, `ci.yml` as the commerce baseline's, no `checks.yml`, the domain not asked, the subdomain from the Cloudflare connection | The commerce baseline's settled shape | `intent.yaml`, `blueprint.yaml` |
| 14 | Workers Paid is a stated requirement, `/api/og` (resvg wasm, 1.4 MB) kept | Dropping a template route to fit Free would change the product | risk SC-B |
