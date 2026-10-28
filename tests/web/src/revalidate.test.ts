import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// src/app/api/revalidate: how an owner's Saleor tells the storefront a
// product changed (its webhook, signed with SALEOR_WEBHOOK_SECRET), and how
// an owner busts a tag by hand (REVALIDATE_SECRET as a bearer token). Both
// secrets are Worker secrets the owner sets; with neither set, nobody can
// revalidate. On Workers `revalidateTag` writes OpenNext's Durable Object tag
// cache — the e2e proves that half under wrangler dev.

const { revalidateTag, revalidatePath } = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag,
  revalidatePath,
  updateTag: vi.fn(),
  cacheLife: () => {},
  cacheTag: () => {},
  io: async () => {},
}));

const keys = ["REVALIDATE_SECRET", "SALEOR_WEBHOOK_SECRET", "NEXT_PUBLIC_SALEOR_API_URL", "NEXT_PUBLIC_DEFAULT_CHANNEL"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const BEARER = "an-owner-revalidate-secret-of-32-chars";
const WEBHOOK = "the-saleor-webhook-secret";

async function route(env: Partial<Record<(typeof keys)[number], string>>) {
  vi.resetModules();
  for (const k of keys) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  return import("@/app/api/revalidate/route");
}
const connected = {
  NEXT_PUBLIC_SALEOR_API_URL: "https://acme.saleor.cloud/graphql/",
  NEXT_PUBLIC_DEFAULT_CHANNEL: "default-channel",
};
const url = (q: string) => `https://acme-shop-web-stage.acme.workers.dev/api/revalidate${q}`;

beforeEach(() => {
  revalidateTag.mockReset();
  revalidatePath.mockReset();
});
afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("revalidating by hand (GET, bearer REVALIDATE_SECRET)", () => {
  it("is refused with no secret configured, whatever is sent", async () => {
    const { GET } = await route({ ...connected });
    const res = await GET(new NextRequest(url("?tag=product:a-tee"), { headers: { authorization: `Bearer ${BEARER}` } }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("is refused with the wrong secret", async () => {
    const { GET } = await route({ ...connected, REVALIDATE_SECRET: BEARER });
    const res = await GET(new NextRequest(url("?tag=product:a-tee"), { headers: { authorization: "Bearer nope" } }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the tag it is given", async () => {
    const { GET } = await route({ ...connected, REVALIDATE_SECRET: BEARER });
    const res = await GET(
      new NextRequest(url("?tag=product:a-tee&channel=default-channel"), { headers: { authorization: `Bearer ${BEARER}` } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, tags: ["product:a-tee"] });
    expect(revalidateTag).toHaveBeenCalledWith("product:a-tee", expect.any(String));
  });
});

describe("Saleor's webhook (POST, signed)", () => {
  const delivery = JSON.stringify({ product: { slug: "a-tee", channel: { slug: "default-channel" } } });
  const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("hex");

  it("is refused unsigned", async () => {
    const { POST } = await route({ ...connected, SALEOR_WEBHOOK_SECRET: WEBHOOK });
    const res = await POST(new NextRequest(url(""), { method: "POST", body: delivery }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("is refused signed with another secret", async () => {
    const { POST } = await route({ ...connected, SALEOR_WEBHOOK_SECRET: WEBHOOK });
    const res = await POST(
      new NextRequest(url(""), {
        method: "POST",
        body: delivery,
        headers: { "saleor-signature": sign(delivery, "someone-else"), "saleor-event": "product_updated" },
      }),
    );
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the product a correctly signed delivery names", async () => {
    const { POST } = await route({ ...connected, SALEOR_WEBHOOK_SECRET: WEBHOOK });
    const res = await POST(
      new NextRequest(url(""), {
        method: "POST",
        body: delivery,
        headers: { "saleor-signature": sign(delivery, WEBHOOK), "saleor-event": "product_updated" },
      }),
    );
    expect(res.status).toBe(200);
    const tags = revalidateTag.mock.calls.map(([tag]) => String(tag));
    expect(tags.some((tag) => tag.includes("a-tee"))).toBe(true);
  });
});
