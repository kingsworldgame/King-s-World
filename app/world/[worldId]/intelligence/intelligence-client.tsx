﻿"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Coins, Compass, ShieldAlert, Swords, Target, type LucideIcon } from "lucide-react";

import { PlayerAlertCards } from "@/components/player-alert-cards";
import { TimeOfDestinyPanel } from "@/components/sandbox/TimeOfDestinyPanel";
import { calculateVillageDevelopment } from "@/core/GameBalance";
import { mergeImperialVillages, useImperialStateContext } from "@/lib/imperial-state";
import { buildPlayerAlertDeck, type PlayerAlertCard, type PlayerAlertChoice } from "@/lib/player-alerts";
import type { ProfileHealthCard } from "@/lib/season-audit-analytics";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { buildGuide, resolveBuild } from "@/lib/world-assistant-guide";
import { useLiveWorldContext } from "@/lib/world-runtime";

type FeedKind = "combate" | "ações" | "movimento" | "economia" | "alertas";

type FeedEntry = {
  id: string;
  kind: FeedKind;
  title: string;
  summary: string;
  time: string;
  utility: string;
  badge: string;
  cardClass: string;
  icon: LucideIcon;
};

function pickLossPercent(details: string[]): number {
  for (const item of details) {
    const match = item.match(/(\d+)%/);
    if (match) {
      return Number.parseInt(match[1] ?? "0", 10);
    }
  }
  return 0;
}

function usefulCombatRead(title: string, summary: string, loss: number): string {
  const win = /repelido|conquistada|confirmado|vitoria/i.test(`${title} ${summary}`);
  if (!win) {
    return loss >= 25 ? "Segure a frente, evite novo envio e reforce a cidade alvo." : "Combate empatado. Vale medir se a próxima ofensiva fecha a tomada.";
  }
  if (loss <= 12) {
    return "Janela boa para pressionar de novo ou converter em tomada.";
  }
  if (loss <= 24) {
    return "Vitória cara. Reponha tropa antes de abrir outra frente.";
  }
  return "Você venceu, mas queimou poder demais. Priorize recomposição.";
}

function movementUtility(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("portal")) {
    return "Confirme score e ETA da marcha final antes de abrir mais risco.";
  }
  if (normalized.includes("anexa")) {
    return "Cheque se o diplomata ficou travado e se a nova cidade precisa estabilizar.";
  }
  if (normalized.includes("fund") || normalized.includes("estrada")) {
    return "Veja se a nova rota encurtou sua logística ou só abriu custo.";
  }
  return "Confira o ETA e o retorno real dessa ordem antes do próximo clique.";
}

function economyUtility(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("supr")) {
    return "Foco em ração, produção ou corte de atrito para não travar a campanha.";
  }
  return "Use este evento para decidir se vale obra, doação interna ou pausa de gasto.";
}

function alertUtility(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("portal") || normalized.includes("corte")) {
    return "Sua preocupação principal agora é score útil, não mais crescimento bonito.";
  }
  if (normalized.includes("horda")) {
    return "Decida entre segurar a borda ou acelerar regroup para o centro.";
  }
  if (normalized.includes("marcha")) {
      return "Cheque ETA, Explorador e se a rota está fisicamente viável.";
  }
  return "Alerta vivo. Ele merece decisão agora, não leitura passiva.";
}

function classifyCombat(loss: number, win: boolean): { badge: string; cardClass: string } {
  if (!win || loss >= 28) {
    return { badge: "Choque", cardClass: "border-rose-300/35 bg-rose-500/10 text-rose-100" };
  }
  if (loss >= 15) {
    return { badge: "Atrito", cardClass: "border-amber-300/35 bg-amber-500/10 text-amber-100" };
  }
  return { badge: "Limpo", cardClass: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" };
}

function classifyAlert(text: string): { badge: string; cardClass: string } {
  const normalized = text.toLowerCase();
  if (normalized.includes("portal") || normalized.includes("horda") || normalized.includes("abaixo do corte")) {
    return { badge: "Crítico", cardClass: "border-rose-300/35 bg-rose-500/10 text-rose-100" };
  }
  if (normalized.includes("marcha") || normalized.includes("ataque")) {
    return { badge: "Pressão", cardClass: "border-amber-300/35 bg-amber-500/10 text-amber-100" };
  }
  return { badge: "Vigia", cardClass: "border-sky-300/35 bg-sky-500/10 text-sky-100" };
}

export function IntelligenceClient({
  params,
  profileHealth,
}: {
  params: { worldId: string };
  profileHealth: ProfileHealthCard[];
}) {
  void profileHealth;
  const { world } = useLiveWorldContext();
  const { imperialState } = useImperialStateContext();
  const [openedDecision, setOpenedDecision] = useState<PlayerAlertCard | null>(null);
  const mergedVillages = useMemo(() => mergeImperialVillages(world.villages, imperialState), [imperialState, world.villages]);
  const activeVillage = useMemo(
    () => mergedVillages.find((village) => village.id === world.activeVillageId) ?? mergedVillages[0],
    [mergedVillages, world.activeVillageId],
  );
  const heroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );
  const highestDevelopment = useMemo(
    () => mergedVillages.reduce((best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)), 0),
    [mergedVillages],
  );
  const questsCompleted = world.id === "world-test" ? imperialState.sandboxQuestsCompleted : world.sovereignty.eraQuestsCompleted;
  const wondersControlled = world.id === "world-test" ? imperialState.sandboxWondersBuilt : world.sovereignty.wondersControlled;
  const buildId = useMemo(() => resolveBuild(undefined, activeVillage?.cityClass), [activeVillage?.cityClass]);
  const guide = useMemo(
    () =>
      buildGuide(buildId, world.day, {
        villageCount: mergedVillages.length,
        highestDevelopment,
        heroCount,
        wonders: wondersControlled,
        quests: questsCompleted,
      }),
    [buildId, heroCount, highestDevelopment, mergedVillages.length, questsCompleted, wondersControlled, world.day],
  );
  const alertDeck = useMemo(
    () =>
      buildPlayerAlertDeck({
        currentDay: world.day,
        worldPhase: world.phase,
        activeAlerts: world.activeAlerts,
        activeVillage,
        villages: mergedVillages,
        imperialState,
        guide,
        heroCount,
        highestDevelopment,
        questsCompleted,
        wondersControlled,
      }),
    [
      activeVillage,
      guide,
      heroCount,
      highestDevelopment,
      imperialState,
      mergedVillages,
      questsCompleted,
      wondersControlled,
      world.activeAlerts,
      world.day,
      world.phase,
    ],
  );

  const handleAlertChoice = (choice: PlayerAlertChoice) => {
    if (!choice.tab) {
      emitUiFeedback("tap", "light");
      return;
    }

    const paramsQuery = new URLSearchParams();
    Object.entries(choice.query ?? {}).forEach(([key, value]) => paramsQuery.set(key, value));
    window.location.assign(`/world/${params.worldId}/${choice.tab}${paramsQuery.toString() ? `?${paramsQuery.toString()}` : ""}`);
  };

  const alertEntries = useMemo<FeedEntry[]>(
    () =>
      world.activeAlerts.map((alert, index) => {
        const tone = classifyAlert(alert);
        return {
          id: `alert-${index + 1}`,
          kind: "alertas",
          title: "Alerta vital",
          summary: alert,
          time: `Dia ${world.day}`,
          utility: alertUtility(alert),
          badge: tone.badge,
          cardClass: tone.cardClass,
          icon: AlertTriangle,
        };
      }),
    [world.activeAlerts, world.day],
  );

  const reportEntries = useMemo<FeedEntry[]>(() => {
    return world.reports.map((report) => {
      if (report.category === "combate") {
        const loss = pickLossPercent(report.details);
        const win = /repelido|conquistada|confirmado|vitoria/i.test(`${report.title} ${report.summary}`);
        const tone = classifyCombat(loss, win);
        return {
          id: report.id,
          kind: "combate",
          title: report.title,
          summary: `${win ? "Vitória" : "Conflito"} · perdas ${loss}%`,
          time: report.time,
          utility: usefulCombatRead(report.title, report.summary, loss),
          badge: tone.badge,
          cardClass: tone.cardClass,
          icon: Swords,
        } satisfies FeedEntry;
      }

      if (report.category === "economia") {
        return {
          id: report.id,
          kind: "economia",
          title: report.title,
          summary: report.summary,
          time: report.time,
          utility: economyUtility(`${report.title} ${report.summary} ${report.details.join(" ")}`),
          badge: "Economia",
          cardClass: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
          icon: Coins,
        } satisfies FeedEntry;
      }

      return {
        id: report.id,
        kind: "movimento",
        title: report.title,
        summary: report.summary,
        time: report.time,
        utility: movementUtility(`${report.title} ${report.summary} ${report.details.join(" ")}`),
        badge: report.category === "espionagem" ? "Espia" : "Movimento",
        cardClass: "border-sky-300/35 bg-sky-500/10 text-sky-100",
        icon: Bell,
      } satisfies FeedEntry;
    });
  }, [world.reports]);

  const actionEntries = useMemo<FeedEntry[]>(
    () =>
      imperialState.logs.map((log, index) => ({
        id: `action-${index + 1}`,
        kind: "ações",
        title: "Ação do reino",
        summary: log,
        time: "agora",
        utility: movementUtility(log),
        badge: "Ação",
        cardClass: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
        icon: Bell,
      })),
    [imperialState.logs],
  );

  const feed = useMemo(
    () => [...alertEntries, ...actionEntries, ...reportEntries],
    [actionEntries, alertEntries, reportEntries],
  );

  const criticalAlerts = alertEntries.filter((entry) => entry.badge === "Crítico").length;
  const combatEntries = reportEntries.filter((entry) => entry.kind === "combate");
  const harshCombats = combatEntries.filter((entry) => entry.badge === "Choque").length;
  const unreadCombat = world.reports.filter((entry) => entry.category === "combate" && entry.unread).length;
  const pendingActions = actionEntries.length;
  const primaryChoice = alertDeck.primary.choices.find((choice) => choice.tab) ?? alertDeck.primary.choices[0] ?? null;
  const riskLabel = criticalAlerts > 0 ? "Crítico" : harshCombats > 0 ? "Atenção" : "Controlado";
  const riskClass = criticalAlerts > 0
    ? "border-rose-300/35 bg-rose-500/12 text-rose-50"
    : harshCombats > 0
      ? "border-amber-300/35 bg-amber-500/12 text-amber-50"
      : "border-emerald-300/35 bg-emerald-500/10 text-emerald-50";

  const jumpTo = (tab: string, query?: Record<string, string>) => {
    const paramsQuery = new URLSearchParams();
    paramsQuery.set("v", activeVillage.id);
    Object.entries(query ?? {}).forEach(([key, value]) => paramsQuery.set(key, value));
    emitUiFeedback("open", "medium");
    window.location.assign(`/world/${params.worldId}/${tab}${paramsQuery.toString() ? `?${paramsQuery.toString()}` : ""}`);
  };

  const decisionsTop = [alertDeck.primary, ...alertDeck.secondary].slice(0, 3);
  const senateMeeting = imperialState.senate.activeMeeting;
  const hasSenateMeeting = Boolean(senateMeeting);

  return (
    <section className="space-y-3">
      {params.worldId === "world-test" ? (
        <TimeOfDestinyPanel
          currentDay={world.day}
          villages={mergedVillages}
          imperialState={imperialState}
          activeAlerts={world.activeAlerts}
        />
      ) : null}

      <article
        className="relative overflow-hidden rounded-[30px] border border-white/14 p-3 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.28)]"
        style={{
          backgroundImage:
            "linear-gradient(145deg, rgba(2,6,23,0.42), rgba(2,6,23,0.92)), url('/images/card-opportunity.jpg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">Hoje no Reino</p>
            <h2 className="mt-1 text-xl font-black leading-tight text-slate-50">Dia {world.day}: ordem da Coroa</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-200">{guide.nextAction}</p>
          </div>
          <span className={`shrink-0 rounded-2xl border px-2.5 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] ${riskClass}`}>
            {riskLabel}
          </span>
        </div>

        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-2 backdrop-blur-md">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">O que mudou</p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-slate-100">{guide.checkpoints[0]}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-2 backdrop-blur-md">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Plano atual</p>
            <p className="mt-1 text-base font-black text-emerald-100">{guide.build.label}</p>
            <p className="text-[10px] text-slate-300">{mergedVillages.length} cidades · {heroCount}/10 heróis</p>
          </div>
        </div>

        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
          {primaryChoice?.tab ? (
            <button
              type="button"
              onClick={() => handleAlertChoice(primaryChoice)}
              className="inline-flex items-center justify-center gap-1 rounded-2xl border border-amber-300/35 bg-amber-500/16 px-3 py-3 text-[11px] font-black text-amber-50"
            >
              <Target className="h-4 w-4" />
              Executar ordem
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => jumpTo(guide.recommendedTab)}
            className="inline-flex items-center justify-center gap-1 rounded-2xl border border-cyan-300/35 bg-cyan-500/16 px-3 py-3 text-[11px] font-black text-cyan-50"
          >
            <Compass className="h-4 w-4" />
            Abrir {guide.recommendedTab === "base" ? "Cidades" : guide.recommendedTab === "board" ? "Mundo" : guide.recommendedTab === "empire" ? "Império" : "Intel"}
          </button>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="kw-title text-base">Riscos e decisões</h2>
          <span className="kw-subtle text-[11px]">{hasSenateMeeting ? "Senado ativo" : "Run ativa"}</span>
        </div>

        {hasSenateMeeting ? (
          <button
            type="button"
            onClick={() => jumpTo("empire", { s: "meeting" })}
            className="mb-2 w-full rounded-2xl border border-amber-300/35 bg-amber-500/14 p-2 text-left"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Reunião do Senado</p>
            <p className="mt-1 text-[13px] font-bold text-amber-50">{senateMeeting?.title}</p>
            <p className="mt-1 text-[11px] text-amber-100/90">Atalho no Império para decidir agora.</p>
          </button>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {decisionsTop.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                emitUiFeedback("open", "light");
                setOpenedDecision(card);
              }}
              className="rounded-2xl border border-white/12 bg-white/7 p-2 text-left"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">{card.severity}</p>
              <p className="mt-1 text-[12px] font-bold leading-4 text-slate-50">{card.title}</p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-300">{card.reason}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="kw-title text-base">Eventos recentes</h2>
          <span className="kw-subtle text-[11px]">{feed.length} sinais</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-2xl border p-2 ${criticalAlerts > 0 ? "border-rose-300/35 bg-rose-500/12" : "border-white/10 bg-white/5"}`}>
            <ShieldAlert className="h-4 w-4 text-rose-200" />
            <p className="mt-1 text-lg font-black text-slate-50">{criticalAlerts}</p>
            <p className="text-[10px] text-slate-300">urgente</p>
          </div>
          <div className={`rounded-2xl border p-2 ${harshCombats > 0 ? "border-amber-300/35 bg-amber-500/12" : "border-white/10 bg-white/5"}`}>
            <Swords className="h-4 w-4 text-amber-200" />
            <p className="mt-1 text-lg font-black text-slate-50">{harshCombats}</p>
            <p className="text-[10px] text-slate-300">combate caro</p>
          </div>
          <div className={`rounded-2xl border p-2 ${pendingActions > 0 ? "border-cyan-300/35 bg-cyan-500/12" : "border-white/10 bg-white/5"}`}>
            <Bell className="h-4 w-4 text-cyan-200" />
            <p className="mt-1 text-lg font-black text-slate-50">{pendingActions}</p>
            <p className="text-[10px] text-slate-300">ações</p>
          </div>
        </div>

        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-bold text-slate-100">
            {criticalAlerts > 0
              ? "Prioridade: resolver alerta antes de gastar."
              : unreadCombat > 0
                ? "Prioridade: ler combate antes de atacar de novo."
                : "Prioridade: ajustar cidade/build e confirmar se salvou."}
          </p>
        </div>

        <div className="mt-3 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {feed.slice(0, 16).map((entry) => (
            <article
              key={entry.id}
              className={`min-w-[220px] snap-start rounded-2xl border p-2 ${entry.cardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em]">{entry.badge}</p>
                <entry.icon className="h-3.5 w-3.5" />
              </div>
              <p className="mt-1 text-[12px] font-bold text-slate-50">{entry.title}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-200">{entry.summary}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-300">{entry.utility}</p>
            </article>
          ))}
        </div>
      </article>

      {openedDecision ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Fechar decisão"
            onClick={() => setOpenedDecision(null)}
            className="absolute inset-0 bg-slate-950/76 backdrop-blur-sm"
          />
          <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] bottom-[calc(env(safe-area-inset-bottom)+16px)] mx-auto flex w-full max-w-md">
            <article
              className="relative w-full overflow-hidden rounded-[28px] border border-white/15 p-3 text-slate-100"
              style={{
                backgroundImage:
                  "linear-gradient(160deg, rgba(2,6,23,0.2), rgba(2,6,23,0.82)), url('/images/card-opportunity.jpg')",
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{openedDecision.severity}</p>
                  <h3 className="mt-1 text-xl font-black text-slate-50">{openedDecision.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenedDecision(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/20 text-slate-50"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-slate-100">{openedDecision.situation}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-200">{openedDecision.impact}</p>
              <div className="mt-3 grid gap-2">
                {openedDecision.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      handleAlertChoice(choice);
                      setOpenedDecision(null);
                    }}
                    className="rounded-xl border border-cyan-300/35 bg-cyan-500/16 px-2.5 py-2 text-left text-[11px] font-semibold text-cyan-50"
                  >
                    {choice.label}
                    {choice.note ? <p className="mt-1 text-[10px] font-normal text-cyan-100/85">{choice.note}</p> : null}
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
