import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

export default function LoginPage() {
  return (
    <MarketingShell
      title="Entre no tabuleiro"
      subtitle="KingsWorld ja esta estruturado para guerra, logistica e fim de mundo. Agora o app comeca a nascer de verdade."
    >
      <div className="form-stack">
        <input type="text" placeholder="Usuario ou email" />
        <input type="password" placeholder="Senha" />
        <Link className="primary-button" href="/lobby">
          Entrar
        </Link>
        <div className="inline-actions">
          <Link className="secondary-button" href="/register">
            Criar conta
          </Link>
          <Link className="ghost-link" href="/forgot-password">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
