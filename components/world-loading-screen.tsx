"use client";

import { useEffect, useMemo, useState } from "react";

const LOADING_LINES = [
  "Abrindo os portoes da campanha...",
  "Carregando Imperio, Cidades e Intel...",
  "Preparando a entrada no reino...",
  "Sincronizando Coroa e Supabase...",
  "Preparando acoes do dia...",
  "Organizando relatorios e eventos...",
  "Quase pronto para jogar.",
];

function loadingPhase(progress: number) {
  if (progress < 25) return "Fase 1/4 - Entrada";
  if (progress < 50) return "Fase 2/4 - Rotas";
  if (progress < 75) return "Fase 3/4 - Dados";
  if (progress < 100) return "Fase 4/4 - Finalizando";
  return "Pronto";
}

export function WorldLoadingScreen({ progress }: { progress?: number }) {
  const [localProgress, setLocalProgress] = useState(8);
  const [lineIndex, setLineIndex] = useState(0);
  const visibleProgress = Math.max(0, Math.min(100, Math.round(progress ?? localProgress)));

  useEffect(() => {
    if (progress !== undefined) {
      return;
    }

    const progressTimer = window.setInterval(() => {
      setLocalProgress((current) => {
        if (current >= 94) {
          return current;
        }
        return Math.min(94, current + Math.max(1, Math.round((96 - current) / 9)));
      });
    }, 260);

    return () => window.clearInterval(progressTimer);
  }, [progress]);

  useEffect(() => {
    const lineTimer = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 520);

    return () => window.clearInterval(lineTimer);
  }, []);

  const activeLine = useMemo(() => LOADING_LINES[lineIndex], [lineIndex]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950 px-5 pb-[calc(env(safe-area-inset-bottom)+26px)] text-center"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.30) 36%, rgba(2,6,23,0.94)), url('/world/lobby2.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(251,191,36,0.18),transparent_30%),radial-gradient(circle_at_50%_72%,rgba(34,211,238,0.13),transparent_36%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-100/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.82)]">
            KingsWorld
          </p>
          <h2 className="mt-2 text-4xl font-black leading-none text-slate-50 drop-shadow-[0_6px_20px_rgba(0,0,0,0.82)]">
            Carregando mundo
          </h2>
          <p className="mx-auto mt-3 max-w-[18rem] text-[12px] font-semibold leading-5 text-slate-200/95 drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            {activeLine}
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-100/24 bg-slate-950/62 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.72)] backdrop-blur-md">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
            <span>{loadingPhase(visibleProgress)}</span>
            <span>{visibleProgress}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full border border-amber-100/25 bg-black/35 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-950 via-amber-300 to-yellow-100 shadow-[0_0_22px_rgba(251,191,36,0.65)] transition-[width] duration-300 ease-out"
              style={{ width: `${visibleProgress}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {["nav-empire", "nav-cities", "nav-intel", "nav-world", "nav-profile"].map((icon) => (
              <span key={icon} className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <img src={`/icons/${icon}.png`} alt="" className="h-9 w-9 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.65)]" />
              </span>
            ))}
          </div>
          <p className="mt-3 text-[10px] font-semibold text-slate-300/90">
            Entrando assim que os dados essenciais do mundo responderem.
          </p>
        </div>
      </div>
    </div>
  );
}
