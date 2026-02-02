export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-4xl font-extrabold tracking-tight">raffle-mvp</div>
          <div className="mt-2 text-zinc-300">Tickets kaufen. Countdown läuft. Gewinner automatisch.</div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/login"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black hover:opacity-90"
            >
              Login
            </a>
            <a
              href="/raffles"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Raffles ansehen
            </a>
            <a
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Admin
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
