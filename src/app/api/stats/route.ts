import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * The browser only ever talks to this route. It reads the sheet on the
 * server, cleans it, computes every number and returns plain JSON.
 */
export async function GET() {
  try {
    const raw = await getDataSource().read();
    const stats = computeStats(raw);
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
