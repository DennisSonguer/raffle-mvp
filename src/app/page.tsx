export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Raffle (Demo)
              </h1>
              <p className="mt-2 text-zinc-300">
                Tickets kaufen → Ziehung → Gewinner.
              </p>
            </div>

            <a
              href="/raffles"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 font-semibold text-black hover:opacity-90"
            >
              Raffles ansehen →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
