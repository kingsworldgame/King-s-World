"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Coins, ShieldAlert, Swords, type LucideIcon } from "lucide-react";

import { TimeOfDestinyPanel } from "@/components/sandbox/TimeOfDestinyPanel";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";

type FeedFilter = "all" | "combate" | "acoes" | "movimento" | "economia" | "alertas";

type FeedEntry = {
  id: string;
  kind: Exclude<FeedFilter, "all">;
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
    return loss >= 25 ? "Segure a frente, evite novo envio e reforce a cidade alvo." : "Combate empatado. Vale medir se a proxima ofensiva fecha a tomada.";
  }
  if (loss <= 12) {
    return "Janela boa para pressionar de novo ou converter em tomada.";
  }
  if (loss <= 24) {
    return "Vitoria cara. Reponha tropa antes de abrir outra frente.";
  }
  return "Voce venceu, mas queimou poder demais. Priorize recomposicao.";
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
    return "Veja se a nova rota encurtou sua logistica ou so abriu custo.";
  }
  return "Confira o ETA e o retorno real dessa ordem antes do proximo clique.";
}

function economyUtility(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("supr")) {
    return "Foco em ração, fazendas ou corte de atrito para nao travar a campanha.";
  }
  if (normalized.includes("energia")) {
    return "Energia curta trava crescimento. Revise minas, pesquisa e ordem de obra.";
  }
  return "Use este evento para decidir se vale obra, doacao interna ou pausa de gasto.";
}

function alertUtility(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("portal") || normalized.includes("corte")) {
    return "Sua preocupacao principal agora e score util, nao mais crescimento bonito.";
  }
  if (normalized.includes("horda")) {
    return "Decida entre segurar a borda ou acelerar regroup para o centro.";
  }
  if (normalized.includes("marcha")) {
    return "Cheque ETA, navegador e se a rota esta fisicamente viavel.";
  }
  return "Alerta vivo. Ele merece decisao agora, nao leitura passiva.";
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
    return { badge: "Critico", cardClass: "border-rose-300/35 bg-rose-500/10 text-rose-100" };
  }
  if (normalized.includes("marcha") || normalized.includes("ataque")) {
    return { badge: "Pressao", cardClass: "border-amber-300/35 bg-amber-500/10 text-amber-100" };
  }
  return { badge: "Vigia", cardClass: "border-sky-300/35 bg-sky-500/10 text-sky-100" };
}

function filterLabel(filter: FeedFilter): string {
  if (filter === "all") return "Tudo";
  if (filter === "acoes") return "Acoes";
  if (filter === "movimento") return "Movimento";
  if (filter === "economia") return "Economia";
  if (filter === "alertas") return "Alertas";
  return "Combate";
}

export function IntelligenceClient({ params }: { params: { worldId: string } }) {
  const { world } = useLiveWorld(params.worldId);
  const { imperialState } = useImperialState(params.worldId, world.villages);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const mergedVillages = useMemo(() => mergeImperialVillages(world.villages, imperialState), [imperialState, world.villages]);

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
          summary: `${win ? "Vitoria" : "Conflito"} · perdas ${loss}%`,
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
        kind: "acoes",
        title: "Acao do reino",
        summary: log,
        time: "agora",
        utility: movementUtility(log),
        badge: "Acao",
        cardClass: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
        icon: Bell,
      })),
    [imperialState.logs],
  );

  const feed = useMemo(
    () => [...alertEntries, ...actionEntries, ...reportEntries],
    [actionEntries, alertEntries, reportEntries],
  );

  const filteredFeed = useMemo(
    () => (filter === "all" ? feed : feed.filter((entry) => entry.kind === filter)),
    [feed, filter],
  );

  const criticalAlerts = alertEntries.filter((entry) => entry.badge === "Critico").length;
  const combatEntries = reportEntries.filter((entry) => entry.kind === "combate");
  const harshCombats = combatEntries.filter((entry) => entry.badge === "Choque").length;
  const unreadCombat = world.reports.filter((entry) => entry.category === "combate" && entry.unread).length;
  const pendingActions = actionEntries.length;

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

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="kw-title text-base">Registro de Guerra</h2>
            <p className="kw-subtle text-[11px]">Aba 5 agora serve para log util: combate, acoes, movimento e economia.</p>
          </div>
          <span className="kw-subtle text-[11px]">Dia {world.day}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="kw-glass-soft rounded-2xl p-2 text-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Criticos</p>
            <p className="mt-1 text-lg font-black text-rose-100">{criticalAlerts}</p>
            <p className="text-[10px] text-slate-300">pedem decisao agora</p>
          </div>
          <div className="kw-glass-soft rounded-2xl p-2 text-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Combates</p>
            <p className="mt-1 text-lg font-black text-amber-100">{unreadCombat}</p>
            <p className="text-[10px] text-slate-300">relatorios nao lidos</p>
          </div>
          <div className="kw-glass-soft rounded-2xl p-2 text-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Acoes</p>
            <p className="mt-1 text-lg font-black text-cyan-100">{pendingActions}</p>
            <p className="text-[10px] text-slate-300">ordens recentes</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="kw-glass-soft rounded-2xl p-2 text-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-300" />
              <p className="text-[11px] font-semibold">Leitura imediata</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              {criticalAlerts > 0
                ? "Ha alertas que pedem reacao imediata. O feed abaixo esta filtrando o que realmente mexe no destino do reino."
                : "Sem colapso imediato. Use o feed abaixo para ler atrito, marcha e retorno real das ordens."}
            </p>
          </div>
          <div className="kw-glass-soft rounded-2xl p-2 text-slate-100">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-300" />
              <p className="text-[11px] font-semibold">Choque recente</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              {harshCombats > 0
                ? `${harshCombats} combate(s) sairam caros. Vale frear, recompor e evitar abrir outra frente sem necessidade.`
                : "Os ultimos combates nao parecem destrutivos. Se houver vantagem de mapa, existe janela para pressionar."}
            </p>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="kw-title text-base">Filtro do Feed</h2>
          <span className="kw-subtle text-[11px]">{filteredFeed.length} itens</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(["all", "combate", "acoes", "movimento", "economia", "alertas"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => {
                emitUiFeedback("tap", "light");
                setFilter(entry);
              }}
              className={`rounded-xl border px-2 py-1.5 text-[10px] font-semibold transition ${
                filter === entry
                  ? "border-cyan-300/55 bg-cyan-500/16 text-cyan-100"
                  : "border-white/15 bg-white/6 text-slate-300 hover:bg-white/10"
              }`}
            >
              {filterLabel(entry)}
            </button>
          ))}
        </div>
      </article>

      <article className="kw-glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="kw-title text-base">Feed Util</h2>
          <span className="kw-subtle text-[11px]">Ultimos 7 dias / ciclo vivo</span>
        </div>

        <div className="space-y-2">
          {filteredFeed.length > 0 ? (
            filteredFeed.map((entry) => {
              const Icon = entry.icon;
              return (
                <article key={entry.id} className={`rounded-2xl border p-2.5 ${entry.cardClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="mt-0.5 rounded-xl border border-white/15 bg-white/8 p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]">
                            {entry.badge}
                          </span>
                          <span className="text-[10px] font-semibold opacity-80">{entry.time}</span>
                        </div>
                        <p className="mt-1 text-[12px] font-bold text-slate-100">{entry.title}</p>
                        <p className="mt-1 text-[11px] text-slate-200">{entry.summary}</p>
                        <p className="mt-1 text-[10px] text-slate-300">{entry.utility}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="kw-glass-soft rounded-2xl p-3 text-sm text-slate-300">
              Nenhum evento util neste filtro agora.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
