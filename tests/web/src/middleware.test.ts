import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// src/middleware.ts: before a store is connected every storefront page goes
// to `/`, which says how to connect one; once connected, upstream's routing
// (the root to the default locale and channel) is untouched.
const keys = ["NEXT_PUBLIC_SALEOR_API_URL", "NEXT_PUBLIC_DEFAULT_CHANNEL"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

async function middlewareWith(env: Partial<Record<(typeof keys)[number], string>>) {
  vi.resetModules();
  for (const k of keys) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  return (await import("@/middleware")).middleware;
}

function visit(path: string) {
  return new NextRequest(new URL(path, "https://acme-shop-web-stage.acme.workers.dev"));
}

afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("the storefront before a store is connected", () => {
  it("serves `/` itself", async () => {
    const middleware = await middlewareWith({ NEXT_PUBLIC_DEFAULT_CHANNEL: "default-channel" });
    const res = middleware(visit("/"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it.each(["/en/default-channel", "/en/default-channel/products/a-tee?colour=red", "/default-channel"])(
    "sends %s to `/`",
    async (path) => {
      const middleware = await middlewareWith({ NEXT_PUBLIC_DEFAULT_CHANNEL: "default-channel" });
      const res = middleware(visit(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://acme-shop-web-stage.acme.workers.dev/");
    },
  );
});

describe("the storefront once a store is connected", () => {
  it("sends `/` to the default locale and channel, as upstream does", async () => {
    const middleware = await middlewareWith({
      NEXT_PUBLIC_SALEOR_API_URL: "https://acme.saleor.cloud/graphql/",
      NEXT_PUBLIC_DEFAULT_CHANNEL: "default-channel",
    });
    const res = middleware(visit("/"));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/en/default-channel");
  });

  it("lets a storefront page through", async () => {
    const middleware = await middlewareWith({
      NEXT_PUBLIC_SALEOR_API_URL: "https://acme.saleor.cloud/graphql/",
      NEXT_PUBLIC_DEFAULT_CHANNEL: "default-channel",
    });
    const res = middleware(visit("/en/default-channel/products"));
    expect(res.headers.get("location")).toBeNull();
  });
});
