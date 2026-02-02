"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("current_user");
      location.href = "/login";
    })();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      Logout…
    </main>
  );
}
