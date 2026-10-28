# cloudflare-r2

Provisions the Cloudflare R2 bucket the app binds (stage and prod)

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-r2`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **web** — The Saleor storefront (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment; R2 + Durable Objects as the Next.js cache; a "connect your Saleor store" page until a store is connected)
