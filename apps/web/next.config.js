/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createNextIntlPlugin from "next-intl/plugin";
import { paperCacheLifeProfiles } from "./src/lib/saleor/cache/life-profiles.data.mjs";
import {
	PUBLIC_ASSET_CACHE_CONTROL,
	publicAssetCacheHeaderSource,
} from "./src/lib/public-asset-cache.data.mjs";

/** Hostnames for mobile/tunnel dev (ngrok, LAN). See ALLOWED_DEV_ORIGINS in .env.example */
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const isDevelopment = process.env.NODE_ENV === "development";

/** Host of the configured Saleor instance — self-hosted deploys serve media from it. */
function saleorApiHostname() {
	try {
		return new URL(process.env.NEXT_PUBLIC_SALEOR_API_URL ?? "").hostname || null;
	} catch {
		return null;
	}
}

/**
 * `/_next/image` will optimize (and bill for) any host it is allowed to fetch, so an open
 * `hostname: "*"` lets a third party turn the storefront into a free image CDN. Production
 * gets an explicit allowlist; the wildcard stays in development only.
 *
 * Add non-Saleor sources (a DAM, a CMS) via IMAGE_ALLOWED_HOSTS. Not `NEXT_PUBLIC_` —
 * it is read here at build time and must never be inlined into a client bundle.
 */
const imageRemotePatterns = [
	{ hostname: "*.saleor.cloud" },
	{ hostname: "*.media.saleor.cloud" },
	...[saleorApiHostname()].filter(Boolean).map((hostname) => ({ hostname })),
	...(process.env.IMAGE_ALLOWED_HOSTS?.split(",")
		.map((host) => host.trim())
		.filter(Boolean)
		.map((hostname) => ({ hostname })) ?? []),
	...(isDevelopment ? [{ hostname: "*" }] : []),
];

const THIRTY_ONE_DAYS_IN_SECONDS = 2678400;

/** A typo here would otherwise become `NaN` and silently disable image caching. */
function imageMinimumCacheTTLFromEnv() {
	const raw = process.env.NEXT_IMAGE_MIN_CACHE_TTL;
	if (!raw) return THIRTY_ONE_DAYS_IN_SECONDS;

	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`NEXT_IMAGE_MIN_CACHE_TTL must be a non-negative number of seconds, got "${raw}"`);
	}
	return parsed;
}

const imageMinimumCacheTTL = imageMinimumCacheTTLFromEnv();

const config = {
	...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
	// Upstream turns on Cache Components (`cacheComponents: true`, partial
	// prerendering) and Instant Navigations (`partialPrefetching: true`). On
	// Cloudflare Workers through @opennextjs/cloudflare 1.20 a Cache Components
	// page answers 500 and then hangs (opennextjs-cloudflare#1450; its fix, #1318,
	// is unreleased), so both are off and routes render per request.
	// `experimental.useCache` keeps every `"use cache"` read, its `cacheLife`
	// profile and its `revalidateTag` invalidation — the data cache this
	// storefront is built on — in OpenNext's R2 incremental cache and Durable
	// Object tag cache (open-next.config.ts).


	// Named cacheLife tiers for `"use cache"` — see src/lib/saleor/cache/life-profiles.ts
	cacheLife: paperCacheLifeProfiles,

	// Optimize barrel file imports for better bundle size and cold start performance
	// See: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
	experimental: {
		useCache: true,
		optimizePackageImports: ["lucide-react", "lodash-es"],
		// Note: API rate limiting is handled by RequestQueue in src/lib/graphql.ts
		// (max 3 concurrent requests; the inter-request delay applies at build time only)
	},
	images: {
		// Workers has no Next.js image optimizer: images are served as Saleor's
		// thumbnail endpoint sized them (it already resizes and encodes WebP).
		unoptimized: true,
		// WebP only: AVIF cold-encodes add ~500ms+ to first /_next/image hit on Vercel (hurts LCP).
		formats: ["image/webp"],
		remotePatterns: imageRemotePatterns,

		// Vercel bills image *transformations* and image *cache writes*. The default 4h TTL
		// re-optimizes the same catalog image ~180x/month; Saleor thumbnail URLs are stable
		// per (media id, size, format), so a long TTL is safe for the common case.
		//
		// Caveat: replacing an image *in place* in Saleor reuses the URL, so the old bytes
		// are served until this expires. Brands that re-shoot frequently should lower
		// NEXT_IMAGE_MIN_CACHE_TTL; uploading as new media always dodges it.
		minimumCacheTTL: imageMinimumCacheTTL,

		// Each width in these ladders is a separately billed transformation per source image.
		// Trimmed from the Next defaults: 2048/3840 only serve 4K/retina-desktop (rare, and
		// the widest variants are the most expensive to generate and store), and the tiny
		// 16/32/48 steps are below anything Paper actually renders.
		deviceSizes: [640, 750, 828, 1080, 1200, 1920],
		imageSizes: [64, 96, 128, 256, 384],
	},
	typedRoutes: false,

	// Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
	// into the Worker. Traced from the workspace root so workspace dependencies
	// resolve from the root node_modules.
	output: "standalone",
	outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),

	// Cache headers for static assets and API routes
	async headers() {
		const isDev = isDevelopment;
		return [
			// In development, prevent aggressive caching of dynamic chunks
			...(isDev
				? [
						{
							source: "/_next/static/chunks/:path*",
							headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
						},
					]
				: []),
			// Production only — immutable breaks Turbopack HMR when applied in dev
			// (stale action/chunk stubs → "module factory is not available").
			...(!isDev
				? [
						{
							source: "/_next/static/:path*",
							headers: [
								{
									key: "Cache-Control",
									value: "public, max-age=31536000, immutable",
								},
							],
						},
					]
				: []),
			{
				// /public leftovers (logos, fonts, same-origin video). Allowlist lives in
				// public-asset-cache.data.mjs — a missed extension inherits document
				// caching (max-age=0) and re-downloads on every visit (Fast Data Transfer).
				source: publicAssetCacheHeaderSource(),
				headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE_CONTROL }],
			},
			{
				// OG Image API — output is a pure function of the query string, and each render
				// is expensive, so cache hard. Social crawlers refetch aggressively.
				source: "/api/og",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=2592000, stale-while-revalidate=604800",
					},
				],
			},
		];
	},

	// Logging configuration
	logging: {
		fetches: {
			fullUrl: process.env.NODE_ENV === "development",
		},
	},
};

// next-intl powers code-owned UI/functional strings (messages/*.json). It does NOT own
// routing — our locale lives in the `[locale]` URL segment (ADR 0001). The request config
// resolves the locale we pass explicitly; see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(config);

// `next dev` reaches the Worker's bindings (the R2 cache bucket, the cache
// Durable Objects) through a local miniflare built from wrangler.jsonc.
initOpenNextCloudflareForDev();
