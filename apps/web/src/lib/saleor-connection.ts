/**
 * Whether this storefront is connected to a Saleor store.
 *
 * A product built from this baseline deploys before its owner has a Saleor
 * store: with no NEXT_PUBLIC_SALEOR_API_URL at build time, the storefront
 * has no channels, every storefront path redirects to `/`, and `/` says how
 * to connect one. Nothing calls Saleor until it is set.
 */
export const saleorApiUrl: string | null = process.env.NEXT_PUBLIC_SALEOR_API_URL?.trim() || null;

export const isSaleorConnected: boolean = saleorApiUrl !== null;
