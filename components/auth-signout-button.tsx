"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupabaseBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase-browser";

export function AuthSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (!hasPublicSupabaseEnv()) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="ghost-link" type="button" onClick={handleSignOut} disabled={loading}>
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
