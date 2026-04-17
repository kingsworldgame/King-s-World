"use client";

import { AlertTriangle, Castle, Crown, ScrollText, Swords, TreePine, Wheat, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ImperialResources, ImperialState, ImperialTroops } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { collectCompletedActionsForDay, resolveSandboxDay } from "@/lib/sandbox-day-resolution";

type TimeOfDestinyPanelProps = {
  currentDay: number;
  villages: VillageSummary[];
  imperialState: ImperialState;
  activeAlerts: string[];
  showDayChangeModal?: boolean;
};

type AnimatedResources = ImperialResources;
type DestinyTab = "economia" | "batalhas" | "marcha" | "eventos";

type DayDeltaPopup = {
  direction: "advance" | "rewind";
  fromDay: number;
  toDay: number;
  changes: Array<{ label: string; delta: number }>;
  notes: string[];
};

function compactAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
}

function snapshotResources(state: ImperialState): ImperialResources {
  return state.resources;
}

function getSnapshotResourcesForDay(state: ImperialState, day: number): ImperialResources | null {
  if (day === state.sandboxLastSyncedDay) {
    return snapshotResources(state);
  }
  return state.sandboxSnapshots[String(day)]?.resources ?? null;
}

function resourceCaps(villages: VillageSummary[]): ImperialResources {
  return villages.reduce(
    (acc, village) => {
      const levels = village.buildingLevels;
      acc.materials += 5000 + (levels.mines ?? 0) * 900 + (levels.palace ?? 0) * 140;
      acc.supplies += 4400 + (levels.farms ?? 0) * 860 + (levels.housing ?? 0) * 120;
      acc.energy += 3600 + (levels.research ?? 0) * 820 + (levels.senate ?? 0) * 120;
      acc.influence += 900 + (levels.palace ?? 0) * 110 + (levels.senate ?? 0) * 160 + (levels.wonder ?? 0) * 260;
      return acc;
    },
    { materials: 0, supplies: 0, energy: 0, influence: 0 },
  );
}

function totalTroops(troops: ImperialTroops): number {
  return troops.militia + troops.shooters + troops.scouts + troops.machinery;
}

function buildDayDelta(state: ImperialState, previousDay: number, currentDay: number): DayDeltaPopup | null {
  const from = getSnapshotResourcesForDay(state, previousDay);
  const to = getSnapshotResourcesForDay(state, currentDay);
  if (!from || !to || previousDay === currentDay) {
    return null;
  }

  const resolutionDay = currentDay > previousDay ? currentDay : previousDay;
  const actions = collectCompletedActionsForDay(state.sandboxCompletedActionIds, resolutionDay);
  const resolution = resolveSandboxDay(resolutionDay, actions);

  return {
    direction: currentDay > previousDay ? "advance" : "rewind",
    fromDay: previousDay,
    toDay: currentDay,
    changes: [
      { label: "Materiais", delta: to.materials - from.materials },
      { label: "Suprimentos", delta: to.supplies - from.supplies },
      { label: "Energia", delta: to.energy - from.energy },
      { label: "Influência", delta: to.influence - from.influence },
    ].filter((entry) => entry.delta !== 0),
    notes: resolution.notes,
  };
}

function crisisLevel(activeAlerts: string[], state: ImperialState): "low" | "medium" | "high" {
  if (state.sandboxMarchStarted || activeAlerts.some((entry) => /horda|portal|corte|crit/i.test(entry))) {
    return "high";
  }
  if (activeAlerts.length >= 2 || state.sandboxQuestsCompleted < 1) {
    return "medium";
  }
  return "low";
}

export function TimeOfDestinyPanel({
  currentDay,
  villages,
  imperialState,
  activeAlerts,
  showDayChangeModal = false,
}: TimeOfDestinyPanelProps) {
  const [animated, setAnimated] = useState<AnimatedResources>(imperialState.resources);
  const [popup, setPopup] = useState<DayDeltaPopup | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [tab, setTab] = useState<DestinyTab>("economia");
  const previousDayRef = useRef(currentDay);
  const caps = useMemo(() => resourceCaps(villages), [villages]);
  const danger = crisisLevel(activeAlerts, imperialState);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulseTick((current) => current + 1);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const start = animated;
    const target = imperialState.resources;
    const startedAt = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 650);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimated({
        materials: start.materials + (target.materials - start.materials) * ease,
        supplies: start.supplies + (target.supplies - start.supplies) * ease,
        energy: start.energy + (target.energy - start.energy) * ease,
        influence: start.influence + (target.influence - start.influence) * ease,
      });
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [imperialState.resources]);

  useEffect(() => {
    if (!showDayChangeModal) return;
    if (imperialState.sandboxLastSyncedDay !== currentDay) return;
    const previousDay = previousDayRef.current;
    if (previousDay !== currentDay) {
      const nextPopup = buildDayDelta(imperialState, previousDay, currentDay);
      if (nextPopup) setPopup(nextPopup);
      previousDayRef.current = currentDay;
    }
  }, [currentDay, imperialState, showDayChangeModal]);

  useEffect(() => {
    if (!showDayChangeModal) return;
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 3600);
    return () => window.clearTimeout(timer);
  }, [popup, showDayChangeModal]);

  const pulseResources = useMemo(() => {
    const wave = (base: number, factor: number) => Math.max(0, base + Math.round(Math.sin(pulseTick * factor) * Math.max(3, base * 0.0025)));
    return {
      materials: wave(animated.materials, 0.9),
      supplies: wave(animated.supplies, 1.1),
      energy: wave(animated.energy, 1.35),
      influence: wave(animated.influence, 1.55),
    };
  }, [animated.energy, animated.influence, animated.materials, animated.supplies, pulseTick]);

  const troopCount = totalTroops(imperialState.troops);
  const marchRead = imperialState.sandboxMarchStarted ? "Marcha final em curso." : "Marcha final ainda não iniciada.";
  const bars = [
    { label: "Materiais", value: pulseResources.materials, max: Math.max(1, caps.materials), color: "kw-progress__bar--green", icon: <TreePine className="h-3.5 w-3.5 text-emerald-200" /> },
    { label: "Suprimentos", value: pulseResources.supplies, max: Math.max(1, caps.supplies), color: "kw-progress__bar--green", icon: <Wheat className="h-3.5 w-3.5 text-amber-200" /> },
    { label: "Energia", value: pulseResources.energy, max: Math.max(1, caps.energy), color: "kw-progress__bar--blue", icon: <Zap className="h-3.5 w-3.5 text-sky-200" /> },
    { label: "Influência", value: pulseResources.influence, max: Math.max(1, caps.influence), color: "kw-progress__bar--red", icon: <Crown className="h-3.5 w-3.5 text-cyan-200" /> },
  ];
  const destinyEvents = [
    `Dia ${currentDay}: ${imperialState.logs[0] ?? "O império segue em movimento."}`,
    ...activeAlerts,
    `Tropas totais: ${troopCount.toLocaleString("pt-BR")}`,
    `Quests: ${imperialState.sandboxQuestsCompleted}/3 | Maravilhas: ${imperialState.sandboxWondersBuilt}/5`,
    marchRead,
  ].slice(0, 6);

  return (
    <>
      <section
        className={`mb-3 rounded-[28px] border p-3 shadow-[0_26px_60px_rgba(15,23,42,0.42)] transition-all ${
          danger === "high"
            ? "border-rose-300/25 bg-[linear-gradient(145deg,rgba(88,28,39,0.92),rgba(15,23,42,0.94))]"
            : danger === "medium"
              ? "border-amber-300/20 bg-[linear-gradient(145deg,rgba(90,57,18,0.88),rgba(15,23,42,0.92))]"
              : "border-white/15 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(30,41,59,0.82))]"
        }`}
        style={{
          boxShadow:
            danger === "high"
              ? `0 0 ${24 + (pulseTick % 2) * 12}px rgba(251,113,133,0.18), 0 26px 60px rgba(15,23,42,0.42)`
              : danger === "medium"
                ? `0 0 ${16 + (pulseTick % 2) * 8}px rgba(251,191,36,0.14), 0 26px 60px rgba(15,23,42,0.42)`
                : "0 26px 60px rgba(15,23,42,0.42)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">O Tempo Do Destino</p>
            <h2 className="text-base font-bold text-slate-50">Painel vivo do destino do império</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              O painel pulsa a cada 10 segundos para manter a sensação de mundo vivo e pressão constante.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-right text-[10px] font-semibold text-cyan-100">
            Dia {currentDay}
            <br />
            {danger === "high" ? "crise alta" : danger === "medium" ? "pressão média" : "ritmo estável"}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 text-[10px] font-semibold">
          {([
            { id: "economia", label: "Economia", icon: <CoinsProxy /> },
            { id: "batalhas", label: "Batalhas", icon: <Swords className="h-3.5 w-3.5" /> },
            { id: "marcha", label: "Marcha", icon: <Castle className="h-3.5 w-3.5" /> },
            { id: "eventos", label: "Eventos", icon: <ScrollText className="h-3.5 w-3.5" /> },
          ] as const).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`rounded-xl border px-2 py-2 transition ${
                tab === entry.id
                  ? "border-cyan-300/55 bg-cyan-500/18 text-cyan-100"
                  : "border-white/15 bg-white/6 text-slate-300"
              }`}
            >
              <span className="mb-1 flex justify-center">{entry.icon}</span>
              {entry.label}
            </button>
          ))}
        </div>

        {tab === "economia" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {bars.map((bar) => {
              const pct = Math.max(0, Math.min(100, (bar.value / bar.max) * 100));
              return (
                <div key={bar.label} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
                    {bar.icon}
                    {bar.label}
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-50">{compactAmount(bar.value)}</p>
                  <p className={`text-[10px] ${pct >= 75 ? "text-emerald-300" : pct <= 25 ? "text-rose-300" : "text-slate-400"}`}>
                    {pct.toFixed(0)}% do ritmo atual
                  </p>
                  <div className="kw-progress">
                    <div className={`kw-progress__bar ${bar.color}`} style={{ width: `${pct}%`, transition: "width 700ms ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === "batalhas" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Swords className="h-3.5 w-3.5 text-rose-200" />
                Frente militar
              </div>
              <p className="mt-1 text-sm font-bold text-slate-50">{troopCount.toLocaleString("pt-BR")} tropas vivas</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {danger === "high" ? "Fronteira aquecida. O reino sente pressão real." : "Sem colapso militar imediato, mas a prontidão precisa continuar."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                Nível de risco
              </div>
              <p className="mt-1 text-sm font-bold text-slate-50">
                {danger === "high" ? "Choque iminente" : danger === "medium" ? "Atenção contínua" : "Controle parcial"}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                Alertas ativos: {activeAlerts.length}. O pulso do painel reage à gravidade do momento.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "marcha" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Castle className="h-3.5 w-3.5 text-amber-200" />
                Estado da marcha
              </div>
              <p className="mt-1 text-sm font-bold text-slate-50">{marchRead}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {imperialState.sandboxDomeActive ? "Domo da Tribo ativado." : "Domo da Tribo ainda não ativado."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Crown className="h-3.5 w-3.5 text-cyan-200" />
                Preparação final
              </div>
              <p className="mt-1 text-sm font-bold text-slate-50">
                {imperialState.sandboxQuestsCompleted}/3 quests | {imperialState.sandboxWondersBuilt}/5 maravilhas
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                O destino final depende de score vivo, não só de progresso histórico.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "eventos" ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <ScrollText className="h-3.5 w-3.5 text-sky-200" />
              Linha do destino
            </div>
            <div className="mt-2 space-y-1.5">
              {destinyEvents.map((event) => (
                <p key={event} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                  {event}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {showDayChangeModal && popup ? (
        <div className="fixed inset-0 z-[88]">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <div className="absolute inset-x-3 top-1/2 mx-auto max-w-md -translate-y-1/2">
            <div
              className={`rounded-[28px] border p-4 shadow-[0_28px_60px_rgba(15,23,42,0.55)] backdrop-blur-xl ${
                popup.direction === "advance"
                  ? "border-emerald-300/25 bg-[linear-gradient(145deg,rgba(6,78,59,0.9),rgba(15,23,42,0.92))]"
                  : "border-amber-300/25 bg-[linear-gradient(145deg,rgba(120,53,15,0.88),rgba(15,23,42,0.92))]"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {popup.direction === "advance" ? "O destino avançou" : "O destino recuou"}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-50">D{popup.fromDay} {"->"} D{popup.toDay}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-200">
                {popup.direction === "advance"
                  ? "Estas foram as mudanças reais causadas pela passagem do dia."
                  : "Estas foram as perdas ou reversões ao voltar para o dia anterior."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {popup.changes.length ? popup.changes.map((change) => (
                  <div key={change.label} className="rounded-2xl border border-white/10 bg-white/6 px-2 py-2 text-[11px]">
                    <p className="font-semibold text-slate-100">{change.label}</p>
                    <p className={`mt-1 text-base font-bold ${change.delta >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {change.delta >= 0 ? "+" : ""}{compactAmount(change.delta)}
                    </p>
                  </div>
                )) : (
                  <p className="text-[11px] text-slate-200">Sem variação material registrada entre esses dias.</p>
                )}
              </div>
              {popup.notes.length ? (
                <div className="mt-3 space-y-1.5">
                  {popup.notes.slice(0, 3).map((note) => (
                    <p key={note} className="rounded-xl border border-white/10 bg-white/6 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CoinsProxy() {
  return <TreePine className="h-3.5 w-3.5" />;
}
