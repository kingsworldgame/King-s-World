"use client";

import { ChevronDown, Crown, TreePine, Wheat, Zap } from "lucide-react";
import type { ChangeEvent } from "react";

type Village = {
  id: string;
  name: string;
};

type Resources = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
};

function compactAmount(value: number): string {
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(value >= 100_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}k`;
  }
  return `${value}`;
}

export function Header({
  selectedVillageId,
  villages,
  resources,
  worldDay,
  worldPhase,
  realTimeEnabled,
  worldStarted,
  onVillageChange,
}: {
  selectedVillageId: string;
  villages: Village[];
  resources: Resources;
  worldDay: number;
  worldPhase: string;
  realTimeEnabled: boolean;
  worldStarted: boolean;
  onVillageChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+4px)]">
      <div className="mx-auto w-full max-w-md rounded-[24px] border border-white/30 bg-white/12 p-2.5 shadow-[0_22px_46px_rgba(2,6,23,0.5)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-gradient-to-b from-sky-400 to-blue-600 text-white shadow-lg">
              <Crown className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-slate-100">Rei Arquiteto</p>
              <span className="mt-0.5 inline-flex rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                Nivel 15
              </span>
            </div>
          </div>

          <label className="relative block w-[46%] rounded-2xl border border-white/25 bg-white/10 p-1 shadow-lg backdrop-blur-xl">
            <span className="sr-only">Selecionar cidade principal</span>
            <select
              value={selectedVillageId}
              onChange={onVillageChange}
              className="w-full appearance-none rounded-xl border border-white/25 bg-white/15 px-3 py-2 pr-9 text-sm font-semibold text-slate-100 outline-none ring-sky-200/30 transition focus:ring-4"
            >
              {villages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          </label>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <TreePine className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold text-slate-100">{compactAmount(resources.materials)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <Wheat className="h-3.5 w-3.5 text-amber-200" />
            <span className="text-[11px] font-bold text-slate-100">{compactAmount(resources.supplies)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <Zap className="h-3.5 w-3.5 text-yellow-300" />
            <span className="text-[11px] font-bold text-slate-100">{compactAmount(resources.energy)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <Crown className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[11px] font-bold text-slate-100">{compactAmount(resources.influence)}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 shadow-lg backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mundo</p>
              <p className="truncate text-[11px] font-bold text-slate-100">Dia {worldDay} · {worldPhase}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${realTimeEnabled ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-100" : "border-white/20 bg-white/10 text-slate-200"}`}>
              {worldStarted ? (realTimeEnabled ? "Tempo real ON" : "Tempo real OFF") : "Pausado"}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-2 py-1.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Modo</p>
            <p className="text-[11px] font-bold text-emerald-50">{realTimeEnabled ? "Tempo real jogavel" : "Tempo fixo"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
