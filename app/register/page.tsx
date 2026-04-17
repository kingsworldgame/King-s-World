"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { MarketingShell } from "@/components/marketing-shell";
import { getSupabaseBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase-browser";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim() || undefined,
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setMessage("Conta criada. Verifique seu email para confirmar o cadastro.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <MarketingShell
      title="Crie sua Coroa"
      subtitle="Conta global, legado permanente e acesso a novos mundos."
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          autoComplete="nickname"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          type="email"
          placeholder="E-mail"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </button>
        {message ? <p>{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <Link className="ghost-link" href="/login">
          Ja tenho conta
        </Link>
      </form>
    </MarketingShell>
  );
}
