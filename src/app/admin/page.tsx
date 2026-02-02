"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  deleteRaffle,
  ensureRunningRound,
  getRaffles,
  upsertRaffle,
  type Raffle,
} from "@/lib/raffles_db";

const ADMIN_PIN = "1234"; // ändern

type Row = { creator_code: string; tickets: number; revenue: number };

export default function AdminDashboard() {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState<"raffles" | "creators">("raffles");

  // creators
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  // raffles
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [ticketPrice, setTicketPrice] = useState(10);
  const [durationSec, setDurationSec] = useState(120);
  const [demoTotalTickets, setDemoTotalTickets] = useState(200);
  const [image, setImage] = useState("/prizes/rolex.jpg");
  const [description, setDescription] = useState("");

  function auth() {
    if (pin === ADMIN_PIN) setOk(true);
  }

  async function reloadRaffles() {
    const rs = await getRaffles();
    setRaffles(rs);
  }

  async function loadSales() {
    setErr("");
    try {
      const { data, error } = await supabase
        .from("ticket_purchases")
        .select("creator_code, qty, raffle_id");

      if (error) throw error;

      const { data: rafflesPrice, error: e2 } = await supabase
        .from("raffles")
        .select("id, ticket_price");

      if (e2) throw e2;

      const priceMap: Record<string, number> = {};
      for (const r of rafflesPrice ?? []) {
        priceMap[String((r as any).id)] = Number((r as any).ticket_price ?? 0);
      }

      const agg: Record<string, { tickets: number; revenue: number }> = {};
      for (const x of data ?? []) {
        const code = String((x as any).creator_code ?? "").trim().toUpperCase();
        if (!code) continue;

        const qty = Number((x as any).qty ?? 0);
        const rid = String((x as any).raffle_id);
        const price = priceMap[rid] ?? 0;

        agg[code] = agg[code] || { tickets: 0, revenue: 0 };
        agg[code].tickets += qty;
        agg[code].revenue += qty * price;
      }

      const out: Row[] = Object.entries(agg).map(([creator_code, v]) => ({
        creator_code,
        tickets: v.tickets,
        revenue: v.revenue,
      }));

      out.sort((a, b) => b.revenue - a.revenue);
      setRows(out);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler");
    }
  }

  useEffect(() => {
    if (!ok) return;
    reloadRaffles();
    loadSales();

    const t = setInterval(() => {
      if (tab === "creators") loadSales();
      if (tab === "raffles") reloadRaffles();
    }, 4000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, tab]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.tickets += r.tickets;
        acc.revenue += r.revenue;
        return acc;
      },
      { tickets: 0, revenue: 0 }
    );
  }, [rows]);

  function copyCSV() {
    const header = "creator_code,tickets,revenue\n";
    const body = rows.map((r) => `${r.creator_code},${r.tickets},${r.revenue}`).join("\n");
    navigator.clipboard.writeText(header + body);
  }

  function fillForEdit(r: Raffle) {
    setEditId(r.id);
    setTitle(r.title);
    setPrize(r.prize);
    setTicketPrice(r.ticketPrice);
    setDurationSec(Math.floor(r.durationMs / 1000));
    setDemoTotalTickets(r.demoTotalTickets);
    setImage(r.image);
    setDescription(r.description);
  }

  function clearForm() {
    setEditId(null);
    setTitle("");
    setPrize("");
    setTicketPrice(10);
    setDurationSec(120);
    setDemoTotalTickets(200);
    setImage("/prizes/rolex.jpg");
    setDescription("");
  }

  async function saveOne() {
    const t = title.trim();
    const p = prize.trim();
    const img = image.trim();
    const desc = description.trim();
    if (!t || !p || !img) return;

    const item: Raffle = {
      id: editId ?? String(Date.now()),
      title: t,
      prize: p,
      ticketPrice: Number(ticketPrice) || 0,
      durationMs: (Number(durationSec) || 0) * 1000,
      demoTotalTickets: Number(demoTotalTickets) || 0,
      image: img,
      description: desc || "",
    };

    await upsertRaffle(item);
    await ensureRunningRound(item);
    await reloadRaffles();
    clearForm();
  }

  async function del(id: string) {
    await deleteRaffle(id);
    await reloadRaffles();
  }

  if (!ok) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-3xl font-extrabold tracking-tight">Admin</h1>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <input
              className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
              placeholder="Admin PIN"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button
              onClick={auth}
              className="mt-3 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90"
            >
              Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
          <a href="/raffles" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Zur Seite
          </a>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setTab("raffles")}
            className={`rounded-xl px-4 py-2 text-sm ${
              tab === "raffles" ? "bg-white text-black font-semibold" : "border border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            Raffles
          </button>
          <button
            onClick={() => setTab("creators")}
            className={`rounded-xl px-4 py-2 text-sm ${
              tab === "creators" ? "bg-white text-black font-semibold" : "border border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            Creator Umsatz
          </button>
        </div>

        {tab === "raffles" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-bold">{editId ? "Bearbeiten" : "Neu erstellen"}</div>

              <div className="mt-4 grid gap-3">
                <input className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                  placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                  placeholder="Preis / Gewinn" value={prize} onChange={(e) => setPrize(e.target.value)} />
                <input className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                  placeholder="Bildpfad (z.B. /prizes/rolex.jpg)" value={image} onChange={(e) => setImage(e.target.value)} />
                <textarea className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                  placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />

                <div className="grid grid-cols-3 gap-2">
                  <input className="rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                    type="number" placeholder="Ticket €" value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))} />
                  <input className="rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                    type="number" placeholder="Dauer (Sek.)" value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))} />
                  <input className="rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
                    type="number" placeholder="Demo Tickets" value={demoTotalTickets}
                    onChange={(e) => setDemoTotalTickets(Number(e.target.value))} />
                </div>

                <div className="flex gap-2">
                  <button onClick={saveOne} className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90">
                    Speichern
                  </button>
                  <button onClick={clearForm} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10">
                    Leeren
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-bold">Vorhandene Raffles</div>

              <div className="mt-4 grid gap-3">
                {raffles.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-sm text-zinc-300">{r.prize}</div>
                        <div className="text-xs text-zinc-400">
                          Ticket: {r.ticketPrice} · Dauer: {Math.floor(r.durationMs / 1000)}s · Bild: {r.image}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => fillForEdit(r)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                          Edit
                        </button>
                        <button onClick={() => del(r.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {raffles.length === 0 && <div className="text-sm text-zinc-400">Keine Raffles.</div>}
              </div>
            </div>
          </div>
        )}

        {tab === "creators" && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                Gesamt Tickets: <span className="text-white font-semibold">{totals.tickets}</span> ·
                Gesamt Umsatz: <span className="text-white font-semibold">{totals.revenue}</span>
              </div>

              <button
                onClick={copyCSV}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                CSV kopieren
              </button>
            </div>

            {err && <div className="mt-4 text-sm text-red-300">{err}</div>}

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/30 text-zinc-300">
                  <tr>
                    <th className="p-4">Code</th>
                    <th className="p-4">Tickets</th>
                    <th className="p-4">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td className="p-4 text-zinc-400" colSpan={3}>
                        Noch keine Sales.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.creator_code} className="border-t border-white/10">
                      <td className="p-4 font-semibold">{r.creator_code}</td>
                      <td className="p-4">{r.tickets}</td>
                      <td className="p-4">{r.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
