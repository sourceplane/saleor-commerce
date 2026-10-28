import { afterEach, describe, expect, it, vi } from "vitest";

// src/lib/saleor-connection.ts: whether the build had a Saleor API to talk
// to. A fresh product has none, and everything that would call Saleor asks
// this first.
const saved = process.env.NEXT_PUBLIC_SALEOR_API_URL;

async function load(url: string | undefined) {
  vi.resetModules();
  if (url === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
  else process.env.NEXT_PUBLIC_SALEOR_API_URL = url;
  return import("@/lib/saleor-connection");
}

afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
  else process.env.NEXT_PUBLIC_SALEOR_API_URL = saved;
});

describe("the Saleor connection", () => {
  it("is absent with no API URL", async () => {
    const c = await load(undefined);
    expect(c.isSaleorConnected).toBe(false);
    expect(c.saleorApiUrl).toBeNull();
  });

  it("is absent with a blank one", async () => {
    expect((await load("   ")).isSaleorConnected).toBe(false);
  });

  it("is the API URL when there is one", async () => {
    const c = await load(" https://acme.saleor.cloud/graphql/ ");
    expect(c.isSaleorConnected).toBe(true);
    expect(c.saleorApiUrl).toBe("https://acme.saleor.cloud/graphql/");
  });

  it("gives the storefront no channel to route to while absent", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
    process.env.NEXT_PUBLIC_DEFAULT_CHANNEL = "default-channel";
    try {
      const { DefaultChannelSlug } = await import("@/app/config");
      const { getStorefrontChannelSlugs } = await import("@/lib/channel-slugs");
      expect(DefaultChannelSlug).toBeNull();
      expect(await getStorefrontChannelSlugs()).toEqual([]);
    } finally {
      delete process.env.NEXT_PUBLIC_DEFAULT_CHANNEL;
    }
  });
});
