"use client";

import {
  BookOpen,
  CalendarDays,
  CircleDot,
  Compass,
  Crown,
  Lightbulb,
  Map,
  MousePointerClick,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { calculateVillageDevelopment, type EvolutionMode } from "@/core/GameBalance";
import type { CityClass } from "@/lib/cities";
import type { ImperialState } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { emitUiFeedback } from "@/lib/ui-feedback";

type WorldTab = "empire" | "operations" | "base" | "board" | "intelligence" | "guide";
type CoachBuildId = "balanced" | "metropole" | "posto_avancado" | "bastiao" | "celeiro";
type CoachWindowId = "opening" | "expand" | "convert" | "scale" | "exodus";

type CoachBuildMeta = {
  label: string;
  identity: string;
  opening: string;
  secondVillageTarget: number;
  firstHundredTarget: number;
  day90Goal: string;
  heroFocus: string[];
};

type CoachGuide = {
  build: CoachBuildMeta;
  buildId: CoachBuildId;
  windowId: CoachWindowId;
  windowLabel: string;
  focus: string;
  summary: string;
  nextAction: string;
  actions: string[];
  checkpoints: string[];
  warnings: string[];
  recommendedTab: WorldTab;
  beginnerTitle: string;
  beginnerSteps: string[];
};

type SandboxCoachCta = {
  label: string;
  detail: string;
  tab: WorldTab;
  query: Record<string, string>;
};

const BUILD_META: Record<CoachBuildId, CoachBuildMeta> = {
  balanced: {
    label: "Balanceado",
    identity: "Segura a economia cedo, expande sem exagero e fecha score antes do Exodo.",
    opening: "Minas 3 + Fazendas 3 + dois predios de identidade sem espalhar nivel.",
    secondVillageTarget: 15,
    firstHundredTarget: 45,
    day90Goal: "1800+ de influencia pronta para a Fase 4.",
    heroFocus: ["1 heroi util ate D20-D30", "Engenheiro", "Navegador se o spawn for longe"],
  },
  metropole: {
    label: "Metropole",
    identity: "Converte Capital forte em vila 100, conselho e Maravilhas cedo.",
    opening: "Minas 3 + Fazendas 3 + Palacio 3 + Senado 3.",
    secondVillageTarget: 11,
    firstHundredTarget: 39,
    day90Goal: "2200+ de influencia com quests e Maravilhas bem encaixadas.",
    heroFocus: ["Engenheiro", "Erudito", "Intendente", "Marechal", "Navegador"],
  },
  posto_avancado: {
    label: "Posto Avancado",
    identity: "Transforma combate e pressao de mapa em expansao e score real.",
    opening: "Minas 3 + Fazendas 3 + Quartel 3 + Arsenal 3.",
    secondVillageTarget: 14,
    firstHundredTarget: 38,
    day90Goal: "2100+ de influencia com militar forte e quests em dia.",
    heroFocus: ["Marechal cedo", "Engenheiro", "Navegador", "Intendente"],
  },
  bastiao: {
    label: "Bastiao",
    identity: "Defende bem no mid game sem perder a janela de logistica final.",
    opening: "Minas 3 + Fazendas 3 + Habitacoes 3 + Muralha 3.",
    secondVillageTarget: 16,
    firstHundredTarget: 46,
    day90Goal: "1900+ de influencia com defesa viva e ETA viavel.",
    heroFocus: ["Engenheiro", "Navegador", "herois de sustentacao"],
  },
  celeiro: {
    label: "Celeiro",
    identity: "Acelera fluxo interno e converte economia em vila 100, quests e ETA.",
    opening: "Fazendas 3 + Habitacoes 3 + Minas 3.",
    secondVillageTarget: 9,
    firstHundredTarget: 37,
    day90Goal: "1789+ de influencia com Flow e logistica fechados.",
    heroFocus: ["Intendente cedo", "Engenheiro", "Erudito", "Navegador"],
  },
};

function resolveBuild(mode: EvolutionMode | undefined, cityClass: CityClass | undefined): CoachBuildId {
  if (cityClass === "metropole") return "metropole";
  if (cityClass === "posto_avancado") return "posto_avancado";
  if (cityClass === "bastiao") return "bastiao";
  if (cityClass === "celeiro") return "celeiro";
  if (mode === "metropole") return "metropole";
  if (mode === "vanguard") return "posto_avancado";
  if (mode === "bastion") return "bastiao";
  if (mode === "flow") return "celeiro";
  return "balanced";
}

function formatCampaignDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildGuide(
  buildId: CoachBuildId,
  currentDay: number,
  stats: {
    villageCount: number;
    highestDevelopment: number;
    heroCount: number;
    wonders: number;
    quests: number;
  },
): CoachGuide {
  const build = BUILD_META[buildId];
  const warnings: string[] = [];

  if (currentDay > build.secondVillageTarget && stats.villageCount < 2) {
    warnings.push(`Sua 2a aldeia esta atrasada para a rota ${build.label}. Meta ideal: ate D${build.secondVillageTarget}.`);
  }
  if (currentDay > build.firstHundredTarget && stats.highestDevelopment < 100) {
    warnings.push(`A primeira aldeia 100/100 ainda nao fechou. A rota ${build.label} queria isso perto de D${build.firstHundredTarget}.`);
  }
  if (currentDay >= 61 && stats.heroCount <= 1) {
    warnings.push("Seu conselho parece raso para o mid/late game. O blueprint forte entra na reta final com mais especialistas.");
  }
  if (currentDay >= 91 && stats.quests <= 1) {
    warnings.push("Voce chegou ao Exodo com poucas quests. Isso costuma travar o corte do Portal.");
  }
  if (currentDay >= 91 && stats.wonders === 0 && buildId !== "posto_avancado") {
    warnings.push("Seu teto de score esta curto sem Maravilhas nesta altura da campanha.");
  }

  if (currentDay <= 5) {
    return {
      build,
      buildId,
      windowId: "opening",
      windowLabel: "Janela D1-D5",
      focus: "Abrir a build sem desperdiÃ§ar recurso em 10 predios ao mesmo tempo.",
      summary: build.opening,
      nextAction: `Feche a abertura da ${build.label} e prepare a reserva para acelerar a 2a aldeia.`,
      actions: [
        "Rush de recursos ate Nv 3 para nao travar material e suprimento.",
        `Suba o eixo de identidade da build: ${build.opening}`,
        "Faca buscas/coletas cedo para criar folga antes da primeira expansao.",
      ],
      checkpoints: [
        `Meta de 2a aldeia: ate D${build.secondVillageTarget}.`,
        "Nao espalhe upgrades em muitos predios pequenos.",
        "Comece a desenhar qual vila vai virar a primeira 100/100.",
      ],
      warnings,
      recommendedTab: "base",
      beginnerTitle: currentDay === 0 ? "Primeiros cliques do reino" : "Rotina da abertura",
      beginnerSteps: currentDay === 0
        ? [
            "Abra Base para melhorar a Capital e ver os predios que fazem o reino crescer.",
            "Abra Imperio para entender recursos, herois e a forca atual do seu reino.",
            "Abra Mapa quando quiser expandir, procurar oportunidades e planejar a proxima aldeia.",
          ]
        : [
            "Comece pela Base e execute a melhoria sugerida no centro da tela.",
            "Use o conselheiro para nao espalhar recurso em muitos predios ao mesmo tempo.",
            "Quando houver folga, visite o Mapa para preparar expansao e reconhecimento.",
          ],
    };
  }

  if (currentDay <= 15) {
    return {
      build,
      buildId,
      windowId: "expand",
      windowLabel: "Janela D6-D15",
      focus: "Expandir sem quebrar a economia inicial.",
      summary: "Agora o jogo quer 2a aldeia, exercito inicial e o primeiro heroi certo para a build.",
      nextAction: `Busque ou funda a 2a aldeia ate D${build.secondVillageTarget} enquanto forma o primeiro pacote de tropas.`,
      actions: [
        "Pare de abrir predios demais e concentre recurso na expansao.",
        "Monte o primeiro bloco de exercito na Capital.",
        `Priorize herois desta rota: ${build.heroFocus.slice(0, 2).join(" + ")}.`,
      ],
      checkpoints: [
        `2a aldeia no prazo ideal: D${build.secondVillageTarget}.`,
        "Primeira quest deve entrar na sua mira para o comeco do mid game.",
        "Mapa e logistica ja precisam entrar na rotina, nao so predio.",
      ],
      warnings,
      recommendedTab: "board",
      beginnerTitle: "Como jogar esta fase",
      beginnerSteps: [
        "Olhe a acao sugerida do conselheiro antes de gastar recurso.",
        "Abra o Mapa para buscar a 2a aldeia e enxergar espacos proximos.",
        "Volte para Base para converter recurso em crescimento real.",
      ],
    };
  }

  if (currentDay <= 45) {
    return {
      build,
      buildId,
      windowId: "convert",
      windowLabel: "Janela D16-D45",
      focus: "Parar de crescer largo e converter uma cidade em score real.",
      summary: "Este trecho decide se a run vira campanha forte ou economia bonita sem fechamento.",
      nextAction: `Escolha agora a vila 100/100 e empurre-a ate fechar perto de D${build.firstHundredTarget}.`,
      actions: [
        "Feche Quest 1 e tire proveito do primeiro pico de herois.",
        "Nao tente upar todas as aldeias igual; uma precisa virar referencia.",
        "Abra economia ou pressao militar conforme a identidade da build.",
      ],
      checkpoints: [
        `1a aldeia 100/100 ideal: perto de D${build.firstHundredTarget}.`,
        "3-4 aldeias bem nutridas normalmente valem mais que 6 aldeias moles.",
        "Se Engenheiro faz parte da rota, ele ja deve estar no radar.",
      ],
      warnings,
      recommendedTab: "empire",
      beginnerTitle: "Como ler o jogo daqui em diante",
      beginnerSteps: [
        "Escolha uma aldeia principal e clique nela com frequencia.",
        "Priorize score real em vez de subir tudo um pouco.",
        "Abra Imperio para checar se a estrutura esta virando poder de verdade.",
      ],
    };
  }

  if (currentDay <= 90) {
    return {
      build,
      buildId,
      windowId: "scale",
      windowLabel: "Janela D46-D90",
      focus: "Escalar pilares de score sem perder timing de ETA.",
      summary: "Seu reino precisa virar um imperio completo: aldeias, quests, conselho, militar e Maravilhas/logistica.",
      nextAction: "Feche as lacunas do seu pilar principal e nao deixe ETA/logistica para a ultima hora.",
      actions: [
        "Leve o imperio para 7-10 aldeias com qualidade, nao so quantidade.",
        "Feche Quest 2 e Quest 3 e traga o conselho para perto do pacote ideal.",
        `Seu alvo de D90 para esta build: ${build.day90Goal}`,
      ],
      checkpoints: [
        "Navegador deixa de ser opcional quando o spawn e longe.",
        "Engenheiro quase sempre vira teto alto de score.",
        "Uma run boa entra no Dia 90 sabendo como vai chegar ao Centro.",
      ],
      warnings,
      recommendedTab: "operations",
      beginnerTitle: "Como manter o reino jogavel",
      beginnerSteps: [
        "Abra Operacoes para coordenar tropas, herois e ritmo de expansao.",
        "Cheque Base quando precisar transformar sobra de recurso em eficiencia.",
        "Use o Mapa para validar distancias, fronteiras e alvos antes de agir.",
      ],
    };
  }

  return {
    build,
    buildId,
    windowId: "exodus",
    windowLabel: "Janela D91-D120",
    focus: "Agrupar, proteger score e marchar no timing certo.",
    summary: "No Exodo, quem vence nao e quem construiu cedo; e quem manteve predios, conselho, quests e ETA vivos ate a marcha final.",
    nextAction: "Reagrupe, confira a influencia e marche apenas quando a conta final continuar viva acima do corte.",
    actions: [
      "Agrupe tropas e cidades chave na Capital.",
      "Cheque score, quest, Maravilhas e ETA antes de comprometer a marcha.",
      "Evite sair cedo sem logistica ou tarde demais sem janela de chegada.",
    ],
    checkpoints: [
      "Portal pede influencia viva, nao historico bonito.",
      "A reta final pune reinos largos mas desorganizados.",
      "Se o spawn e longe, logistica manda mais que forca bruta.",
    ],
    warnings,
    recommendedTab: "board",
    beginnerTitle: "Como fechar a campanha",
    beginnerSteps: [
      "Abra Mapa para preparar a marcha e reagrupar o que importa.",
      "Confira Imperio para garantir que sua influencia continua viva.",
      "So execute a jogada final quando logistica e defesa estiverem coerentes.",
    ],
  };
}

function buildSandboxCoachCta(
  currentDay: number,
  strategyId: string | null | undefined,
  capitalVillageId: string,
  focusVillageId: string,
): SandboxCoachCta {
  const strategy = strategyId ?? "metropole";

  if (currentDay <= 5) {
    if (strategy === "metropole") {
      const building = currentDay % 2 === 0 ? "palace" : "mines";
      return {
        label: "Abrir botao da abertura",
        detail: "Va direto para o predio certo da abertura e clique no upgrade ou no plano do dia.",
        tab: "base",
        query: { v: capitalVillageId, b: building, sb: "city" },
      };
    }
    if (strategy === "posto_avancado") {
      return {
        label: "Abrir quartel/arsenal",
        detail: "Abertura militar: va direto para os botoes de Quartel e Arsenal na Capital.",
        tab: "base",
        query: { v: capitalVillageId, b: currentDay % 2 === 0 ? "arsenal" : "barracks", sb: "city" },
      };
    }
    if (strategy === "bastiao") {
      return {
        label: "Abrir defesa inicial",
        detail: "Va direto para Habitacoes ou Muralha e dispare a abertura de seguranca.",
        tab: "base",
        query: { v: capitalVillageId, b: currentDay % 2 === 0 ? "wall" : "housing", sb: "city" },
      };
    }
    return {
      label: "Abrir economia inicial",
      detail: "Va direto para Fazendas ou Habitacoes e dispare a abertura de fluxo.",
      tab: "base",
      query: { v: capitalVillageId, b: currentDay % 2 === 0 ? "housing" : "farms", sb: "city" },
    };
  }

  if (currentDay <= 15) {
    return {
      label: "Ir para a acao do mapa",
      detail: "Agora a jogada certa costuma ser preparar 2a aldeia, busca ou expansao no mapa.",
      tab: "board",
      query: { v: focusVillageId },
    };
  }

  if (currentDay <= 45) {
    return {
      label: "Abrir cidade foco",
      detail: "Voce precisa concentrar clique na aldeia foco e transformar isso em 100/100.",
      tab: "base",
      query: { v: focusVillageId, b: "housing", sb: "city" },
    };
  }

  if (currentDay <= 90) {
    return {
      label: "Abrir comando do imperio",
      detail: "Neste trecho o clique certo costuma misturar recrutamento, heroi e operacoes.",
      tab: "base",
      query: { v: capitalVillageId, sb: "command", lc: "drill" },
    };
  }

  return {
    label: "Abrir marcha final",
    detail: "Reta final: reagrupar, consolidar tropas e preparar a marcha no mapa.",
    tab: "board",
    query: { v: capitalVillageId },
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tutorialOpen, setTutorialOpen] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageId = `kw-coach-seen-${worldId}-${guide.buildId}-${guide.windowId}`;
    const alreadySeen = window.sessionStorage.getItem(storageId);
    if (alreadySeen) {
      return;
    }

    setTutorialOpen(true);
    window.sessionStorage.setItem(storageId, "1");
  }, [guide.buildId, guide.windowId, worldId]);

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

  return (
    <>
      <div className="mb-2 space-y-2">
        <article className="kw-glass rounded-2xl p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {isSandboxWorld ? "Sandbox em tempo real" : "Linha do tempo ao vivo"}
              </p>
              <p className="text-sm font-bold text-slate-50">Dia {currentDay} - {formatCampaignDate(campaignDate)}</p>
              <p className="text-[11px] text-slate-300">{worldPhase}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Relogio</p>
              <p className="text-[11px] font-bold text-emerald-50">{realTimeEnabled ? "Rodando em tempo real" : "Tempo pausado"}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-200">
            <div className="rounded-xl border border-white/15 bg-white/5 p-2">
              <p className="font-semibold text-slate-100">Estado do mundo</p>
              <p className="mt-1 leading-5">O mundo comeca no Dia 0 e segue sozinho em tempo real.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2">
              <p className="font-semibold text-slate-100">Como testar</p>
              <p className="mt-1 leading-5">Clique nas abas e nas acoes do reino. O avancador manual foi apenas escondido.</p>
            </div>
          </div>
        </article>
        <article className="kw-glass rounded-2xl p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Conselheiro Real</p>
              <p className="truncate text-sm font-bold text-slate-50">{guide.build.label} Â· {guide.windowLabel}</p>
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
              Tutorial
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-200">
              <p className="font-semibold text-slate-100">Acao sugerida agora</p>
              <p className="mt-1 leading-5">{guide.nextAction}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-200">
              <p className="font-semibold text-slate-100">Leitura do reino</p>
              <p className="mt-1 leading-5">
                {villages.length} aldeias Â· pico {highestDevelopment}/100 Â· {heroCount} herois ativos
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => jumpToTab(guide.recommendedTab)}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/14 px-2 py-1 text-[10px] font-semibold text-cyan-100"
            >
              <Compass className="h-3.5 w-3.5" />
              Ir para {guide.recommendedTab}
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatCampaignDate(campaignDate)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
              <Map className="h-3.5 w-3.5" />
              Aba atual: {activeTab}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-100">
              <CircleDot className="h-3.5 w-3.5" />
              Tempo real ativo
            </span>
          </div>

          <div className="mt-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-2">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-sky-100" />
              <p className="text-[11px] font-bold text-slate-50">{guide.beginnerTitle}</p>
            </div>
            <div className="mt-2 space-y-1.5">
              {guide.beginnerSteps.map((step) => (
                <p key={step} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                  {step}
                </p>
              ))}
            </div>
          </div>

          {sandboxCoachCta ? (
            <div className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-2">
              <p className="text-[11px] font-bold text-amber-100">Botao direto da acao do dia</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-200">{sandboxCoachCta.detail}</p>
              <button
                type="button"
                onClick={() => jumpToTabWithQuery(sandboxCoachCta.tab, sandboxCoachCta.query)}
                className="mt-2 inline-flex items-center gap-1 rounded-xl border border-amber-300/45 bg-amber-500/18 px-2.5 py-2 text-[10px] font-bold text-amber-50"
              >
                <Target className="h-3.5 w-3.5" />
                {sandboxCoachCta.label}
              </button>
            </div>
          ) : null}
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
                  <h3 className="text-lg font-bold text-slate-50">{guide.build.label} Â· Dia {currentDay}</h3>
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
                    <p className="mt-1 text-sm font-bold text-slate-50">{heroCount} herois Â· {questsCompleted} quests</p>
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




