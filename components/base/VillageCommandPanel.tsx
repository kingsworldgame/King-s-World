"use client";

import { CheckCircle2, Crown, Shield, ShieldAlert, Sparkles, Swords, TrendingUp, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateTroopPower, calculateVillageDevelopment } from "@/core/GameBalance";
import type { BuildingId } from "@/lib/buildings";
import {
  projectStructureLevelsToBuildingLevels,
  useImperialStateContext,
  type ImperialResources,
  type ImperialTroops,
} from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { emitUiFeedback } from "@/lib/ui-feedback";

type LocalCommand = "guard" | "drill" | "sortie" | "fortify" | "rations";

type VillageLite = Pick<
  VillageSummary,
  | "id"
  | "name"
  | "type"
  | "materials"
  | "supplies"
  | "buildingLevels"
  | "kingHere"
  | "underAttack"
  | "deficits"
>;

type VillageCommandPanelProps = {
  worldId: string;
  village: VillageLite;
  villages: VillageLite[];
  localCommand: LocalCommand;
};

type TroopType = keyof ImperialTroops;
type ActionTone = "success" | "warning" | "info";

type RecruitPlan = {
  key: TroopType;
  label: string;
  amount: number;
  cost: ImperialResources;
  role: string;
};

type ActionFeedback = {
  title: string;
  detail: string;
  tone: ActionTone;
  delta?: string;
};

const HERO_POOL = [
  { id: "engineer", label: "Engenheiro", bonus: "Obras e muralha" },
  { id: "marshal", label: "General", bonus: "Ataque e moral" },
  { id: "navigator", label: "Explorador", bonus: "Mapa e deslocamento" },
  { id: "intendente", label: "Administrador", bonus: "Suprimentos e fluxo" },
  { id: "erudite", label: "Sabio", bonus: "Pesquisa e legado" },
] as const;

const RECRUITMENT: RecruitPlan[] = [
  {
    key: "militia",
    label: "Milicia",
    amount: 12,
    role: "Linha de choque",
    cost: { materials: 110, supplies: 90, influence: 0 },
  },
  {
    key: "shooters",
    label: "Atiradores",
    amount: 8,
    role: "Dano de media distancia",
    cost: { materials: 140, supplies: 85, influence: 0 },
  },
  {
    key: "scouts",
    label: "Batedores",
    amount: 7,
    role: "Visao e flanco",
    cost: { materials: 120, supplies: 70, influence: 0 },
  },
  {
    key: "machinery",
    label: "Maquinaria",
    amount: 2,
    role: "Cerco e ruptura",
    cost: { materials: 240, supplies: 120, influence: 0 },
  },
];

const LOCAL_COMMAND_META: Record<LocalCommand, { label: string; summary: string }> = {
  guard: { label: "Guarnicao", summary: "Auto-defesa da cidade com resposta da legiao central." },
  drill: { label: "Treino", summary: "Lote maior e custo menor no recrutamento da Capital." },
  sortie: { label: "Sortida", summary: "Prepara a cidade para saques e ataques escolhidos no mapa." },
  fortify: { label: "Blindar", summary: "Puxa muralha, seguranca local e segurar horda." },
  rations: { label: "Racao", summary: "Poupa suprimento em campanha longa." },
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
}

function getVillageLevel(levels: Partial<Record<BuildingId, number>>, id: BuildingId): number {
  return Math.max(0, Math.min(10, Math.floor(levels[id] ?? 0)));
}

function getCommandModifiers(localCommand: LocalCommand): {
  costMult: number;
  batchMult: number;
  autoDefenseShare: number;
  autoDefenseMin: number;
} {
  switch (localCommand) {
    case "drill":
      return { costMult: 0.92, batchMult: 1.12, autoDefenseShare: 0.1, autoDefenseMin: 48 };
    case "sortie":
      return { costMult: 0.95, batchMult: 1.06, autoDefenseShare: 0.08, autoDefenseMin: 36 };
    case "fortify":
      return { costMult: 0.98, batchMult: 1.0, autoDefenseShare: 0.22, autoDefenseMin: 120 };
    case "rations":
      return { costMult: 0.9, batchMult: 0.96, autoDefenseShare: 0.14, autoDefenseMin: 72 };
    default:
      return { costMult: 1, batchMult: 1, autoDefenseShare: 0.18, autoDefenseMin: 90 };
  }
}

function sumTroops(troops: ImperialTroops): number {
  return troops.militia + troops.shooters + troops.scouts + troops.machinery;
}

function calcRecruitCost(plan: RecruitPlan, localCommand: LocalCommand): ImperialResources {
  const mod = getCommandModifiers(localCommand);
  return {
    materials: Math.round(plan.cost.materials * mod.costMult),
    supplies: Math.round(plan.cost.supplies * mod.costMult),
    influence: 0,
  };
}

function calcRecruitPowerGain(plan: RecruitPlan, amount: number): number {
  return calculateTroopPower({ [plan.key]: amount });
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getProgressTier(score: number): { label: string; min: number; max: number } {
  if (score >= 85) return { label: "Dominante", min: 85, max: 100 };
  if (score >= 65) return { label: "Ascendente", min: 65, max: 84 };
  if (score >= 45) return { label: "Estavel", min: 45, max: 64 };
  return { label: "Fragil", min: 0, max: 44 };
}

export function VillageCommandPanel({ worldId, village, villages, localCommand }: VillageCommandPanelProps) {
  const capitalVillage = useMemo(
    () => villages.find((entry) => entry.type === "Capital") ?? villages[0] ?? village,
    [village, villages],
  );
  const { imperialState, setImperialState } = useImperialStateContext();
  const levelOverrides = imperialState.buildingLevelsByVillage[village.id] ?? {};
  const effectiveLevels = useMemo(
    () => ({
      ...village.buildingLevels,
      ...projectStructureLevelsToBuildingLevels(levelOverrides),
    }),
    [levelOverrides, village.buildingLevels],
  );

  const barracksLevel = getVillageLevel(effectiveLevels, "barracks");
  const wallLevel = getVillageLevel(effectiveLevels, "wall");
  const researchLevel = getVillageLevel(effectiveLevels, "research");
  const development = calculateVillageDevelopment(effectiveLevels);

  const centralResources = imperialState.resources;
  const centralTroops = imperialState.troops;
  const heroByVillage = imperialState.heroByVillage;
  const deployedByVillage = imperialState.deployedByVillage;
  const logs = imperialState.logs;
  const assignedHero = heroByVillage[village.id] ?? "none";
  const assignedDiplomat = imperialState.diplomatByVillage[village.id] ?? false;
  const modifiers = getCommandModifiers(localCommand);
  const [recentAction, setRecentAction] = useState<ActionFeedback | null>(null);
  const [highlightedAction, setHighlightedAction] = useState<string | null>(null);

  const totalTroops = sumTroops(centralTroops);
  const militaryRating = calculateTroopPower(centralTroops);
  const deployedTotal = Object.values(deployedByVillage).reduce((acc, value) => acc + Math.max(0, Math.floor(value)), 0);
  const availableTroops = Math.max(0, totalTroops - deployedTotal);
  const currentDeployment = deployedByVillage[village.id] ?? 0;
  const isCapitalView = village.id === capitalVillage.id;
  const readinessScore = Math.round(
    Math.min(
      100,
      development * 0.48 +
        Math.min(24, barracksLevel * 4) +
        Math.min(18, wallLevel * 3) +
        Math.min(12, researchLevel * 2) +
        Math.min(18, currentDeployment / 12) +
        (assignedHero === "none" ? 0 : 6) +
        (assignedDiplomat ? 4 : 0),
    ),
  );
  const progressTier = getProgressTier(readinessScore);
  const progressWithinTier = clampPercent(
    ((readinessScore - progressTier.min) / Math.max(1, progressTier.max - progressTier.min + 1)) * 100,
  );
  const nextTierLabel =
    progressTier.label === "Fragil"
      ? "Estavel"
      : progressTier.label === "Estavel"
        ? "Ascendente"
        : progressTier.label === "Ascendente"
          ? "Dominante"
          : "Maximo";

  const appendLog = (line: string) => {
    setImperialState((current) => ({
      ...current,
      logs: [line, ...current.logs].slice(0, 8),
    }));
  };

  const registerAction = (
    actionKey: string,
    feedback: ActionFeedback,
    tone: "tap" | "open" = "open",
    haptic: "light" | "medium" | "heavy" = "medium",
  ) => {
    setRecentAction(feedback);
    setHighlightedAction(actionKey);
    emitUiFeedback(tone, haptic);
  };

  useEffect(() => {
    if (!highlightedAction) return;
    const timer = window.setTimeout(() => setHighlightedAction(null), 520);
    return () => window.clearTimeout(timer);
  }, [highlightedAction]);

  useEffect(() => {
    if (isCapitalView || !village.underAttack) return;
    if (availableTroops <= 0) return;

    const target = Math.max(modifiers.autoDefenseMin, Math.round(totalTroops * modifiers.autoDefenseShare));
    if (currentDeployment >= target) return;

    const sendable = Math.min(availableTroops, target - currentDeployment);
    if (sendable <= 0) return;

    setImperialState((current) => ({
      ...current,
      deployedByVillage: {
        ...current.deployedByVillage,
        [village.id]: (current.deployedByVillage[village.id] ?? 0) + sendable,
      },
    }));
    registerAction(
      "auto-defense",
      {
        title: "Resposta automatica ativada",
        detail: `${sendable} tropas chegaram para segurar ${village.name}.`,
        tone: "info",
        delta: `+${sendable} defesa`,
      },
      "open",
      "light",
    );
    appendLog(`Auto-defesa: ${sendable} tropas enviadas para ${village.name}`);
  }, [availableTroops, currentDeployment, isCapitalView, modifiers.autoDefenseMin, modifiers.autoDefenseShare, setImperialState, totalTroops, village.id, village.name, village.underAttack]);

  const canAfford = (plan: RecruitPlan) => {
    const cost = calcRecruitCost(plan, localCommand);
    return centralResources.materials >= cost.materials && centralResources.supplies >= cost.supplies;
  };

  const recruit = (plan: RecruitPlan) => {
    const amount = Math.max(1, Math.round(plan.amount * modifiers.batchMult));
    const cost = calcRecruitCost(plan, localCommand);

    if (!canAfford(plan)) {
      registerAction(
        `recruit-${plan.key}-fail`,
        {
          title: "Tesouro insuficiente",
          detail: `Faltam recursos para recrutar ${plan.label}.`,
          tone: "warning",
        },
        "tap",
        "light",
      );
      appendLog(`Recursos insuficientes para ${plan.label}`);
      return;
    }

    setImperialState((current) => ({
      ...current,
      resources: {
        materials: current.resources.materials - cost.materials,
        supplies: current.resources.supplies - cost.supplies,
        influence: current.resources.influence,
      },
      troops: {
        ...current.troops,
        [plan.key]: current.troops[plan.key] + amount,
      },
    }));

    registerAction(
      `recruit-${plan.key}`,
      {
        title: `${plan.label} recrutados`,
        detail: `${amount} novas unidades reforcam a ${capitalVillage.name}.`,
        tone: "success",
        delta: `+${amount} tropas`,
      },
      "open",
      "medium",
    );
    appendLog(`+${amount} ${plan.label} recrutados e enviados para ${capitalVillage.name}`);
  };

  const reinforceNow = () => {
    if (isCapitalView) return;
    if (availableTroops <= 0) {
      registerAction(
        "reinforce-empty",
        {
          title: "Reserva esgotada",
          detail: `Nao ha tropas livres para enviar para ${village.name}.`,
          tone: "warning",
        },
        "tap",
        "light",
      );
      appendLog(`Sem tropas disponiveis para reforcar ${village.name}`);
      return;
    }

    const wave = availableTroops;
    setImperialState((current) => ({
      ...current,
      deployedByVillage: {
        ...current.deployedByVillage,
        [village.id]: (current.deployedByVillage[village.id] ?? 0) + wave,
      },
    }));
    registerAction(
      "reinforce",
      {
        title: "Reforcos em marcha",
        detail: `${wave} tropas foram despachadas para ${village.name}.`,
        tone: "success",
        delta: `+${wave} defesa`,
      },
      "open",
      "heavy",
    );
    appendLog(`Chamado total: ${wave} tropas enviadas para ${village.name}`);
  };

  const recall = () => {
    if (currentDeployment <= 0) return;
    setImperialState((current) => ({
      ...current,
      deployedByVillage: { ...current.deployedByVillage, [village.id]: 0 },
    }));
    registerAction(
      "recall",
      {
        title: "Destacamento recolhido",
        detail: `${currentDeployment} tropas voltaram para ${capitalVillage.name}.`,
        tone: "info",
        delta: `-${currentDeployment} na linha`,
      },
      "tap",
      "medium",
    );
    appendLog(`Destacamento recolhido de ${village.name} para ${capitalVillage.name}`);
  };

  return (
    <section className="space-y-3">
      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">Prontidao da Cidade</p>
            <h2 className="kw-title text-base">{progressTier.label}</h2>
          </div>
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/80">Score</p>
            <p className="text-lg font-black text-white">{readinessScore}/100</p>
          </div>
        </div>

        <div className="kw-progress">
          <div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${progressWithinTier}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-300">
          <span>Evolucao visivel: desenvolvimento + defesa + comando local</span>
          <span>Proximo marco: {nextTierLabel}</span>
        </div>

        {recentAction ? (
          <div
            className={`kw-action-banner mt-3 ${
              recentAction.tone === "success"
                ? "kw-action-banner--success"
                : recentAction.tone === "warning"
                  ? "kw-action-banner--warning"
                  : "kw-action-banner--info"
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="kw-action-banner__icon">
                {recentAction.tone === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : recentAction.tone === "warning" ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{recentAction.title}</p>
                  {recentAction.delta ? <span className="kw-action-banner__delta">{recentAction.delta}</span> : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-200">{recentAction.detail}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
            Cada ordem agora gera leitura imediata de impacto para a cidade.
          </div>
        )}
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="kw-title text-base">Exercito da Coroa</h2>
          <span className="kw-subtle text-[11px]">{village.name} · {village.type}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-slate-100">
          <div className="kw-glass-soft kw-status-card">
            <div className="kw-icon-core"><Swords className="h-5 w-5 text-rose-300" /></div>
            <p className="kw-card-title mt-2">Rating militar</p>
            <p className="kw-card-meta">{formatCompact(militaryRating)} poder</p>
          </div>
          <div className="kw-glass-soft kw-status-card">
            <div className="kw-icon-core"><Shield className="h-5 w-5 text-sky-300" /></div>
            <p className="kw-card-title mt-2">Livres</p>
            <p className="kw-card-meta">{formatCompact(availableTroops)} prontas</p>
          </div>
          <div className="kw-glass-soft kw-status-card">
            <div className="kw-icon-core"><Wrench className="h-5 w-5 text-amber-300" /></div>
            <p className="kw-card-title mt-2">Defendendo</p>
            <p className="kw-card-meta">{formatCompact(deployedTotal)} alocadas</p>
          </div>
          <div className="kw-glass-soft kw-status-card col-span-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="kw-icon-core !h-10 !w-10"><TrendingUp className="h-4 w-4 text-emerald-300" /></div>
                <div>
                  <p className="kw-card-title">Forca disponivel: {formatCompact(totalTroops)} tropas</p>
                  <p className="kw-card-meta">{LOCAL_COMMAND_META[localCommand].label}: {LOCAL_COMMAND_META[localCommand].summary}</p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-100">
                {progressTier.label}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-100">
          <div className="kw-glass-soft rounded-lg p-1.5 text-center">M {formatCompact(centralResources.materials)}</div>
          <div className="kw-glass-soft rounded-lg p-1.5 text-center">S {formatCompact(centralResources.supplies)}</div>
        </div>

        <p className="mt-2 text-[11px] text-slate-300">
          Desenvolvimento {development}/100 · Quartel Nv {barracksLevel} · Pesquisa Nv {researchLevel} · Muralha Nv {wallLevel}
        </p>
        <p className="mt-1 text-[11px] text-slate-300">{LOCAL_COMMAND_META[localCommand].summary}</p>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-300" />
          <h2 className="kw-title text-base">Defesa de Cidade</h2>
        </div>

        <div className="kw-glass-soft rounded-2xl p-2">
          <p className="text-sm font-semibold text-slate-100">
            {isCapitalView
              ? "Capital: defesa central"
              : village.underAttack
                ? "Cidade sob ataque: resposta automatica ativa"
                : "Cidade estavel"}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">Destacamento nesta cidade: {formatCompact(currentDeployment)} tropas</p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={reinforceNow}
              disabled={isCapitalView || availableTroops <= 0}
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                isCapitalView || availableTroops <= 0
                  ? "border-white/15 bg-white/5 text-slate-400"
                  : `border-sky-300/50 bg-sky-500/20 text-sky-100 ${highlightedAction === "reinforce" ? "kw-action-press" : ""}`
              }`}
            >
              Chamar todas
            </button>
            <button
              type="button"
              onClick={recall}
              disabled={currentDeployment <= 0}
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                currentDeployment <= 0
                  ? "border-white/15 bg-white/5 text-slate-400"
                  : `border-amber-300/50 bg-amber-500/15 text-amber-100 ${highlightedAction === "recall" ? "kw-action-press" : ""}`
              }`}
            >
              Recolher
            </button>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center gap-2">
          <Crown className="h-4 w-4 text-cyan-300" />
          <h2 className="kw-title text-base">Slot de Heroi (max 1)</h2>
        </div>

        <div className="kw-glass-soft rounded-2xl p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="kw-card-title">Heroi da cidade</p>
            <span className="kw-badge static">{assignedHero === "none" ? "Vazio" : "Ativo"}</span>
          </div>
          <div className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm font-semibold text-slate-100">
            {assignedHero === "none" ? "Contrate no Governo" : HERO_POOL.find((hero) => hero.id === assignedHero)?.label ?? assignedHero}
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {assignedHero === "none"
              ? "O heroi agora custa caro, ocupa o slot da cidade e so entra pelo modal de Governo."
              : HERO_POOL.find((hero) => hero.id === assignedHero)?.bonus}
          </p>
        </div>

        <div className="mt-2 kw-glass-soft rounded-2xl p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="kw-card-title">Diplomata designado</p>
            <span className="kw-badge static">
              {isCapitalView ? "Rei" : assignedDiplomat ? "Ativo" : "Vazio"}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            {isCapitalView
              ? "A Capital não consome diplomata: o Rei já cobre a gestão política local."
              : assignedDiplomat
                ? "Esta cidade tem diplomata alocado para tutela, estabilizacao e politica local."
                : "Sem diplomata local. Se a Colonia ja liberou slot e houver agente contratado, aloque pela aba Herois."}
          </p>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-sky-300" />
          <h2 className="kw-title text-base">Recrutar na Capital</h2>
        </div>

        <div className="kw-status-grid kw-status-grid--2">
          {RECRUITMENT.map((plan) => {
            const amount = Math.max(1, Math.round(plan.amount * modifiers.batchMult));
            const cost = calcRecruitCost(plan, localCommand);
            const powerGain = calcRecruitPowerGain(plan, amount);
            const affordable = canAfford(plan);
            return (
              <div key={plan.key} className="kw-glass-soft kw-status-card text-slate-100">
                <span className="kw-badge">+{powerGain} poder</span>
                <div className="kw-icon-core"><Swords className="h-5 w-5 text-rose-300" /></div>
                <p className="kw-card-title mt-2">{plan.label}</p>
                <p className="kw-card-meta">{plan.role}</p>
                <p className="mt-1 text-[11px] text-slate-300">+{amount} unidades · {centralTroops[plan.key]} atuais</p>
                <p className="mt-1 text-[11px] text-slate-300">Custo: M{cost.materials} / S{cost.supplies}</p>
                <button
                  type="button"
                  onClick={() => recruit(plan)}
                  disabled={!affordable}
                  className={`mt-2 w-full rounded-lg border px-2 py-1 text-[11px] font-bold ${
                    affordable
                      ? `border-sky-300/50 bg-sky-500/20 text-sky-100 ${highlightedAction === `recruit-${plan.key}` ? "kw-action-press" : ""}`
                      : "border-white/15 bg-white/5 text-slate-400"
                  }`}
                >
                  Recrutar na Capital
                </button>
              </div>
            );
          })}
        </div>
      </article>

      {logs.length > 0 ? (
        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-300" />
            <h2 className="kw-title text-base">Log Central</h2>
          </div>
          <div className="space-y-1">
            {logs.map((line) => (
              <p key={line} className="kw-glass-soft rounded-lg px-2 py-1 text-[11px] text-slate-200">{line}</p>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
