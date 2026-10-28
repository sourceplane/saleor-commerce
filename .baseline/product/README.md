# saleor-commerce

A Saleor storefront — home, categories, collections, search with filters,
product pages with variants, a cart and a multi-step checkout, customer
accounts and orders, in several languages — on **Cloudflare Workers + Static
Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
built from [Saleor's Next.js storefront](https://github.com/saleor/storefront)
("Paper", the Functional Source License — `apps/web/LICENSE`). Every read from
Saleor is cached with `"use cache"` in an **R2 bucket** that Terraform
provisions per environment; the tag cache and the revalidation queue are
**Durable Objects** the Worker itself exports, and Saleor's webhook
revalidates exactly what changed.

It is live from its first deploy, before any Saleor store exists: `/` says
**"Connect your Saleor store"** and every other page goes there. Once you give
the build your store's API URL, it sells your products.

The account must be on **Workers Paid**: the Worker is about 3.4 MiB gzipped,
over Workers Free's 3 MiB.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, whether a Saleor store is connected and the secrets the store uses
into [ai/context/deployment.md](ai/context/deployment.md); how the store
deploys and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The storefront's routes: `/[locale]/[channel]` home, categories, collections, products, search, cart, account, orders, sign-in; `/checkout`, `/order`; `/api/revalidate` (Saleor's webhook), `/api/og`, `/api/health` | `apps/web/src/app` |
| The store's name | `apps/web/src/config/brand.ts` (`SITE_NAME`) |
| Whether a Saleor store is connected, and the page that says how to connect one | `apps/web/src/lib/saleor-connection.ts`, `apps/web/src/app/(root)/page.tsx`, `apps/web/src/middleware.ts` |
| Saleor's data layer: the cached reads, their tags and `cacheLife` profiles, the webhook's invalidation plan | `apps/web/src/lib/saleor`, `apps/web/src/graphql` |
| Saleor's GraphQL schema the storefront's types are generated from (Saleor 3.23) | `apps/web/schema.graphql` |
| Workers build, cache bindings and deploy contract | `apps/web/next.config.js`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The R2 bucket (stage, prod) | `infra/terraform/cloudflare-r2` |
| Tests | `apps/web` (the storefront's own vitest suite), `tests/web` |

Saleor's own guides to the storefront — configuration, caching, checkout,
international stores, its architecture decisions — are in `apps/web/docs`
and `apps/web/skills/saleor-paper-storefront`.

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # GraphQL types + next build + opennextjs-cloudflare build → apps/web/.open-next
```

The GraphQL types are generated from `apps/web/schema.graphql` by every
build, type check and test, so none of these needs a store. With no store
the build is the "connect your Saleor store" storefront; to work against
yours, copy `apps/web/.env.example` to `apps/web/.env.local`, set
`NEXT_PUBLIC_SALEOR_API_URL` and `NEXT_PUBLIC_DEFAULT_CHANNEL`, then:

```bash
pnpm --filter @app/web dev        # http://localhost:3000, Next's dev server
pnpm --filter @app/web preview    # wrangler dev over the built Worker, a local R2 bucket and local Durable Objects
```

## Connecting Saleor

1. **A Saleor store, 3.23 or later** — a free sandbox at
   [cloud.saleor.io](https://cloud.saleor.io), or one you run. You need its
   GraphQL URL (`https://<your-store>.saleor.cloud/graphql/`, with the
   trailing slash) and the slug of the channel to sell in (Dashboard →
   Configuration → Channels; a new store's is `default-channel`). The
   storefront lists the products published and available in that channel;
   its header and footer are the store's `navbar` and `footer` menus
   (Dashboard → Navigation).
2. **Give the build your store**, once per deployed environment. The build
   inlines both values — the shopper's browser talks to the same API at
   checkout — so they are this repository's Orun secrets, and stage and prod
   can each name their own store:

   ```bash
   orun secrets set SALEOR_API_URL  --env stage   # prompts for the value
   orun secrets set SALEOR_API_URL  --env prod
   orun secrets set SALEOR_CHANNEL  --env stage   # optional: default-channel when unset
   orun secrets set SALEOR_CHANNEL  --env prod
   ```

   Then **redeploy the storefront**: a secret is read when the storefront
   builds, and setting one builds nothing. Use **Deploy by hand** below, or
   change the stamp on the last line of `apps/web/component.yaml`
   (`# orun: redeploy …`) and merge. From that deploy on, `/` is your store's
   home page.
3. **Let Saleor revalidate the cache** (recommended). Every Saleor read is
   cached at the edge for its profile's lifetime (minutes for listings, a day
   for the catalogue, longer for menus); a webhook makes a change show on the
   next request instead. Set the webhook's secret — and, for revalidating by
   hand, a bearer secret of at least 32 characters — as Worker secrets in
   each environment, Cloudflare's, so deploys leave them alone:

   ```bash
   pnpm --filter @app/web exec wrangler secret put SALEOR_WEBHOOK_SECRET --name saleor-commerce-web-prod
   pnpm --filter @app/web exec wrangler secret put REVALIDATE_SECRET     --name saleor-commerce-web-prod
   ```

   (and the same for `saleor-commerce-web-stage`). In Saleor, install the
   **Saleor Cloud Paper app** (Dashboard → Extensions — Saleor Cloud only),
   or create a webhook yourself (Dashboard → Configuration → Webhooks) with
   that secret, pointing at
   `https://saleor-commerce-web-prod.your-workers-subdomain.workers.dev/api/revalidate`,
   for the product, category, collection, page and menu events. Each signed
   delivery revalidates the tags it names in the Durable Object tag cache.
   By hand: `curl -H "Authorization: Bearer <REVALIDATE_SECRET>"
   "https://…/api/revalidate?tag=product:<slug>"`.
4. **Optional:** an app token (`SALEOR_APP_TOKEN`, a Worker secret, with
   `MANAGE_ORDERS`) turns on guest order lookup at `/order/find` and lets the
   storefront discover channels from the API.

## Checkout and payments

Checkout is Saleor's: the cart, the shipping and billing steps and the order
are your store's checkout objects, and payment goes through the payment app
your Saleor store has for the channel — the storefront renders Stripe
Elements for the Saleor Stripe app, and a dummy gateway for test orders.
Their switches are build settings (`NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS`,
`NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT`): set them under the environment's `env:`
in `intent.yaml`, and see `apps/web/.env.example` and
`apps/web/skills/saleor-paper-storefront` for the rest. Before a store is
connected there is no checkout: `/checkout` and `/order` go to `/`.

## How the cache is wired

The Worker binds the bucket as `NEXT_INC_CACHE_R2_BUCKET` (every `"use cache"`
entry), and two Durable Objects: `NEXT_TAG_CACHE_DO_SHARDED` (which tags were
revalidated, and when) and `NEXT_CACHE_DO_QUEUE` (background revalidation of
stale routes, through the Worker's own `WORKER_SELF_REFERENCE` binding). The
bucket's name is never hand-written: `apps/web/wrangler.template.jsonc` names
it as a wiring token, and `wrangler.jsonc` is that template rendered — from
`wiring.fixture.json` for local work and verification, and on every deploy
from the document the `cloudflare-r2` Terraform root publishes after its
apply (`WIRING_CLOUDFLARE_R2`, per environment). Edit the template, then
`pnpm run wire:fixture` and commit the render with the template. The Durable
Objects need no root: the migration in the config creates them on the first
deploy.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The R2 bucket applies first, then the
storefront builds for that environment — its bucket, its origin, and its
Saleor store if one is set — and deploys, to `stage`, then to `prod` once
stage has converged on the same commit; `dev` only verifies. The Worker is
`saleor-commerce-web-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: the home page must answer, and so
must `/api/health`, which only the Worker can. A pull request runs the same
pipeline's verify lanes, with nothing applied or deployed: the R2 bucket
planned for stage and prod, and the storefront built and dry-deployed for
each environment. They do not run the tests or the linter — run those before
you push (Getting started, above). (A push to `main` applies, builds and
deploys.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The Cloudflare
tokens and account id are brokered per run from the workspace's Cloudflare
connection — one to deploy the Worker, one with R2 access for the bucket's
apply — and the bucket names and your store's URL travel as Orun secrets;
nothing provider-shaped is stored in the repository or in GitHub. The
revalidation secrets are Worker secrets, set once on the Workers themselves.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after setting your
store's URL, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting (SSR, server actions, route handlers, middleware, `next/og`) | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets (`ASSETS`) |
| Cache Components: partial prerendering, `"use cache"` with named `cacheLife` profiles | `"use cache"` and its profiles kept (`experimental.useCache`); routes render per request (below) |
| Data Cache entries | The R2 bucket bound as `NEXT_INC_CACHE_R2_BUCKET` |
| `revalidateTag` from Saleor's webhook | A sharded Durable Object tag cache consulted on every cache read |
| Stale-while-revalidate | A Durable Object queue that re-renders stale entries through the Worker |
| Image Optimization (`/_next/image`) | Off (`images.unoptimized`): images come from Saleor's own thumbnail endpoint, already sized |
| Vercel Web Analytics, Speed Insights | Off unless the build runs on Vercel, as upstream already does for Web Analytics |
| `NEXT_PUBLIC_SALEOR_API_URL`, `NEXT_PUBLIC_DEFAULT_CHANNEL` | Orun secrets `SALEOR_API_URL`, `SALEOR_CHANNEL` (above); the "connect your Saleor store" page until set |
| `NEXT_PUBLIC_STOREFRONT_URL` | Each environment's `SITE_URL` (intent.yaml), else its workers.dev URL — set by the build |
| `SALEOR_WEBHOOK_SECRET`, `REVALIDATE_SECRET`, `SALEOR_APP_TOKEN` | Worker secrets |
| Deploy on push | Orun applies the bucket and deploys `saleor-commerce-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`) |

Partial prerendering is off: `@opennextjs/cloudflare` 1.20 cannot run Next.js
16's Cache Components on workerd yet (a Cache Components page answers 500 and
then hangs), so the storefront keeps every `"use cache"` read, its profile and
its tags through `experimental.useCache`, and renders each route at request
time from those cached reads. Instant Navigations (`partialPrefetching`) needs
Cache Components and is off with it.

## Custom domain

The store answers on workers.dev from its first deploy. To serve it on your
own domain:

1. Add the domain to the Cloudflare account the store deploys into, and attach
   it to the Worker (dashboard → Workers & Pages →
   `saleor-commerce-web-prod` → Settings → Domains & Routes → Add →
   Custom domain).
2. Set the environment's public origin in `intent.yaml`, so the next deploy
   builds the store's canonical, Open Graph and redirect-allowlist URLs for it
   (until then they use the workers.dev URL):

   ```yaml
   environments:
     prod:
       env:
         SITE_URL: https://shop.example.com
   ```

   The store was born with the reserved placeholder
   `saleor-commerce.example.com` where its domain goes: `BASE_DOMAIN` under
   each environment in `intent.yaml`. Replace it with your domain in the same
   change, and land it with a change under `apps/web` so the merge rebuilds
   the store. Point Saleor's webhook at the new domain too.

## Licence

The storefront is Saleor's, under the Functional Source License 1.1 with an
Apache 2.0 future licence (`apps/web/LICENSE`): you may use, change and
redistribute it for any purpose other than a competing use — offering it to
others as a product or service that substitutes for the storefront itself —
and each release becomes Apache 2.0 two years after it was published. Read it
before you offer the storefront itself to others.
