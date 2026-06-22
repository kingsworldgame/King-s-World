"use client";

import {
  BookOpen,
  CalendarDays,
  CircleDot,
  Compass,
  Crown,
  Lightbulb,
  Map as MapIcon,
  MousePointerClick,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { calculateVillageDevelopment, getThreatCalendar, type EvolutionMode } from "@/core/GameBalance";
import { PlayerAlertCards } from "@/components/player-alert-cards";
import type { ImperialDecisionConsequenceType, ImperialDecisionInboxItem, ImperialState } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { buildPlayerAlertDeck, type PlayerAlertCard, type PlayerAlertChoice } from "@/lib/player-alerts";
import { emitUiFeedback, emitUiToast } from "@/lib/ui-feedback";
import {
  buildGuide,
  buildSandboxCoachCta,
  formatCampaignDate,
  resolveBuild,
  type WorldTab,
} from "@/lib/world-assistant-guide";

type IntelSubtab = "decisions" | "intel";

function clampPenalty(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function resolveDecisionWindow(
  severity: PlayerAlertCard["severity"],
  source: ImperialDecisionInboxItem["source"],
): number {
  if (source === "senate") {
    return severity === "high" ? 4 : severity === "medium" ? 7 : 10;
  }
  if (source === "field") {
    return severity === "high" ? 1 : severity === "medium" ? 2 : 3;
  }
  return severity === "high" ? 2 : severity === "medium" ? 4 : 6;
}

function resolveDecisionConsequence(
  severity: PlayerAlertCard["severity"],
  source: ImperialDecisionInboxItem["source"],
  current: ImperialState,
): {
  consequenceType: ImperialDecisionConsequenceType;
  consequenceAmount: number;
  consequenceLabel: string;
} {
  const severityFactor = severity === "high" ? 1 : severity === "medium" ? 0.62 : 0.36;
  const totalTroops = current.troops.militia + current.troops.shooters + current.troops.scouts + current.troops.machinery;

  if (source === "senate") {
    const amount = clampPenalty(7 + 14 * severityFactor, 7, 21);
    return {
      consequenceType: "satisfaction",
      consequenceAmount: amount,
      consequenceLabel: `Se ignorar: -${amount} satisfacao por crise politica`,
    };
  }

  if (source === "field") {
    const amount = clampPenalty(totalTroops * (0.04 + severityFactor * 0.08), 14, 120);
    return {
      consequenceType: "troops",
      consequenceAmount: amount,
      consequenceLabel: `Se ignorar: ate -${amount} milicia por atrito de campo`,
    };
  }

  const resourceBase = Math.max(1000, current.resources.supplies);
  const amount = clampPenalty(resourceBase * (0.018 + severityFactor * 0.038), 70, 280);
  return {
    consequenceType: "supplies",
    consequenceAmount: amount,
    consequenceLabel: `Se ignorar: -${amount} suprimentos por atraso operacional`,
  };
}

function applyDecisionReward(current: ImperialState, decision: ImperialDecisionInboxItem): ImperialState {
  if (decision.source === "senate") {
    const gain = decision.severity === "high" ? 6 : decision.severity === "medium" ? 4 : 2;
    return {
      ...current,
      senate: {
        ...current.senate,
        satisfaction: Math.min(100, current.senate.satisfaction + gain),
      },
      logs: [`Decisao politica resolvida: ${decision.title}. +${gain} satisfacao.`, ...current.logs].slice(0, 12),
    };
  }

  if (decision.source === "field") {
    const saved = Math.max(4, Math.floor(decision.consequenceAmount * 0.35));
    return {
      ...current,
      troops: {
        ...current.troops,
        militia: current.troops.militia + saved,
      },
      logs: [`Decisao de campo resolvida: ${decision.title}. ${saved} milicia preservada.`, ...current.logs].slice(0, 12),
    };
  }

  const savedSupplies = Math.max(25, Math.floor(decision.consequenceAmount * 0.25));
  return {
    ...current,
    resources: {
      ...current.resources,
      supplies: current.resources.supplies + savedSupplies,
    },
    logs: [`Leitura operacional resolvida: ${decision.title}. +${savedSupplies} suprimentos preservados.`, ...current.logs].slice(0, 12),
  };
}

export function WorldAssistant({
  worldId,
  currentDay,
  worldPhase,
  campaignDate,
  isSandboxWorld,
  realTimeEnabled,
  activeTab,
  evolutionMode,
  activeVillage,
  villages,
  imperialState,
  questsCompleted,
  wondersControlled,
  activeAlerts,
  setImperialState,
}: {
  worldId: string;
  currentDay: number;
  worldPhase: string;
  campaignDate: Date;
  isSandboxWorld: boolean;
  realTimeEnabled: boolean;
  activeTab: WorldTab;
  evolutionMode?: EvolutionMode;
  activeVillage: VillageSummary;
  villages: VillageSummary[];
  imperialState: ImperialState;
  questsCompleted: number;
  wondersControlled: number;
  activeAlerts: string[];
  setImperialState: (updater: (current: ImperialState) => ImperialState) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [subtab, setSubtab] = useState<IntelSubtab>("decisions");

  const buildId = useMemo(
    () => resolveBuild(evolutionMode, activeVillage.cityClass),
    [activeVillage.cityClass, evolutionMode],
  );

  const heroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );

  const highestDevelopment = useMemo(
    () => villages.reduce((best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)), 0),
    [villages],
  );

  const guide = useMemo(
    () =>
      buildGuide(buildId, currentDay, {
        villageCount: villages.length,
        highestDevelopment,
        heroCount,
        wonders: wondersControlled,
        quests: questsCompleted,
      }),
    [buildId, currentDay, heroCount, highestDevelopment, questsCompleted, villages.length, wondersControlled],
  );

  const jumpToTab = (tab: WorldTab) => {
    const params = new URLSearchParams(searchParams.toString());
    emitUiFeedback("open", "medium");
    router.push(`/world/${worldId}/${tab}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const jumpToTabWithQuery = (tab: WorldTab, query: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(query).forEach(([key, value]) => params.set(key, value));
    emitUiFeedback("open", "medium");
    router.push(`/world/${worldId}/${tab}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const capitalVillageId = villages.find((village) => village.type === "Capital")?.id ?? activeVillage.id;
  const focusVillageId =
    villages.reduce((best, village) => {
      const score = calculateVillageDevelopment(village.buildingLevels);
      return score > best.score ? { id: village.id, score } : best;
    }, { id: activeVillage.id, score: calculateVillageDevelopment(activeVillage.buildingLevels) }).id;
  const sandboxCoachCta = isSandboxWorld
    ? buildSandboxCoachCta(currentDay, imperialState.sandboxStrategyId, capitalVillageId, focusVillageId)
    : null;
  const alertDeck = useMemo(
    () =>
      buildPlayerAlertDeck({
        currentDay,
        worldPhase,
        activeAlerts,
        activeVillage,
        villages,
        imperialState,
        guide,
        heroCount,
        highestDevelopment,
        questsCompleted,
        wondersControlled,
      }),
    [
      activeAlerts,
      activeVillage,
      currentDay,
      guide,
      heroCount,
      highestDevelopment,
      imperialState,
      questsCompleted,
      villages,
      wondersControlled,
      worldPhase,
    ],
  );

  const decisionCards = useMemo(
    () => [alertDeck.primary, ...alertDeck.secondary].filter((card) => card.kind === "decision"),
    [alertDeck.primary, alertDeck.secondary],
  );
  const infoCards = useMemo(
    () => [alertDeck.primary, ...alertDeck.secondary].filter((card) => card.kind !== "decision"),
    [alertDeck.primary, alertDeck.secondary],
  );
  const intelLogCards = useMemo<PlayerAlertCard[]>(() => {
    return (imperialState.logs ?? [])
      .filter((entry) => /^Intel de marcha:/i.test(entry))
      .slice(0, 6)
      .map((entry, index) => {
        const text = entry.replace(/^Intel de marcha:\s*/i, "");
        return {
          id: `map-intel-${index}-${text.slice(0, 24)}`,
          kind: "reading",
          severity: text.includes("hostil") ? "high" : text.includes("Cidade vazia") ? "medium" : "low",
          title: text.includes("hostil") ? "Contato hostil avistado" : text.includes("Cidade vazia") ? "Cidade vazia no corredor" : "Relatorio de marcha",
          situation: text,
          reason: "Exploradores registraram o contato durante a passagem pelo corredor de marcha.",
          impact: "Fica salvo como leitura tática. Não oferece ação direta nesta aba.",
          choices: [],
          sourceTags: ["intel", "map", "march"],
        };
      });
  }, [imperialState.logs]);
  const decisionInboxById = useMemo(
    () => new Map((imperialState.decisionInbox ?? []).map((entry) => [entry.id, entry] as const)),
    [imperialState.decisionInbox],
  );
  const sortedDecisionCards = useMemo(() => {
    return [...decisionCards].sort((a, b) => {
      const aExp = decisionInboxById.get(a.id)?.expiresAtDay ?? Number.MAX_SAFE_INTEGER;
      const bExp = decisionInboxById.get(b.id)?.expiresAtDay ?? Number.MAX_SAFE_INTEGER;
      return aExp - bExp;
    });
  }, [decisionCards, decisionInboxById]);
  const decisionsPrimary = sortedDecisionCards[0] ?? null;
  const decisionsSecondary = sortedDecisionCards.slice(1);
  const intelPrimary = intelLogCards[0] ?? infoCards[0] ?? alertDeck.primary;
  const intelSecondary = intelLogCards.length > 0 ? [...intelLogCards.slice(1), ...infoCards] : infoCards.slice(1);
  const threat = getThreatCalendar(currentDay);
  const strongestRisk = useMemo(
    () => [...decisionCards, ...infoCards].filter((card) => card.severity === "high" || card.severity === "medium").slice(0, 2),
    [decisionCards, infoCards],
  );
  const recentIntel = useMemo(
    () => [...intelLogCards, ...infoCards].slice(0, 3),
    [infoCards, intelLogCards],
  );
  const recommendedTabLabel =
    guide.recommendedTab === "base"
      ? "Abrir Cidades"
      : guide.recommendedTab === "board"
        ? "Abrir Mundo"
        : guide.recommendedTab === "empire"
          ? "Abrir Império"
          : guide.recommendedTab === "guide"
            ? "Abrir Perfil"
            : "Abrir Comando";
  const decisionSyncSignature = useMemo(
    () =>
      [
        currentDay,
        ...decisionCards.map((card) => [card.id, card.title, card.severity, card.sourceTags.join(",")].join(":")),
      ].join("|"),
    [currentDay, decisionCards],
  );
  const lastDecisionSyncRef = useRef("");

  useEffect(() => {
    if (lastDecisionSyncRef.current === decisionSyncSignature) {
      return;
    }
    lastDecisionSyncRef.current = decisionSyncSignature;

    const seedItems = decisionCards.map((card) => {
      const source: ImperialDecisionInboxItem["source"] = card.sourceTags.some((tag) => /senado|senate/i.test(tag))
        ? "senate"
        : card.sourceTags.some((tag) => /map|combat|frontline|horde|quest|march|expansion/i.test(tag))
          ? "field"
          : "intel";
      const expiresWindowDays = resolveDecisionWindow(card.severity, source);
      return {
        id: card.id,
        title: card.title,
        severity: card.severity,
        source,
        expiresWindowDays,
      };
    });

    setImperialState((current) => {
      const prev = current.decisionInbox ?? [];
      const prevMap = new Map(prev.map((entry) => [entry.id, entry] as const));
      const seedMap = new Map(seedItems.map((entry) => [entry.id, entry] as const));
      let changed = false;
      const penalties: string[] = [];

      const next: ImperialDecisionInboxItem[] = [];

      for (const seed of seedItems) {
        const existing = prevMap.get(seed.id);
        const consequence = resolveDecisionConsequence(seed.severity, seed.source, current);
        if (!existing) {
          changed = true;
          next.push({
            id: seed.id,
            title: seed.title,
            severity: seed.severity,
            source: seed.source,
            createdAtDay: currentDay,
            expiresAtDay: currentDay + seed.expiresWindowDays,
            status: "pending",
            consequenceApplied: false,
            consequenceType: consequence.consequenceType,
            consequenceAmount: consequence.consequenceAmount,
            consequenceLabel: consequence.consequenceLabel,
          });
          continue;
        }

        const updated: ImperialDecisionInboxItem = {
          ...existing,
          title: seed.title,
          severity: seed.severity,
          source: seed.source,
          consequenceType: consequence.consequenceType,
          consequenceAmount: consequence.consequenceAmount,
          consequenceLabel: consequence.consequenceLabel,
        };

        if (existing.title !== updated.title || existing.severity !== updated.severity || existing.source !== updated.source || existing.consequenceLabel !== updated.consequenceLabel || existing.consequenceType !== updated.consequenceType || existing.consequenceAmount !== updated.consequenceAmount) {
          changed = true;
        }

        if (updated.status === "pending" && currentDay > updated.expiresAtDay) {
          updated.status = "expired";
          if (!updated.consequenceApplied) {
            updated.consequenceApplied = true;
            penalties.push(updated.id);
          }
          changed = true;
        }

        next.push(updated);
      }

      for (const existing of prev) {
        if (seedMap.has(existing.id)) {
          continue;
        }
        if (existing.status === "pending") {
          changed = true;
          next.push({ ...existing, status: "resolved" });
        } else {
          next.push(existing);
        }
      }

      if (penalties.length > 0) {
        let suppliesPenalty = 0;
        let materialsPenalty = 0;
        let satisfactionPenalty = 0;
        let militiaPenalty = 0;
        for (const penaltyId of penalties) {
          const item = next.find((entry) => entry.id === penaltyId);
          if (!item) continue;
          if (item.consequenceType === "supplies") {
            suppliesPenalty += item.consequenceAmount;
          } else if (item.consequenceType === "materials") {
            materialsPenalty += item.consequenceAmount;
          } else if (item.consequenceType === "satisfaction") {
            satisfactionPenalty += item.consequenceAmount;
          } else {
            militiaPenalty += Math.max(1, Math.floor(item.consequenceAmount));
          }
        }

        changed = true;
        return {
          ...current,
          resources: {
            ...current.resources,
            supplies: Math.max(0, current.resources.supplies - suppliesPenalty),
            materials: Math.max(0, current.resources.materials - materialsPenalty),
          },
          troops: {
            ...current.troops,
            militia: Math.max(0, current.troops.militia - militiaPenalty),
          },
          senate: {
            ...current.senate,
            satisfaction: Math.max(0, current.senate.satisfaction - satisfactionPenalty),
          },
          decisionInbox: next.slice(0, 120),
          logs: [
            `Decisoes expiraram (${penalties.length}). Custo aplicado: -${materialsPenalty} materiais, -${suppliesPenalty} suprimentos, -${militiaPenalty} milicia.`,
            ...current.logs,
          ].slice(0, 12),
        };
      }

      if (!changed) {
        return current;
      }

      return {
        ...current,
        decisionInbox: next.slice(0, 120),
      };
    });
  }, [currentDay, decisionCards, decisionSyncSignature, setImperialState]);
  const handleAlertChoice = (choice: PlayerAlertChoice) => {
    const decisionId = choice.id.includes("-") ? choice.id.split("-").slice(0, -1).join("-") : "";
    if (decisionId) {
      setImperialState((current) => {
        const decision = (current.decisionInbox ?? []).find((entry) => entry.id === decisionId && entry.status === "pending");
        if (!decision) {
          return current;
        }
        const rewarded = applyDecisionReward(current, decision);
        return {
          ...rewarded,
          decisionInbox: (rewarded.decisionInbox ?? []).map((entry) =>
            entry.id === decisionId && entry.status === "pending"
              ? { ...entry, status: "resolved" }
              : entry,
          ),
        };
      });
      emitUiToast({
        tone: "success",
        title: "Decisão computada",
        message: "Resposta registrada no conselho. Recompensa aplicada se a pauta ainda estava pendente.",
      });
    }
    if (choice.tab) {
      jumpToTabWithQuery(choice.tab, choice.query ?? {});
      return;
    }

    emitUiFeedback("tap", "light");
  };

  const handleIgnoreDecision = (cardId: string) => {
    setImperialState((current) => {
      const target = (current.decisionInbox ?? []).find((entry) => entry.id === cardId);
      if (!target || target.status !== "pending") {
        return current;
      }
      const nextInbox: ImperialDecisionInboxItem[] = (current.decisionInbox ?? []).map((entry) =>
        entry.id === cardId ? { ...entry, status: "expired" as const, consequenceApplied: true } : entry,
      );
      const next = { ...current };
      if (target.consequenceType === "supplies") {
        next.resources = { ...next.resources, supplies: Math.max(0, next.resources.supplies - target.consequenceAmount) };
      } else if (target.consequenceType === "materials") {
        next.resources = { ...next.resources, materials: Math.max(0, next.resources.materials - target.consequenceAmount) };
      } else if (target.consequenceType === "troops") {
        next.troops = { ...next.troops, militia: Math.max(0, next.troops.militia - target.consequenceAmount) };
      } else if (target.consequenceType === "satisfaction") {
        next.senate = { ...next.senate, satisfaction: Math.max(0, next.senate.satisfaction - target.consequenceAmount) };
      }
      next.decisionInbox = nextInbox;
      next.logs = [`Decisao ignorada: ${target.title}. ${target.consequenceLabel}.`, ...next.logs].slice(0, 12);
      return next;
    });
    emitUiFeedback("tap", "medium");
  };

  return (
    <>
      <div className="mb-2 space-y-2">
        {currentDay <= 3 && !isSandboxWorld ? (
          <article className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Primeiro dia no mundo</p>
            <p className="mt-1 text-sm font-black text-slate-50">4 passos para sobreviver</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {[
                { step: "1", label: "Coroa", desc: "Escolha seu rei — define seus bônus" },
                { step: "2", label: "Capital", desc: "Suba os prédios em Cidades" },
                { step: "3", label: "Mapa", desc: "Explore o território em Mundo" },
                { step: "4", label: "1500 Influência", desc: "Meta para passar pelo Portal" },
              ].map(({ step, label, desc }) => (
                <div key={step} className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-300">Passo {step}</p>
                  <p className="mt-0.5 text-[11px] font-black text-slate-50">{label}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-300">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Este guia desaparece após o Dia 3. Use o <strong className="text-slate-200">?</strong> no canto para ver dicas a qualquer momento.</p>
          </article>
        ) : null}
        <article className="kw-glass rounded-2xl border border-cyan-200/20 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Hoje no Reino</p>
              <p className="truncate text-sm font-black text-slate-50">Dia {currentDay}: {guide.windowLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">{guide.focus}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                emitUiFeedback("open", "medium");
                setTutorialOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-300/40 bg-sky-500/14 px-2 py-1.5 text-[10px] font-bold text-sky-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guia
            </button>
          </div>

          <div className="mt-2 rounded-2xl border border-amber-300/28 bg-amber-500/12 p-2.5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-100" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Ordem recomendada</p>
            </div>
            <p className="mt-1 text-[12px] font-bold leading-5 text-slate-50">{guide.nextAction}</p>
            <button
              type="button"
              onClick={() => jumpToTab(guide.recommendedTab)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-200/50 bg-amber-300 px-3 py-2 text-[11px] font-black text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.18)] active:scale-95"
            >
              <Compass className="h-3.5 w-3.5" />
              {recommendedTabLabel}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px] text-slate-200">
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Data da campanha">
              <CalendarDays className="mx-auto h-4 w-4 text-slate-200" />
              <p className="mt-1 font-black text-slate-50">{formatCampaignDate(campaignDate)}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Cidades">
              <MapIcon className="mx-auto h-4 w-4 text-cyan-200" />
              <p className="mt-1 font-black text-slate-50">{villages.length}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Pico de desenvolvimento">
              <CircleDot className="mx-auto h-4 w-4 text-emerald-200" />
              <p className="mt-1 font-black text-slate-50">{highestDevelopment}/100</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Herois ativos">
              <Crown className="mx-auto h-4 w-4 text-amber-200" />
              <p className="mt-1 font-black text-slate-50">{heroCount}</p>
            </div>
          </div>

          {(() => {
            const threat = getThreatCalendar(currentDay);
            if (threat.activeWave) {
              return (
                <div className="mt-2 rounded-2xl border border-rose-300/35 bg-rose-500/15 p-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-200">⚔ Ataque agora</p>
                  <p className="mt-0.5 text-[11px] font-bold text-rose-50">{threat.activeWave.label} — prepare a defesa da capital</p>
                </div>
              );
            }
            if (threat.nextWave && threat.daysUntilNext !== null && threat.daysUntilNext <= 12) {
              return (
                <div className="mt-2 rounded-2xl border border-amber-300/30 bg-amber-500/12 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">Próxima ameaça</p>
                  <p className="mt-0.5 text-[11px] text-amber-50">
                    {threat.nextWave.label} em <strong>{threat.daysUntilNext} dia(s)</strong> — reforce a defesa antes.
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {strongestRisk.length > 0 ? (
            <div className="mt-2 grid gap-1.5">
              {strongestRisk.map((card) => (
                <div key={card.id} className="rounded-2xl border border-white/12 bg-white/6 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                    {card.severity === "high" ? "Risco alto" : "Atenção"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold leading-4 text-slate-100">{card.title}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => jumpToTab(guide.recommendedTab)}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/14 px-2 py-1 text-[10px] font-semibold text-cyan-100"
            >
              <Compass className="h-3.5 w-3.5" />
              {guide.recommendedTab === "base" ? "Ir para Cidades" : guide.recommendedTab === "board" ? "Ir para Mundo" : guide.recommendedTab === "empire" ? "Ir para Império" : guide.recommendedTab === "guide" ? "Ir para Perfil" : "Ir para Comando"}
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-100">
              <CircleDot className="h-3.5 w-3.5" />
              {realTimeEnabled ? "tempo real" : "pausado"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
              <MousePointerClick className="h-3.5 w-3.5" />
              {activeTab}
            </span>
            {recentIntel.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-500/12 px-2 py-1 text-[10px] font-semibold text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {recentIntel.length} evento(s)
              </span>
            ) : null}
          </div>

          {sandboxCoachCta ? (
            <div className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-2">
              <button
                type="button"
                onClick={() => jumpToTabWithQuery(sandboxCoachCta.tab, sandboxCoachCta.query)}
                title={sandboxCoachCta.detail}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-300/45 bg-amber-500/18 px-2.5 py-2 text-[10px] font-bold text-amber-50"
              >
                <Target className="h-3.5 w-3.5" />
                {sandboxCoachCta.label}
              </button>
            </div>
          ) : null}
        </article>

        <article className="kw-glass rounded-2xl p-2.5">
          <div className="mb-2 inline-flex rounded-xl border border-white/12 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => {
                emitUiFeedback("tap", "light");
                setSubtab("decisions");
              }}
              className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                subtab === "decisions"
                  ? "border border-amber-300/35 bg-amber-500/18 text-amber-50"
                  : "text-slate-300 hover:bg-white/8"
              }`}
            >
              Decisões ({decisionCards.length})
            </button>
            <button
              type="button"
              onClick={() => {
                emitUiFeedback("tap", "light");
                setSubtab("intel");
              }}
              className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                subtab === "intel"
                  ? "border border-cyan-300/35 bg-cyan-500/18 text-cyan-50"
                  : "text-slate-300 hover:bg-white/8"
              }`}
            >
              Info ({infoCards.length})
            </button>
          </div>

          {subtab === "decisions" ? (
            <PlayerAlertCards
              primary={decisionsPrimary}
              secondary={decisionsSecondary}
              onChoice={handleAlertChoice}
              title="Decisoes do Senado e Campo"
              subtitle="Escolhas reais. Senado pode maturar por dias; campo exige resposta curta. Ignorar cobra custo político ou militar."
              decisionInboxById={decisionInboxById}
              onIgnoreDecision={handleIgnoreDecision}
            />
          ) : (
            <PlayerAlertCards
              primary={intelPrimary}
              secondary={intelSecondary}
              onChoice={handleAlertChoice}
              title="Info da Run"
              subtitle="Leitura tática e contexto. Aqui não existe ação, oferta ou custo."
              decisionInboxById={decisionInboxById}
              onIgnoreDecision={handleIgnoreDecision}
              showChoices={false}
            />
          )}
        </article>
      </div>

      {tutorialOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Fechar tutorial"
            onClick={() => {
              emitUiFeedback("close", "light");
              setTutorialOpen(false);
            }}
            className="absolute inset-0 bg-slate-950/76 backdrop-blur-sm"
          />

          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+18px)] top-[calc(env(safe-area-inset-top)+74px)] mx-auto flex w-full max-w-md">
            <div className="kw-glass flex h-full w-full flex-col rounded-[28px] p-3 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Popup tutorial</p>
                  <h3 className="text-lg font-bold text-slate-50">{guide.build.label} | Dia {currentDay}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-300">
                    {guide.summary} Esta build quer: {guide.build.identity}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    emitUiFeedback("close", "light");
                    setTutorialOpen(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-sky-200" />
                    <p className="text-[11px] font-bold text-slate-50">Proxima acao</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-200">{guide.nextAction}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ritmo atual</p>
                    <p className="mt-1 text-sm font-bold text-slate-50">{villages.length} aldeias</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">Maior desenvolvimento: {highestDevelopment}/100</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pilares</p>
                    <p className="mt-1 text-sm font-bold text-slate-50">{heroCount} herois | {questsCompleted} quests</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{wondersControlled} Maravilhas controladas</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-200" />
                    <p className="text-[11px] font-bold text-slate-50">Checklist da fase</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {guide.actions.map((action) => (
                      <p key={action} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {action}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-200" />
                    <p className="text-[11px] font-bold text-slate-50">Marcos ideais da build</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {guide.checkpoints.map((checkpoint) => (
                      <p key={checkpoint} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {checkpoint}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-violet-200" />
                    <p className="text-[11px] font-bold text-slate-50">Leitura de contexto</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {activeAlerts.slice(0, 3).map((alert) => (
                      <p key={alert} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {alert}
                      </p>
                    ))}
                  </div>
                </div>

                {guide.warnings.length ? (
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-500/8 p-2">
                    <p className="text-[11px] font-bold text-rose-100">Alertas da sua run</p>
                    <div className="mt-2 space-y-1.5">
                      {guide.warnings.map((warning) => (
                        <p key={warning} className="rounded-xl border border-rose-300/15 bg-rose-500/8 px-2 py-1.5 text-[11px] leading-5 text-rose-50">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => jumpToTab(guide.recommendedTab)}
                  className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/35 bg-cyan-500/14 px-2.5 py-2 text-[10px] font-bold text-cyan-100"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Abrir aba recomendada
                </button>
                {sandboxCoachCta ? (
                  <button
                    type="button"
                    onClick={() => jumpToTabWithQuery(sandboxCoachCta.tab, sandboxCoachCta.query)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300/35 bg-amber-500/14 px-2.5 py-2 text-[10px] font-bold text-amber-50"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Abrir acao do dia
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
