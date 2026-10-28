# saleor-commerce — Saleor's Next.js storefront on Cloudflare Workers

**Saleor's storefront is built on Next.js 16's Cache Components and a hosted
Saleor API. The port keeps every one of its `"use cache"` reads — their
profiles, their tags, the webhook that revalidates them — and moves them onto
Cloudflare: one Worker, its data cache in R2, its tag cache in Durable
Objects. Partial prerendering is the one thing the adapter cannot run yet. A
product built from it deploys before its owner has a Saleor store, and sells
from theirs once they set its URL.**

| | |
|---|---|
| Status | In progress — SC1 on main: the site runs on Workers |
| Upstream | [saleor/storefront](https://github.com/saleor/storefront) ("Paper", FSL-1.1-ALv2), at `a6e357a` (2026-10-20) |
| Reference | [commerce](https://github.com/sourceplane/commerce) — the same OpenNext, R2 and Durable Object shape for a storefront on a hosted commerce API |
| Key | `SC` |

## Read in this order

1. [design.md](design.md) — the storefront, how each Vercel piece maps to
   Cloudflare, the cache, the schema, the unconnected store, the tests, and
   the alternatives rejected.
2. [implementation-plan.md](implementation-plan.md) — the milestones and
   what each one lands.
3. [risks-and-open-questions.md](risks-and-open-questions.md) — what is not
   proven, and what was accepted.
4. [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — what shipped, and
   every departure from upstream.

## Milestones

| Milestone | What it lands | Task |
|---|---|---|
| SC0 — the spec | this doc set and the three task contracts | SC-1 |
| SC1 — the storefront on Workers | `apps/web`, the R2 root, `tests/web` | SC-2 |
| SC2 — a baseline | the card, the build document, the rename, the tiers | SC-3 |
