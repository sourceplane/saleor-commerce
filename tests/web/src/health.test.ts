import { afterEach, describe, expect, it, vi } from "vitest";

// src/app/api/health/route.ts: the deploy's smoke and the deployment record's
// probe — the Worker answering, and whether it has a store.
const saved = process.env.NEXT_PUBLIC_SALEOR_API_URL;
afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
  else process.env.NEXT_PUBLIC_SALEOR_API_URL = saved;
});

async function health(url?: string) {
  vi.resetModules();
  if (url === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
  else process.env.NEXT_PUBLIC_SALEOR_API_URL = url;
  const { GET } = await import("@/app/api/health/route");
  const res = GET();
  return { status: res.status, body: (await res.json()) as { ok: boolean; saleor: string } };
}

describe("/api/health", () => {
  it("answers ok, not connected, on a fresh product", async () => {
    expect(await health()).toEqual({ status: 200, body: { ok: true, saleor: "not-connected" } });
  });

  it("answers ok, connected, once the store is", async () => {
    expect(await health("https://acme.saleor.cloud/graphql/")).toEqual({
      status: 200,
      body: { ok: true, saleor: "connected" },
    });
  });
});
