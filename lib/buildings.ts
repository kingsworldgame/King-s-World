export type BuildingId =
  | "palace"
  | "senate"
  | "mines"
  | "farms"
  | "housing"
  | "research"
  | "roads"
  | "barracks"
  | "arsenal"
  | "wall"
  | "wonder";

export type ResourceCost = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
};

export type BuildingDefinition = {
  id: BuildingId;
  name: string;
  summary: string;
  maxLevel: number;
  villageDevelopmentPerLevel?: number;
  villageDevelopmentCap?: number;
  baseCost: ResourceCost;
  growth: number;
  baseMinutes: number;
  benefit: {
    label: string;
    base: number;
    perLevel: number;
    unit: "%" | "pts" | "slots" | "x" | "/h";
  };
};

export type BuildingLayout = {
  id: Exclude<BuildingId, "roads">;
  xPct: number;
  yPct: number;
  sizePx: number;
  badgeXPct: number;
  badgeYPct: number;
  clickRadius: number;
};

export const BUILDINGS: BuildingDefinition[] = [
  {
    id: "palace",
    name: "Palacio",
    summary: "Centro da aldeia. Define comando e cap politico.",
    maxLevel: 10,
    baseCost: { materials: 450, supplies: 180, energy: 130, influence: 60 },
    growth: 1.19,
    baseMinutes: 24,
    benefit: { label: "Cap politico", base: 100, perLevel: 45, unit: "pts" },
  },
  {
    id: "senate",
    name: "Senado",
    summary: "Expande o teto de influencia da Coroa.",
    maxLevel: 10,
    baseCost: { materials: 620, supplies: 210, energy: 250, influence: 110 },
    growth: 1.2,
    baseMinutes: 26,
    benefit: { label: "Cap de influencia", base: 500, perLevel: 250, unit: "pts" },
  },
  {
    id: "mines",
    name: "Minas",
    summary: "Producao e extraÃ§Ã£o de materiais.",
    maxLevel: 10,
    baseCost: { materials: 320, supplies: 120, energy: 110, influence: 36 },
    growth: 1.16,
    baseMinutes: 16,
    benefit: { label: "Materiais", base: 260, perLevel: 58, unit: "/h" },
  },
  {
    id: "farms",
    name: "Fazendas",
    summary: "Mantem suprimentos e reduz risco de fome.",
    maxLevel: 10,
    baseCost: { materials: 300, supplies: 135, energy: 80, influence: 34 },
    growth: 1.16,
    baseMinutes: 16,
    benefit: { label: "Suprimentos", base: 240, perLevel: 55, unit: "/h" },
  },
  {
    id: "housing",
    name: "Habitacoes",
    summary: "Aumenta lotacao e slots civis.",
    maxLevel: 10,
    baseCost: { materials: 360, supplies: 180, energy: 95, influence: 40 },
    growth: 1.17,
    baseMinutes: 18,
    benefit: { label: "Slots populacionais", base: 8, perLevel: 1, unit: "slots" },
  },
  {
    id: "research",
    name: "C. Pesquisa",
    summary: "Acelera desenvolvimento tecnologico.",
    maxLevel: 10,
    baseCost: { materials: 520, supplies: 220, energy: 190, influence: 78 },
    growth: 1.18,
    baseMinutes: 23,
    benefit: { label: "Velocidade de pesquisa", base: 4, perLevel: 1.4, unit: "%" },
  },
  {
    id: "roads",
    name: "M. Viaria",
    summary: "Infraestrutura global do mapa e deslocamento.",
    maxLevel: 10,
    villageDevelopmentPerLevel: 0,
    villageDevelopmentCap: 0,
    baseCost: { materials: 520, supplies: 320, energy: 220, influence: 85 },
    growth: 1.17,
    baseMinutes: 20,
    benefit: { label: "Velocidade de deslocamento", base: 1.02, perLevel: 0.02, unit: "x" },
  },
  {
    id: "barracks",
    name: "Quartel",
    summary: "Treinamento de tropas base.",
    maxLevel: 10,
    baseCost: { materials: 420, supplies: 260, energy: 140, influence: 55 },
    growth: 1.18,
    baseMinutes: 20,
    benefit: { label: "Capacidade de treinamento", base: 12, perLevel: 2, unit: "%" },
  },
  {
    id: "arsenal",
    name: "Arsenal",
    summary: "Desbloqueia poder militar avancado.",
    maxLevel: 10,
    baseCost: { materials: 560, supplies: 260, energy: 170, influence: 65 },
    growth: 1.18,
    baseMinutes: 22,
    benefit: { label: "Ataque do exercito", base: 10, perLevel: 2.5, unit: "%" },
  },
  {
    id: "wall",
    name: "Muralha",
    summary: "Linha defensiva contra cerco e horda.",
    maxLevel: 10,
    baseCost: { materials: 680, supplies: 120, energy: 190, influence: 70 },
    growth: 1.2,
    baseMinutes: 28,
    benefit: { label: "Defesa estrutural", base: 120, perLevel: 18, unit: "%" },
  },
  {
    id: "wonder",
    name: "Maravilha",
    summary: "Capstone tardio da aldeia. Ao concluir, fecha +10 no desenvolvimento local e completa os 100 pontos da aldeia.",
    maxLevel: 1,
    villageDevelopmentPerLevel: 10,
    villageDevelopmentCap: 10,
    baseCost: { materials: 1300, supplies: 800, energy: 620, influence: 260 },
    growth: 1.22,
    baseMinutes: 34,
    benefit: { label: "Poder imperial", base: 2, perLevel: 1.8, unit: "%" },
  },
];

export const BUILDINGS_BY_ID: Record<BuildingId, BuildingDefinition> = Object.fromEntries(
  BUILDINGS.map((entry) => [entry.id, entry]),
) as Record<BuildingId, BuildingDefinition>;

export const BUILDING_LAYOUT: BuildingLayout[] = [
  { id: "senate", xPct: 50, yPct: 34, sizePx: 54, badgeXPct: 49.73198181418461, badgeYPct: 19.180333613560354, clickRadius: 30 },
  { id: "research", xPct: 37, yPct: 39, sizePx: 54, badgeXPct: 88.11845859965082, badgeYPct: 33.45889504126878, clickRadius: 30 },
  { id: "wonder", xPct: 63, yPct: 39, sizePx: 54, badgeXPct: 43.60275258812362, badgeYPct: 70.96179882701762, clickRadius: 30 },
  { id: "palace", xPct: 50, yPct: 49, sizePx: 72, badgeXPct: 46.289130076887375, badgeYPct: 40.443025599848916, clickRadius: 35 },
  { id: "mines", xPct: 31, yPct: 56, sizePx: 56, badgeXPct: 25.52195918228666, badgeYPct: 24.816089984780266, clickRadius: 28 },
  { id: "farms", xPct: 12.402347051700104, yPct: 44.5581925675203, sizePx: 56, badgeXPct: 13.12997167886195, badgeYPct: 34.98518210244697, clickRadius: 28 },
  { id: "housing", xPct: 37, yPct: 67, sizePx: 58, badgeXPct: 73.12196358043634, badgeYPct: 26.166044875357038, clickRadius: 32 },
  { id: "barracks", xPct: 63, yPct: 67, sizePx: 60, badgeXPct: 25.650185992044424, badgeYPct: 61.17993346166683, clickRadius: 30 },
  { id: "arsenal", xPct: 34.02324776721095, yPct: 76.15369255824002, sizePx: 56, badgeXPct: 92.56787718508564, badgeYPct: 50.64562884650532, clickRadius: 30 },
  { id: "wall", xPct: 80.9852307226898, yPct: 71.66520720046347, sizePx: 78, badgeXPct: 80.87271256167554, badgeYPct: 72.45816634789709, clickRadius: 34 },
];

export const BUILDING_NAME_TO_ID: Record<string, BuildingId> = {
  Palacio: "palace",
  Senado: "senate",
  Minas: "mines",
  Fazendas: "farms",
  Habitacoes: "housing",
  "C. Pesquisa": "research",
  "C Pesquisa": "research",
  "M. Viaria": "roads",
  "M Viaria": "roads",
  Quartel: "barracks",
  Arsenal: "arsenal",
  Muralha: "wall",
  Maravilha: "wonder",
};

export function getDefaultBuildingLevels(palaceLevel: number): Record<BuildingId, number> {
  const palace = Math.min(10, Math.max(1, Math.floor(palaceLevel)));
  const core = Math.max(1, palace - 1);
  const support = Math.max(1, palace - 2);

  return {
    palace,
    senate: core,
    mines: core,
    farms: core,
    housing: support,
    research: support,
    roads: support,
    barracks: core,
    arsenal: core,
    wall: core,
    wonder: 0,
  };
}

export function getZeroBuildingLevels(): Record<BuildingId, number> {
  return {
    palace: 0,
    senate: 0,
    mines: 0,
    farms: 0,
    housing: 0,
    research: 0,
    roads: 0,
    barracks: 0,
    arsenal: 0,
    wall: 0,
    wonder: 0,
  };
}

export function getUpgradeCost(definition: BuildingDefinition, nextLevel: number): ResourceCost {
  const scalar = definition.growth ** Math.max(0, nextLevel - 1);
  return {
    materials: Math.round(definition.baseCost.materials * scalar),
    supplies: Math.round(definition.baseCost.supplies * scalar),
    energy: Math.round(definition.baseCost.energy * scalar),
    influence: Math.round(definition.baseCost.influence * scalar),
  };
}

export function getUpgradeMinutes(definition: BuildingDefinition, nextLevel: number): number {
  return Math.max(1, Math.round(definition.baseMinutes * 1.09 ** Math.max(0, nextLevel - 1)));
}

export function getBenefitValue(definition: BuildingDefinition, level: number): number {
  return definition.benefit.base + Math.max(0, level - 1) * definition.benefit.perLevel;
}

export function formatBenefit(definition: BuildingDefinition, value: number): string {
  const { unit } = definition.benefit;
  if (unit === "x") {
    return `${value.toFixed(2)}x`;
  }
  if (unit === "%") {
    return `+${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  if (unit === "/h") {
    return `${Math.round(value).toLocaleString("pt-BR")}/h`;
  }
  if (unit === "slots") {
    return `+${Math.round(value)} slots`;
  }
  return `+${Math.round(value).toLocaleString("pt-BR")} pts`;
}

export function formatCompact(value: number): string {
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

export function formatDuration(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}






