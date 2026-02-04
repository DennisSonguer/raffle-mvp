import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  // Vercel Cron Header
  if (req.headers.get("x-vercel-cron") === "1") return true;

  // Manuell testen: /api/tick?secret=...
  const url = new URL(req.url);
  const qp = url.searchParams.get("secret") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  return !!secret && qp === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Nur abgelaufene RUNNING-Runden holen
  const { data: expiredRounds, error: e1 } = await supabaseAdmin
    .from("raffle_rounds")
    .select("id, raffle_id, ends_at")
    .eq("status", "RUNNING")
    .lte("ends_at", nowIso);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const done: any[] = [];

  for (const rr of expiredRounds ?? []) {
    const roundId = Number((rr as any).id);
    const raffleId = String((rr as any).raffle_id);

    // Total Tickets aus Käufen berechnen
    const { data: purchases, error: e2 } = await supabaseAdmin
      .from("ticket_purchases")
      .select("qty")
      .eq("round_id", roundId);

    if (e2) continue;

    const total = (purchases ?? []).reduce(
      (a: number, x: any) => a + Number((x as any).qty ?? 0),
      0
    );

    const winningTicket = total > 0 ? randomInt(1, total + 1) : null;

    // Runde beenden (WICHTIG: KEIN neuer Round wird hier erstellt)
    const { error: e3 } = await supabaseAdmin
      .from("raffle_rounds")
      .update({
        status: "ENDED",
        winning_ticket: winningTicket,
        total_at_draw: total > 0 ? total : null,
      })
      .eq("id", roundId);

    if (e3) continue;

    done.push({ raffleId, roundId, total, winningTicket });
  }

  return NextResponse.json({ ok: true, processed: done.length, done });
}
