"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function cleanUsername(s: string) {
  return s.trim().replace(/\s+/g, "_");
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // falls jemand nach Email-Confirm zurückkommt und schon eingeloggt ist
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user) {
        const u =
          (session.user.user_metadata as any)?.username ||
          session.user.email ||
          "";
        if (u) localStorage.setItem("current_user", u);
        location.href = "/raffles";
      }
    })();
  }, []);

  async function submit() {
    setMsg("");
    setBusy(true);

    try {
      if (mode === "register") {
        const u = cleanUsername(username);
        if (!u) {
          setMsg("Bitte Username eingeben.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: u },
            emailRedirectTo: `${location.origin}/login`,
          },
        });

        if (error) throw error;

        // Wenn Email-Confirm AN ist: es gibt noch keine Session
        if (!data.session) {
          setMsg("Check deine E-Mail und bestätige den Link. Danach hier einloggen.");
          return;
        }

        const finalUser =
          (data.user?.user_metadata as any)?.username || data.user?.email || u;
        localStorage.setItem("current_user", finalUser);
        location.href = "/raffles";
        return;
      }

      // LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // typischer Fall wenn nicht bestätigt
        if ((error.message || "").toLowerCase().includes("confirm")) {
          throw new Error("E-Mail noch nicht bestätigt. Bitte erst bestätigen, dann einloggen.");
        }
        throw error;
      }

      const finalUser =
        (data.user?.user_metadata as any)?.username || data.user?.email || email;

      localStorage.setItem("current_user", finalUser);
      location.href = "/raffles";
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirm() {
    setMsg("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${location.origin}/login` },
      });
      if (error) throw error;
      setMsg("Bestätigungs-Mail wurde erneut gesendet.");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {mode === "login" ? "Login" : "Registrieren"}
        </h1>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {mode === "register" && (
            <input
              className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
              placeholder="Username (z.B. Dennis)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <input
            className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
            placeholder="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {mode === "login" ? "Einloggen" : "Account erstellen"}
          </button>

          {mode === "register" && (
            <button
              onClick={resendConfirm}
              disabled={busy || !email}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              Bestätigungs-Mail neu senden
            </button>
          )}

          {msg && <div className="mt-3 text-sm text-zinc-200">{msg}</div>}

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
          >
            {mode === "login" ? "Noch kein Account? Registrieren" : "Schon Account? Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
