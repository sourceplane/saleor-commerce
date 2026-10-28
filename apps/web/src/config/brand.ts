/**
 * Brand Configuration
 *
 * Centralized branding settings for the storefront.
 * Update these values when customizing for a new store.
 *
 * @example
 * ```tsx
 * import { brandConfig } from "@/config/brand";
 *
 * <title>{brandConfig.siteName}</title>
 * <Suspense><CopyrightText /></Suspense> // never `new Date()` during render (sync IO under Cache Components)
 * ```
 */

/**
 * The store's name — the one line a product's bootstrap rewrites. Everything
 * below that names the store reads it.
 */
// prettier-ignore
export const SITE_NAME = "Saleor Store";

export const brandConfig = {
	/** Site name used in titles, metadata, and headers */
	siteName: SITE_NAME,

	/** Legal entity name for copyright notices */
	copyrightHolder: SITE_NAME,

	/** Organization name for structured data (JSON-LD) */
	organizationName: SITE_NAME,

	/** Default brand name for products without a brand */
	defaultBrand: SITE_NAME,

	/** Tagline/description for the store */
	tagline: "Discover our collection.",

	/** Homepage meta description */
	description: "Shop our collection.",

	/** Logo aria-label for accessibility */
	logoAriaLabel: "Store",

	/** Title template - %s will be replaced with page title */
	titleTemplate: `%s | ${SITE_NAME}`,

	/** Social media handles */
	social: {
		/** Twitter/X handle (without @) - set to null to disable */
		twitter: null as string | null,
		/** Instagram handle (without @) - set to null to disable */
		instagram: null as string | null,
		/** Facebook page URL - set to null to disable */
		facebook: null as string | null,
	},
} as const;

/**
 * Helper to format page title using brand template.
 */
export function formatPageTitle(title: string): string {
	return brandConfig.titleTemplate.replace("%s", title);
}

/**
 * Get copyright text with specified year.
 * Render through `CopyrightText` inside `<Suspense>`: it calls `io()` before reading the clock.
 */
export function getCopyrightText(year: number = new Date().getFullYear()): string {
	return `© ${year} ${brandConfig.copyrightHolder}. All rights reserved.`;
}
