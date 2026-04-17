import { axialDistance, type AxialCoord } from "@/lib/hex-grid";
import {
  BUILDINGS_BY_ID,
  type BuildingDefinition,
  type BuildingId,
  type ResourceCost,
} from "@/lib/buildings";

export type BalancePhase = "phase_1" | "phase_2";
export type ProtocolType = "focus_supply" | "focus_energy" | "focus_influence" | "focus_defense";

export const GAME_BALANCE_CONSTANTS = Object.freeze({
  worldDays: 120,
  phase1EndDay: 90,
  hordeSpikeDay: 110,
  baseMoveTimeMinutes: 45,
  roadMoveTimeMinutes: 15,
  phase4LogisticsMultiplier: 5,
  etaSpecialistMinHours: 48,
  etaSpecialistMaxHours: 60,
  wonderCostMultiplier: 2.6,
  buildingTimeGrowth: 1.09,
});

export const SOVEREIGNTY_SCORE_MAX = 2500;
export const SOVEREIGNTY_PORTAL_CUT = 1500;
export const TRIBE_LOYALTY_STAGE_COUNT = 5;
export const TRIBE_LOYALTY_FULL_BONUS = 200;
export const TRIBE_LOYALTY_STAGE_BONUS = TRIBE_LOYALTY_FULL_BONUS / TRIBE_LOYALTY_STAGE_COUNT;
export const CITY_DIPLOMAT_UNLOCK_DEVELOPMENT = 60;
export const MAX_CITY_DIPLOMATS = 9;
export const MAX_TRIBE_ENVOYS = 2;
export const MAX_TOTAL_DIPLOMATS = MAX_CITY_DIPLOMATS + MAX_TRIBE_ENVOYS;

const SOVEREIGNTY_BUILDING_IDS: BuildingId[] = [
  "palace",
  "senate",
  "mines",
  "farms",
  "housing",
  "research",
  "barracks",
  "arsenal",
  "wall",
  "wonder",
];

export type TerrainModifiers = {
  terrainCostMultiplier?: number;
  terrainTimeMultiplier?: number;
  terrainProductionMultiplier?: number;
  terrainCombatMultiplier?: number;
  terrainMovementMultiplier?: number;
};

export type EvolutionMode =
  | "balanced"
  | "metropole"
  | "vanguard"
  | "bastion"
  | "flow";

export type SovereignArchetype =
  | "sovereign_industrial" // Heavy energy focus, efficient materials
  | "sovereign_citadel"    // Heavy materials focus, efficient energy
  | "sovereign_logistic"   // High energy for expansion, balanced materials
  | "sovereign_vanguard";  // Offensive frontier build with heavier supply burn

type BuildingCategory =
  | "governance"
  | "economy"
  | "research"
  | "logistics"
  | "military"
  | "defense"
  | "legacy";

export type EvolutionModeProfile = {
  id: EvolutionMode;
  label: string;
  summary: string;
  costByCategory: Partial<Record<BuildingCategory, number>>;
  timeByCategory: Partial<Record<BuildingCategory, number>>;
};

const DEFAULT_EVOLUTION_MODE: EvolutionMode = "balanced";

const EVOLUTION_MODE_PROFILES: Record<EvolutionMode, EvolutionModeProfile> = {
  balanced: {
    id: "balanced",
    label: "Balanceado",
    summary: "Progressao estavel para economia, defesa e militar.",
    costByCategory: {},
    timeByCategory: {},
  },
  metropole: {
    id: "metropole",
    label: "Metropole",
    summary: "Acelera economia e pesquisa, encarece militar no inicio.",
    costByCategory: {
      economy: 0.88,
      research: 0.9,
      governance: 0.94,
      military: 1.12,
      defense: 1.08,
    },
    timeByCategory: {
      economy: 0.88,
      research: 0.9,
      military: 1.08,
      defense: 1.05,
    },
  },
  vanguard: {
    id: "vanguard",
    label: "Posto Avancado",
    summary: "Forte em militar/ocupacao, economia menos eficiente.",
    costByCategory: {
      military: 0.86,
      defense: 0.92,
      logistics: 0.95,
      economy: 1.14,
      research: 1.08,
    },
    timeByCategory: {
      military: 0.84,
      defense: 0.9,
      logistics: 0.92,
      economy: 1.12,
    },
  },
  bastion: {
    id: "bastion",
    label: "Bastiao",
    summary: "Prioriza muralha e seguranca, ataque fica mais lento.",
    costByCategory: {
      defense: 0.84,
      governance: 0.95,
      economy: 0.97,
      military: 1.12,
      legacy: 1.06,
    },
    timeByCategory: {
      defense: 0.82,
      governance: 0.95,
      military: 1.1,
      legacy: 1.06,
    },
  },
  flow: {
    id: "flow",
    label: "Celeiro de Fluxo",
    summary: "Logistica e suprimentos com foco na marcha final.",
    costByCategory: {
      logistics: 0.8,
      economy: 0.9,
      research: 0.96,
      military: 1.08,
    },
    timeByCategory: {
      logistics: 0.8,
      economy: 0.9,
      research: 0.94,
      military: 1.08,
    },
  },
};

export type BuildingUpgradeOptions = TerrainModifiers & {
  scalarMultiplier?: number;
  evolutionMode?: EvolutionMode;
  archetype?: SovereignArchetype; // Added for strategy-dependent costs
};

export type EconomyStructures = {
  economy: number;
  infrastructure: number;
  governance: number;
  military: number;
};

export type EconomyResearch = {
  economy: number;
  logistics: number;
  governance: number;
};

export type EconomyTraits = {
  economyFocus: number;
  quality: number;
};

export type EconomyTroops = {
  offense: number;
  defense: number;
};

export type EconomyResources = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
};

export type CatastropheMultipliers = {
  materialsMult?: number;
  suppliesMult?: number;
  energyMult?: number;
  influenceMult?: number;
  upkeepMult?: number;
};

export type DailyEconomyInput = TerrainModifiers & {
  villages: number;
  structures: EconomyStructures;
  research: EconomyResearch;
  traits: EconomyTraits;
  troops: EconomyTroops;
  resources: EconomyResources;
  upkeepMult?: number;
  activeProtocol?: ProtocolType | null;
  catastrophe?: CatastropheMultipliers | null;
};

export type DailyEconomyResult = {
  production: EconomyResources;
  upkeep: number;
  villageConsumptionEnergy: number;
  stocksAfterTick: EconomyResources;
  supplyPenaltyRatio: number;
  energyPenaltyRatio: number;
  offenseMultiplierAfterPenalty: number;
  defenseMultiplierAfterPenalty: number;
};

export type ResearchCostOptions = TerrainModifiers & {
  materialsMultiplier?: number;
  influenceMultiplier?: number;
};

export type ResearchCost = {
  materials: number;
  influence: number;
};

export type AttackChanceInput = TerrainModifiers & {
  phase: BalancePhase;
  aggression: number;
  isHuman: boolean;
  aggressionMultiplier?: number;
};

export type AttackForceInput = TerrainModifiers & {
  offense: number;
  aggression: number;
  hasGeneral?: boolean;
  researchArmyLevel: number;
  hasWarLeader?: boolean;
  hasHero?: boolean;
};

export type DefenseForceInput = TerrainModifiers & {
  defense: number;
  targetSite: "capital" | "colony";
  structuresDefenseLevel: number;
  researchArmyLevel: number;
  hasHero?: boolean;
  wallDefenseMultiplier?: number;
  tribeDefenseMultiplier?: number;
  focusDefenseActive?: boolean;
};

export type CombatForces = {
  attackForce: number;
  defenseForce: number;
  attackerCommit: number;
  defenderCommit: number;
};

export type CombatResolution = {
  winner: "attacker" | "defender";
  attackerLossRatio: number;
  defenderLossRatio: number;
};

export type MarchOptions = TerrainModifiers & {
  hasRoad: boolean;
  baseMoveMinutes?: number;
  roadMoveMinutes?: number;
};

export type MarchTime = {
  hexDistance: number;
  minutesPerHex: number;
  totalMinutes: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function safeMultiplier(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function resolveBuilding(building: BuildingId | BuildingDefinition): BuildingDefinition {
  return typeof building === "string" ? BUILDINGS_BY_ID[building] : building;
}

function getBuildingCategory(buildingId: BuildingId): BuildingCategory {
  switch (buildingId) {
    case "palace":
    case "senate":
      return "governance";
    case "mines":
    case "farms":
    case "housing":
      return "economy";
    case "research":
      return "research";
    case "roads":
      return "logistics";
    case "barracks":
    case "arsenal":
      return "military";
    case "wall":
      return "defense";
    case "wonder":
      return "legacy";
    default:
      return "economy";
  }
}

export function getEvolutionModeProfile(mode?: EvolutionMode): EvolutionModeProfile {
  return EVOLUTION_MODE_PROFILES[mode ?? DEFAULT_EVOLUTION_MODE] ?? EVOLUTION_MODE_PROFILES[DEFAULT_EVOLUTION_MODE];
}

export function listEvolutionModeProfiles(): EvolutionModeProfile[] {
  return Object.values(EVOLUTION_MODE_PROFILES);
}

function resolveEvolutionMultipliers(mode: EvolutionMode | undefined, buildingId: BuildingId): { cost: number; time: number } {
  const profile = getEvolutionModeProfile(mode);
  const category = getBuildingCategory(buildingId);
  return {
    cost: safeMultiplier(profile.costByCategory[category]),
    time: safeMultiplier(profile.timeByCategory[category]),
  };
}

export function getWorldPhase(day: number): BalancePhase {
  return day <= GAME_BALANCE_CONSTANTS.phase1EndDay ? "phase_1" : "phase_2";
}

export type SovereignUpgradeCost = ResourceCost & {
  requiredInfluence: number;
};

export function calculateBuildingUpgradeCost(
  building: BuildingId | BuildingDefinition,
  nextLevel: number,
  options: BuildingUpgradeOptions = {},
): SovereignUpgradeCost {
  const definition = resolveBuilding(building);
  const scalar = definition.growth ** Math.max(0, nextLevel - 1);
  const wonderScalar =
    definition.id === "wonder" ? GAME_BALANCE_CONSTANTS.wonderCostMultiplier : 1;
  const levelPressure = nextLevel >= 9 ? 1.25 : nextLevel >= 7 ? 1.15 : 1; // Slight increase in pressure for late game
  const earlyAcceleration = nextLevel <= 3 ? 0.9 : 1; // Better early game feel

  const evolution = resolveEvolutionMultipliers(options.evolutionMode, definition.id);

  // Dynamic Energy/Resource footprint based on Archetype Strategy
  // This prevents a single "optimal" development path by shifting costs based on chosen playstyle
  let archetypeEnergyMult = 1.3;
  let archetypeMaterialMult = 1.0;
  let archetypeSupplyMult = 1.0;

  if (options.archetype === "sovereign_industrial") {
    archetypeEnergyMult = 1.6; // High energy dependency
    archetypeMaterialMult = 0.85; // Refined material usage
  } else if (options.archetype === "sovereign_citadel") {
    archetypeEnergyMult = 1.1; // Energy efficiency
    archetypeMaterialMult = 1.4; // Massive material requirements
  } else if (options.archetype === "sovereign_logistic") {
    archetypeEnergyMult = 1.5; // High power for logistics
    archetypeSupplyMult = 1.25; // High upkeep for supply lines
  } else if (options.archetype === "sovereign_vanguard") {
    archetypeEnergyMult = 1.22;
    archetypeMaterialMult = 1.08;
    archetypeSupplyMult = 1.32;
  }

  const totalScalar =
    scalar *
    wonderScalar *
    levelPressure *
    earlyAcceleration *
    safeMultiplier(options.scalarMultiplier) *
    safeMultiplier(options.terrainCostMultiplier) *
    evolution.cost;

  return {
    materials: round(definition.baseCost.materials * totalScalar * archetypeMaterialMult),
    supplies: round(definition.baseCost.supplies * totalScalar * archetypeSupplyMult),
    energy: round(definition.baseCost.energy * totalScalar * archetypeEnergyMult),
    // Influence is now a threshold (score required), not a consumable cost.
    influence: 0,
    requiredInfluence: round(definition.baseCost.influence * totalScalar),
  };
}

export function calculateBuildingUpgradeMinutes(
  building: BuildingId | BuildingDefinition,
  nextLevel: number,
  options: BuildingUpgradeOptions = {},
): number {
  const definition = resolveBuilding(building);
  const evolution = resolveEvolutionMultipliers(options.evolutionMode, definition.id);

  const minutes =
    definition.baseMinutes *
    GAME_BALANCE_CONSTANTS.buildingTimeGrowth ** Math.max(0, nextLevel - 1) *
    safeMultiplier(options.terrainTimeMultiplier) *
    evolution.time;

  return Math.max(1, round(minutes));
}

export function calculateBuildingBenefit(
  building: BuildingId | BuildingDefinition,
  level: number,
): number {
  const definition = resolveBuilding(building);
  const perLevel = definition.benefit.perLevel;

  // Breakthrough Logic (Níveis de Ruptura)
  // Spiky progression: benefits jump at key levels (3, 7, and 10)
  let multipliers = 0;
  for (let i = 2; i <= level; i++) {
    // Level 10 is the "Sovereign" level, but we reduced the spike for better balance
    if (i === 10) multipliers += 2.6;
    else if (i === 7) multipliers += 1.8;
    else if (i === 3) multipliers += 1.5;
    else multipliers += 1.0; // Standard linear growth
  }

  return definition.benefit.base + multipliers * perLevel;
}

export type BuildingActionDelta = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
  note: string;
};

export function calculateBuildingActionDelta(buildingId: BuildingId, level: number): BuildingActionDelta {
  const safeLevel = clamp(Math.floor(level), 1, 10);
  const benefit = calculateBuildingBenefit(buildingId, safeLevel);

  switch (buildingId) {
    case "mines":
      return {
        materials: round(Math.max(80, benefit * 0.92)),
        supplies: 0,
        energy: -round(24 + safeLevel * 4),
        influence: round(4 + safeLevel * 1.4),
        note: "Extracao acelerada de materiais",
      };
    case "farms":
      return {
        materials: 0,
        supplies: round(Math.max(80, benefit * 0.9)),
        energy: -round(20 + safeLevel * 3),
        influence: round(3 + safeLevel * 1.3),
        note: "Pulso de abastecimento",
      };
    case "housing":
      return {
        materials: -round(28 + safeLevel * 5),
        supplies: round(34 + safeLevel * 6),
        energy: -round(10 + safeLevel * 2),
        influence: round(6 + safeLevel * 1.8),
        note: "Mobilizacao civil",
      };
    case "research":
      return {
        materials: -round(26 + safeLevel * 6),
        supplies: 0,
        energy: -round(30 + safeLevel * 4),
        influence: round(20 + safeLevel * 3),
        note: "Aceleracao cientifica",
      };
    case "palace":
      return {
        materials: -round(34 + safeLevel * 7),
        supplies: -round(16 + safeLevel * 3),
        energy: -round(12 + safeLevel * 2),
        influence: round(28 + safeLevel * 4),
        note: "Decreto imperial",
      };
    case "senate":
      return {
        materials: -round(24 + safeLevel * 5),
        supplies: -round(22 + safeLevel * 4),
        energy: -round(14 + safeLevel * 2),
        influence: round(32 + safeLevel * 4.5),
        note: "Negociacao politica",
      };
    case "barracks":
      return {
        materials: -round(20 + safeLevel * 4),
        supplies: -round(58 + safeLevel * 10),
        energy: -round(34 + safeLevel * 6),
        influence: round(8 + safeLevel * 2),
        note: "Treino de tropa",
      };
    case "arsenal":
      return {
        materials: -round(62 + safeLevel * 12),
        supplies: -round(28 + safeLevel * 5),
        energy: -round(42 + safeLevel * 7),
        influence: round(10 + safeLevel * 2.2),
        note: "Forja militar",
      };
    case "wall":
      return {
        materials: -round(54 + safeLevel * 10),
        supplies: -round(22 + safeLevel * 4),
        energy: -round(18 + safeLevel * 3),
        influence: round(7 + safeLevel * 1.8),
        note: "Reforco de muralha",
      };
    case "wonder":
      return {
        materials: -round(120 + safeLevel * 20),
        supplies: -round(60 + safeLevel * 9),
        energy: -round(72 + safeLevel * 11),
        influence: round(36 + safeLevel * 5),
        note: "Impulso de legado",
      };
    case "roads":
      return {
        materials: -round(48 + safeLevel * 8),
        supplies: -round(20 + safeLevel * 3),
        energy: -round(36 + safeLevel * 6),
        influence: round(8 + safeLevel * 1.8),
        note: "Operacao logistica",
      };
    default:
      return {
        materials: 0,
        supplies: 0,
        energy: 0,
        influence: 0,
        note: "Sem efeito",
      };
  }
}

export function calculateInfluenceCap(palaceLevel: number, senateLevel: number): number {
  return palaceLevel * 100 + senateLevel * 500;
}

export type SovereigntyScoreInput = {
  villageDevelopments: number[];
  councilHeroes: number;
  militaryRankingPoints: number;
  eraQuestsCompleted?: number;
  wondersControlled?: number;
  currentDay: number;
  hasTribeDome?: boolean;
  tribeLoyaltyStage?: number;
  kingAlive?: boolean;
};

export type SovereigntyScoreBreakdown = {
  buildingLevels: number;
  militaryRanking: number;
  heroesCouncil: number;
  eraQuests: number;
  wonders: number;
  tribeDome: number;
  tribeLoyaltyStage: number;
  tribeLoyaltyNextDay: number | null;
  total: number;
  max: number;
  portalCut: number;
  portalEligible: boolean;
};

export function calculateVillageDevelopment(levels: Partial<Record<BuildingId, number>>): number {
  return SOVEREIGNTY_BUILDING_IDS.reduce((acc, buildingId) => {
    const definition = BUILDINGS_BY_ID[buildingId];
    const rawLevel = levels[buildingId] ?? 0;
    const sanitizedLevel = clamp(Math.floor(rawLevel), 0, definition?.maxLevel ?? 10);
    const villageDevelopmentPerLevel = definition?.villageDevelopmentPerLevel ?? 1;
    const villageDevelopmentCap =
      definition?.villageDevelopmentCap ?? (definition?.maxLevel ?? 10) * villageDevelopmentPerLevel;

    return acc + clamp(sanitizedLevel * villageDevelopmentPerLevel, 0, villageDevelopmentCap);
  }, 0);
}

export function calculateVillageInfluencePoints(development: number): number {
  return clamp(Math.floor(development), 0, 100);
}

export function calculateTribeProgressStage(input: {
  currentDay: number;
  tribeEnvoysCommitted: number;
  kingAlive?: boolean;
}): number {
  if (input.kingAlive === false) {
    return 0;
  }

  const envoys = clamp(Math.floor(input.tribeEnvoysCommitted ?? 0), 0, MAX_TRIBE_ENVOYS);
  if (envoys <= 0) {
    return 0;
  }

  let stage = 1;
  if (input.currentDay >= 30) stage = 2;
  if (input.currentDay >= 60) stage = 3;
  if (input.currentDay >= 91) stage = 4;
  if (input.currentDay >= 91 && envoys >= 2) stage = 5;
  return clamp(stage, 0, TRIBE_LOYALTY_STAGE_COUNT);
}

export function describeNextTribeStep(input: {
  currentDay: number;
  currentStage: number;
  tribeEnvoysCommitted: number;
  kingAlive?: boolean;
}): string {
  if (input.kingAlive === false) {
    return "Mantenha o Rei vivo. Sem Coroa ativa, a linha da Tribo cai para 0.";
  }

  const stage = clamp(Math.floor(input.currentStage ?? 0), 0, TRIBE_LOYALTY_STAGE_COUNT);
  const envoys = clamp(Math.floor(input.tribeEnvoysCommitted ?? 0), 0, MAX_TRIBE_ENVOYS);

  if (stage <= 0) {
    return "Recrute e envie o 1o enviado tribal para abrir Representacao e ganhar os primeiros 40.";
  }
  if (stage === 1) {
    return "Permaneça leal ate o Dia 30 para fechar Pacto e ganhar +40.";
  }
  if (stage === 2) {
    return "Segure a filiacao tribal ate o Dia 60 para abrir Camara e ganhar +40.";
  }
  if (stage === 3) {
    return "Entre vivo na Fase IV (Dia 91) para abrir o penultimo +40 da Tribo.";
  }
  if (stage === 4 && envoys < 2) {
    return "Recrute e envie o 2o enviado tribal na fase final para fechar os ultimos +40.";
  }
  if (stage === 4) {
    return "Envie o 2o enviado tribal e mantenha a ligacao ate consolidar o ultimo selo de 40.";
  }
  return "Trilha tribal completa. Os 200 pontos da Tribo ja estao fechados.";
}

export function calculateBuildingUpgradeLoad(buildingId: BuildingId, nextLevel: number): number {
  const sanitizedLevel = clamp(Math.floor(nextLevel), 0, 10);
  if (buildingId === "roads" || sanitizedLevel <= 1) {
    return 0;
  }
  if (buildingId === "wonder") {
    return 8;
  }
  if (sanitizedLevel <= 3) {
    return 1;
  }
  if (sanitizedLevel <= 6) {
    return 2;
  }
  if (sanitizedLevel <= 8) {
    return 3;
  }
  return 4;
}

export function calculateVillageConstructionLoad(levels: Partial<Record<BuildingId, number>>): number {
  const buildingIds = Object.keys(BUILDINGS_BY_ID) as BuildingId[];

  return buildingIds.reduce((acc, buildingId) => {
    if (buildingId === "roads") {
      return acc;
    }

    const definition = BUILDINGS_BY_ID[buildingId];
    const level = clamp(Math.floor(levels[buildingId] ?? 0), 0, definition.maxLevel);
    if (level <= 1) {
      return acc;
    }

    let load = acc;
    for (let currentLevel = 2; currentLevel <= level; currentLevel += 1) {
      load += calculateBuildingUpgradeLoad(buildingId, currentLevel);
    }
    return load;
  }, 0);
}

export function calculateVillageConstructionCapacity(
  levels: Partial<Record<BuildingId, number>>,
  hasEngineer = false,
): number {
  const palace = clamp(Math.floor(levels.palace ?? 0), 0, 10);
  const senate = clamp(Math.floor(levels.senate ?? 0), 0, 10);
  const housing = clamp(Math.floor(levels.housing ?? 0), 0, 10);
  const research = clamp(Math.floor(levels.research ?? 0), 0, 10);
  const wall = clamp(Math.floor(levels.wall ?? 0), 0, 10);

  return (
    40 +
    palace * 6 +
    senate * 5 +
    housing * 4 +
    research * 3 +
    wall * 2 +
    (hasEngineer ? 10 : 0)
  );
}

export function calculateVillageConstructionRemaining(
  levels: Partial<Record<BuildingId, number>>,
  hasEngineer = false,
): number {
  const capacity = calculateVillageConstructionCapacity(levels, hasEngineer);
  const load = calculateVillageConstructionLoad(levels);
  return Math.max(0, capacity - load);
}

export type TribeLoyaltyProgress = {
  stage: number;
  points: number;
  nextStageDay: number | null;
};

export function calculateTribeLoyaltyProgress(input: {
  currentDay: number;
  hasTribeDome?: boolean;
  kingAlive?: boolean;
  explicitStage?: number;
}): TribeLoyaltyProgress {
  const hasDome = Boolean(input.hasTribeDome);
  const kingAlive = input.kingAlive ?? true;
  if (!hasDome || !kingAlive) {
    return { stage: 0, points: 0, nextStageDay: Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT) };
  }

  const stageByDay = Math.floor(
    clamp(input.currentDay, 0, GAME_BALANCE_CONSTANTS.worldDays) /
    Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT),
  );
  const stage = clamp(
    typeof input.explicitStage === "number" ? Math.floor(input.explicitStage) : stageByDay,
    0,
    TRIBE_LOYALTY_STAGE_COUNT,
  );

  const points = stage * TRIBE_LOYALTY_STAGE_BONUS;
  const nextStageDay =
    stage >= TRIBE_LOYALTY_STAGE_COUNT
      ? null
      : Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT) * (stage + 1);

  return {
    stage,
    points,
    nextStageDay,
  };
}

export type ResonanceState = {
  currentTicks: number; // 0 to 4
  resonancePct: number; // 0 to 100
};

/**
 * Calculates the next state of Social Resonance.
 * Every 100% resonancePct triggers 1 tick.
 * When reaching 4 ticks, the player harvests +50 Influence.
 * This creates the "4-tick heartbeat" dynamic for social progress.
 */
export function processSocialResonance(state: ResonanceState, deltaResonance: number): ResonanceState & { influenceHarvest: number } {
  let nextPct = state.resonancePct + deltaResonance;
  let nextTicks = state.currentTicks;
  let influenceHarvest = 0;

  while (nextPct >= 100) {
    nextPct -= 100;
    nextTicks += 1;
  }

  if (nextTicks >= 4) {
    nextTicks = 0;
    influenceHarvest = 50;
  }

  return {
    currentTicks: nextTicks,
    resonancePct: nextPct,
    influenceHarvest,
  };
}

export function calculateSovereigntyScore(input: SovereigntyScoreInput): SovereigntyScoreBreakdown {
  const cappedDevelopments = input.villageDevelopments.slice(0, 10);
  const buildingLevels = clamp(
    round(cappedDevelopments.reduce((acc, value) => acc + calculateVillageInfluencePoints(value), 0)),
    0,
    1000,
  );

  const militaryRanking = clamp(round(input.militaryRankingPoints), 0, 500);
  const heroesCouncil = clamp(Math.floor(input.councilHeroes), 0, 5) * 50;
  const eraQuests = clamp(Math.floor(input.eraQuestsCompleted ?? 0), 0, 3) * 100;
  const wonders = clamp(Math.floor(input.wondersControlled ?? 0), 0, 5) * 50;

  const loyalty = calculateTribeLoyaltyProgress({
    currentDay: input.currentDay,
    hasTribeDome: input.hasTribeDome,
    kingAlive: input.kingAlive,
    explicitStage: input.tribeLoyaltyStage,
  });
  const tribeDome = loyalty.points;

  const total = clamp(
    buildingLevels + militaryRanking + heroesCouncil + eraQuests + wonders + tribeDome,
    0,
    SOVEREIGNTY_SCORE_MAX,
  );

  return {
    buildingLevels,
    militaryRanking,
    heroesCouncil,
    eraQuests,
    wonders,
    tribeDome,
    tribeLoyaltyStage: loyalty.stage,
    tribeLoyaltyNextDay: loyalty.nextStageDay,
    total,
    max: SOVEREIGNTY_SCORE_MAX,
    portalCut: SOVEREIGNTY_PORTAL_CUT,
    portalEligible: total >= SOVEREIGNTY_PORTAL_CUT,
  };
}

export function canEnterPortal(score: number | SovereigntyScoreBreakdown): boolean {
  const resolved = typeof score === "number" ? score : score.total;
  return resolved >= SOVEREIGNTY_PORTAL_CUT;
}

export type OutcomeDecisionKey =
  | "capitalArchetype"
  | "buildArchitecture"
  | "expansionTiming"
  | "occupationChallenge"
  | "officerGarrison"
  | "militaryEfficiency"
  | "tribeSovereignty"
  | "questManagement"
  | "finalExodus"
  | "hordeResilience";

export type OutcomeDecisionInput = Partial<Record<OutcomeDecisionKey, number>>;

export type OutcomeDecisionWeight = {
  key: OutcomeDecisionKey;
  label: string;
  weight: number;
};

export const OUTCOME_DECISION_WEIGHTS: ReadonlyArray<OutcomeDecisionWeight> = [
  { key: "capitalArchetype", label: "Arquetipo de Capital", weight: 180 },
  { key: "buildArchitecture", label: "Arquitetura de Construcao", weight: 320 },
  { key: "expansionTiming", label: "Timing de Expansao", weight: 260 },
  { key: "occupationChallenge", label: "Desafio de Ocupacao", weight: 260 },
  { key: "officerGarrison", label: "Guarnicao de Oficiais", weight: 180 },
  { key: "militaryEfficiency", label: "Eficacia Militar", weight: 420 },
  { key: "tribeSovereignty", label: "Soberania de Tribo", weight: 180 },
  { key: "questManagement", label: "Gestao de Quests", weight: 220 },
  { key: "finalExodus", label: "Exodo Final", weight: 280 },
  { key: "hordeResilience", label: "Resiliencia de Horda", weight: 200 },
] as const;

export type OutcomeDecisionBreakdown = {
  key: OutcomeDecisionKey;
  label: string;
  weight: number;
  value01: number;
  points: number;
  efficiencyPercent: number;
};

export type OutcomePathBreakdown = {
  infraPath: number;
  militaryPath: number;
  leadershipPath: number;
};

export type OutcomeScoreBreakdown = {
  total: number;
  max: number;
  portalCut: number;
  portalEligible: boolean;
  byDecision: OutcomeDecisionBreakdown[];
  byPath: OutcomePathBreakdown;
};

function normalizeDecisionValue(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return clamp(raw, 0, 1);
}

export function calculateOutcomeScore(input: OutcomeDecisionInput): OutcomeScoreBreakdown {
  const byDecision = OUTCOME_DECISION_WEIGHTS.map((entry) => {
    const value01 = normalizeDecisionValue(input[entry.key]);
    const points = Math.round(entry.weight * value01);
    return {
      key: entry.key,
      label: entry.label,
      weight: entry.weight,
      value01,
      points,
      efficiencyPercent: Math.round(value01 * 100),
    };
  });

  const totalRaw = byDecision.reduce((acc, row) => acc + row.points, 0);
  const total = clamp(totalRaw, 0, SOVEREIGNTY_SCORE_MAX);

  const pick = (key: OutcomeDecisionKey) => byDecision.find((row) => row.key === key)?.points ?? 0;
  const byPath = {
    infraPath:
      pick("capitalArchetype") +
      pick("buildArchitecture") +
      pick("expansionTiming") +
      pick("hordeResilience"),
    militaryPath:
      pick("occupationChallenge") +
      pick("militaryEfficiency") +
      pick("finalExodus"),
    leadershipPath:
      pick("officerGarrison") + pick("tribeSovereignty") + pick("questManagement"),
  };

  return {
    total,
    max: SOVEREIGNTY_SCORE_MAX,
    portalCut: SOVEREIGNTY_PORTAL_CUT,
    portalEligible: total >= SOVEREIGNTY_PORTAL_CUT,
    byDecision,
    byPath,
  };
}

export type OutcomeScenario = {
  villageDevelopments: number[];
  militaryRankingPoints: number;
  councilHeroes: number;
  eraQuestsCompleted: number;
  wondersControlled: number;
  currentDay: number;
  hasTribeDome: boolean;
  activeVillageCount: number;
  underAttackVillageCount: number;
  totalVillageCap?: number;
};

export function deriveOutcomeDecisionInput(scenario: OutcomeScenario): OutcomeDecisionInput {
  const totalVillageCap = Math.max(1, scenario.totalVillageCap ?? 10);
  const averageDevelopment =
    scenario.villageDevelopments.length > 0
      ? scenario.villageDevelopments.reduce((acc, value) => acc + clamp(value, 0, 100), 0) / scenario.villageDevelopments.length
      : 0;
  const developedVillages = scenario.villageDevelopments.filter((value) => value >= 70).length;

  const expansionRatio = clamp(scenario.activeVillageCount / totalVillageCap, 0, 1);
  const attackPressure = scenario.activeVillageCount > 0 ? scenario.underAttackVillageCount / scenario.activeVillageCount : 0;
  const developmentRatio = clamp(averageDevelopment / 100, 0, 1);
  const militaryRatio = clamp(scenario.militaryRankingPoints / 500, 0, 1);
  const wonderRatio = clamp(scenario.wondersControlled / 5, 0, 1);
  const questRatio = clamp(scenario.eraQuestsCompleted / 3, 0, 1);
  const resilienceRatio = clamp(1 - attackPressure, 0, 1);
  const expansionMaturity = clamp(developedVillages / totalVillageCap, 0, 1);

  return {
    capitalArchetype: clamp(developmentRatio * 0.58 + wonderRatio * 0.42, 0, 1),
    buildArchitecture: clamp(developmentRatio * 0.9 + expansionMaturity * 0.1, 0, 1),
    expansionTiming: clamp(expansionRatio * 0.78 + expansionMaturity * 0.22, 0, 1),
    occupationChallenge: clamp(militaryRatio * 0.78 + wonderRatio * 0.22, 0, 1),
    officerGarrison: clamp(scenario.councilHeroes / 5, 0, 1),
    militaryEfficiency: clamp(militaryRatio * 0.62 + questRatio * 0.23 + wonderRatio * 0.15, 0, 1),
    tribeSovereignty: scenario.hasTribeDome ? 1 : 0,
    questManagement: clamp(questRatio * 0.85 + wonderRatio * 0.15, 0, 1),
    finalExodus:
      scenario.currentDay < 91
        ? clamp(expansionRatio * 0.48 + militaryRatio * 0.22 + resilienceRatio * 0.3, 0, 1)
        : clamp(resilienceRatio * 0.72 + militaryRatio * 0.18 + questRatio * 0.1, 0, 1),
    hordeResilience: clamp(resilienceRatio * 0.82 + developmentRatio * 0.18, 0, 1),
  };
}
export function calculateResearchCadenceDays(adaptability: number): number {
  return clamp(6 - Math.floor(adaptability * 4), 2, 6);
}

export function calculateResearchCost(
  currentLevel: number,
  options: ResearchCostOptions = {},
): ResearchCost {
  const materials =
    (380 + currentLevel * 120) *
    safeMultiplier(options.materialsMultiplier) *
    safeMultiplier(options.terrainCostMultiplier);
  const influence =
    (70 + currentLevel * 25) *
    safeMultiplier(options.influenceMultiplier) *
    safeMultiplier(options.terrainCostMultiplier);
  return {
    materials: round(materials),
    influence: round(influence),
  };
}

export function calculateExpansionCap(
  governanceStructureLevel: number,
  governanceResearchLevel: number,
  adaptability: number,
): number {
  const rawCap = 1 + Math.floor((governanceStructureLevel + governanceResearchLevel + adaptability * 6) / 2.4);
  return clamp(rawCap, 1, 10);
}

export function calculateExpansionInfluenceCost(
  villages: number,
  expansionInfluenceMultiplier = 1,
  terrainCostMultiplier = 1,
): number {
  const safeVillages = Math.max(1, Math.floor(villages));
  const linearCost = 150 + safeVillages * 30;
  const latePressure = safeVillages > 6 ? (safeVillages - 6) ** 2 * 22 : 0;

  return round(
    (linearCost + latePressure) *
    safeMultiplier(expansionInfluenceMultiplier) *
    safeMultiplier(terrainCostMultiplier),
  );
}

export function calculateDailyEconomy(input: DailyEconomyInput): DailyEconomyResult {
  const terrainProductionMultiplier = safeMultiplier(input.terrainProductionMultiplier);
  const upkeepMult = safeMultiplier(input.upkeepMult);
  const catastrophe = input.catastrophe ?? {};

  const productionBase = {
    materials:
      input.villages *
      (180 + input.structures.economy * 26 + input.research.economy * 15) *
      (0.86 + input.traits.economyFocus * 0.52),
    supplies:
      input.villages *
      (160 + input.structures.economy * 21 + input.research.economy * 12) *
      (0.88 + input.traits.economyFocus * 0.47),
    energy:
      input.villages *
      (125 + input.structures.infrastructure * 19 + input.research.logistics * 11) *
      (0.9 + input.traits.economyFocus * 0.18),
    influence:
      input.villages *
      (22 + input.structures.governance * 4 + input.research.governance * 3) *
      (0.76 + input.traits.quality * 0.34),
  };

  let materials = productionBase.materials * terrainProductionMultiplier;
  let supplies = productionBase.supplies * terrainProductionMultiplier;
  let energy = productionBase.energy * terrainProductionMultiplier;
  let influence = productionBase.influence * terrainProductionMultiplier;
  let upkeep =
    (input.villages * 42 + input.troops.offense * 0.052 + input.troops.defense * 0.047) *
    upkeepMult;

  materials *= safeMultiplier(catastrophe.materialsMult);
  supplies *= safeMultiplier(catastrophe.suppliesMult);
  energy *= safeMultiplier(catastrophe.energyMult);
  influence *= safeMultiplier(catastrophe.influenceMult);
  upkeep *= safeMultiplier(catastrophe.upkeepMult);

  if (input.activeProtocol === "focus_supply") {
    supplies *= 1.22;
    materials *= 0.92;
  } else if (input.activeProtocol === "focus_energy") {
    energy *= 1.22;
    materials *= 0.95;
  } else if (input.activeProtocol === "focus_influence") {
    influence *= 1.3;
    supplies *= 0.94;
  }

  const villageConsumptionEnergy =
    input.villages * 18 +
    input.structures.infrastructure * 9 +
    input.structures.military * 6;

  let materialsStock = input.resources.materials + round(materials);
  let suppliesStock = input.resources.supplies + round(supplies - upkeep);
  let energyStock = input.resources.energy + round(energy - villageConsumptionEnergy);
  let influenceStock = input.resources.influence + round(influence);

  let supplyPenaltyRatio = 0;
  let energyPenaltyRatio = 0;
  let offenseMultiplierAfterPenalty = 1;
  let defenseMultiplierAfterPenalty = 1;

  if (suppliesStock < 0) {
    supplyPenaltyRatio = clamp(Math.abs(suppliesStock) / 2200, 0.05, 0.28);
    offenseMultiplierAfterPenalty *= 1 - supplyPenaltyRatio;
    defenseMultiplierAfterPenalty *= 1 - supplyPenaltyRatio * 0.85;
    suppliesStock = 0;
  }

  if (energyStock < 0) {
    energyPenaltyRatio = clamp(Math.abs(energyStock) / 1800, 0.04, 0.22);
    defenseMultiplierAfterPenalty *= 1 - energyPenaltyRatio * 0.35;
    energyStock = 0;
  }

  return {
    production: {
      materials: round(materials),
      supplies: round(supplies),
      energy: round(energy),
      influence: round(influence),
    },
    upkeep: round(upkeep),
    villageConsumptionEnergy: round(villageConsumptionEnergy),
    stocksAfterTick: {
      materials: Math.max(0, materialsStock),
      supplies: Math.max(0, suppliesStock),
      energy: Math.max(0, energyStock),
      influence: Math.max(0, influenceStock),
    },
    supplyPenaltyRatio,
    energyPenaltyRatio,
    offenseMultiplierAfterPenalty,
    defenseMultiplierAfterPenalty,
  };
}

export function calculateAttackChance(input: AttackChanceInput): number {
  const phaseBase = input.phase === "phase_1" ? 0.05 : 0.028;
  const aggressionScale = input.phase === "phase_1" ? 0.12 : 0.08;
  const humanBonus = input.isHuman ? 0.01 : 0;
  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const aggressionMult = safeMultiplier(input.aggressionMultiplier);

  const chanceRaw =
    (phaseBase + input.aggression * aggressionScale * aggressionMult + humanBonus) * terrainCombat;
  return clamp(chanceRaw, 0, 0.22);
}

export function calculateAttackForce(input: AttackForceInput): { commit: number; force: number } {
  const commit = clamp(
    0.35 + input.aggression * 0.28 + (input.hasGeneral ? 0.04 : 0),
    0.35,
    0.78,
  );

  const forceMultiplier =
    1 +
    input.researchArmyLevel * 0.018 +
    (input.hasWarLeader ? 0.14 : 0) +
    (input.hasHero ? 0.05 : 0);

  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const force = input.offense * commit * forceMultiplier * terrainCombat;
  return { commit, force };
}

export function calculateDefenseForce(input: DefenseForceInput): { commit: number; force: number } {
  const commit = input.targetSite === "capital" ? 0.58 : 0.38;
  const siteFactor = input.targetSite === "capital" ? 1.16 : 0.94;
  const baseMultiplier =
    1 +
    input.structuresDefenseLevel * 0.02 +
    input.researchArmyLevel * 0.015 +
    (input.hasHero ? 0.12 : 0);

  const wall = safeMultiplier(input.wallDefenseMultiplier);
  const tribe = safeMultiplier(input.tribeDefenseMultiplier);
  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const focusDefense = input.focusDefenseActive ? 1.22 : 1;

  const force =
    input.defense *
    commit *
    baseMultiplier *
    siteFactor *
    wall *
    tribe *
    terrainCombat *
    focusDefense;

  return { commit, force };
}

export function resolveCombat(forces: CombatForces): CombatResolution {
  if (forces.attackForce > forces.defenseForce) {
    const casualtyRatio = clamp(forces.defenseForce / Math.max(1, forces.attackForce), 0.08, 0.92);
    return {
      winner: "attacker",
      attackerLossRatio: clamp(forces.attackerCommit * casualtyRatio * 0.55, 0, 0.98),
      defenderLossRatio: clamp(forces.defenderCommit * 0.72, 0, 0.98),
    };
  }

  const casualtyRatio = clamp(forces.attackForce / Math.max(1, forces.defenseForce), 0.08, 0.85);
  return {
    winner: "defender",
    attackerLossRatio: clamp(forces.attackerCommit * 0.75, 0, 0.98),
    defenderLossRatio: clamp(forces.defenderCommit * casualtyRatio * 0.28, 0, 0.98),
  };
}

export function calculateMarchTimeMinutes(
  from: AxialCoord,
  to: AxialCoord,
  options: MarchOptions,
): MarchTime {
  const hexDistance = axialDistance(from, to);
  const baseMove = options.baseMoveMinutes ?? GAME_BALANCE_CONSTANTS.baseMoveTimeMinutes;
  const roadMove = options.roadMoveMinutes ?? GAME_BALANCE_CONSTANTS.roadMoveTimeMinutes;
  const minutesPerHex =
    (options.hasRoad ? roadMove : baseMove) * safeMultiplier(options.terrainMovementMultiplier);
  const totalMinutes = round(hexDistance * minutesPerHex);

  return {
    hexDistance,
    minutesPerHex,
    totalMinutes: Math.max(0, totalMinutes),
  };
}

export type Phase4EtaInput = {
  hexDistance: number;
  roadCoverage: number;
  hasNavigator: boolean;
  hasFlowBranch: boolean;
  hasIntendente?: boolean;
};

export function calculatePhase4MarchEtaHours(input: Phase4EtaInput): number {
  const distance = Math.max(1, Math.floor(input.hexDistance));
  const coverage = clamp(input.roadCoverage, 0, 1);

  const minutesPerHex =
    GAME_BALANCE_CONSTANTS.baseMoveTimeMinutes * (1 - coverage) +
    GAME_BALANCE_CONSTANTS.roadMoveTimeMinutes * coverage;

  let totalHours =
    (distance * minutesPerHex * GAME_BALANCE_CONSTANTS.phase4LogisticsMultiplier) / 60;

  if (input.hasNavigator && input.hasFlowBranch) {
    const specialistBase = 54 - (input.hasIntendente ? 2 : 0);
    return clamp(
      Math.round(specialistBase * 100) / 100,
      GAME_BALANCE_CONSTANTS.etaSpecialistMinHours,
      GAME_BALANCE_CONSTANTS.etaSpecialistMaxHours,
    );
  }

  if (input.hasNavigator) totalHours *= 0.76;
  if (input.hasFlowBranch) totalHours *= 0.81;
  if (input.hasIntendente) totalHours *= 0.9;

  return Math.max(1, Math.round(totalHours * 100) / 100);
}

export type MapConstructionType = "outpost" | "road";

export type MapConstructionOptions = TerrainModifiers & {
  distanceFromNetwork: number;
  logisticsLevel?: number;
  ownedVillages?: number;
  targetKind?: "empty" | "hotspot" | "abandoned_city" | "frontier_ruins";
};

export type MapConstructionCost = {
  materials: number;
  energy: number;
  influence: number;
  buildMinutes: number;
};

export function calculateMapConstructionCost(
  construction: MapConstructionType,
  options: MapConstructionOptions,
): MapConstructionCost {
  const distance = Math.max(0, Math.floor(options.distanceFromNetwork));
  const logisticsLevel = Math.max(0, options.logisticsLevel ?? 0);
  const ownedVillages = Math.max(1, Math.floor(options.ownedVillages ?? 1));
  const terrainCost = safeMultiplier(options.terrainCostMultiplier);
  const terrainTime = safeMultiplier(options.terrainTimeMultiplier);
  const logisticsDiscount = clamp(1 - logisticsLevel * 0.015, 0.72, 1);
  const targetKind = options.targetKind ?? "empty";
  const targetDiscount =
    targetKind === "frontier_ruins"
      ? 0.78
      : targetKind === "hotspot"
        ? 0.9
        : targetKind === "abandoned_city"
          ? 1.06
          : 1;

  const base =
    construction === "road"
      ? { materials: 170, energy: 64, influence: 0, minutes: 11, distanceGrowth: 1.05 }
      : { materials: 1820, energy: 760, influence: 0, minutes: 38, distanceGrowth: 1.12 };

  const distanceScalar = base.distanceGrowth ** distance;

  if (construction === "outpost") {
    const expansionPressure = 1 + Math.max(0, ownedVillages - 1) * 0.16;
    const influencePressure = calculateExpansionInfluenceCost(ownedVillages, 1.08, terrainCost);

    return {
      materials: round(base.materials * distanceScalar * terrainCost * logisticsDiscount * expansionPressure * targetDiscount),
      energy: round(base.energy * distanceScalar * terrainCost * logisticsDiscount * (0.96 + ownedVillages * 0.04) * targetDiscount),
      influence: round((influencePressure + distance * 18) * targetDiscount),
      buildMinutes: Math.max(1, round(base.minutes * distanceScalar * terrainTime * logisticsDiscount * (0.92 + ownedVillages * 0.05))),
    };
  }

  return {
    materials: round(base.materials * distanceScalar * terrainCost * logisticsDiscount),
    energy: round(base.energy * distanceScalar * terrainCost * logisticsDiscount),
    influence: round(base.influence * distanceScalar * terrainCost),
    buildMinutes: Math.max(1, round(base.minutes * distanceScalar * terrainTime * logisticsDiscount)),
  };
}

export type SpyOperationOptions = TerrainModifiers & {
  hexDistance: number;
  spyMasteryLevel?: number;
};

export type SpyOperationCost = {
  influence: number;
  prepMinutes: number;
};

export function calculateSpyOperationCost(options: SpyOperationOptions): SpyOperationCost {
  const hexDistance = Math.max(1, Math.floor(options.hexDistance));
  const mastery = Math.max(0, options.spyMasteryLevel ?? 0);
  const terrainCost = safeMultiplier(options.terrainCostMultiplier);
  const terrainTime = safeMultiplier(options.terrainTimeMultiplier);
  const masteryDiscount = clamp(1 - mastery * 0.02, 0.6, 1);

  return {
    influence: round((52 + hexDistance * 9) * terrainCost * masteryDiscount),
    prepMinutes: Math.max(1, round((8 + hexDistance * 1.8) * terrainTime * masteryDiscount)),
  };
}

export type BarracksRosterPreview = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};

export function calculateBarracksRosterPreview(barracksLevel: number): BarracksRosterPreview {
  return {
    militia: 120 + barracksLevel * 10,
    shooters: 70 + barracksLevel * 7,
    scouts: 40 + barracksLevel * 5,
    machinery: 10 + Math.floor(barracksLevel * 1.8),
  };
}

export type LegacySliceBuildingCurve = {
  level: number;
  baseCost: {
    materials: number;
    energy: number;
    influence: number;
  };
  baseTimeMin: number;
  curve: number;
};

export type LegacySliceUpgradeCost = {
  materials: number;
  energy: number;
  influence: number;
  timeMin: number;
};

export function calculateLegacySliceUpgradeCost(
  building: LegacySliceBuildingCurve,
  options: TerrainModifiers = {},
): LegacySliceUpgradeCost {
  const factor = building.curve ** Math.max(0, building.level - 1);
  const costMult = safeMultiplier(options.terrainCostMultiplier);
  const timeMult = safeMultiplier(options.terrainTimeMultiplier);

  return {
    materials: round(building.baseCost.materials * factor * costMult),
    energy: round(building.baseCost.energy * factor * costMult),
    influence: round(building.baseCost.influence * factor * costMult),
    timeMin: Math.max(6, round(building.baseTimeMin * factor * timeMult)),
  };
}

export function calculateLegacySliceInfluenceCap(palaceLevel: number): number {
  return palaceLevel * 100 + 400;
}

export type LegacySliceEconomyInput = {
  resources: EconomyResources;
  palaceLevel: number;
  bastionLevel: number;
  arsenalLevel: number;
  roadsLevel: number;
};

export type LegacySliceEconomyResult = {
  nextResources: EconomyResources;
  income: EconomyResources;
  upkeep: number;
  influenceCap: number;
};

export function calculateLegacySliceEconomyTick(input: LegacySliceEconomyInput): LegacySliceEconomyResult {
  const income = {
    materials: 210 + input.palaceLevel * 9 + input.roadsLevel * 4,
    supplies: 185 + input.palaceLevel * 5 + input.roadsLevel * 3,
    energy: 140 + input.roadsLevel * 10 + input.bastionLevel * 2,
    influence: 22 + input.palaceLevel * 3 + Math.floor(input.roadsLevel * 0.8),
  };

  const upkeep = 92 + input.arsenalLevel * 7 + input.bastionLevel * 4;
  const influenceCap = calculateLegacySliceInfluenceCap(input.palaceLevel);

  return {
    nextResources: {
      materials: Math.max(0, input.resources.materials + income.materials),
      supplies: Math.max(0, input.resources.supplies + income.supplies - upkeep),
      energy: Math.max(0, input.resources.energy + income.energy),
      influence: Math.max(0, Math.min(influenceCap, input.resources.influence + income.influence)),
    },
    income,
    upkeep,
    influenceCap,
  };
}

















