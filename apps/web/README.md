# apps/web — the storefront

Saleor's Next.js storefront, "Paper" ([saleor/storefront](https://github.com/saleor/storefront)
at `a6e357a`, the Functional Source License 1.1 — `LICENSE`), on Cloudflare
Workers + Static Assets. Its pages, components, data layer, checkout and
tests are upstream's; what this app adds is the Workers build, the cache
bindings, the schema its types are generated from, and a storefront that
deploys before a Saleor store is connected.

- `src/app/` — the routes: `(root)` (`/`, which redirects to the default
  locale and channel — or, with no store connected, says how to connect one),
  `(storefront)/[locale]/[channel]` (home, categories, collections, products,
  search, cart, account, orders, sign-in), `(checkout)` (`/checkout`,
  `/order`), and `api/` (`revalidate` for Saleor's webhook, `og`, `auth`,
  `listing`, `cache-info`, `health`)
- `src/lib/saleor/` — the data layer: every read is a `"use cache"` function
  tagged by entity with a named `cacheLife` profile (`cache/`), and the
  webhook's invalidation plan (`invalidation/`)
- `src/lib/saleor-connection.ts` — whether the build had a Saleor API URL; the
  middleware, the channel list and the checkout layout ask it first
- `src/config/brand.ts` — the store's name (`SITE_NAME`)
- `schema.graphql` — Saleor's published GraphQL schema (Saleor 3.23,
  `saleor/graphql/schema.graphql` in saleor/saleor), which codegen
  (`.graphqlrc.ts`, `src/checkout/graphql/codegen.ts`) and the GraphQL lint
  read instead of a live API
- `docs/`, `skills/saleor-paper-storefront/` — Saleor's own guides to the
  storefront: configuration, caching, checkout and payments, international
  stores, its architecture decisions

```bash
pnpm dev        # GraphQL types, then next dev on http://localhost:3000
pnpm build      # GraphQL types, next build, opennextjs-cloudflare build → .open-next/
pnpm preview    # wrangler dev over the built Worker: a local R2 bucket, local Durable Objects
pnpm test       # GraphQL types, then the storefront's vitest suite
```

The cache's bucket is not hand-written. `wrangler.template.jsonc` names it as
a wiring token; `wrangler.jsonc` is that template rendered from
`wiring.fixture.json` (`pnpm run wire:fixture`) for local work, and on every
deploy from the wiring document the `cloudflare-r2` root publishes. The
Durable Objects (the tag cache and the revalidation queue) are classes the
generated Worker exports; the config's `migrations` create them.

What differs from upstream, and why:

- **Cache Components and Instant Navigations are off.** On Workers through
  @opennextjs/cloudflare 1.20 a Cache Components page answers 500 and then
  hangs (opennextjs-cloudflare#1450). `experimental.useCache` keeps every
  `"use cache"` read, its `cacheLife` profile and its tags; routes render per
  request from those cached reads. The five `instant` / `prefetch` route
  segment configs are Cache Components options and went with it.
- **Next.js 16.3.8, not 16.4.1**: the adapter's newest npm release cannot
  serve 16.4 yet.
- **The GraphQL types come from `schema.graphql`**, not from the live API, so
  the build, the type check, the lint and the tests need no store.
- **No store, no calls**: with no `NEXT_PUBLIC_SALEOR_API_URL` the storefront
  has no channels, the middleware sends every page to `/`, `/` says "Connect
  your Saleor store", and the checkout layout redirects there too; the auth
  client reads the URL when it is made, not when it is imported.
- **One store-name seam**: upstream spelled "Saleor Store" in five places;
  each reads `SITE_NAME` now.
- **Images unoptimized** (Workers has no Next.js image optimizer; Saleor's
  thumbnail endpoint already sizes them), and **Speed Insights off unless the
  build runs on Vercel**, as upstream already does for Web Analytics.
- **`/api/health`** for the deploy's smoke test.
- **Lint has a 4 GiB heap**: upstream's type-aware lint outgrows Node's
  default on a small machine. Its warnings are upstream's.
- Not carried: the Dockerfile and docker-compose, the Vercel and GitHub
  workflows, the husky hooks, the Cursor and MCP configuration.
