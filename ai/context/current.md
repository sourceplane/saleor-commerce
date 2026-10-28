# saleor-commerce — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a storefront built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Saleor's Next.js storefront ("Paper", saleor/storefront — Vercel's Next.js
Saleor Commerce) on Cloudflare Workers + Static Assets through
`@opennextjs/cloudflare`, its Next.js cache in an R2 bucket and two Durable
Objects the Worker exports, packaged as an Orun baseline:
`orun new --blueprint repo-blueprint.yaml` builds a new storefront in its own
repository and takes it to live on stage and prod in one landing
(`01-product`) — the R2 bucket applied before the Worker that binds it — then
records what went live (`02-docs`). With no Saleor store connected it says
"Connect your Saleor store" and sends every page there; the owner connects one
by setting its API URL as an Orun secret and redeploying. It needs Workers
Paid (about 3.4 MiB gzipped).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (SC2) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI — the storefront built and served as born, then connected to a stand-in Saleor, its cache reused and revalidated by a signed webhook. The tokens minted, a real R2 apply, a real `wrangler deploy` on Workers Paid, the probes and a real Saleor store are still to come (risk SC-A) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/saleor-commerce/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/saleor-commerce/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/saleor-commerce/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `infra/terraform/cloudflare-r2/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one storefront from `baseline-v1` on a Workers Paid account and
   record its timings; connect a Saleor Cloud sandbox to it once and register
   its webhook. That closes SC-A and SC-B.
2. When an npm release of @opennextjs/cloudflare runs Cache Components on
   workerd (opennextjs-cloudflare#1450), turn them back on (SC-C).
