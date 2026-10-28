# saleor-commerce — implementation plan

| Milestone | Lands | Done when |
|---|---|---|
| SC0 — the spec | the repository born (intent, CI, tooling, spec index), this doc set, SC-1…SC-3 | on main |
| SC1 — the storefront on Workers | `apps/web` (upstream at `a6e357a` plus the departures in IMPLEMENTATION-STATUS), `infra/terraform/cloudflare-r2`, `tests/web` | typecheck, lint, test, build green with no store; served unconnected and connected under `wrangler dev` |
| SC2 — a baseline | `blueprint.yaml`, `repo-blueprint.yaml`, `.baseline/`, the rename engine and bootstrap helpers, the record renderer, the context pack, `testing/` with the stand-in Saleor, `baseline.yml`, `tag.yml` | Baseline CI green; `baseline-v1` tagged |

Order inside SC1: the spike (Cache Components off, `useCache`, the R2/DO
caches, a cached read reused and revalidated under `wrangler dev`); the
schema-driven codegen; the unconnected seam; the workspace (lockfile seeded
from upstream's); the tests.
