export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import RafflesClient from "./RafflesClient";

function Fallback() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-bold">Laden…</div>
        <div className="mt-2 text-zinc-300">
          Wenn du hier hängen bleibst: Browser-Erweiterungen deaktivieren und neu laden.
        </div>
        <div className="mt-4">
          <a className="underline" href="/login">→ Login</a>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <RafflesClient />
    </Suspense>
  );
}
