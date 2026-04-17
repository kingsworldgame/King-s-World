import type { EvolutionMode, SovereignArchetype } from "@/core/GameBalance";

export type CityRole = "Capital" | "Colonia";

export type CityClass =
  | "neutral"
  | "metropole"
  | "posto_avancado"
  | "bastiao"
  | "celeiro";

export type CityOriginKind =
  | "claimed_city"
  | "wild_empty"
  | "abandoned_city"
  | "frontier_ruins"
  | "hotspot";

export type TerrainKind =
  | "crown_heartland"
  | "riverlands"
  | "frontier_pass"
  | "ironridge"
  | "ashen_fields";

export const CITY_CLASS_META: Record<
  CityClass,
  {
    label: string;
    shortLabel: string;
    summary: string;
  }
> = {
  neutral: {
    label: "Neutra",
    shortLabel: "Neutra",
    summary: "Ainda sem especializacao travada. Boa para decidir depois.",
  },
  metropole: {
    label: "Metropole",
    shortLabel: "Metro",
    summary: "Economia, pesquisa e fechamento rapido de desenvolvimento.",
  },
  posto_avancado: {
    label: "Posto Avancado",
    shortLabel: "Posto",
    summary: "Pressao de fronteira, ocupacao e resposta militar.",
  },
  bastiao: {
    label: "Bastiao",
    shortLabel: "Bastiao",
    summary: "Muralha, seguranca e sustentacao sob horda.",
  },
  celeiro: {
    label: "Celeiro",
    shortLabel: "Celeiro",
    summary: "Fluxo, suprimento e campanhas longas.",
  },
};

export const TERRAIN_META: Record<
  TerrainKind,
  {
    label: string;
    summary: string;
    recommendedCityClass: CityClass;
  }
> = {
  crown_heartland: {
    label: "Coracao da Coroa",
    summary: "Plano urbano rico e estavel.",
    recommendedCityClass: "metropole",
  },
  riverlands: {
    label: "Varzea dos Rios",
    summary: "Fluxo de mantimentos e carga.",
    recommendedCityClass: "celeiro",
  },
  frontier_pass: {
    label: "Passagem de Fronteira",
    summary: "Choque de rotas e pressao territorial.",
    recommendedCityClass: "posto_avancado",
  },
  ironridge: {
    label: "Escarpa de Ferro",
    summary: "Pedra, muralha e posicao defensiva.",
    recommendedCityClass: "bastiao",
  },
  ashen_fields: {
    label: "Campos de Cinza",
    summary: "Area neutra e ingrime, boa para adaptação.",
    recommendedCityClass: "neutral",
  },
};

export function cityClassLabel(cityClass: CityClass | undefined): string {
  return CITY_CLASS_META[cityClass ?? "neutral"].label;
}

export function cityClassToArchetype(cityClass: CityClass | undefined): SovereignArchetype {
  switch (cityClass) {
    case "metropole":
      return "sovereign_industrial";
    case "bastiao":
      return "sovereign_citadel";
    case "celeiro":
      return "sovereign_logistic";
    case "posto_avancado":
      return "sovereign_vanguard";
    default:
      return "sovereign_industrial";
  }
}

export function cityClassToEvolutionMode(cityClass: CityClass | undefined): EvolutionMode {
  switch (cityClass) {
    case "metropole":
      return "metropole";
    case "bastiao":
      return "bastion";
    case "celeiro":
      return "flow";
    case "posto_avancado":
      return "vanguard";
    default:
      return "balanced";
  }
}

