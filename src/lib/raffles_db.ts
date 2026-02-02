import { supabase } from "./supabase";

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
  endsAt: string;
  status: "RUNNING" | "ENDED";
  winningTicket: number | null;
  totalAtDraw: number | null;
};

function mapRaffle(r: any): Raffle {
  return {
    id: String(r.id),
    title: r.title ?? "",
    prize: r.prize ?? "",
    ticketPrice: Number(r.ticket_price ?? 0),
    durationMs: Number(r.duration_ms ?? 0),
    demoTotalTickets: Number(r.demo_total_tickets ?? 0),
    image: r.image ?? "",
    description: r.description ?? "",
  };
}

function mapRound(r: any): Round {
  return {
    id: Number(r.id),
    raffleId: String(r.raffle_id),
    endsAt: String(r.ends_at),
    status: (r.status ?? "RUNNING") as any,
    winningTicket: r.winning_ticket ?? null,
    totalAtDraw: r.total_at_draw ?? null,
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
  const { error } = await supabase.from("raffles").upsert({
    id: r.id,
    title: r.title,
    prize: r.prize,
    ticket_price: r.ticketPrice,
    duration_ms: r.durationMs,
    demo_total_tickets: r.demoTotalTickets,
    image: r.image,
    description: r.description,
  });
  if (error) throw error;
}

export async function deleteRaffle(id: string) {
  const { error } = await supabase.from("raffles").delete().eq("id", id);
  if (error) throw error;
}

export async function getRunningRounds(raffleIds: string[]): Promise<Record<string, Round>> {
  if (!raffleIds.length) return {};
  const { data, error } = await supabase
    .from("raffle_rounds")
    .select("id,raffle_id,ends_at,status,winning_ticket,total_at_draw,created_at")
    .in("raffle_id", raffleIds)
    .eq("status", "RUNNING")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const map: Record<string, Round> = {};
  for (const row of data ?? []) {
    const rr = mapRound(row);
    if (!map[rr.raffleId]) map[rr.raffleId] = rr; // first = newest
  }
  return map;
}

export async function getLatestEndedRound(raffleId: string): Promise<Round | null> {
  const { data, error } = await supabase
    .from("raffle_rounds")
    .select("id,raffle_id,ends_at,status,winning_ticket,total_at_draw,created_at")
    .eq("raffle_id", raffleId)
    .eq("status", "ENDED")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data[0] ? mapRound(data[0]) : null;
}

export async function ensureRunningRound(raffle: Raffle): Promise<Round> {
  const rrMap = await getRunningRounds([raffle.id]);
  const existing = rrMap[raffle.id];
  if (existing) return existing;

  const endsAt = new Date(Date.now() + raffle.durationMs).toISOString();
  const { data, error } = await supabase
    .from("raffle_rounds")
    .insert({ raffle_id: raffle.id, ends_at: endsAt, status: "RUNNING" })
    .select("id,raffle_id,ends_at,status,winning_ticket,total_at_draw")
    .single();

  if (error) throw error;
  return mapRound(data);
}

export async function buyTicket(opts: {
  raffleId: string;
  roundId: number;
  username: string;
  creatorCode?: string | null;
  qty?: number;
}) {
  const { raffleId, roundId, username, creatorCode, qty = 1 } = opts;
  const { error } = await supabase.from("ticket_purchases").insert({
    raffle_id: raffleId,
    round_id: roundId,
    username,
    qty,
    creator_code: creatorCode || null,
  });
  if (error) throw error;
}

export async function getPurchases(roundId: number): Promise<{ id: number; username: string; qty: number }[]> {
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("id,username,qty")
    .eq("round_id", roundId)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((x: any) => ({
    id: Number(x.id),
    username: String(x.username),
    qty: Number(x.qty ?? 0),
  }));
}

export async function getMyTickets(roundId: number, username: string): Promise<number> {
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("qty")
    .eq("round_id", roundId)
    .eq("username", username);

  if (error) throw error;
  return (data ?? []).reduce((a: number, r: any) => a + Number(r.qty ?? 0), 0);
}

export async function getTotalTickets(roundId: number): Promise<number> {
  const { data, error } = await supabase.from("ticket_purchases").select("qty").eq("round_id", roundId);
  if (error) throw error;
  return (data ?? []).reduce((a: number, r: any) => a + Number(r.qty ?? 0), 0);
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

export async function startNewRound(raffle: Raffle): Promise<Round> {
  const endsAt = new Date(Date.now() + raffle.durationMs).toISOString();
  const { data, error } = await supabase
    .from("raffle_rounds")
    .insert({ raffle_id: raffle.id, ends_at: endsAt, status: "RUNNING" })
    .select("id,raffle_id,ends_at,status,winning_ticket,total_at_draw")
    .single();

  if (error) throw error;
  return mapRound(data);
}

export async function getUserTicketsByRaffle(username: string, roundIds: number[]) {
  if (!username || !roundIds.length) return {} as Record<string, number>;
  const { data, error } = await supabase
    .from("ticket_purchases")
    .select("raffle_id,qty")
    .eq("username", username)
    .in("round_id", roundIds);

  if (error) throw error;

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const rid = String((row as any).raffle_id);
    const q = Number((row as any).qty ?? 0);
    out[rid] = (out[rid] ?? 0) + q;
  }
  return out;
}
