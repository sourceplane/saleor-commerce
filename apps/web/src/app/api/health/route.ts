import { isSaleorConnected } from "@/lib/saleor-connection";

/** The deploy's smoke test and the deployment record's probe. */
export function GET() {
	return Response.json({ ok: true, saleor: isSaleorConnected ? "connected" : "not-connected" });
}
