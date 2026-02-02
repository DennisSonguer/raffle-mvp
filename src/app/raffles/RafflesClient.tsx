 "use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getRaffles,
  getRunningRounds,
  getUserTicketsByRaffle,
  ensureRunningRound,
  getTotalTickets,
  endRound,
  startNewRound,
  type Raffle,
  type Round,
} from "@/lib/raffles_db";

function formatLeft(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function RafflesClient() {
  const sp = useSearchParams();
  const ref = sp.get("ref");

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);

  const [user, setUser] = useState("");
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [rounds, setRounds] = useState<Record<string, Round>>({});
  const [myTickets, setMyTickets] = useState<Record<string, number>>({});

  const lockRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());

    if (ref) localStorage.setItem("ref_code", ref.toUpperCase());

    const loadAll = async () => {
      if (lockRef.current) return;
      lockRef.current = true;

      try {
        const u = localStorage.getItem("current_user") ?? "";
        setUser(u);

        const rs = await getRaffles();
        setRaffles(rs);

        await Promise.all(rs.map((r) => ensureRunningRound(r)));

        let rr = await getRunningRounds(rs.map((x) => x.id));

        const nowMs = Date.now();
        for (const r of rs) {
          const cur = rr[r.id];
          if (!cur) continue;

          const endAt = new Date(cur.endsAt).getTime();
          if (nowMs < endAt) continue;

          const totalAtDraw = await getTotalTickets(cur.id);
          const winningTicket =
            totalAtDraw > 0 ? Math.floor(Math.random() * totalAtDraw) + 1 : null;

          await endRound(cur.id, winningTicket, totalAtDraw > 0 ? totalAtDraw : null);
          await startNewRound(r);
        }

        rr = await getRunningRounds(rs.map((x) => x.id));
        setRounds(rr);

        const roundIds = Object.values(rr).map((x) => x.id);
        const ticketsMap = await getUserTicketsByRaffle(u, roundIds);
        setMyTickets(ticketsMap);
      } finally {
        lockRef.current = false;
      }
    };

    loadAll();

    const t1 = setInterval(() => setNow(Date.now()), 1000);
    const t2 = setInterval(loadAll, 3000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [ref]);

  const totalTickets = useMemo(() => {
    if (!user) return 0;
    return raffles.reduce((sum, r) => sum + (myTickets[r.id] ?? 0), 0);
  }, [raffles, myTickets, user]);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <a href="/" className="text-zinc-300 hover:text-white">← Zurück</a>
              <a href="/admin" className="text-sm text-white font-semibold underline">Admin</a>

              {user ? (
                <span className="text-sm text-zinc-300">
                  User: <span className="text-white font-semibold">{user}</span>
                </span>
              ) : (
                <span className="text-sm text-zinc-300">Nicht eingeloggt</span>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Raffles</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-zinc-400">Deine Tickets (gesamt)</div>
              <div className="text-2xl font-extrabold">{totalTickets}</div>
            </div>

            {user ? (
              <a
                href="/logout"
                className="rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90"
              >
                Logout
              </a>
            ) : (
              <a
                href="/login"
                className="rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90"
              >
                Login
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {raffles.map((r) => {
            const rr = rounds[r.id];
            const endAt = rr ? new Date(rr.endsAt).getTime() : now;
            const left = endAt - now;
            const my = user ? (myTickets[r.id] ?? 0) : 0;

            return (
              <div key={r.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-lg">
                <div className="h-40 w-full bg-black/30">
                  <img src={r.image} alt={r.title} className="h-40 w-full object-cover" />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-bold">{r.title}</div>
                      <div className="mt-2 text-zinc-300">
                        Preis: <span className="text-white">{r.prize}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                      Countdown: {formatLeft(left)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-zinc-300">
                      Ticket: <span className="text-white font-semibold">{r.ticketPrice}</span>
                    </div>

                    <Link
                      href={`/raffles/${r.id}`}
                      className="rounded-xl bg-white px-4 py-2 font-semibold text-black hover:opacity-90"
                    >
                      Öffnen →
                    </Link>
                  </div>

                  <div className="mt-3 text-sm text-zinc-400">
                    Deine Tickets hier: <span className="text-zinc-200 font-semibold">{my}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
