"use client";

import {
  AlertTriangle,
  Building2,
  Crown,
  ScrollText,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  SOVEREIGNTY_PORTAL_CUT,
  SOVEREIGNTY_SCORE_MAX,
  calculateSovereigntyScore,
  calculateTribeProgressStage,
  calculateVillageDevelopment,
  describeNextTribeStep,
} from "@/core/GameBalance";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";
import { cityClassLabel } from "@/lib/cities";
import type { VillageSummary } from "@/lib/mock-data";

type ManagedVillage = VillageSummary & {
  isAbandoned?: boolean;
};

type Pillar = {
  id: "buildings" | "military" | "quests" | "council" | "wonders" | "tribe";
  label: string;
  value: number;
  max: number;
  color: "blue" | "green" | "red";
  icon: LucideIcon;
};

type PillarBreakRow = {
  label: string;
  current: number;
  max: number;
  note: string;
};

type PillarDetail = {
  id: Pillar["id"];
  title: string;
  description: string;
  formula: string;
  current: number;
  max: number;
  color: Pillar["color"];
  metrics: Array<{
    label: string;
    value: string;
    note: string;
  }>;
  breakdown: PillarBreakRow[];
  missing: string[];
};

const RADIAL_ANGLES = [-90, -30, 30, 90, 150, 210];

function progressPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function formatCompact(value: number): string {
  return value.toLocaleString("pt-BR");
}

function getCityState(village: ManagedVillage): {
  label: string;
  badgeClass: string;
} {
  if (village.isAbandoned) {
    return {
      label: "Evacuada",
      badgeClass: "border-amber-300/40 bg-amber-500/12 text-amber-100",
    };
  }
  if (village.underAttack) {
    return {
      label: "Sob ataque",
      badgeClass: "border-rose-300/45 bg-rose-500/12 text-rose-100",
    };
  }
  if (calculateVillageDevelopment(village.buildingLevels) >= 100) {
    return {
      label: "Fechada",
      badgeClass: "border-emerald-300/45 bg-emerald-500/12 text-emerald-100",
    };
  }
  return {
    label: "Em crescimento",
    badgeClass: "border-sky-300/45 bg-sky-500/12 text-sky-100",
  };
}

export default function EmpirePage({ params }: { params: { worldId: string } }) {
  const { world } = useLiveWorld(params.worldId);
  const { imperialState, setImperialState } = useImperialState(params.worldId, world.villages);
  const mergedInitialVillages = useMemo(
    () => mergeImperialVillages(world.villages, imperialState).map((village) => ({ ...village })),
    [imperialState, world.villages],
  );
  const [abandonedVillageIds, setAbandonedVillageIds] = useState<string[]>([]);
  const [exodusLog, setExodusLog] = useState<string[]>([]);
  const [activePillarId, setActivePillarId] = useState<Pillar["id"]>("buildings");
  const [openedPillarId, setOpenedPillarId] = useState<Pillar["id"] | null>(null);
  const [tribeSheetOpen, setTribeSheetOpen] = useState(false);

  const isPhase4 = world.day >= 91;

  const villages = useMemo<ManagedVillage[]>(
    () =>
      mergedInitialVillages.map((village) =>
        abandonedVillageIds.includes(village.id)
          ? {
              ...village,
              isAbandoned: true,
              politicalState: "Abandonada no Exodo",
              materials: Math.round(village.materials * 0.35),
              supplies: Math.round(village.supplies * 0.35),
              energy: Math.round(village.energy * 0.35),
              influence: Math.round(village.influence * 0.2),
              underAttack: false,
              deficits: ["Estruturas evacuadas"],
              buildingLevels: {
                ...village.buildingLevels,
                palace: 0,
                senate: 0,
                mines: 0,
                farms: 0,
                housing: 0,
                research: 0,
                barracks: 0,
                arsenal: 0,
                wall: 0,
                wonder: 0,
              },
            }
          : village,
      ),
    [abandonedVillageIds, mergedInitialVillages],
  );

  const villageRows = useMemo(() => {
    return villages.slice(0, 10).map((village) => ({
      ...village,
      development: calculateVillageDevelopment(village.buildingLevels),
    }));
  }, [villages]);
  const tribeInfluenceStage = calculateTribeProgressStage({
    currentDay: world.day,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: world.sovereignty.kingAlive,
  });
  const nextTribeStep = describeNextTribeStep({
    currentDay: world.day,
    currentStage: tribeInfluenceStage,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: world.sovereignty.kingAlive,
  });

  const sovereignty = useMemo(() => {
    return calculateSovereigntyScore({
      villageDevelopments: villageRows.map((entry) => entry.development),
      councilHeroes: world.sovereignty.councilHeroes,
      militaryRankingPoints: world.sovereignty.militaryRankingPoints,
      eraQuestsCompleted: world.sovereignty.eraQuestsCompleted,
      wondersControlled: world.sovereignty.wondersControlled,
      currentDay: world.day,
      hasTribeDome: world.sovereignty.tribeDomeUnlocked,
      tribeLoyaltyStage: tribeInfluenceStage,
      kingAlive: world.sovereignty.kingAlive,
    });
  }, [tribeInfluenceStage, villageRows, world.day, world.sovereignty]);

  const pillars: Pillar[] = useMemo(
    () => [
      { id: "buildings", label: "Predios", value: sovereignty.buildingLevels, max: 1000, color: "green", icon: Building2 },
      { id: "military", label: "Militar", value: sovereignty.militaryRanking, max: 500, color: "red", icon: Swords },
      { id: "quests", label: "Quests", value: sovereignty.eraQuests, max: 300, color: "green", icon: ScrollText },
      { id: "council", label: "Conselho", value: sovereignty.heroesCouncil, max: 250, color: "blue", icon: UserRound },
      { id: "wonders", label: "Maravilhas", value: sovereignty.wonders, max: 250, color: "blue", icon: Sparkles },
      { id: "tribe", label: "Tribo", value: sovereignty.tribeDome, max: 200, color: "blue", icon: Shield },
    ],
    [sovereignty],
  );

  const activePillar = pillars.find((pillar) => pillar.id === activePillarId) ?? pillars[0];
  const sovereigntyPercent = progressPct(sovereignty.total, SOVEREIGNTY_SCORE_MAX);
  const worldAveragePercent = progressPct(world.averageInfluenceScore, SOVEREIGNTY_SCORE_MAX);
  const aboveWorldAverage = sovereignty.total >= world.averageInfluenceScore;
  const quickPillars = pillars;
  const citySummary = useMemo(() => {
    const total = villageRows.length;
    const maxed = villageRows.filter((entry) => entry.development >= 100).length;
    const endangered = villageRows.filter((entry) => entry.underAttack).length;
    const abandoned = villageRows.filter((entry) => entry.isAbandoned).length;
    const averageDevelopment =
      total > 0 ? Math.round(villageRows.reduce((sum, entry) => sum + entry.development, 0) / total) : 0;

    return {
      total,
      maxed,
      endangered,
      abandoned,
      averageDevelopment,
    };
  }, [villageRows]);
  const cityClassMix = useMemo(() => {
    const counters = new Map<string, number>();
    for (const village of villageRows) {
      const label = cityClassLabel(village.cityClass ?? "neutral");
      counters.set(label, (counters.get(label) ?? 0) + 1);
    }
    return Array.from(counters.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [villageRows]);

  const pillarDetails = useMemo<Record<Pillar["id"], PillarDetail>>(() => {
    const portalGap = Math.max(0, sovereignty.portalCut - sovereignty.total);
    const villageContributionRows = villageRows.map((village) => {
      const contribution = Math.min(100, village.development);
      const villageGap = Math.max(0, 100 - contribution);
      return {
        label: village.name,
        current: contribution,
        max: 100,
        note: village.isAbandoned
          ? "Exodo concluido; esta cidade nao soma mais score."
          : villageGap > 0
            ? `Faltam ${villageGap} niveis para fechar os 100 pontos.`
            : "Cidade fechada no teto de influencia.",
      };
    });
    const topBuildingGaps = [...villageContributionRows]
      .filter((row) => row.current < row.max)
      .sort((a, b) => (b.max - b.current) - (a.max - a.current))
      .slice(0, 3)
      .map((row) => `${row.label}: +${row.max - row.current} pontos de desenvolvimento para fechar.`);

    return {
      buildings: {
        id: "buildings",
        title: "Predios",
        description: "Este pilar e a soma direta do desenvolvimento das 10 cidades. Cada cidade fecha 100 pontos ao completar Palacio, Senado, Minas, Fazendas, Habitacoes, C. Pesquisa, Quartel, Arsenal e Muralha, e depois concluir a Maravilha local como capstone final.",
        formula: "Dev da cidade = 9 predios-base incluindo Muralha (0-90) + Maravilha local concluida (+10 de uma vez). Influencia de Predios = soma das 10 cidades (cap 1000).",
        current: sovereignty.buildingLevels,
        max: 1000,
        color: "green",
        metrics: [
          { label: "Pontos atuais", value: `${formatCompact(sovereignty.buildingLevels)}/1000`, note: "Peso bruto do seu imperio construido." },
          { label: "Faltam", value: formatCompact(Math.max(0, 1000 - sovereignty.buildingLevels)), note: "Equivale a niveis de edificio ainda nao convertidos em score." },
          { label: "Se fechar", value: formatCompact(Math.min(SOVEREIGNTY_SCORE_MAX, sovereignty.total + Math.max(0, 1000 - sovereignty.buildingLevels))), note: "Score total se todas as cidades chegarem no teto." },
        ],
        breakdown: villageContributionRows,
        missing: topBuildingGaps.length > 0 ? topBuildingGaps : ["Todas as cidades somam o teto maximo deste pilar."],
      },
      military: {
        id: "military",
        title: "Militar",
        description: "Militar entra na nota como ranking global de poder. Aqui vale qualidade de tropa, composicao e presenca real no topo do servidor.",
        formula: "Pontuacao direta do ranking militar global (0-500).",
        current: sovereignty.militaryRanking,
        max: 500,
        color: "red",
        metrics: [
          { label: "Ranking atual", value: `${formatCompact(sovereignty.militaryRanking)}/500`, note: "Quanto do teto militar voce ja converteu em score." },
          { label: "Faltam", value: formatCompact(Math.max(0, 500 - sovereignty.militaryRanking)), note: "Pontos de ranking ainda nao capturados." },
          { label: "Gap Portal", value: portalGap > 0 ? formatCompact(Math.max(0, portalGap - Math.max(0, 500 - sovereignty.militaryRanking))) : "0", note: "Quanto ainda faltaria para 1500 mesmo fechando este pilar." },
        ],
        breakdown: [
          {
            label: "Ranking militar",
            current: sovereignty.militaryRanking,
            max: 500,
            note: sovereignty.militaryRanking >= 400 ? "Ja esta em faixa de elite." : "Ainda existe espaco para subir peso militar sem mexer nos outros pilares.",
          },
        ],
        missing: [
          sovereignty.militaryRanking >= 400 ? "Militar ja puxa bem a nota; agora o valor marginal fica mais caro." : `Faltam ${500 - sovereignty.militaryRanking} pontos para o teto militar.`,
          "Esse pilar sobe com tropas melhores, composicao forte e melhor ranking global.",
        ],
      },
      quests: {
        id: "quests",
        title: "Quests",
        description: "Quests sao marcos fechados de temporada. Cada uma concluida entrega 100 pontos secos e previsiveis.",
        formula: "3 quests de era x 100 pontos = 300 max.",
        current: sovereignty.eraQuests,
        max: 300,
        color: "green",
        metrics: [
          { label: "Quests fechadas", value: `${Math.floor(sovereignty.eraQuests / 100)}/3`, note: "Cada quest concluida vale +100." },
          { label: "Faltam", value: `${Math.max(0, 3 - Math.floor(sovereignty.eraQuests / 100))}`, note: "Numero de quests ainda abertas no caminho do 300/300." },
          { label: "Valor atual", value: `${formatCompact(sovereignty.eraQuests)}/300`, note: "Pontos convertidos em score hoje." },
        ],
        breakdown: Array.from({ length: 3 }, (_, index) => {
          const completed = index < Math.floor(sovereignty.eraQuests / 100);
          return {
            label: `Quest ${index + 1}`,
            current: completed ? 100 : 0,
            max: 100,
            note: completed ? "Quest concluida e travada no score." : "Quest ainda nao convertida em influencia.",
          };
        }),
        missing:
          sovereignty.eraQuests >= 300
            ? ["As 3 quests ja foram fechadas; este pilar esta completo."]
            : [`Cada quest pendente entrega +100. Hoje faltam ${300 - sovereignty.eraQuests} pontos neste pilar.`],
      },
      council: {
        id: "council",
        title: "Conselho",
        description: "O Conselho vale pontos fixos. Cada heroi especialista ativo adiciona 50 pontos e acelera um eixo da build.",
        formula: "5 herois x 50 pontos = 250 max.",
        current: sovereignty.heroesCouncil,
        max: 250,
        color: "blue",
        metrics: [
          { label: "Herois ativos", value: `${Math.floor(sovereignty.heroesCouncil / 50)}/5`, note: "Cada slot preenchido rende +50 no score." },
          { label: "Faltam", value: `${Math.max(0, 5 - Math.floor(sovereignty.heroesCouncil / 50))}`, note: "Vagas ainda abertas no Conselho." },
          { label: "Valor atual", value: `${formatCompact(sovereignty.heroesCouncil)}/250`, note: "Conselho convertido em influencia." },
        ],
        breakdown: Array.from({ length: 5 }, (_, index) => {
          const active = index < Math.floor(sovereignty.heroesCouncil / 50);
          return {
            label: `Heroi ${index + 1}`,
            current: active ? 50 : 0,
            max: 50,
            note: active ? "Slot preenchido e pontuando." : "Slot vazio; contratar preenche +50.",
          };
        }),
        missing:
          sovereignty.heroesCouncil >= 250
            ? ["Conselho completo; os 5 especialistas ja estao contando."]
            : [`Faltam ${250 - sovereignty.heroesCouncil} pontos, ou ${5 - Math.floor(sovereignty.heroesCouncil / 50)} herois.`],
      },
      wonders: {
        id: "wonders",
        title: "Maravilhas",
        description: "Este pilar fala das Maravilhas globais do mundo, nao da Maravilha local da cidade. Cada slot dominado vale 50 pontos e pede base madura para sustentar a conquista.",
        formula: "5 slots globais de Maravilha x 50 pontos = 250 max.",
        current: sovereignty.wonders,
        max: 250,
        color: "blue",
        metrics: [
          { label: "Slots ativos", value: `${Math.floor(sovereignty.wonders / 50)}/5`, note: "Cada maravilha sob controle vale +50." },
          { label: "Faltam", value: `${Math.max(0, 5 - Math.floor(sovereignty.wonders / 50))}`, note: "Quantidade de slots ainda nao convertidos." },
          { label: "Valor atual", value: `${formatCompact(sovereignty.wonders)}/250`, note: "Prestigio convertido em score." },
        ],
        breakdown: Array.from({ length: 5 }, (_, index) => {
          const active = index < Math.floor(sovereignty.wonders / 50);
          return {
            label: `Maravilha ${index + 1}`,
            current: active ? 50 : 0,
            max: 50,
            note: active ? "Ja contribui no total." : "Ainda falta dominar/construir este slot.",
          };
        }),
        missing:
          sovereignty.wonders >= 250
            ? ["As 5 maravilhas ja estao pontuando no score."]
            : [`Faltam ${250 - sovereignty.wonders} pontos, ou ${5 - Math.floor(sovereignty.wonders / 50)} maravilhas.`],
      },
      tribe: {
        id: "tribe",
        title: "Tribo",
        description: "A trilha tribal agora tem 5 selos de 40. O 1o enviado tribal abre a porta de entrada, os marcos centrais vêm por permanencia, e o 2o enviado fecha o ultimo selo no endgame.",
        formula: "5 selos x 40 = 200 max. Regra viva: 1o enviado abre +40, permanencia fecha os meios, 2o enviado fecha o ultimo +40.",
        current: sovereignty.tribeDome,
        max: 200,
        color: "blue",
        metrics: [
          { label: "Estagio atual", value: `${tribeInfluenceStage}/5`, note: "Selo tribal ja convertido em score." },
          { label: "Enviados", value: `${imperialState.tribeEnvoysCommitted ?? 0}/2`, note: "Dois enviados tribais especiais, fora dos 9 de Colonia." },
          { label: "Proximo +40", value: nextTribeStep, note: "Passo exato para subir a proxima faixa." },
          { label: "Valor atual", value: `${formatCompact(sovereignty.tribeDome)}/200`, note: "Pontuacao fixa da rede de tribo." },
        ],
        breakdown: [
          { label: "1. Representacao", current: tribeInfluenceStage >= 1 ? 40 : 0, max: 40, note: "Envie o 1o enviado tribal para abrir os primeiros 40." },
          { label: "2. Pacto", current: tribeInfluenceStage >= 2 ? 40 : 0, max: 40, note: "Permaneça ligado a Tribo ate o primeiro marco de temporada." },
          { label: "3. Camara", current: tribeInfluenceStage >= 3 ? 40 : 0, max: 40, note: "Segure o pacto no meio do mundo e trave mais 40." },
          { label: "4. Abrigo", current: tribeInfluenceStage >= 4 ? 40 : 0, max: 40, note: "Chegue vivo a Fase IV com a ligacao tribal mantida." },
          { label: "5. Juramento Final", current: tribeInfluenceStage >= 5 ? 40 : 0, max: 40, note: "Envie o 2o enviado tribal para fechar os ultimos 40." },
        ],
        missing:
          sovereignty.tribeDome >= 200
            ? ["Lealdade plena da tribo; o pilar esta fechado."]
            : [
                `Faltam ${200 - sovereignty.tribeDome} pontos, ou ${5 - tribeInfluenceStage} selos.`,
                nextTribeStep,
              ],
      },
    };
  }, [imperialState.tribeEnvoysCommitted, nextTribeStep, sovereignty, tribeInfluenceStage, villageRows]);

  const openedPillar = openedPillarId ? pillarDetails[openedPillarId] : null;

  const openPillarModal = (pillarId: Pillar["id"]) => {
    emitUiFeedback("open", "light");
    setActivePillarId(pillarId);
    setOpenedPillarId(pillarId);
  };

  const handleExodus = (villageId: string) => {
    if (!isPhase4) {
      return;
    }

    const target = villages.find((village) => village.id === villageId);
    if (!target || target.type === "Capital" || target.isAbandoned) {
      return;
    }

    setAbandonedVillageIds((current) => (current.includes(villageId) ? current : [...current, villageId]));

    setImperialState((current) => ({
      ...current,
      buildingLevelsByVillage: {
        ...current.buildingLevelsByVillage,
        [villageId]: {
          palace: 0,
          senate: 0,
          mines: 0,
          farms: 0,
          housing: 0,
          research: 0,
          barracks: 0,
          arsenal: 0,
          wall: 0,
          wonder: 0,
        },
      },
      logs: [`Exodo: ${target.name} abandonada`, ...current.logs].slice(0, 12),
    }));

    setExodusLog((current) => [
      `Dia ${world.day}: ${target.name} abandonada. Desenvolvimento removido e recursos de evacucao aplicados.`,
      ...current,
    ]);
  };

  return (
    <>
      <section className="space-y-3">
        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="kw-title text-base">Dashboard de Soberania</h2>
            <span className="kw-subtle text-[11px]">Dia {world.day}</span>
          </div>

          <div className="mb-2 rounded-2xl kw-glass-soft p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Resumo inicial de pilares</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {quickPillars.map((pillar) => {
                const pct = progressPct(pillar.value, pillar.max);
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => openPillarModal(pillar.id)}
                    className="rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-left transition hover:border-sky-300/40 hover:bg-white/8"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold text-slate-100">{pillar.label}</p>
                      <span className="text-[10px] font-bold text-slate-200">{pillar.value}/{pillar.max}</span>
                    </div>
                    <div className="kw-progress mt-1">
                      <div
                        className={`kw-progress__bar ${pillar.color === "green" ? "kw-progress__bar--green" : pillar.color === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="kw-glass-soft kw-radial-shell">
            <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute inset-[10%] rounded-full border border-white/10" />
            <div className="pointer-events-none absolute inset-[22%] rounded-full border border-white/10" />

            <div className="kw-glass kw-radial-center text-slate-100">
              <p className="kw-card-meta">Influencia</p>
              <p className="kw-title text-xl">{sovereignty.total}</p>
              <p className="kw-card-meta">/ {SOVEREIGNTY_SCORE_MAX}</p>
            </div>

            {pillars.map((pillar, index) => {
              const angle = (RADIAL_ANGLES[index] * Math.PI) / 180;
              const x = 50 + Math.cos(angle) * 37;
              const y = 50 + Math.sin(angle) * 37;
              const pct = progressPct(pillar.value, pillar.max);
              const Icon = pillar.icon;

              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => openPillarModal(pillar.id)}
                  className={`kw-glass-soft kw-radial-pillar ${activePillarId === pillar.id ? "kw-radial-pillar--active" : ""}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${pillar.label}: ${pillar.value}/${pillar.max}`}
                >
                  <Icon className="mx-auto h-4 w-4 text-slate-100" />
                  <p className="mt-1 text-[10px] font-bold text-slate-100">{pillar.label}</p>
                  <div className="kw-progress mt-1">
                    <div
                      className={`kw-progress__bar ${pillar.color === "green" ? "kw-progress__bar--green" : pillar.color === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openPillarModal(activePillar.id)}
            className="mt-2 w-full rounded-2xl kw-glass-soft p-2 text-left text-slate-100 transition hover:border-sky-300/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="kw-card-title">{activePillar.label}</p>
              <span className="kw-badge static">{activePillar.value}/{activePillar.max}</span>
            </div>
            <div className="kw-progress">
              <div
                className={`kw-progress__bar ${activePillar.color === "green" ? "kw-progress__bar--green" : activePillar.color === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                style={{ width: `${progressPct(activePillar.value, activePillar.max)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-300">Corte do Portal: {SOVEREIGNTY_PORTAL_CUT} · Score atual: {sovereignty.total}</p>
          </button>

          <div className="mt-2 kw-glass-soft rounded-2xl p-2 text-xs font-semibold">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Painel do Portal</p>
              <span className="text-[10px] text-slate-400">Corte {SOVEREIGNTY_PORTAL_CUT}</span>
            </div>
            {sovereignty.portalEligible ? (
              <p className="text-emerald-200">Acesso liberado ao Portal Central.</p>
            ) : (
              <p className="text-rose-200">Dignidade insuficiente para o Portal Central.</p>
            )}
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold">
              <span className={aboveWorldAverage ? "text-emerald-200" : "text-amber-100"}>
                {aboveWorldAverage ? "Acima da media mundial" : "Abaixo da media mundial"}
              </span>
              <span className="text-slate-300">Media do mundo: {world.averageInfluenceScore}</span>
            </div>
            <div className="kw-progress mt-1 relative overflow-visible">
              <div className={`kw-progress__bar ${sovereignty.portalEligible ? "kw-progress__bar--green" : "kw-progress__bar--red"}`} style={{ width: `${sovereigntyPercent}%` }} />
              <span
                className="pointer-events-none absolute -top-1 bottom-[-4px] w-[2px] rounded-full bg-amber-200/95 shadow-[0_0_12px_rgba(253,230,138,0.85)]"
                style={{ left: `calc(${worldAveragePercent}% - 1px)` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-300">A linha dourada marca a media viva do mundo neste servidor.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              emitUiFeedback("open", "light");
              setTribeSheetOpen(true);
            }}
            className="mt-2 w-full rounded-2xl kw-glass-soft p-2 text-left text-slate-100 transition hover:border-cyan-300/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl border border-white/15 bg-white/8 p-2">
                  <Shield className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <p className="kw-card-title">{world.tribe.name}</p>
                  <p className="kw-card-meta">Sua tribo · rank #{world.tribe.rank}</p>
                </div>
              </div>
              <span className="kw-badge static">Abrir</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <p className="text-slate-400">Posicao</p>
                <p className="mt-1 font-black text-slate-100">#{world.tribe.rank}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <p className="text-slate-400">Score</p>
                <p className="mt-1 font-black text-slate-100">{formatCompact(world.tribe.totalScore)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <p className="text-slate-400">Vivos</p>
                <p className="mt-1 font-black text-slate-100">{world.tribe.membersAlive}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-300">{world.tribe.citadelStatus}. Esse card vira a entrada da Tribo na aba 1.</p>
          </button>
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="kw-title text-base">Gestao de Cidades</h2>
            <span className="kw-subtle text-[11px]">{isPhase4 ? "Exodo liberado" : "Exodo bloqueado"}</span>
          </div>

          <div className="mb-2 grid grid-cols-4 gap-2">
            <div className="kw-glass-soft rounded-2xl p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Media</p>
              <p className="mt-1 text-lg font-black text-slate-100">{citySummary.averageDevelopment}</p>
              <p className="text-[10px] text-slate-300">dev / 100</p>
            </div>
            <div className="kw-glass-soft rounded-2xl p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Fechadas</p>
              <p className="mt-1 text-lg font-black text-emerald-100">{citySummary.maxed}</p>
              <p className="text-[10px] text-slate-300">100 / 100</p>
            </div>
            <div className="kw-glass-soft rounded-2xl p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sob pressao</p>
              <p className="mt-1 text-lg font-black text-rose-100">{citySummary.endangered}</p>
              <p className="text-[10px] text-slate-300">frentes</p>
            </div>
            <div className="kw-glass-soft rounded-2xl p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Exodo</p>
              <p className="mt-1 text-lg font-black text-amber-100">{citySummary.abandoned}</p>
              <p className="text-[10px] text-slate-300">evacuadas</p>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {cityClassMix.map(([label, count]) => (
              <span key={label} className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
                {label} x{count}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {villageRows.map((village) => (
              <article key={village.id} className="kw-glass-soft rounded-2xl p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="kw-title text-sm">{village.name}</h3>
                    <p className="kw-card-meta">{village.type} · Dev {village.development}/100</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {village.kingHere ? <Crown className="h-4 w-4 text-cyan-300" /> : null}
                    {village.underAttack ? <ShieldAlert className="h-4 w-4 text-rose-300" /> : null}
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-100">Desenvolvimento</p>
                    <span className="text-[11px] font-black text-slate-100">{village.development}/100</span>
                  </div>
                  <div className="kw-progress mt-1.5">
                    <div
                      className={`kw-progress__bar ${village.isAbandoned ? "kw-progress__bar--red" : village.development >= 100 ? "kw-progress__bar--green" : "kw-progress__bar--blue"}`}
                      style={{ width: `${Math.min(100, village.development)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] font-semibold text-slate-100">
                  <div className="kw-glass-soft rounded-lg p-1">{formatCompact(village.materials)} Mat</div>
                  <div className="kw-glass-soft rounded-lg p-1">{formatCompact(village.supplies)} Sup</div>
                  <div className="kw-glass-soft rounded-lg p-1">{formatCompact(village.energy)} Ene</div>
                  <div className="kw-glass-soft rounded-lg p-1">{formatCompact(village.influence)} Inf</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExodus(village.id)}
                  disabled={!isPhase4 || village.type === "Capital" || Boolean(village.isAbandoned)}
                  className={`mt-2 w-full rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
                    !isPhase4 || village.type === "Capital" || village.isAbandoned
                      ? "border-white/15 bg-white/5 text-slate-400"
                      : "border-amber-300/55 bg-amber-500/12 text-amber-100 hover:bg-amber-500/20"
                  }`}
                >
                  {village.isAbandoned
                    ? "Cidade abandonada"
                    : !isPhase4
                    ? "Exodo no Dia 91"
                    : village.type === "Capital"
                    ? "Capital bloqueada"
                    : "Exodo / Abandonar"}
                </button>
              </article>
            ))}
          </div>

          {exodusLog.length > 0 ? (
            <div className="mt-3 rounded-2xl kw-glass-soft p-2">
              <p className="text-xs font-semibold text-amber-100">Registro de Exodo</p>
              <div className="mt-1 space-y-1 text-[11px] text-slate-200">
                {exodusLog.slice(0, 4).map((line) => (
                  <p key={line} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">{line}</p>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
            <p className="text-xs text-slate-200">
              Exodo acelera marcha, mas derruba desenvolvimento. Decisao errada perto do Dia 120 pode tirar o acesso ao Portal.
            </p>
          </div>
        </article>
      </section>

      {tribeSheetOpen ? (
        <div className="fixed inset-0 z-[79]">
          <button
            type="button"
            aria-label="Fechar painel da tribo"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            onClick={() => {
              emitUiFeedback("close", "light");
              setTribeSheetOpen(false);
            }}
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+20px)] top-[calc(env(safe-area-inset-top)+72px)] mx-auto flex w-full max-w-md">
            <div className="kw-glass flex h-full w-full flex-col rounded-[28px] p-3 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tribo</p>
                  <h3 className="kw-title text-lg">{world.tribe.name}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-300">
                    Entrada inicial da sua Tribo na aba 1. Aqui vamos depois abrir ranking, membros, pacts, Domo e pressão diplomática.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    emitUiFeedback("close", "light");
                    setTribeSheetOpen(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="kw-glass-soft rounded-2xl p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Posicao</p>
                  <p className="mt-1 text-sm font-black text-slate-100">#{world.tribe.rank}</p>
                  <p className="mt-1 text-[11px] text-slate-300">Posição atual no mundo.</p>
                </div>
                <div className="kw-glass-soft rounded-2xl p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Score</p>
                  <p className="mt-1 text-sm font-black text-slate-100">{formatCompact(world.tribe.totalScore)}</p>
                  <p className="mt-1 text-[11px] text-slate-300">Força agregada da sua tribo.</p>
                </div>
                <div className="kw-glass-soft rounded-2xl p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vivos</p>
                  <p className="mt-1 text-sm font-black text-slate-100">{world.tribe.membersAlive}</p>
                  <p className="mt-1 text-[11px] text-slate-300">Casas ainda ativas.</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl kw-glass-soft p-2">
                <p className="text-xs font-bold text-slate-100">Estado da cidadela</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-300">{world.tribe.citadelStatus}</p>
              </div>

              <div className="mt-3 rounded-2xl kw-glass-soft p-2">
                <p className="text-xs font-bold text-slate-100">O que vai entrar aqui</p>
                <div className="mt-2 space-y-1.5">
                  {[
                    "Ranking interno da tribo e casas mais fortes.",
                    "Quem enviou diplomatas para o Domo e quanto falta para fechar.",
                    "Pactos, pressão externa e alertas da cidadela.",
                    "Atalhos para Mundo e Operações quando a tribo estiver sob risco.",
                  ].map((line) => (
                    <p key={line} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {openedPillar ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Fechar detalhes do pilar"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            onClick={() => {
              emitUiFeedback("close", "light");
              setOpenedPillarId(null);
            }}
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+20px)] top-[calc(env(safe-area-inset-top)+72px)] mx-auto flex w-full max-w-md">
            <div className="kw-glass flex h-full w-full flex-col rounded-[28px] p-3 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Fonte de Influencia</p>
                  <h3 className="kw-title text-lg">{openedPillar.title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-300">{openedPillar.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    emitUiFeedback("close", "light");
                    setOpenedPillarId(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 rounded-2xl kw-glass-soft p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="kw-card-title">{openedPillar.current}/{openedPillar.max}</p>
                  <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-bold text-slate-200">
                    {Math.round(progressPct(openedPillar.current, openedPillar.max))}%
                  </span>
                </div>
                <div className="kw-progress mt-2">
                  <div
                    className={`kw-progress__bar ${openedPillar.color === "green" ? "kw-progress__bar--green" : openedPillar.color === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                    style={{ width: `${progressPct(openedPillar.current, openedPillar.max)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-300">{openedPillar.formula}</p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {openedPillar.metrics.map((metric) => (
                  <div key={metric.label} className="kw-glass-soft rounded-2xl p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                    <p className="mt-1 text-sm font-black text-slate-100">{metric.value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-300">{metric.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="rounded-2xl kw-glass-soft p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-100">Compoe a nota</p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Score atual</span>
                  </div>
                  <div className="space-y-2">
                    {openedPillar.breakdown.map((row) => (
                      <div key={row.label} className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-slate-100">{row.label}</p>
                          <span className="text-[11px] font-bold text-slate-200">{row.current}/{row.max}</span>
                        </div>
                        <div className="kw-progress mt-1.5">
                          <div
                            className={`kw-progress__bar ${openedPillar.color === "green" ? "kw-progress__bar--green" : openedPillar.color === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                            style={{ width: `${progressPct(row.current, row.max)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] leading-5 text-slate-300">{row.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl kw-glass-soft p-2">
                  <p className="mb-2 text-xs font-bold text-slate-100">O que falta</p>
                  <div className="space-y-1.5">
                    {openedPillar.missing.map((line) => (
                      <p key={line} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
