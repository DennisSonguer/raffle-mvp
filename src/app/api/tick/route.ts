import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  // Vercel Cron sendet diesen Header
  const vercelCron = req.headers.get("x-vercel-cron") === "1";
  if (vercelCron) return true;

  // Manuell testen via ?secret=
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: raffles, error: eR } = await supabaseAdmin
    .from("raffles")
    .select("id, duration_seconds");

  if (eR) return NextResponse.json({ error: eR.message }, { status: 500 });

  const done: any[] = [];
  let processed = 0;

  for (const r of raffles ?? []) {
    const raffleId = String((r as any).id);
    const duration = Number((r as any).duration_seconds ?? 0);

    const { data: round } = await supabaseAdmin
      .from("raffle_rounds")
      .select("id, raffle_id, start_at, ends_at, total_tickets, winning_ticket")
      .eq("raffle_id", raffleId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    // wenn kein Round existiert → anlegen
    if (!round) {
      const start = new Date();
      const ends = new Date(start.getTime() + duration * 1000);
      await supabaseAdmin.from("raffle_rounds").insert({
        raffle_id: raffleId,
        start_at: start.toISOString(),
        ends_at: ends.toISOString(),
        total_tickets: 0,
        winning_ticket: null,
      });
      processed++;
      continue;
    }

    const endsAt = new Date((round as any).ends_at).getTime();
    const isOver = Date.now() >= endsAt;

    if (!isOver) continue;

    const total = Number((round as any).total_tickets ?? 0);
    const winningTicket = total > 0 ? randomInt(1, total + 1) : null;

    await supabaseAdmin
      .from("raffle_rounds")
      .update({ winning_ticket: winningTicket })
      .eq("id", (round as any).id);

    done.push({
      raffleId,
      roundId: (round as any).id,
      total,
      winningTicket,
    });

    // neuen Round starten
    const start = new Date();
    const ends = new Date(start.getTime() + duration * 1000);
    await supabaseAdmin.from("raffle_rounds").insert({
      raffle_id: raffleId,
      start_at: start.toISOString(),
      ends_at: ends.toISOString(),
      total_tickets: 0,
      winning_ticket: null,
    });

    processed++;
  }

  return NextResponse.json({ ok: true, processed, done, now });
}
