import "../globals.css";
import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { isSaleorConnected } from "@/lib/saleor-connection";
import { GeistMono } from "geist/font/mono";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getDefaultLocaleSlug, resolveLocaleFromSlug } from "@/config/locale";
import { getRootHtmlFontProps } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { speedInsightsEnabled, speedInsightsSampleRate } from "@/lib/speed-insights";
import { webAnalyticsEnabled } from "@/lib/analytics/web-analytics";
import { AnalyticsMount } from "@/ui/components/analytics-mount";
import { WebAnalytics } from "@/ui/components/web-analytics";

const defaultHtmlLang = resolveLocaleFromSlug(getDefaultLocaleSlug()).htmlLang;

/**
 * Checkout surface root layout — its own `<html>`/`<body>` (multiple root layouts).
 *
 * Locale-less surface: no `cookies()` here (blocks the route outside Suspense).
 * `html lang` defaults to `NEXT_PUBLIC_DEFAULT_LOCALE`; `CheckoutBrowseProvider`
 * syncs the resolved browse locale after RSC loads inside page Suspense.
 */
export default function CheckoutLayout(props: { children: ReactNode }) {
	// Checkout and orders are Saleor's: with no store connected, `/` says how to connect one.
	if (!isSaleorConnected) redirect("/");
	const htmlProps = getRootHtmlFontProps(defaultHtmlLang);

	return (
		<html {...htmlProps} className={cn(htmlProps.className, GeistMono.variable)}>
			<body className="min-h-dvh font-sans">
				<main className="min-h-dvh">{props.children}</main>
				{/* Sampled — unsampled Speed Insights dominates the Vercel bill at scale. */}
				{speedInsightsEnabled() && <SpeedInsights sampleRate={speedInsightsSampleRate()} />}
				{/* Unsampled page views — the denominator; `?checkout=` and `/order/<key>` are redacted in beforeSend. */}
				{webAnalyticsEnabled() && <WebAnalytics />}
				<AnalyticsMount />
			</body>
		</html>
	);
}
