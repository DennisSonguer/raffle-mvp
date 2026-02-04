"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Raffle = {
  id: string;
  title: string;
  prize: string;
  description: string | null;
  ticket_price: number;
  image_path: string | null;
  duration_seconds: number;
};

type Round = {
  id: number;
  raffle_id: string;
  start_at: string;
  ends_at: string;
  total_tickets: number;
  winning_ticket: number | null;
};

type Purchase = {
  id: number;
  raffle_id: string;
  round_id: number;
  username: string;
  qty: number;
  creator_code: string | null;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function RaffleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const raffleId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [round, setRound] = useState<Round | null>(null);

  const [username, setUsername] = useState<string>("");
  const [creatorCode, setCreatorCode] = useState<string>("");

  const [leftMs, setLeftMs] = useState(0);
  const [myTickets, setMyTickets] = useState(0);

  const [winnerUsername, setWinnerUsername] = useState<string | null>(null);
  const [winnerTicket, setWinnerTicket] = useState<number | null>(null);

  const status = useMemo(() => {
    if (!round) return "LOADING";
    if (round.winning_ticket != null) return "FINISHED";
    if (leftMs <= 0) return "WAITING_RESULT";
    return "RUNNING";
  }, [round, leftMs]);

  // Load username + creatorCode from localStorage (simple MVP)
  useEffect(() => {
    const u = (localStorage.getItem("username") || "").trim();
    const c = (localStorage.getItem("creatorCode") || "").trim();
    if (!u) {
      router.push("/login");
      return;
    }
    setUsername(u);
    setCreatorCode(c);
  }, [router]);

  async function loadRaffleAndRound() {
    setLoading(true);

    const { data: r, error: e1 } = await supabase
      .from("raffles")
      .select("id,title,prize,description,ticket_price,image_path,duration_seconds")
      .eq("id", raffleId)
      .maybeSingle();

    if (e1 || !r) {
      setLoading(false);
      setRaffle(null);
      setRound(null);
      return;
    }

    const { data: rd, error: e2 } = await supabase
      .from("raffle_rounds")
      .select("id,raffle_id,start_at,ends_at,total_tickets,winning_ticket")
      .eq("raffle_id", raffleId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    setRaffle(r as any);
    setRound((rd as any) ?? null);
    setLoading(false);
  }

  async function loadMyTickets(curRoundId: number, u: string) {
    const { data } = await supabase
      .from("ticket_purchases")
      .select("qty")
      .eq("round_id", curRoundId)
      .eq("username", u);

    const sum = (data ?? []).reduce((acc: number, row: any) => acc + Number(row.qty ?? 0), 0);
    setMyTickets(sum);
  }

  async function resolveWinner(curRound: Round) {
    if (curRound.winning_ticket == null) {
      setWinnerUsername(null);
      setWinnerTicket(null);
      return;
    }

    const wt = Number(curRound.winning_ticket);
    setWinnerTicket(wt);

    const { data } = await supabase
      .from("ticket_purchases")
      .select("username, qty, created_at")
      .eq("round_id", curRound.id)
      .order("created_at", { ascending: true });

    let cur = 0;
    let winner: string | null = null;

    for (const row of (data ?? []) as any[]) {
      const qty = Number(row.qty ?? 0);
      const start = cur + 1;
      const end = cur + qty;
      if (wt >= start && wt <= end) {
        winner = String(row.username);
        break;
      }
      cur = end;
    }

    setWinnerUsername(winner);
  }

  // Initial load
  useEffect(() => {
    if (!raffleId) return;
    loadRaffleAndRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleId]);

  // Countdown tick
  useEffect(() => {
    if (!round) return;

    const update = () => {
      const endsAt = new Date(round.ends_at).getTime();
      setLeftMs(endsAt - Date.now());
    };

    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [round]);

  // Load my tickets whenever round/username changes
  useEffect(() => {
    if (!round || !username) return;
    loadMyTickets(round.id, username);
  }, [round?.id, username]);

  // When time is over: poll until winning_ticket appears (so it won’t sit at 0)
  useEffect(() => {
    if (!round) return;
    if (round.winning_ticket != null) return;

    if (leftMs > 0) return;

    const poll = setInterval(async () => {
      const { data: rd } = await supabase
        .from("raffle_rounds")
        .select("id,raffle_id,start_at,ends_at,total_tickets,winning_ticket")
        .eq("id", round.id)
        .maybeSingle();

      if (rd && (rd as any).winning_ticket != null) {
        const next = rd as any as Round;
        setRound(next);
        clearInterval(poll);
      }
    }, 2500);

    return () => clearInterval(poll);
  }, [leftMs, round]);

  // When finished: compute winner
  useEffect(() => {
    if (!round) return;
    if (round.winning_ticket == null) return;
    resolveWinner(round);
  }, [round?.winning_ticket]);

  async function buyTicket(qty: number) {
    if (!raffle || !round) return;
    if (!username) return;
    if (round.winning_ticket != null) return;

    // insert purchase
    await supabase.from("ticket_purchases").insert({
      raffle_id: String(raffle.id),
      round_id: round.id,
      username,
      qty,
      creator_code: creatorCode ? creatorCode.toUpperCase() : null,
    });

    // update total_tickets
    const nextTotal = Number(round.total_tickets ?? 0) + qty;
    await supabase.from("raffle_rounds").update({ total_tickets: nextTotal }).eq("id", round.id);

    // refresh local state
    setRound({ ...round, total_tickets: nextTotal });
    setMyTickets((v) => v + qty);
  }

  if (loading || !raffle || !round) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-6 py-10 text-zinc-300">Lade…</div>
      </main>
    );
  }

  const imgSrc = raffle.image_path ? raffle.image_path : null;
  const isWinner = winnerUsername && username && winnerUsername === username;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button
          onClick={() => router.push("/raffles")}
          className="mb-6 text-sm text-zinc-300 hover:text-white"
        >
          ← Zurück
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc.startsWith("/") ? imgSrc : `/${imgSrc}`}
                alt={raffle.title}
                className="h-36 w-full rounded-2xl object-cover sm:h-36 sm:w-56"
              />
            ) : (
              <div className="h-36 w-full rounded-2xl bg-white/10 sm:w-56" />
            )}

            <div className="flex-1">
              <div className="text-2xl font-extrabold">{raffle.title}</div>
              <div className="mt-1 text-zinc-300">Preis: {raffle.prize}</div>
              {raffle.description ? (
                <div className="mt-3 text-sm text-zinc-300">{raffle.description}</div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  Ticket: <b>{raffle.ticket_price}</b>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  Deine Tickets: <b>{myTickets}</b>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  Gesamt: <b>{round.total_tickets}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {status === "FINISHED" ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Ziehung beendet</div>
                <div className="mt-2 text-sm text-zinc-300">
                  Gewinn-Ticket: <b>{winnerTicket ?? "-"}</b>
                </div>
                <div className="mt-1 text-sm text-zinc-300">
                  Gewinner: <b>{winnerUsername ?? "-"}</b>
                </div>

                {winnerUsername ? (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 font-semibold ${
                      isWinner ? "bg-white text-black" : "border border-white/10 bg-black/30"
                    }`}
                  >
                    {isWinner ? "GEWONNEN ✅" : "NICHT GEWONNEN ❌"}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-300">
                    Keine Tickets verkauft – kein Gewinner.
                  </div>
                )}
              </div>
            ) : status === "WAITING_RESULT" ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-200">
                Ziehung läuft… bitte kurz warten.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-200">
                Countdown: {formatLeft(leftMs)}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => buyTicket(1)}
              disabled={status !== "RUNNING"}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              1 Ticket kaufen
            </button>

            <button
              onClick={() => buyTicket(5)}
              disabled={status !== "RUNNING"}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              5 Tickets kaufen
            </button>

            <button
              onClick={() => buyTicket(10)}
              disabled={status !== "RUNNING"}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              10 Tickets kaufen
            </button>
          </div>

          <div className="mt-6 text-xs text-zinc-400">
            Eingeloggt als: <b className="text-zinc-200">{username}</b>
          </div>
        </div>
      </div>
    </main>
  );
}
