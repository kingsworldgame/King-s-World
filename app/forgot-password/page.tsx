import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

export default function ForgotPasswordPage() {
  return (
    <MarketingShell
      title="Recupere o acesso"
      subtitle="Fluxo simples de redefinicao para manter a conta global viva entre temporadas."
    >
      <div className="form-stack">
        <input type="email" placeholder="Seu e-mail" />
        <Link className="primary-button" href="/login">
          Enviar link
        </Link>
        <Link className="ghost-link" href="/login">
          Voltar ao login
        </Link>
      </div>
    </MarketingShell>
  );
}
