import { supabase } from "@/lib/supabase";

export type Raffle = {
  id: string;
  title: string;
  prize: string;
  ticketPrice: number;
  durationMs: number;
  demoTotalTickets: number;
  image: string;
  description: string;
};

export type Round = {
  id: number;
  raffleId: string;
  endsAt: string; // ISO
  status: "RUNNING" | "ENDED";
  winningTicket: number | null;
  totalAtDraw: number | null;
};

function mapRaffle(row: any): Raffle {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    prize: String(row.prize ?? ""),
    ticketPrice: Number(row.ticket_price ?? 0),
    durationMs: Number(row.duration_ms ?? 0),
    demoTotalTickets: Number(row.demo_total_tickets ?? 0),
    image: String(row.image ?? ""),
    description: String(row.description ?? ""),
  };
}

function mapRound(row: any): Round {
  return {
    id: Number(row.id),
    raffleId: String(row.raffle_id),
    endsAt: String(row.ends_at),
    status: (row.status as any) === "ENDED" ? "ENDED" : "RUNNING",
    winningTicket: row.winning_ticket === null || row.winning_ticket === undefined ? null : Number(row.winning_ticket),
    totalAtDraw: row.total_at_draw === null || row.total_at_draw === undefined ? null : Number(row.total_at_draw),
  };
}

export async function getRaffles(): Promise<Raffle[]> {
  const { data, error } = await supabase
    .from("raffles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRaffle);
}

export async function getRaffle(id: string): Promise<Raffle | null> {
  const { data, error } = await supabase
    .from("raffles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRaffle(data) : null;
}

export async function upsertRaffle(r: Raffle) {
  const payload = {
    id: r.id,
    title: r.title,
    prize: r.prize,
    ticket_price: r.ticketPrice,
    duration_ms: r.durationMs,
    demo_total_tickets: r.demoTotalTickets,
    image: r.image,
    description: r.description,
  };

  const { error } = await supabase.from("raffles").upsert(payload);
  if (error) throw error;
}

export async function deleteRaffle(id: string) {
  const { error } = await supabase.from("raffles").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Sorgt dafür, dass es pro raffle_id genau 1 RUNNING Runde gibt (oder erstellt eine).
 */
export async function ensureRunningRound(raffle: Raffle): Promise<Round> {
  const { data: existing, error: e1 } = await supabase
    .from("raffle_rounds")
    .select("*")
    .eq("raffle_id", raffle.id)
    .eq("status", "RUNNING")
    .order("created_at", { ascending: false })
    .limit(1);

  if (e1) throw e1;

  if (existing && existing.length > 0) return mapRound(existing[0]);

  const endsAt = new Date(Date.now() + raffle.durationMs).toISOString();

  const { data: created, error: e2 } = await supabase
    .from("raffle_rounds")
    .insert({ raffle_id: raffle.id, ends_at: endsAt, status: "RUNNING" })
    .select("*")
    .single();

  if (!e2 && created) return mapRound(created);

  // Falls unique-index blockt (weil parallel schon eine RUNNING erstellt wurde)
  const { data: ex2, error: e3 } = await supabase
    .from("raffle_rounds")
    .select("*")
    .eq("raffle_id", raffle.id)
    .eq("status", "RUNNING")
    .order("created_at", { ascending: false })
    .limit(1);

  if (e3) throw (e2 ?? e3);
  if (ex2 && ex2.length > 0) return mapRound(ex2[0]);

  throw (e2 ?? new Error("ensureRunningRound failed"));
}

export async function getRunningRounds(raffleIds: string[]): Promise<Record<string, Round>> {
  if (raffleIds.length === 0) return {};

  const { data, error } = await supabase
    .from("raffle_rounds")
    .select("*")
    .in("raffle_id", raffleIds)
    .eq("status", "RUNNING")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const map: Record<string, Round> = {};
  for (const row of data ?? []) {
    const rid = String((row as any).raffle_id);
    if (!map[rid]) map[rid] = mapRound(row);
  }
  return map;
}

export async function startNewRound(raffle: Raffle): Promise<Round> {
  const endsAt = new Date(Date.now() + raffle.durationMs).toISOString();

  const { data, error } = await supabase
    .from("raffle_rounds")
    .insert({ raffle_id: raffle.id, ends_at: endsAt, status: "RUNNING" })
    .select("*")
    .single();

  if (error) throw error;
  return mapRound(data);
}

export async function endRound(roundId: number, winningTicket: number | null, totalAtDraw: number | null) {
  const { error } = await supabase
    .from("raffle_rounds")
    .update({
      status: "ENDED",
      winning_ticket: winningTicket,
      total_at_draw: totalAtDraw,
    })
    .eq("id", roundId);

  if (error) throw error;
}

export async function buyTicket(args: {
  raffleId: string;
  roundId: number;
  username: string;
  qty: number;
  creatorCode: string | null;
}) {
  const { error } = await supabase.from("ticket_purchases").insert({
    raffle_id: args.raffleId,
    round_id: args.roundId,
    username: args.username,
    qty: args.qty,
    creator_code: args.creatorCode,
  });
  if (error) throw error;
}

export async function getPurchases(roundId: number): Promise<{ username: string; qty: number }[]> {
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("username, qty")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((x: any) => ({ username: String(x.username), qty: Number(x.qty ?? 0) }));
}

export async function getTotalTickets(roundId: number): Promise<number> {
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("qty")
    .eq("round_id", roundId);

  if (error) throw error;
  return (data ?? []).reduce((a: number, x: any) => a + Number(x.qty ?? 0), 0);
}

export async function getMyTickets(roundId: number, username: string): Promise<number> {
  if (!username) return 0;

  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("qty")
    .eq("round_id", roundId)
    .eq("username", username);

  if (error) throw error;
  return (data ?? []).reduce((a: number, x: any) => a + Number(x.qty ?? 0), 0);
}

/**
 * Liefert Map: raffleId -> tickets vom User (für laufende Runden)
 */
export async function getUserTicketsByRaffle(username: string, roundIds: number[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!username || roundIds.length === 0) return out;

  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("raffle_id, qty")
    .eq("username", username)
    .in("round_id", roundIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const rid = String((row as any).raffle_id);
    const qty = Number((row as any).qty ?? 0);
    out[rid] = (out[rid] ?? 0) + qty;
  }

  return out;
}

export async function getLatestEndedRound(raffleId: string): Promise<Round | null> {
  const { data, error } = await supabase
    .from("raffle_rounds")
    .select("*")
    .eq("raffle_id", raffleId)
    .eq("status", "ENDED")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length ? mapRound(data[0]) : null;
}

export async function getWinnerUsername(roundId: number, winningTicket: number) {
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("username, qty")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  let acc = 0;
  for (const p of data ?? []) {
    const start = acc + 1;
    acc += Number((p as any).qty ?? 0);
    const end = acc;
    if (winningTicket >= start && winningTicket <= end) {
      return String((p as any).username ?? "");
    }
  }
  return "";
}
