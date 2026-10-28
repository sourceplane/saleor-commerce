# saleor-commerce — risks and open questions

| ID | Risk | State | Notes |
|---|---|---|---|
| SC-A | Not proven live: the repository and link, the minted tokens, a real `terraform apply` and `wrangler deploy`, the probes, a real Saleor store | OPEN | Baseline CI proves everything else offline; one bootstrap and a Saleor Cloud sandbox close it |
| SC-B | Workers Paid: the Worker is 3.37 MiB gzipped (14.3 MiB raw), over Free's 3 MiB; 1.38 MB is resvg.wasm for `/api/og` | OPEN | Stated on the card, the README and BOOTSTRAP.md |
| SC-C | Cache Components (partial prerendering, Instant Navigations) off | ACCEPTED | opennextjs-cloudflare#1450 / #1318; turning them back on needs no change to the `"use cache"` reads |
| SC-D | Next pinned to 16.3.8 (upstream 16.4.1) | ACCEPTED | 16.4.x fails every request on adapter 1.20.11; 1.20.12 fixes it but is not on npm |
| SC-E | Images unoptimized | ACCEPTED | Saleor's thumbnail endpoint serves sized WebP |
| SC-F | A webhook racing a render; `revalidateTag` with a profile is stale-while-revalidate | ACCEPTED | The first request after a delivery may be stale while the fresh entry is read, as on Vercel; the e2e allows for it |
| SC-G | The e2e's store is a stand-in: schema-valid answers, not a catalogue's data, and the cart and checkout mutations are not exercised end to end | ACCEPTED | Upstream's own suite covers the checkout logic; a real store is SC-A |
| SC-H | The store's name: the rename rewrites one line and the sweep does not look for it | ACCEPTED, gated | The leak gate fails any other spelling under `apps/web/src`; the placement and e2e tiers check the branded product |
| SC-I | Licence: FSL-1.1-ALv2 — source-available, no "Competing Use" (offering it to others as a substitute for the storefront), Apache 2.0 two years after each release | OPEN | Redistribution is permitted with the licence kept (`apps/web/LICENSE`); whether a public catalogue row is a competing use is the registry owner's call |
| SC-J | `global_fetch_strictly_public` kept from the reference | ACCEPTED | `wrangler dev` still reaches the e2e's local stand-in with it |
| SC-K | Lint needs more than Node's 2 GiB default heap on small machines | ACCEPTED | The script sets 4 GiB |
