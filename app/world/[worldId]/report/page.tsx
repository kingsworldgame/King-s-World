import Link from "next/link";

import { calculateSovereigntyScore, calculateVillageDevelopment } from "@/core/GameBalance";
import { getWorldPayload } from "@/lib/world-data";

function resultLabel(result: "victorious" | "survived" | "defeated" | "eliminated" | null) {
  if (result === "victorious") return "Vitória Suprema";
  if (result === "survived") return "Sobreviveu";
  if (result === "defeated") return "Reino derrotado";
  if (result === "eliminated") return "Eliminado";
  return "Campanha em andamento";
}

function areaLabel(areaId: "production" | "government" | "military" | "society" | "legacy") {
  if (areaId === "production") return "Infra";
  if (areaId === "government") return "Governo";
  if (areaId === "military") return "Militar";
  if (areaId === "society") return "Sociedade";
  return "Legado";
}

export default async function FinalReportPage({ params }: { params: { worldId: string } }) {
  const payload = await getWorldPayload(params.worldId);
  const { world, worldMeta } = payload;
  const campaignFinished = Boolean(worldMeta.result || worldMeta.finalReason);
  const villageDevelopments = world.villages.map((village) => calculateVillageDevelopment(village.buildingLevels));
  const sovereignty = calculateSovereigntyScore({
    villages: world.villages,
    villageDevelopments,
    councilHeroes: world.sovereignty.councilHeroes,
    militaryRankingPoints: world.sovereignty.militaryRankingPoints,
    eraQuestsCompleted: world.sovereignty.eraQuestsCompleted,
    wondersControlled: world.sovereignty.wondersControlled,
    currentDay: world.day,
    hasTribeDome: world.sovereignty.tribeDomeUnlocked,
    tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage,
    kingAlive: world.sovereignty.kingAlive,
  });

  return (
    <section className="space-y-3 pb-6" data-smoke="final-report-page">
      <article
        className="relative overflow-hidden rounded-[30px] border border-white/14 px-4 py-4 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.38)]"
        style={{
          backgroundImage:
            worldMeta.result === "victorious"
              ? "linear-gradient(180deg, rgba(2,6,23,0.18), rgba(2,6,23,0.76)), url('/images/wonder.jpg')"
              : worldMeta.result === "defeated" || worldMeta.result === "eliminated"
                ? "linear-gradient(180deg, rgba(2,6,23,0.18), rgba(2,6,23,0.76)), url('/images/threat-raiders.jpg')"
                : "linear-gradient(180deg, rgba(2,6,23,0.18), rgba(2,6,23,0.76)), url('/images/capital.jpg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/78 via-slate-950/42 to-slate-950/26" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
            {campaignFinished ? "Relatório Final" : "Relatório da Campanha"}
          </p>
          <h1 className="mt-1 text-[clamp(1.4rem,5vw,2rem)] font-black leading-tight text-slate-50">Temporada de {world.name}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-200">{resultLabel(worldMeta.result)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
            <div className="rounded-2xl border border-white/10 bg-black/26 px-3 py-3 backdrop-blur-md">
              <span className="block text-slate-400">{campaignFinished ? "Dia final" : "Dia atual"}</span>
              <span className="mt-1 block text-slate-50">{world.day}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/26 px-3 py-3 backdrop-blur-md">
              <span className="block text-slate-400">Posição</span>
              <span className="mt-1 block text-slate-50">{worldMeta.finalRank ? `#${worldMeta.finalRank}` : "--"}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/26 px-3 py-3 backdrop-blur-md">
              <span className="block text-slate-400">{campaignFinished ? "Score final" : "Score atual"}</span>
              <span className="mt-1 block text-slate-50">{worldMeta.finalScore ?? sovereignty.total}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/26 px-3 py-3 backdrop-blur-md">
              <span className="block text-slate-400">Cidades</span>
              <span className="mt-1 block text-slate-50">{world.villages.length}</span>
            </div>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Áreas do Reino</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {sovereignty.areas.map((area) => (
            <div key={area.id} className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{areaLabel(area.id)}</p>
              <p className="mt-1 text-xl font-black text-slate-50">{area.current}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Campanha</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
          <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
            <span className="block text-slate-400">Maravilhas</span>
            <span className="mt-1 block text-slate-50">{world.sovereignty.wondersControlled}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
            <span className="block text-slate-400">Quests</span>
            <span className="mt-1 block text-slate-50">{world.sovereignty.eraQuestsCompleted}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
            <span className="block text-slate-400">Relatórios</span>
            <span className="mt-1 block text-slate-50">{world.reports.length}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
            <span className="block text-slate-400">Linha viva</span>
            <span className="mt-1 block text-slate-50">{world.sovereignty.kingAlive ? "Mantida" : "Quebrada"}</span>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Causa do Encerramento</p>
        <p className="mt-2 text-sm font-semibold text-slate-100">
          {worldMeta.finalReason === "victory"
            ? "Seu reino dominou o mundo e fechou a temporada como vencedor."
            : worldMeta.finalReason === "collapse"
              ? "A Coroa caiu antes do fim da temporada."
              : worldMeta.finalReason === "timeout"
                ? "O prazo do mundo terminou e a temporada foi arquivada."
                : "A campanha ainda segue aberta."}
        </p>
      </article>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/world/${params.worldId}/board`}
          data-smoke="final-report-world-link"
          className="rounded-2xl border border-cyan-200/45 bg-cyan-400/20 px-4 py-3 text-center text-sm font-black text-cyan-50"
        >
          Ver mundo
        </Link>
        <Link
          href="/lobby"
          data-smoke="final-report-lobby-link"
          className="rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-center text-sm font-black text-slate-100"
        >
          Voltar ao lobby
        </Link>
      </div>
    </section>
  );
}
