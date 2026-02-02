"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  buyTicket,
  endRound,
  ensureRunningRound,
  getLatestEndedRound,
  getMyTickets,
  getRaffle,
  getPurchases,
  getTotalTickets,
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

function winnerFromPurchases(
  purchases: { username: string; qty: number }[],
  winningTicket: number
) {
  let acc = 0;
  for (const p of purchases) {
    const start = acc + 1;
    acc += p.qty;
    const end = acc;
    if (winningTicket >= start && winningTicket <= end) return p.username;
  }
  return "";
}

export default function RaffleDetailPage() {
  const params = useParams<{ id: string }>();
  const raffleId = params.id;

  const [now, setNow] = useState(Date.now());
  const [user, setUser] = useState("");
  const [raffle, setRaffle] = useState<Raffle | null>(null);

  const [round, setRound] = useState<Round | null>(null);
  const [my, setMy] = useState(0);
  const [total, setTotal] = useState(0);

  const [lastRound, setLastRound] = useState<Round | null>(null);
  const [lastWinnerUser, setLastWinnerUser] = useState("");
  const [lastWon, setLastWon] = useState<boolean | null>(null);

  const [activeCode, setActiveCode] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setUser(localStorage.getItem("current_user") ?? "");
    setActiveCode((localStorage.getItem("ref_code") ?? "").toUpperCase());
  }, []);

  async function refreshAll() {
    setErr("");
    try {
      const u = localStorage.getItem("current_user") ?? "";
      setUser(u);
      setActiveCode((localStorage.getItem("ref_code") ?? "").toUpperCase());

      const r = await getRaffle(raffleId);
      setRaffle(r);
      if (!r) return;

      const running = await ensureRunningRound(r);
      setRound(running);

      const [myT, totalT] = await Promise.all([
        u ? getMyTickets(running.id, u) : Promise.resolve(0),
        getTotalTickets(running.id),
      ]);
      setMy(myT);
      setTotal(totalT);

      const lr = await getLatestEndedRound(r.id);
      setLastRound(lr);

      if (lr && lr.winningTicket && lr.winningTicket > 0) {
        const purchases = await getPurchases(lr.id);
        const wUser = winnerFromPurchases(purchases, lr.winningTicket);
        setLastWinnerUser(wUser);
        setLastWon(u ? wUser === u : null);
      } else {
        setLastWinnerUser("");
        setLastWon(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Fehler");
    }
  }

  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleId]);

  // Auto-Ende + neue Runde
  useEffect(() => {
    const run = async () => {
      if (!raffle || !round) return;
      if (busy) return;

      const endAt = new Date(round.endsAt).getTime();
      if (now < endAt) return;
      if (round.status !== "RUNNING") return;

      setBusy(true);
      setErr("");

      try {
        const totalAtDraw = await getTotalTickets(round.id);
        let winningTicket: number | null = null;

        if (totalAtDraw > 0) {
          winningTicket = Math.floor(Math.random() * totalAtDraw) + 1;
        }

        await endRound(round.id, winningTicket, totalAtDraw > 0 ? totalAtDraw : null);
        await startNewRound(raffle);

        await refreshAll();
      } catch (e: any) {
        setErr(e?.message ?? "Fehler beim Draw");
      } finally {
        setBusy(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, raffle, round]);

  async function onBuy() {
    if (!raffle || !round) return;
    const u = localStorage.getItem("current_user") ?? "";
    if (!u) return (location.href = "/login");

    if (busy) return;
    setBusy(true);
    setErr("");

    try {
      const code = (localStorage.getItem("ref_code") ?? "").trim().toUpperCase() || null;

      await buyTicket({
        raffleId: raffle.id,
        roundId: round.id,
        username: u,
        creatorCode: code,
        qty: 1,
      });

      await refreshAll();
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Kauf");
    } finally {
      setBusy(false);
    }
  }

  function applyCode() {
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    localStorage.setItem("ref_code", c);
    setActiveCode(c);
    setCodeInput("");
  }

  function clearCode() {
    localStorage.removeItem("ref_code");
    setActiveCode("");
    setCodeInput("");
  }

  const endAt = round ? new Date(round.endsAt).getTime() : now;
  const left = endAt - now;
  const ended = left <= 0;

  const chance = total > 0 ? (my / total) * 100 : 0;
  const chanceText = my > 0 ? `${Math.min(100, chance).toFixed(1)}%` : "0%";

  if (!raffle) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <a href="/raffles" className="text-zinc-300 hover:text-white">← Zurück</a>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            {err ? err : "Lade…"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <a href="/raffles" className="text-zinc-300 hover:text-white">← Zurück</a>
          <div className="text-sm text-zinc-300">
            {user ? (
              <>User: <span className="text-white font-semibold">{user}</span></>
            ) : (
              <a href="/login" className="text-white font-semibold underline">Login</a>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="h-56 w-full bg-black/30">
            <img src={raffle.image} alt={raffle.title} className="h-56 w-full object-cover" />
          </div>

          <div className="p-6">
            <h1 className="text-3xl font-extrabold tracking-tight">{raffle.title}</h1>

            <div className="mt-3 text-zinc-300">
              Preis: <span className="text-white font-semibold">{raffle.prize}</span>
            </div>

            <div className="mt-4 text-zinc-300">Beschreibung</div>
            <div className="mt-1 text-white/90">{raffle.description}</div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                Countdown: {formatLeft(left)}
              </div>
              <div className="text-zinc-300">
                Ticket: <span className="text-white font-semibold">{raffle.ticketPrice}</span>
              </div>
            </div>

            {/* Creator Code */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm text-zinc-300">Creator Code</div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  className="flex-1 rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                  placeholder="Code eingeben (z.B. MIKE)"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                />
                <button
                  onClick={applyCode}
                  className="rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90"
                >
                  Anwenden
                </button>
                <button
                  onClick={clearCode}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
                >
                  Löschen
                </button>
              </div>

              <div className="mt-2 text-sm text-zinc-300">
                Aktiv: <span className="text-white font-semibold">{activeCode || "kein"}</span>
              </div>
            </div>

            {/* Tickets (aktuelle Runde) */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-zinc-300">
                  Deine Tickets (Runde): <span className="text-white font-semibold">{my}</span>
                  <span className="ml-3 text-sm text-zinc-400">
                    (Gesamt: {total} · Chance ~ {chanceText})
                  </span>
                </div>

                <button
                  onClick={onBuy}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
                  disabled={busy || ended}
                >
                  Tickets kaufen
                </button>
              </div>

              {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
              {busy && <div className="mt-2 text-sm text-zinc-300">…</div>}
            </div>

            {/* Letztes Ergebnis */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm text-zinc-300">Letztes Ergebnis</div>

              {!lastRound && <div className="mt-1 text-white font-semibold">Noch keins</div>}

              {lastRound && !lastRound.winningTicket && (
                <div className="mt-1 text-white font-semibold">Runde beendet (keine Tickets)</div>
              )}

              {lastRound && lastRound.winningTicket && (
                <div className="mt-2">
                  <div className="text-2xl font-extrabold">
                    {lastWon === null ? "ENDED" : lastWon ? "GEWONNEN ✅" : "VERLOREN ❌"}
                  </div>
                  <div className="mt-2 text-sm text-zinc-300">
                    Gewinner-Ticket:{" "}
                    <span className="text-white font-semibold">#{lastRound.winningTicket}</span> von{" "}
                    <span className="text-white font-semibold">{lastRound.totalAtDraw ?? "-"}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Gewinner User: <span className="text-zinc-200 font-semibold">{lastWinnerUser || "-"}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
