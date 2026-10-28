# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`saleor-commerce/`](./saleor-commerce/) | **SC** | ✅ Shipped (`baseline-v1`); live bootstrap pending | Saleor's Next.js storefront (Vercel's Next.js Saleor Commerce) on Cloudflare Workers, its Saleor reads cached in R2 and revalidated by Saleor's webhook — and an Orun baseline that instantiates it in one landing, live before a store is connected (SC2) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
