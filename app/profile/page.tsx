import Link from "next/link";

import { AuthSignOutButton } from "@/components/auth-signout-button";
import { SectionCard, StatusBadge } from "@/components/ui";
import { profile } from "@/lib/mock-data";

export default function ProfilePage() {
  return (
    <main className="marketing-shell" style={{ padding: "2rem 0 3rem" }}>
      <div className="dashboard-grid">
        <SectionCard title={profile.username} eyebrow="Perfil global">
          <div className="metric-grid">
            <div>
              <span>Score global</span>
              <strong>{profile.globalScore.toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Medalhas</span>
              <strong>{profile.medals.length}</strong>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Legado" eyebrow="Marcas permanentes">
          <div className="list-stack">
            {profile.medals.map((medal) => (
              <StatusBadge key={medal} label={medal} tone="warning" />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Historico de mundos" eyebrow="Campanhas encerradas">
        <div className="list-stack">
          {profile.history.map((entry) => (
            <div key={entry.world} className="world-card">
              <strong>{entry.world}</strong>
              <span className="list-meta">Rank final #{entry.rank} · Tribo {entry.tribe}</span>
            </div>
          ))}
        </div>
        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link className="secondary-button" href="/lobby">
            Voltar ao lobby
          </Link>
          <AuthSignOutButton />
        </div>
      </SectionCard>
    </main>
  );
}
