import type { RelationFilter, TileActionKind } from "./strategic-map-types";

export function describeTileAction(kind: TileActionKind): string {
  if (kind === "build") return "Criar estrada ou cidade";
  if (kind === "go") return "Enviar marcha ou apoio";
  if (kind === "attack") return "Tentar tomar a cidade";
  if (kind === "annex") return "Tomar cidade vazia";
  if (kind === "explore") return "Revelar a area e descobrir riscos";
  return "Apenas olhar";
}

export function actionTone(kind: TileActionKind): string {
  if (kind === "attack") return "border-rose-300/45 bg-rose-500/12 text-rose-100";
  if (kind === "annex") return "border-cyan-300/45 bg-cyan-500/12 text-cyan-100";
  if (kind === "build") return "border-emerald-300/45 bg-emerald-500/12 text-emerald-100";
  if (kind === "go") return "border-amber-300/45 bg-amber-500/12 text-amber-100";
  if (kind === "explore") return "border-sky-300/45 bg-sky-500/12 text-sky-100";
  return "border-white/20 bg-white/8 text-slate-100";
}

export function relationFilterLabel(filter: RelationFilter): string {
  if (filter === "all") return "Tudo";
  if (filter === "self") return "So eu";
  if (filter === "tribe") return "Tribo";
  if (filter === "ally") return "Aliados";
  if (filter === "enemy") return "Inimigos";
  return "Abandonadas";
}

export function relationFilterTone(filter: RelationFilter, active: boolean): string {
  if (!active) {
    return "border-white/15 bg-white/6 text-slate-200";
  }

  if (filter === "all") return "border-sky-300/80 bg-sky-500/18 text-sky-100";
  if (filter === "self") return "border-yellow-300/80 bg-yellow-400/18 text-yellow-50";
  if (filter === "tribe") return "border-rose-300/80 bg-rose-500/18 text-rose-100";
  if (filter === "ally") return "border-violet-300/80 bg-violet-500/18 text-violet-100";
  if (filter === "enemy") return "border-emerald-300/80 bg-emerald-500/18 text-emerald-100";
  return "border-amber-300/80 bg-amber-500/18 text-amber-100";
}
