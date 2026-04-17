"use client";

import { useEffect, useRef, useState } from "react";

import type { ImperialResources, ImperialState } from "@/lib/imperial-state";

type SandboxDayDeltaModalProps = {
  currentDay: number;
  imperialState: ImperialState;
};

type DayDeltaPopup = {
  direction: "advance" | "rewind";
  fromDay: number;
  toDay: number;
  changes: Array<{ label: string; delta: number }>;
};

function compactAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
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

function buildDayDelta(state: ImperialState, previousDay: number, currentDay: number): DayDeltaPopup | null {
  const from = getSnapshotResourcesForDay(state, previousDay);
  const to = getSnapshotResourcesForDay(state, currentDay);
  if (!from || !to || previousDay === currentDay) {
    return null;
  }

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
  };
}

export function SandboxDayDeltaModal({ currentDay, imperialState }: SandboxDayDeltaModalProps) {
  const [popup, setPopup] = useState<DayDeltaPopup | null>(null);
  const previousDayRef = useRef(currentDay);

  useEffect(() => {
    if (imperialState.sandboxLastSyncedDay !== currentDay) return;
    const previousDay = previousDayRef.current;
    if (previousDay !== currentDay) {
      const nextPopup = buildDayDelta(imperialState, previousDay, currentDay);
      if (nextPopup) setPopup(nextPopup);
      previousDayRef.current = currentDay;
    }
  }, [currentDay, imperialState]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 3600);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!popup) {
    return null;
  }

  return (
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
            {popup.changes.length ? (
              popup.changes.map((change) => (
                <div key={change.label} className="rounded-2xl border border-white/10 bg-white/6 px-2 py-2 text-[11px]">
                  <p className="font-semibold text-slate-100">{change.label}</p>
                  <p className={`mt-1 text-base font-bold ${change.delta >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {change.delta >= 0 ? "+" : ""}
                    {compactAmount(change.delta)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-200">Sem variação material registrada entre esses dias.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
