# saleor-commerce — implementation status

| Milestone | State | Landed |
|---|---|---|
| SC0 — the spec | ✅ | SC-1 |
| SC1 — the storefront on Workers | ✅ | SC-2 |
| SC2 — a baseline | planned | SC-3 |

## Departures from the upstream template

Everything not listed here is saleor/storefront as it is at `a6e357a`.

| # | What | Why |
|---|---|---|
| 1 | The app lives in `apps/web` of a pnpm workspace (`@app/web`); its `pnpm-workspace.yaml` overrides move to the root; the lockfile is seeded from upstream's (importer moved to `apps/web`), and the ranged direct dependencies (react, react-dom, @types/*) are pinned to upstream's locked versions | The workspace's shape, with upstream's tested resolutions |
| 2 | `cacheComponents` and `partialPrefetching` off; `experimental.useCache: true`; the `instant` / `prefetch` route configs removed from five files | A Cache Components page hangs on workerd under @opennextjs/cloudflare 1.20 (opennextjs-cloudflare#1450); the configs are Cache Components options |
| 3 | `next`, `@next/env`, `@next/playwright` 16.4.1 → 16.3.8 | 16.4.x fails every request on the adapter's newest npm release |
| 4 | `output: "standalone"`, `outputFileTracingRoot` at the workspace root, `images.unoptimized`, `initOpenNextCloudflareForDev()`; `open-next.config.ts` (R2 + DO caches), `wrangler.template.jsonc`, `wiring.fixture.json`, `cloudflare-env.d.ts` added | OpenNext's build and bindings |
| 5 | Codegen (`.graphqlrc.ts`, `src/checkout/graphql/codegen.ts`) and the GraphQL lint read `schema.graphql` (Saleor 3.23.44's published schema) instead of the live API | The build, type check, lint and tests need no store |
| 6 | `src/lib/saleor-connection.ts`; unconnected: `DefaultChannelSlug` null, no channels (`getStorefrontChannelSlugs`, the channel layout's `generateStaticParams`), the middleware redirects every page to `/`, the checkout layout redirects to `/`, `/` says "Connect your Saleor store"; `src/lib/auth/server.ts` reads the URL when a client is made | A product deploys before its owner has a store; upstream threw at import without the URL |
| 7 | `SITE_NAME` in `src/config/brand.ts`; `brandConfig`'s name fields, the title template and `/api/og`'s fallback read it | One rename seam |
| 8 | Speed Insights rendered only when the build runs on Vercel (`speedInsightsEnabled`, like upstream's `webAnalyticsEnabled`) | Its script 404s elsewhere |
| 9 | `src/app/api/health/route.ts` | The deploy's smoke and the record's probe |
| 10 | `package.json`: the build, typecheck and test scripts generate the types first (no pre/post scripts); `preview`, `wire:fixture`; `engines.node` `>=22`; lint with a 4 GiB heap; `prepare` (husky) removed | pnpm 10 runs no pre-scripts; the runners are Node 22; upstream's lint outgrows Node's default heap |
| 11 | The ESLint config ignores `.open-next/` and `.wrangler/` | The Worker build and wrangler's state |
| 12 | `.gitignore` keeps `cloudflare-env.d.ts` tracked | The Worker's typed bindings |
| 13 | `README.md` replaced by the app's own; `.env.example` header says what is optional and where it lives on Workers | The port's README |
| 14 | Not carried: `.github/` (Vercel and GitHub workflows), `.husky`, `.lintstagedrc.js`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.cursor`, `.cursorignore`, `.mcp.json`, `.npmrc`, `.nvmrc` | Vercel-, Docker- and editor-specific |

## Verified

- Spike: Cache Components off + `useCache` on Next 16.3.8, R2 + DO caches,
  under `wrangler dev`: pages 200 with no hang; a second visit read Saleor
  0 times; a tag revalidation re-read exactly that entry; unconnected, `/` 200
  and every other page 307 to `/`.
- `pnpm typecheck`, `lint` (0 errors; upstream's 26 warnings), `test`
  (upstream's 787, the port's 21) and `build` green with no store; the Worker
  is 3.37 MiB gzipped.
- Every baseline tier passes locally on orun v2.89.0; the e2e serves the
  product as born and connected to the stand-in Saleor.
