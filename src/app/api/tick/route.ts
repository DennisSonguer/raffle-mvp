import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const url = new URL(req.url);

  // 1) Vercel Cron: Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  // 2) Manuell (Browser): /api/tick?secret=...
  const qp = url.searchParams.get("secret") ?? "";

  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true;

  return bearer === secret || qp === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

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

    const { error: e3 } = await supabaseAdmin
      .from("raffle_rounds")
      .update({
        status: "ENDED",
        winning_ticket: winningTicket,
        total_at_draw: total > 0 ? total : null,
      })
      .eq("id", roundId);

    if (e3) continue;

    const { data: raffleRow, error: e4 } = await supabaseAdmin
      .from("raffles")
      .select("duration_ms")
      .eq("id", raffleId)
      .maybeSingle();

    if (e4 || !raffleRow) continue;

    const durationMs = Number((raffleRow as any).duration_ms ?? 0);
    const endsAt = new Date(Date.now() + durationMs).toISOString();

    const { error: e5 } = await supabaseAdmin
      .from("raffle_rounds")
      .insert({ raffle_id: raffleId, ends_at: endsAt, status: "RUNNING" });

    if (e5) continue;

    done.push({ raffleId, roundId, total, winningTicket });
  }

  return NextResponse.json({ ok: true, processed: done.length, done });
}
