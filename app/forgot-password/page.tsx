"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { MarketingShell } from "@/components/marketing-shell";
import { getSupabaseBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!hasPublicSupabaseEnv()) {
      setError("Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Link de recuperacao enviado. Verifique sua caixa de entrada.");
  }

  return (
    <MarketingShell
      title="Recupere o acesso"
      subtitle="Fluxo simples de redefinicao para manter a conta global viva entre temporadas."
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Seu e-mail"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar link"}
        </button>
        {message ? <p>{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <Link className="ghost-link" href="/login">
          Voltar ao login
        </Link>
      </form>
    </MarketingShell>
  );
}
