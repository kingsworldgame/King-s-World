"use client";

import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Compass, Map, Target } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";
import type { SandboxStrategyPlaybook } from "@/lib/sandbox-playbooks";

type RouteTab = "base" | "board" | "operations" | "empire";

type GuideAction = {
  screen: string;
  action: string;
  routeTab: RouteTab;
  query?: Record<string, string>;
};

function buildGuideAction(day: number, milestone: string): GuideAction {
  if (/Fazendas -> Nv 2 \+ Minas -> Nv 2/i.test(milestone)) {
    return {
      screen: "Base > Cidade (Capital)",
      action: "Clique em `Fazendas` > `Iniciar upgrade para Nv 2`, depois `Minas` > `Iniciar upgrade para Nv 2`.",
      routeTab: "base",
      query: { b: "farms", sb: "city" },
    };
  }

  if (/Palacio -> Nv 2 \+ Senado -> Nv 2/i.test(milestone)) {
    return {
      screen: "Base > Cidade (Capital)",
      action: "Clique em `Palacio` > `Iniciar upgrade para Nv 2`, depois `Senado` > `Iniciar upgrade para Nv 2`.",
      routeTab: "base",
      query: { b: "palace", sb: "city" },
    };
  }

  if (/Fazendas -> Nv 3 \+ Minas -> Nv 3/i.test(milestone)) {
    return {
      screen: "Base > Cidade (Capital)",
      action: "Clique em `Fazendas` > `Iniciar upgrade para Nv 3`, depois `Minas` > `Iniciar upgrade para Nv 3`.",
      routeTab: "base",
      query: { b: "farms", sb: "city" },
    };
  }

  if (/Palacio -> Nv 3 \+ Senado -> Nv 3/i.test(milestone)) {
    return {
      screen: "Base > Cidade (Capital)",
      action: "Clique em `Palacio` > `Iniciar upgrade para Nv 3`, depois `Senado` > `Iniciar upgrade para Nv 3`.",
      routeTab: "base",
      query: { b: "palace", sb: "city" },
    };
  }

  if (/Conquistou\/Fundou a 2a aldeia/i.test(milestone)) {
    return {
      screen: "Mapa",
      action: "Selecione um hex conectado e seguro > `Entreposto` > `Confirmar`.",
      routeTab: "board",
    };
  }

  if (/Quest/i.test(milestone)) {
    return {
      screen: "Imperio + Operacoes",
      action: "Abra os pilares do reino, confirme a quest da era e feche o dia sem atrasar o proximo marco.",
      routeTab: "empire",
    };
  }

  if (/Contratou Engenheiro/i.test(milestone)) {
    return {
      screen: "Base > Comando",
      action: "Abra `Slot de Heroi (max 1)` e selecione `Engenheiro` para a cidade foco.",
      routeTab: "base",
      query: { sb: "command" },
    };
  }

  if (/Contratou Erudito/i.test(milestone)) {
    return {
      screen: "Base > Comando",
      action: "Abra `Slot de Heroi (max 1)` e selecione `Erudito` para a cidade foco.",
      routeTab: "base",
      query: { sb: "command" },
    };
  }

  if (/Contratou Intendente/i.test(milestone)) {
    return {
      screen: "Base > Comando",
      action: "Abra `Slot de Heroi (max 1)` e selecione `Intendente` para a cidade de fluxo.",
      routeTab: "base",
      query: { sb: "command" },
    };
  }

  if (/Contratou Navegador/i.test(milestone)) {
    return {
      screen: "Base > Comando",
      action: "Abra `Slot de Heroi (max 1)` e selecione `Navegador` para preparar a reta final.",
      routeTab: "base",
      query: { sb: "command" },
    };
  }

  if (/Primeira aldeia atingiu 100\/100/i.test(milestone)) {
    return {
      screen: "Base > Cidade (aldeia foco)",
      action: "Feche a aldeia foco, abra `Maravilha` e garanta o fechamento estrutural da cidade 100/100.",
      routeTab: "base",
      query: { b: "wonder", sb: "city" },
    };
  }

  if (/Maravilha/i.test(milestone)) {
    return {
      screen: "Imperio > Maravilhas",
      action: "Confira o pilar `Maravilhas` e volte para a cidade foco se ainda faltar fechar a capstone local.",
      routeTab: "empire",
    };
  }

  if (/Domo da Tribo/i.test(milestone)) {
    return {
      screen: "Operacoes",
      action: "No card `Domo da Tribo`, clique em `Enviar`.",
      routeTab: "operations",
    };
  }

  if (/Agrupamento liberado na Capital/i.test(milestone)) {
    return {
      screen: "Mapa",
      action: "Abra o mapa e clique em `Reagrupar Imperio` assim que entrar na Fase 4.",
      routeTab: "board",
    };
  }

  if (/Iniciou marcha ao Portal/i.test(milestone)) {
    return {
      screen: "Mapa",
      action: "Selecione o Centro (0,0) > `Marchar ao Portal` > ajuste a composicao > `Confirmar`.",
      routeTab: "board",
    };
  }

  if (day <= 9) {
    return {
      screen: "Base > Comando + Base > Cidade",
      action: "Recrute leve na Capital e preserve recursos para a 2a aldeia.",
      routeTab: "base",
      query: { sb: "command" },
    };
  }

  if (day <= 35) {
    return {
      screen: "Base > Cidade (aldeia foco)",
      action: "Empurre o predio-base mais atrasado da aldeia foco e mantenha a Capital funcional.",
      routeTab: "base",
      query: { sb: "city" },
    };
  }

  if (day <= 60) {
    return {
      screen: "Imperio + Base > Cidade",
      action: "Feche score estrutural, expanda sem quebrar o core e mantenha a cidade foco na frente.",
      routeTab: "empire",
    };
  }

  if (day <= 90) {
    return {
      screen: "Imperio + Base > Comando",
      action: "Ajuste herois, quests e pilares. Nao desperdice obra em periferia fraca.",
      routeTab: "empire",
    };
  }

  return {
    screen: "Mapa + Imperio",
    action: "Reagrupe, preserve score vivo e marche no timing certo para o Portal.",
    routeTab: "board",
    query: {},
  };
}

export function CampaignGuidePage({
  worldId,
  playbook,
  defaultVillageId,
}: {
  worldId: string;
  playbook: SandboxStrategyPlaybook;
  defaultVillageId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { world, setManualDay, advanceDay, rewindDay } = useLiveWorld(worldId);

  const currentPlan =
    playbook.days.find((entry) => entry.day === Math.max(1, world.day || 1)) ??
    playbook.days[0];

  const quickDays = useMemo(
    () => [1, playbook.secondVillageDay, playbook.firstHundredDay, 45, 90, 116],
    [playbook.firstHundredDay, playbook.secondVillageDay],
  );

  const openRouteForDay = (day: number) => {
    const plan = playbook.days.find((entry) => entry.day === day) ?? currentPlan;
    const next = buildGuideAction(day, plan.milestone);
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", searchParams.get("v") ?? defaultVillageId);
    Object.entries(next.query ?? {}).forEach(([key, value]) => params.set(key, value));
    emitUiFeedback("route", "medium");
    router.push(`/world/${worldId}/${next.routeTab}?${params.toString()}`);
  };

  return (
    <section className="space-y-3">
      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Guia da campanha</p>
            <h1 className="text-lg font-bold text-slate-50">Rota vitoriosa: {playbook.meta.label}</h1>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              2a aldeia perto do D{playbook.secondVillageDay}, primeira cidade 100/100 no D{playbook.firstHundredDay} e reta final preparada para o Portal.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-300/35 bg-sky-500/14 px-2 py-1 text-right text-[10px] font-semibold text-sky-100">
            Dia {world.day}
            <br />
            {world.phase}
          </div>
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
            <ChevronLeft className="mr-1 inline h-3.5 w-3.5" />
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
            <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
          </button>
          {quickDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                emitUiFeedback("tap", "light");
                setManualDay(day);
              }}
              className="rounded-full border border-white/20 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100"
            >
              D{day}
            </button>
          ))}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Checklist do dia</p>
            <h2 className="text-base font-bold text-slate-50">Dia {currentPlan.day}</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">{buildGuideAction(currentPlan.day, currentPlan.milestone).screen}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100">
            {currentPlan.villages} aldeias
          </span>
        </div>

        <div className="mt-3 space-y-2 text-[11px]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Clique exato</p>
            <p className="mt-1 leading-5">{buildGuideAction(currentPlan.day, currentPlan.milestone).action}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
            <p className="font-semibold text-slate-100">Marco do dia</p>
            <p className="mt-1 leading-5">{currentPlan.milestone}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
              <p className="font-semibold text-slate-100">Prioridade 1</p>
              <p className="mt-1 leading-5">{currentPlan.priorities[0] ?? currentPlan.actions[0]}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
              <p className="font-semibold text-slate-100">Fechar o dia</p>
              <p className="mt-1 leading-5">Quando terminar, clique em `Proximo dia`.</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openRouteForDay(currentPlan.day)}
            className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/35 bg-cyan-500/14 px-2.5 py-2 text-[11px] font-bold text-cyan-100"
          >
            <Compass className="h-3.5 w-3.5" />
            Abrir tela certa
          </button>
          <button
            type="button"
            onClick={() => {
              emitUiFeedback("tap", "light");
              setManualDay(currentPlan.day);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/8 px-2.5 py-2 text-[11px] font-bold text-slate-100"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Ir para este dia
          </button>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-sky-300" />
          <h2 className="text-base font-bold text-slate-50">Linha do tempo completa</h2>
        </div>

        <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {playbook.days.map((day) => {
            const action = buildGuideAction(day.day, day.milestone);
            const active = day.day === currentPlan.day;

            return (
              <div
                key={day.day}
                className={`rounded-2xl border px-3 py-2 ${active ? "border-sky-300/45 bg-sky-500/14" : "border-white/10 bg-white/5"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-50">
                      Dia {day.day} <span className="text-slate-400">| {day.villages} aldeias</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{action.screen}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-200">{action.action}</p>
                    <p className="mt-1 text-[10px] text-amber-100">Marco: {day.milestone}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100">
                    {day.margin >= 0 ? `+${day.margin}` : `${day.margin}`}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      emitUiFeedback("tap", "light");
                      setManualDay(day.day);
                    }}
                    className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-100"
                  >
                    Ir para D{day.day}
                  </button>
                  <button
                    type="button"
                    onClick={() => openRouteForDay(day.day)}
                    className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2 py-1 text-[10px] font-semibold text-cyan-100"
                  >
                    Abrir tela
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3 text-[11px] text-slate-200">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-300" />
          <h2 className="text-base font-bold text-slate-50">Marcos que nao podem falhar</h2>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D{playbook.secondVillageDay}: 2a aldeia</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D{playbook.firstHundredDay}: 1a cidade 100/100</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D45: base madura</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D90: score e reagrupar prontos</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D91+: Domo e reagrupar</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">D116+: marcha ao Portal</div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2">
          <p className="font-semibold text-slate-100">Leitura honesta</p>
          <p className="mt-1 leading-5">
            Onde o simulador descreve uma acao macro que ainda nao existe como botao unico, este guia traduz para a tela real mais proxima do build atual.
          </p>
        </div>

        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
          <Map className="h-3.5 w-3.5" />
          Meta final: Portal com score vivo, nao so historico bonito.
        </div>
      </article>
    </section>
  );
}
