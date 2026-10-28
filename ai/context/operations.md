# saleor-commerce — operating contract (for humans and agents)

This is the standing guide to how this store is deployed and operated.
Instance facts (live URLs, workspace, whether a Saleor store is connected,
the secrets it uses) live in [deployment.md](deployment.md), rendered from
probed reality by the bootstrap's `02-docs` phase; this file is the contract
that stays true between deployments. It is written to give an agent with
repository read access enough context to reason about and operate the store
without any other source.

## What this system is

A Saleor storefront on Cloudflare, expressed as an Orun component-native
desired-state repo. Saleor itself — the catalogue, carts, checkouts, orders,
customers — is the owner's store (Saleor Cloud or their own), reached over
its GraphQL API; nothing here runs Saleor.

- **`infra/terraform/cloudflare-r2`** — one R2 bucket per deployed
  environment (`stage`, `prod`), applied by Terraform: the storefront's
  Next.js incremental cache. After each apply it publishes a wiring document
  — `{r2_bucket_name}` — as the Orun secret `WIRING_CLOUDFLARE_R2` on that
  environment.
- **`apps/web`** — the storefront: Saleor's Next.js storefront built by
  `@opennextjs/cloudflare` into one Worker plus Static Assets. Every route
  renders per request from cached Saleor reads: each read is a `"use cache"`
  function tagged by entity (`product:<slug>`, `category:<slug>`,
  `navigation:<channel>` …) with a named `cacheLife` profile
  (`src/lib/saleor/cache`). The Worker binds the bucket
  (`NEXT_INC_CACHE_R2_BUCKET`) and exports two Durable Objects: the tag cache
  and the revalidation queue. Its GraphQL types are generated from
  `apps/web/schema.graphql` (Saleor 3.23's published schema) on every build.
- **`tests/web`** — the store-name seam, the Saleor connection, the
  middleware before a store is connected, `/api/health`, and the
  revalidation route's two secrets (vitest). The storefront's own suite
  (`apps/web`, upstream's) runs with `pnpm test`. Neither runs in a lane: the
  `dev` lane of `tests/web` installs it and checks its structure, so run
  `pnpm typecheck`, `pnpm lint` and `pnpm test` before you push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, and the
  wrangler renderer that turns `wrangler.template.jsonc` plus a wiring
  document into `wrangler.jsonc`.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and dry-deploy, nothing deploys, and
no bucket exists for it (its build renders the committed fixture).

The account must be on **Workers Paid**: the Worker is about 3.4 MiB
gzipped, over Workers Free's 3 MiB.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. **The bucket before the Worker.** `cloudflare-r2` applies for the
   environment and publishes `WIRING_CLOUDFLARE_R2`. `apps/web` declares an
   enforced `dependsOn` on it for pushes to `main`, so its deploy starts only
   after that apply — and a job resolves its secrets when it starts, so the
   document is there.
4. `apps/web` renders `wrangler.jsonc` from that document (the real bucket
   name) and builds once per environment: `NEXT_PUBLIC_STOREFRONT_URL` is the
   environment's `SITE_URL` (intent.yaml) or its workers.dev URL, and the
   Saleor API URL and channel are the environment's `SALEOR_API_URL` and
   `SALEOR_CHANNEL` secrets, when set. `wrangler deploy` ships
   `saleor-commerce-web-<env>` (the Durable Objects are created by the
   config's migration on the first deploy), and a smoke test fetches `/` and
   `/api/health`, which only the Worker answers.
5. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
6. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing applies or deploys: the R2 root plans, the
storefront builds and dry-deploys, and the edges in step 3 are advisory.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "store
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/web`.
- Setting or changing `SALEOR_API_URL` / `SALEOR_CHANNEL` builds nothing:
  they are read when the storefront builds. Redeploy it (below).
- `wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`, run
  `pnpm run wire:fixture` and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.

## The store

- **No Saleor store connected** (no `SALEOR_API_URL` for the environment):
  the build calls nothing; the storefront has no channels; `/` answers 200
  with "Connect your Saleor store"; every other page, `/checkout` and
  `/order` included, redirects (307) to `/`; `/api/health` answers
  `{"ok":true,"saleor":"not-connected"}`.
- **Connected**: `/` redirects (308) to `/<locale>/<channel>`; every page
  reads Saleor through cached reads; the cart, checkout, accounts and orders
  are the store's; payment is the payment app the store has for the channel
  (the Saleor Stripe app, or the dummy gateway for test orders, switched on
  by build settings — the README's "Checkout and payments").
- **Revalidation**: Saleor's webhook (the Saleor Cloud Paper app, or a
  webhook made by hand) POSTs to `/api/revalidate`, signed with
  `SALEOR_WEBHOOK_SECRET`; each verified delivery revalidates the tags it
  names in the Durable Object tag cache, and the next request re-reads
  Saleor. `GET /api/revalidate?tag=…` with `Authorization: Bearer
  <REVALIDATE_SECRET>` does the same by hand (`?all=1` for everything).
  With neither secret set, nothing can revalidate and entries expire by
  their profile.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (the
  `workers-deploy` scope: Workers Scripts and KV Storage write) deploys the
  Worker; `CLOUDFLARE_R2_TOKEN` (the `r2-data` scope: R2 Storage write) is
  what the R2 root's Terraform authenticates with, because the deploy token
  carries no R2; `CLOUDFLARE_ACCOUNT_ID` is the connection fact both bind.
  Minted per run from the workspace's Cloudflare connection — no long-lived
  values at rest, nothing to rotate by hand.
- **Wiring**: `WIRING_CLOUDFLARE_R2` on `stage` and `prod`, written by the R2
  root's apply (lease-published), read by the Worker's build as
  `WIRING_CLOUDFLARE_R2_<ENV>`. It holds the bucket name, not a credential.
- **The store**: `SALEOR_API_URL` and `SALEOR_CHANNEL` per environment, Orun
  secrets the owner sets (`orun secrets set … --env <env>`), optional —
  read by the build as `NEXT_PUBLIC_SALEOR_API_URL` and
  `NEXT_PUBLIC_DEFAULT_CHANNEL` and inlined, because the shopper's browser
  talks to the same API. The URL is not a credential.
- **Worker secrets**: `SALEOR_WEBHOOK_SECRET`, `REVALIDATE_SECRET` and the
  optional `SALEOR_APP_TOKEN` on `saleor-commerce-web-<env>`, set by the
  owner with `wrangler secret put`; the pipeline never reads or writes them.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`; `wrangler secret list --name saleor-commerce-web-<env>`.
  No tooling in this repository prints a secret value, and no document in
  `ai/context/` may contain one.

## Verifying the system

```bash
# the storefront on each environment (also recorded, probed, in deployment.md);
# /api/health says whether a Saleor store is connected
curl -s https://saleor-commerce-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://saleor-commerce-web-prod.your-workers-subdomain.workers.dev/

# the wiring and the store the deploys read, and workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| change the storefront | edit `apps/web` (its name: `apps/web/src/config/brand.ts`), merge |
| connect a Saleor store | the README's "Connecting Saleor": `SALEOR_API_URL` (and `SALEOR_CHANNEL`) per environment, then redeploy the storefront |
| let Saleor revalidate | `SALEOR_WEBHOOK_SECRET` (and `REVALIDATE_SECRET`) as Worker secrets, and the webhook pointing at `/api/revalidate` |
| revalidate by hand | `curl -H "Authorization: Bearer <REVALIDATE_SECRET>" "https://<host>/api/revalidate?tag=product:<slug>"` (`?all=1` for everything) |
| change a GraphQL query | edit `apps/web/src/graphql/*.graphql` (or the checkout's); the build regenerates the types from `apps/web/schema.graphql` |
| move to a newer Saleor schema | replace `apps/web/schema.graphql` with that release's `saleor/graphql/schema.graphql` (saleor/saleor), then `pnpm typecheck`; merge |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| empty the data cache | `GET /api/revalidate?all=1` with the bearer secret, or delete the bucket's `incremental-cache/` objects |
| add a binding (D1, KV, another bucket) | a Terraform root under `infra/terraform/` that publishes `WIRING_<ROOT>`, a token in `wrangler.template.jsonc`, its fixture entry, the root in the build's `--components`, the `WIRING_<ROOT>_<ENV>` secretEnv and an enforced `dependsOn` on it in `apps/web/component.yaml` |
| serve a custom domain | attach it to the Worker in Cloudflare and set `SITE_URL` for the environment in `intent.yaml` (README, "Custom domain"), then replace the placeholder `saleor-commerce.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it |
| add a runtime secret | `wrangler secret put <KEY> --name saleor-commerce-web-<env>` for the Worker; `orun secrets set <KEY> --org <ws> --env <env>` for a lane |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes follow the same contract that deployed the store: add a
component under `apps/`, `infra/` or `packages/` with a `component.yaml`,
land it as a pull request, and the convergence run applies it. When
@opennextjs/cloudflare runs Cache Components on workerd, turning them back on
(`cacheComponents: true`, `partialPrefetching: true`, the `instant` and
`prefetch` route configs) restores upstream's partial prerendering; the
`"use cache"` reads need no change.
