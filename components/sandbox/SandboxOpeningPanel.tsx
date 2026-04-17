"use client";

import { BookOpen, ChevronRight, Crown, Route, Shield, Swords, WandSparkles } from "lucide-react";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { calculateVillageDevelopment } from "@/core/GameBalance";
import { BUILDING_NAME_TO_ID, type BuildingId } from "@/lib/buildings";
import { useImperialState } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { collectCompletedActionsForDay, resolveSandboxDay } from "@/lib/sandbox-day-resolution";
import type { SandboxDayPlan, SandboxStrategyId, SandboxStrategyPlaybook } from "@/lib/sandbox-playbooks";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";

type SandboxOpeningPanelProps = {
  worldId: string;
  villages: VillageSummary[];
  selectedVillageId: string;
  playbooks: Record<SandboxStrategyId, SandboxStrategyPlaybook>;
};

type ActionEffect = {
  label: string;
  routeTab?: "base" | "command" | "board" | "operations";
  query?: Record<string, string>;
};

const STRATEGY_ORDER: SandboxStrategyId[] = ["metropole", "posto_avancado", "bastiao", "celeiro"];
const HERO_NAME_TO_ID: Record<string, string> = {
  Engenheiro: "engineer",
  Marechal: "marshal",
  Navegador: "navigator",
  Intendente: "intendente",
  Erudito: "erudite",
};

function dedupeLogs(logs: string[], line: string): string[] {
  return [line, ...logs.filter((entry) => entry !== line)].slice(0, 12);
}

function ensureCompleted(list: string[], actionId: string): string[] {
  return list.includes(actionId) ? list : [...list, actionId];
}

function findCapital(villages: VillageSummary[]): VillageSummary {
  return villages.find((village) => village.type === "Capital") ?? villages[0];
}

function findFocusVillage(villages: VillageSummary[]): VillageSummary {
  return [...villages].sort((left, right) => {
    const rightScore = calculateVillageDevelopment(right.buildingLevels);
    const leftScore = calculateVillageDevelopment(left.buildingLevels);
    return rightScore - leftScore;
  })[0] ?? villages[0];
}

function parseBuildingAction(action: string): { buildingId: BuildingId; targetLevel: number; focusMode: "capital" | "focus" } | null {
  const match = action.match(/^(.*?)(?: foco)? -> Nv (\d+)/i);
  if (!match) {
    return null;
  }

  const buildingName = match[1].trim();
  const buildingId = BUILDING_NAME_TO_ID[buildingName];
  if (!buildingId) {
    return null;
  }

  return {
    buildingId,
    targetLevel: Number(match[2]),
    focusMode: /foco/i.test(action) ? "focus" : "capital",
  };
}

function createExtraVillage(index: number, strategyId: SandboxStrategyId): VillageSummary & {
  coord: string;
  axial: { q: number; r: number };
  owner: string;
  relation: "Proprio";
  state: string;
} {
  const names: Record<SandboxStrategyId, string[]> = {
    metropole: ["Aurea Secunda", "Solar de Vidro", "Arquivo da Coroa", "Prisma Alto"],
    posto_avancado: ["Porta de Aco", "Rastro Vermelho", "Punho Leste", "Baluarte de Choque"],
    bastiao: ["Muralha Serena", "Escudo do Norte", "Pedra Firme", "Claustro de Ferro"],
    celeiro: ["Celeiro Azul", "Varzea Rica", "Canal Dourado", "Entreposto de Sal"],
  };
  const cityClassByStrategy = {
    metropole: "metropole",
    posto_avancado: "posto_avancado",
    bastiao: "bastiao",
    celeiro: "celeiro",
  } as const;
  const name = names[strategyId][(index - 1) % names[strategyId].length] ?? `Nova Aldeia ${index}`;

  return {
    id: `sandbox-extra-${index}`,
    name,
    type: "Colonia",
    cityClass: cityClassByStrategy[strategyId],
    cityClassLocked: true,
    originKind: "claimed_city",
    terrainKind: strategyId === "celeiro" ? "riverlands" : strategyId === "bastiao" ? "ironridge" : "frontier_pass",
    terrainLabel: strategyId === "celeiro" ? "Varzea dos Rios" : strategyId === "bastiao" ? "Escarpa de Ferro" : "Passagem de Fronteira",
    politicalState: "Nova base imperial",
    materials: 280,
    supplies: 220,
    energy: 120,
    influence: 10,
    palaceLevel: 1,
    kingHere: false,
    princeHere: false,
    underAttack: false,
    deficits: [],
    buildingLevels: {
      palace: 1,
      senate: 0,
      mines: 1,
      farms: 1,
      housing: 0,
      research: 0,
      barracks: 0,
      arsenal: 0,
      wall: 0,
      wonder: 0,
    },
    coord: `0${index}:1${index}`,
    axial: { q: index, r: index + 1 },
    owner: "Afonso",
    relation: "Proprio",
    state: "Fundada pela abertura do sandbox",
  };
}

function buildActionId(strategyId: SandboxStrategyId, day: number, action: string): string {
  return `${strategyId}:${day}:${action}`;
}

function normalizeActionChunks(plan: SandboxDayPlan | undefined): string[] {
  if (!plan) {
    return [];
  }

  return plan.actions.slice(0, 5);
}

export function SandboxOpeningPanel({ worldId, villages, selectedVillageId, playbooks }: SandboxOpeningPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { world, advanceDay, rewindDay, setManualDay } = useLiveWorld(worldId);
  const { imperialState, setImperialState } = useImperialState(worldId, villages);

  const selectedStrategyId = imperialState.sandboxStrategyId ?? "metropole";
  const selectedPlaybook = playbooks[selectedStrategyId];
  const currentDay = world.day;
  const visibleDay = Math.max(1, currentDay || 1);
  const currentPlan = selectedPlaybook.days.find((day) => day.day === visibleDay) ?? selectedPlaybook.days[0];
  const capital = findCapital(villages);
  const focusVillage = findFocusVillage(villages);

  const completedToday = useMemo(
    () => new Set(collectCompletedActionsForDay(imperialState.sandboxCompletedActionIds, currentPlan.day)),
    [currentPlan, imperialState.sandboxCompletedActionIds, selectedStrategyId],
  );
  const nextDayPreview = useMemo(
    () => resolveSandboxDay(currentPlan.day, Array.from(completedToday)),
    [completedToday, currentPlan.day],
  );

  const navigate = (tab: "base" | "command" | "board" | "operations", query: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(query).forEach(([key, value]) => params.set(key, value));
    if (tab === "command") {
      params.set("sb", "command");
      router.push(`/world/${worldId}/base?${params.toString()}`);
      return;
    }
    if (tab === "base") {
      params.set("sb", "city");
    }
    router.push(`/world/${worldId}/${tab}?${params.toString()}`);
  };

  const applySandboxAction = (day: number, action: string, shouldNavigate = true) => {
    const actionId = buildActionId(selectedStrategyId, day, action);
    const buildingAction = parseBuildingAction(action);
    const recruitMatch = action.match(/Recrutar .*?(\d+)/i);
    const heroMatch = action.match(/Contratou ([A-Za-z]+)/i);
    const questMatch = action.match(/Quest (\d)\/3/i);
    const wonderMatch = action.match(/Maravilha (\d)/i);
    const expandMatch = action.match(/(\d+)a aldeia/i);

    let effect: ActionEffect = { label: "Acao registrada no sandbox." };

    setImperialState((current) => {
      if (current.sandboxCompletedActionIds.includes(actionId)) {
        return current;
      }

      const next = {
        ...current,
        sandboxCompletedActionIds: ensureCompleted(current.sandboxCompletedActionIds, actionId),
      };

      if (buildingAction) {
        const villageId = buildingAction.focusMode === "focus" ? focusVillage.id : capital.id;
        next.buildingLevelsByVillage = {
          ...current.buildingLevelsByVillage,
          [villageId]: {
            ...(current.buildingLevelsByVillage[villageId] ?? {}),
            [buildingAction.buildingId]: buildingAction.targetLevel,
          },
        };
        next.logs = dedupeLogs(next.logs, `${action} aplicado em ${villageId === capital.id ? capital.name : focusVillage.name}.`);
        effect = {
          label: `${action} aplicado.`,
          routeTab: "base",
          query: { v: villageId, b: buildingAction.buildingId, sb: "city" },
        };
        return next;
      }

      if (recruitMatch) {
        next.logs = dedupeLogs(next.logs, `Recrutamento preparado: a tropa chegara na virada para o proximo dia.`);
        effect = {
          label: "Recrutamento registrado para a virada do dia.",
          routeTab: "command",
          query: { v: capital.id, lc: "drill" },
        };
        return next;
      }

      if (/Buscas|coletas|Vasculhar|saque/i.test(action)) {
        next.logs = dedupeLogs(next.logs, `Expedicao preparada: ${action}. O retorno vira no proximo dia.`);
        effect = {
          label: "Busca/coleta registrada para render no proximo dia.",
          routeTab: "board",
          query: { v: selectedVillageId },
        };
        return next;
      }

      if (/Transferir recursos|Doar recursos/i.test(action)) {
        next.logs = dedupeLogs(next.logs, `Fluxo interno preparado: ${action}. Os recursos chegarao na virada do dia.`);
        effect = {
          label: "Fluxo interno registrado para o proximo dia.",
          routeTab: "operations",
          query: { v: focusVillage.id },
        };
        return next;
      }

      if (expandMatch) {
        const targetCount = Number(expandMatch[1]);
        if (current.extraVillages.length + villages.length < targetCount) {
          next.extraVillages = [...current.extraVillages, createExtraVillage(current.extraVillages.length + 1, selectedStrategyId)];
        }
        next.logs = dedupeLogs(next.logs, `Expansao executada: ${action}.`);
        effect = {
          label: "Nova aldeia adicionada ao sandbox.",
          routeTab: "board",
          query: { v: focusVillage.id },
        };
        return next;
      }

      if (heroMatch) {
        const heroId = HERO_NAME_TO_ID[heroMatch[1]] ?? "engineer";
        const villageId = heroId === "engineer" || heroId === "erudite" ? focusVillage.id : capital.id;
        next.heroByVillage = {
          ...current.heroByVillage,
          [villageId]: heroId,
        };
        next.logs = dedupeLogs(next.logs, `${heroMatch[1]} alocado em ${villageId === capital.id ? capital.name : focusVillage.name}.`);
        effect = {
          label: `${heroMatch[1]} contratado e alocado.`,
          routeTab: "command",
          query: { v: villageId, sb: "command" },
        };
        return next;
      }

      if (questMatch) {
        next.sandboxQuestsCompleted = Math.max(current.sandboxQuestsCompleted, Number(questMatch[1]));
        next.logs = dedupeLogs(next.logs, `${action} marcado como concluido.`);
        effect = { label: `${action} marcado como concluido.` };
        return next;
      }

      if (wonderMatch) {
        next.sandboxWondersBuilt = Math.max(current.sandboxWondersBuilt, Number(wonderMatch[1]));
        next.logs = dedupeLogs(next.logs, `${action} registrada no sandbox.`);
        effect = { label: `${action} registrada.` };
        return next;
      }

      if (/Domo da Tribo/i.test(action)) {
        next.sandboxDomeActive = true;
        next.logs = dedupeLogs(next.logs, "Domo da Tribo ativado no sandbox.");
        effect = { label: "Domo da Tribo ativado." };
        return next;
      }

      if (/Ativar reagrupar|Parar upgrades perifericos|Preservar score|Sustentar a marcha|Usar apenas apoio/i.test(action)) {
        next.logs = dedupeLogs(next.logs, `${action} aplicado como ordem global do sandbox.`);
        effect = { label: "Ordem global aplicada ao sandbox." };
        return next;
      }

      if (/marcha/i.test(action)) {
        next.sandboxMarchStarted = true;
        next.logs = dedupeLogs(next.logs, "Marcha final marcada no sandbox.");
        effect = {
          label: "Marcha final iniciada.",
          routeTab: "board",
          query: { v: capital.id },
        };
        return next;
      }

      if (/Portal/i.test(action)) {
        next.logs = dedupeLogs(next.logs, "Resultado final do sandbox registrado.");
        effect = { label: "Marco final registrado no sandbox." };
        return next;
      }

      if (/Chamar todas as tropas/i.test(action)) {
        next.deployedByVillage = {};
        next.logs = dedupeLogs(next.logs, "Todas as tropas foram reagrupadas.");
        effect = {
          label: "Reagrupamento registrado.",
          routeTab: "command",
          query: { v: capital.id, sb: "command" },
        };
        return next;
      }

      next.logs = dedupeLogs(next.logs, `${action} registrado manualmente.`);
      return next;
    });

    emitUiFeedback("tap", "medium");
    if (shouldNavigate && effect.routeTab) {
      navigate(effect.routeTab, effect.query);
    } else if (shouldNavigate) {
      router.replace(pathname);
    }

    return effect;
  };

  const runAction = (day: number, action: string) => {
    applySandboxAction(day, action, true);
  };

  const runWholeDay = () => {
    const actions = normalizeActionChunks(currentPlan);
    actions.forEach((action) => {
      applySandboxAction(currentPlan.day, action, false);
    });
    emitUiFeedback("route", "medium");
    router.replace(pathname);
  };

  return (
    <section className="mb-2 space-y-2">
      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Dia 0 jogavel</p>
            <h2 className="text-base font-bold text-slate-50">Comece do zero sem perder o sandbox</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              Escolha uma rota de abertura, veja o risco e o beneficio de cada caminho, clique nas acoes do dia
              e avance/regrida dias quando quiser.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-300/30 bg-sky-500/12 px-2 py-1 text-right text-[10px] font-semibold text-sky-100">
            Dia {currentDay}
            <br />
            {selectedPlaybook.meta.label}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {STRATEGY_ORDER.map((strategyId) => {
            const strategy = playbooks[strategyId];
            const active = strategyId === selectedStrategyId;
            return (
              <button
                key={strategyId}
                type="button"
                onClick={() => {
                  emitUiFeedback("open", "medium");
                  setImperialState((current) => ({
                    ...current,
                    sandboxStrategyId: strategyId,
                    logs: dedupeLogs(current.logs, `Rota escolhida no Dia 0: ${strategy.meta.label}.`),
                  }));
                }}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? "border-sky-300/50 bg-sky-500/14" : "border-white/15 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-50">{strategy.meta.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{strategy.meta.tagline}</p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100">
                    2a aldeia D{strategy.secondVillageDay}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] text-slate-200">
                  <p className="rounded-xl border border-emerald-300/20 bg-emerald-500/8 px-2 py-1.5">
                    <strong>Beneficio:</strong> {strategy.meta.benefit}
                  </p>
                  <p className="rounded-xl border border-rose-300/20 bg-rose-500/8 px-2 py-1.5">
                    <strong>Risco:</strong> {strategy.meta.risk}
                  </p>
                  <p className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                    <strong>Melhor para:</strong> {strategy.meta.bestFor}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              emitUiFeedback("tap", "light");
              rewindDay();
            }}
            className="rounded-xl border border-white/20 bg-white/8 px-2.5 py-2 text-[11px] font-semibold text-slate-100"
          >
            Dia anterior
          </button>
          <button
            type="button"
            onClick={() => {
              emitUiFeedback("tap", "medium");
              advanceDay();
            }}
            className="rounded-xl border border-sky-300/45 bg-sky-500/16 px-2.5 py-2 text-[11px] font-semibold text-sky-100"
          >
            Proximo dia
          </button>
          <button
            type="button"
            onClick={() => {
              emitUiFeedback("tap", "light");
              setManualDay(1);
            }}
            className="rounded-xl border border-white/20 bg-white/8 px-2.5 py-2 text-[11px] font-semibold text-slate-100"
          >
            Ir para D1
          </button>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tutorial mastigado</p>
            <h3 className="text-base font-bold text-slate-50">O que fazer no Dia {visibleDay}</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">{selectedPlaybook.meta.openingGoal}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100">
            {currentPlan.influence} infl.
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Se voce seguir</p>
            <p className="mt-1 leading-5">{selectedPlaybook.day90Summary}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Se voce atrasar</p>
            <p className="mt-1 leading-5">
              O maior risco desta rota e: {selectedPlaybook.meta.risk}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/8 px-3 py-2 text-[11px] text-emerald-50">
            <p className="font-semibold text-emerald-100">Ao ir para o próximo dia</p>
            {nextDayPreview.actionCount > 0 ? (
              <>
                <p className="mt-1 leading-5">
                  Materiais +{nextDayPreview.resources.materials}, Suprimentos +{nextDayPreview.resources.supplies}, Energia +{nextDayPreview.resources.energy}, Influência +{nextDayPreview.resources.influence}.
                </p>
                <p className="mt-1 leading-5">
                  Tropas: +{nextDayPreview.troops.militia} milícia, +{nextDayPreview.troops.shooters} atiradores, +{nextDayPreview.troops.scouts} batedores, +{nextDayPreview.troops.machinery} máquinas.
                </p>
                <p className="mt-1 leading-5">{nextDayPreview.notes.slice(0, 2).join(" ")}</p>
              </>
            ) : (
              <p className="mt-1 leading-5">
                Nenhuma ordem do Dia {currentPlan.day} foi registrada ainda. Se avançar agora, quase nada vai mudar.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={runWholeDay}
            className="w-full rounded-2xl border border-sky-300/40 bg-sky-500/14 px-3 py-2 text-left transition"
          >
            <p className="text-sm font-semibold text-sky-100">Executar dia inteiro</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-200">
              Aplica em sequencia as principais acoes recomendadas para o Dia {currentPlan.day} no sandbox.
            </p>
          </button>

          {normalizeActionChunks(currentPlan).map((action) => {
            const done = completedToday.has(action);
            return (
              <button
                key={action}
                type="button"
                onClick={() => runAction(currentPlan.day, action)}
                className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                  done ? "border-emerald-300/35 bg-emerald-500/12" : "border-white/15 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-50">{action}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">
                      Clique para aplicar esta decisao no sandbox e abrir a area relevante do jogo.
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {currentPlan.priorities.slice(0, 3).map((priority, index) => (
            <div key={`${currentPlan.day}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">
              <p className="font-semibold text-slate-100">Proximo caminho {index + 1}</p>
              <p className="mt-1 leading-5">{priority}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/8 p-2 text-[11px] text-amber-50">
          <strong>Marco do dia:</strong> {currentPlan.milestone}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Simulacao D1-D120</p>
            <h3 className="text-base font-bold text-slate-50">O que eu clicaria em cada dia</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              Cada linha abaixo vem do simulador. Clique numa linha para pular para o dia e usar esse plano como guia.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/8 px-2 py-1 text-right text-[10px] font-semibold text-slate-100">
            D120
            <br />
            {selectedPlaybook.day120Summary}
          </div>
        </div>

        <div className="mt-3 max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
          {selectedPlaybook.days.map((day) => (
            <button
              key={day.day}
              type="button"
              onClick={() => {
                emitUiFeedback("tap", "light");
                setManualDay(day.day);
              }}
              className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                day.day === visibleDay ? "border-sky-300/45 bg-sky-500/14" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-50">
                    Dia {day.day} <span className="text-slate-400">| {day.villages} aldeias</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-300">{day.actions.join(" + ")}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100">
                  {day.margin >= 0 ? `+${day.margin}` : `${day.margin}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-sky-300" />
          <h3 className="text-base font-bold text-slate-50">Estado local da sua campanha</h3>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Quests</p>
            <p className="mt-1">{imperialState.sandboxQuestsCompleted}/3 concluida(s)</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Maravilhas</p>
            <p className="mt-1">{imperialState.sandboxWondersBuilt}/5 registradas</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Domo</p>
            <p className="mt-1">{imperialState.sandboxDomeActive ? "Ativo" : "Nao ativado"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Marcha final</p>
            <p className="mt-1">{imperialState.sandboxMarchStarted ? "Em curso" : "Ainda nao iniciou"}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => navigate("board", { v: focusVillage.id })}
            className="rounded-2xl border border-white/15 bg-white/5 p-2 text-left text-slate-100"
          >
            <Route className="mb-1 h-4 w-4 text-sky-300" />
            Abrir mapa
          </button>
          <button
            type="button"
            onClick={() => navigate("command", { v: capital.id, lc: "drill" })}
            className="rounded-2xl border border-white/15 bg-white/5 p-2 text-left text-slate-100"
          >
            <Swords className="mb-1 h-4 w-4 text-rose-300" />
            Abrir comando
          </button>
          <button
            type="button"
            onClick={() => navigate("base", { v: capital.id, b: "palace" })}
            className="rounded-2xl border border-white/15 bg-white/5 p-2 text-left text-slate-100"
          >
            <Crown className="mb-1 h-4 w-4 text-cyan-300" />
            Abrir Capital
          </button>
          <button
            type="button"
            onClick={() => navigate("operations", { v: focusVillage.id })}
            className="rounded-2xl border border-white/15 bg-white/5 p-2 text-left text-slate-100"
          >
            <Shield className="mb-1 h-4 w-4 text-amber-300" />
            Abrir operacoes
          </button>
        </div>

        <div className="mt-2 rounded-2xl border border-violet-300/20 bg-violet-500/8 p-2 text-[11px] text-violet-50">
          <WandSparkles className="mb-1 h-4 w-4 text-violet-200" />
          Dica pratica: escolha a rota no Dia 0, clique nas acoes do dia na ordem mostrada, e so depois avance para o
          proximo dia. Assim voce joga como se tivesse um mentor explicando cada passo.
        </div>
      </article>
    </section>
  );
}
