# web-tests

The port's vitest suite — the store-name seam, the Saleor connection and the storefront before a store is connected (the middleware's redirects, /api/health), and revalidation (the bearer secret and Saleor's signed webhook)

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
