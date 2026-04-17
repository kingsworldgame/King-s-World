"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { MarketingShell } from "@/components/marketing-shell";
import { getSupabaseBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!hasPublicSupabaseEnv()) {
      setError("Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const nextPath =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    const safeNext = nextPath?.startsWith("/") ? nextPath : "/lobby";
    router.replace(safeNext);
    router.refresh();
  }

  return (
    <MarketingShell
      title="Entre no tabuleiro"
      subtitle="KingsWorld ja esta estruturado para guerra, logistica e fim de mundo. Agora o app comeca a nascer de verdade."
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {error ? <p role="alert">{error}</p> : null}
        <div className="inline-actions">
          <Link className="secondary-button" href="/register">
            Criar conta
          </Link>
          <Link className="ghost-link" href="/forgot-password">
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </MarketingShell>
  );
}
