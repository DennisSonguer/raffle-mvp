import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function okPin(req: Request) {
  const need = process.env.ADMIN_PIN || "";
  if (!need) return true; // wenn du noch keinen gesetzt hast
  const url = new URL(req.url);
  const qp = url.searchParams.get("pin") || "";
  const hdr = req.headers.get("x-admin-pin") || "";
  return qp === need || hdr === need;
}

export async function GET(req: Request) {
  if (!okPin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: raffles, error: e1 } = await supabaseAdmin
    .from("raffles")
    .select("id, ticket_price");

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const priceById = new Map<string, number>();
  for (const r of raffles ?? []) {
    priceById.set(String((r as any).id), Number((r as any).ticket_price ?? 0));
  }

  const { data: purchases, error: e2 } = await supabaseAdmin
    .from("ticket_purchases")
    .select("creator_code, raffle_id, qty")
    .not("creator_code", "is", null);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const agg: Record<string, { code: string; tickets: number; revenue: number }> = {};

  for (const p of purchases ?? []) {
    const code = String((p as any).creator_code ?? "").trim().toUpperCase();
    if (!code) continue;

    const raffleId = String((p as any).raffle_id ?? "");
    const qty = Number((p as any).qty ?? 0);
    const price = priceById.get(raffleId) ?? 0;

    if (!agg[code]) agg[code] = { code, tickets: 0, revenue: 0 };
    agg[code].tickets += qty;
    agg[code].revenue += qty * price;
  }

  const rows = Object.values(agg).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ ok: true, rows });
}
