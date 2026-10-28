#!/usr/bin/env python3
"""What a visitor does to the served Worker — testing/e2e.test.sh's stages 3 and 4.

    e2e-visit.py born      <url> <values.json>
    e2e-visit.py connected <url> <values.json>    (E2E_API, E2E_WEBHOOK_SECRET, E2E_BEARER)

`born` is a fresh product, no Saleor store: `/` asks for one under the
product's name, every storefront path, `/checkout` and `/order` go there,
`/api/health` says not connected, revalidation is refused.

`connected` is the same product built with the stand-in Saleor
(testing/lib/fake-saleor.mjs) as its store: the catalogue renders; a second
visit reads Saleor not at all (every read is a `"use cache"` entry in the
local R2 bucket); a change in Saleor does not show until Saleor's SIGNED
webhook names the product, and then only that product is read again; the
bearer route revalidates by hand; unsigned and wrongly signed deliveries are
refused.
"""
import hashlib
import hmac
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

mode, base, values = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
name = values["productname"]
# Upstream's store name: residue in a product named anything else.
UPSTREAM_NAME = "Saleor Store"
renamed = name != UPSTREAM_NAME
problems = []


def bad(m):
    problems.append(m)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=dict(headers or {}), method=method)
    try:
        r = opener.open(req, timeout=90)
    except urllib.error.HTTPError as e:
        r = e
    return r.status, r.headers, r.read()


def get(path):
    s, h, b = request(base + path)
    return s, h, b.decode("utf-8", "replace")


def title_of(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S)
    return html.unescape(m.group(1)) if m else None


def done(summary):
    if problems:
        for p in problems:
            print(f"  ✕ {p}", file=sys.stderr)
        sys.exit(1)
    for line in summary:
        print(f"   {line}")
    sys.exit(0)


# ── a fresh product: no Saleor store ─────────────────────────────────────
if mode == "born":
    status, _, page = get("/")
    if status != 200:
        bad(f"/ answered {status}, not 200")
    if "Connect your Saleor store" not in page:
        bad("/ does not say \"Connect your Saleor store\"")
    if title_of(page) != name:
        bad(f"/'s <title> is {title_of(page)!r}, not the store's name {name!r}")
    if renamed and UPSTREAM_NAME in page:
        bad(f"/ still names the store {UPSTREAM_NAME!r}")
    for path in ("/en/default-channel", "/en/default-channel/products/a-tee", "/default-channel",
                 "/checkout", "/checkout?checkout=abc", "/order/find"):
        status, headers, _ = get(path)
        loc = headers.get("location") or ""
        if status not in (307, 308) or not (loc == "/" or loc == f"{base}/"):
            bad(f"{path} answered {status} → {loc!r}, not a redirect to /")
    status, _, body = get("/api/health")
    if status != 200 or json.loads(body or "{}") != {"ok": True, "saleor": "not-connected"}:
        bad(f"/api/health answered {status} {body[:80]!r}, not ok and not-connected")
    status, _, _ = get("/api/revalidate?tag=product:a-tee")
    if status != 401:
        bad(f"/api/revalidate answered {status} with no secret configured, not 401")
    status, h, body = request(base + "/icon.png")
    if status != 200 or not (h.get("content-type") or "").startswith("image/"):
        bad(f"/icon.png answered {status} {h.get('content-type')}")
    done([
        "/ asks for a Saleor store under the product's name; every storefront page, /checkout and /order",
        "go to /; /api/health says not connected; revalidation is refused; never a 500",
    ])

# ── the same product, with a store connected ─────────────────────────────
api = os.environ["E2E_API"]
webhook_secret = os.environ["E2E_WEBHOOK_SECRET"]
bearer = os.environ["E2E_BEARER"]


def api_call(path, method="GET"):
    s, _, b = request(api + path, data=b"" if method == "POST" else None, method=method)
    return json.loads(b or b"{}")


def reads():
    return api_call("/__calls")


def reset():
    api_call("/__reset", "POST")


home, listing, product, category = (
    "/en/default-channel", "/en/default-channel/products", "/en/default-channel/products/sample-product-1",
    "/en/default-channel/categories/sample-category-1",
)

status, headers, _ = get("/")
if status not in (307, 308) or not (headers.get("location") or "").endswith(home):
    bad(f"/ answered {status} → {headers.get('location')!r}, not the default locale and channel")

reset()
pages = {}
for path in (home, listing, product, category, "/en/default-channel/search?q=sample"):
    status, _, page = get(path)
    pages[path] = page
    if status != 200:
        bad(f"{path} answered {status}")
    if renamed and UPSTREAM_NAME in page:
        bad(f"{path} still names the store {UPSTREAM_NAME!r}")
first = reads()
if not first:
    bad("the first visits read nothing from Saleor — the store is not connected")
if name not in (title_of(pages[home]) or ""):
    bad(f"the home page's <title> is {title_of(pages[home])!r}, without the store's name {name!r}")
linked = set(re.findall(r'href="/en/default-channel/products/(sample-product-\d+)"', pages[listing]))
if len(linked) < 2:
    bad(f"the product listing links {sorted(linked)} — not the store's products")
if "Sample product 1 v1" not in pages[product]:
    bad("the product page does not show the product Saleor named")
if f"Sample product 1 v1 | {name}" != title_of(pages[product]):
    bad(f"the product page's <title> is {title_of(pages[product])!r}")

# THE CACHE: the same pages again read Saleor not at all.
reset()
for path in (home, listing, product, category):
    status, _, _ = get(path)
    if status != 200:
        bad(f"{path} answered {status} on a second visit")
if reads():
    bad(f"a second visit read Saleor again: {reads()} — the \"use cache\" entries were not reused")

# A change in Saleor does not show until Saleor says so — however often the
# page is asked for.
api_call("/__bump", "POST")
reset()
for _ in range(3):
    status, _, page = get(product)
    if "Sample product 1 v1" not in page or "Sample product 1 v2" in page:
        bad("after Saleor changed, the product page did not still show the cached product")
        break
if reads():
    bad(f"a cached product page read Saleor: {reads()}")

# …and an unsigned or wrongly signed delivery changes nothing.
delivery = json.dumps({"product": {"slug": "sample-product-1", "channel": {"slug": "default-channel"},
                                   "category": {"slug": "sample-category-1"}}}).encode()
def deliver(signature):
    h = {"Content-Type": "application/json", "saleor-event": "product_updated"}
    if signature is not None:
        h["saleor-signature"] = signature
    return request(base + "/api/revalidate", data=delivery, headers=h, method="POST")[0]
sign = lambda secret: hmac.new(secret.encode(), delivery, hashlib.sha256).hexdigest()
for label, signature in (("unsigned", None), ("signed with another secret", sign("someone-else"))):
    s = deliver(signature)
    if s != 401:
        bad(f"a delivery {label} answered {s}, not 401")

# Saleor's signed webhook names the product: that product is read again. The
# route revalidates with the tag's profile — stale-while-revalidate, as on
# Vercel — so the first request after it may still be answered from the
# stale entry while the fresh one is read; the change shows within a few.
s = deliver(sign(webhook_secret))
if s != 200:
    bad(f"Saleor's signed delivery answered {s}, not 200")
reset()
fresh = False
for attempt in range(6):
    status, _, page = get(product)
    if "Sample product 1 v2" in page:
        fresh = True
        break
    time.sleep(1)
if not fresh:
    bad("after Saleor's webhook named the product, its page never showed the change")
after = reads()
if not after.get("ProductDetails"):
    bad(f"the revalidated product page did not read the product from Saleor again: {after}")
if after.get("ProductListPaginated") or after.get("MenuGetBySlug"):
    bad(f"a delivery naming one product re-read the listing or the menus: {after}")
time.sleep(1)
reset()
get(product)
if reads():
    bad(f"the re-read product was not cached again: {reads()}")

# By hand, with the bearer secret.
s, _, body = request(base + "/api/revalidate?tag=product:sample-product-2&channel=default-channel",
                     headers={"Authorization": f"Bearer {bearer}"})
if s != 200 or json.loads(body or b"{}").get("success") is not True:
    bad(f"revalidating by hand answered {s} {body[:80]!r}")
s, _, _ = request(base + "/api/revalidate?tag=product:sample-product-2", headers={"Authorization": "Bearer nope"})
if s != 401:
    bad(f"revalidating with the wrong bearer answered {s}, not 401")

status, _, body = get("/api/health")
if status != 200 or json.loads(body or "{}") != {"ok": True, "saleor": "connected"}:
    bad(f"/api/health answered {status} {body[:80]!r}, not ok and connected")
s, h, b = request(base + "/api/og?title=Sample")
if s != 200 or not (h.get("content-type") or "").startswith("image/png") or b[:8] != b"\x89PNG\r\n\x1a\n":
    bad(f"/api/og answered {s} {h.get('content-type')}, not a PNG")
status, _, _ = get("/no-such-page")
if status != 404:
    bad(f"/no-such-page answered {status}, not 404")

done([
    f"/ → {home}; the home page, the listing, a product, a category and search from the store;",
    f"first visits read {sum(first.values())} time(s) from Saleor, a second visit none; a change in Saleor stays",
    "cached until its signed webhook names the product, then only that product is read again; the bearer",
    "route revalidates by hand; unsigned and wrongly signed deliveries are refused; /api/og, a 404",
])
