import Link from "next/link";

import { SectionCard, StatusBadge } from "@/components/ui";
import { listWorldSummaries } from "@/lib/world-data";

export default async function LobbyPage() {
  const worlds = await listWorldSummaries();

  return (
    <main className="marketing-shell" style={{ padding: "2rem 0 3rem" }}>
      <section className="marketing-hero">
        <p className="eyebrow">Lobby de mundos</p>
        <h1>Escolha sua temporada</h1>
        <p>
          O ecossistema do jogo ja esta documentado e a casca do app comeca aqui: cadastro, lobby, shell do mundo e mock do centro de comando.
        </p>
      </section>

      <SectionCard title="Mundos disponiveis" eyebrow="Porta de entrada">
        <div className="list-stack">
          {worlds.map((world) => {
            const href = world.status === "Em Andamento" ? `/world/${world.id}/base` : world.status === "Finalizado" ? "/profile" : `/world/${world.id}/empire`;
            const tone = world.status === "Em Andamento" ? "success" : world.status === "Finalizado" ? "neutral" : "warning";

            return (
              <div key={world.id} className="world-card">
                <div className="card-row">
                  <div>
                    <strong>{world.name}</strong>
                    <p className="list-meta">Dia {world.day} · {world.phase} · {world.players} jogadores</p>
                  </div>
                  <StatusBadge label={world.status} tone={tone} />
                </div>
                <div className="inline-actions">
                  <Link className="primary-button" href={href}>
                    {world.actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link className="ghost-link" href="/profile">
            Ver perfil global
          </Link>
          <Link className="ghost-link" href="/login">
            Trocar conta
          </Link>
        </div>
      </SectionCard>
    </main>
  );
}
