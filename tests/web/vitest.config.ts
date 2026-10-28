import { defineConfig } from "vitest/config";
import * as path from "node:path";

// The storefront imports its own modules as `@/…` (apps/web/tsconfig.json
// `paths`); the alias makes the same specifiers resolve from here, and
// `server-only` is the storefront's own test stub (it throws outside React's
// server environment).
const app = path.resolve(__dirname, "../../apps/web");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${app}/src/` },
      { find: /^server-only$/, replacement: `${app}/vitest.server-only.ts` },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
