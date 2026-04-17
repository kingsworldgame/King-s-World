import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

export default function RegisterPage() {
  return (
    <MarketingShell
      title="Crie sua Coroa"
      subtitle="Conta global, legado permanente e acesso a novos mundos."
    >
      <div className="form-stack">
        <input type="text" placeholder="Username" />
        <input type="email" placeholder="E-mail" />
        <input type="password" placeholder="Senha" />
        <Link className="primary-button" href="/lobby">
          Criar conta
        </Link>
        <Link className="ghost-link" href="/login">
          Ja tenho conta
        </Link>
      </div>
    </MarketingShell>
  );
}
