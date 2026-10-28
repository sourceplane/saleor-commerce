# saleor-commerce — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/saleor-commerce/risks-and-open-questions.md`; this page lists only what
is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| SC-A | No live bootstrap yet: the repository created and linked, the two tokens minted, a real `terraform apply`, a real `wrangler deploy` with the R2 and Durable Object bindings, the probes, and a real Saleor store connected | OPEN | One bootstrap from a tag against a workspace, then a Saleor Cloud sandbox connected |
| SC-B | Workers Paid: the Worker is 3.4 MiB gzipped; a Free account refuses the deploy | OPEN (stated on the card) | A live deploy on a Paid account |
| SC-C | Cache Components off until @opennextjs/cloudflare runs them on workerd | ACCEPTED | An npm release with a fix for opennextjs-cloudflare#1450 |
| SC-I | The storefront is FSL-1.1-ALv2 (Saleor's Functional Source License): source-available, no competing use, Apache 2.0 two years after each release | OPEN — for the registry's owner to review before the row goes public | A decision on listing an FSL-licensed starter |

Accepted, and worth knowing before you change them: SC-D (Next pinned to
16.3.8 with the adapter), SC-E (images unoptimized), SC-F (a webhook racing a
render; stale-while-revalidate), SC-G (the stand-in is not a catalogue),
SC-H (the store-name seam; gated).
