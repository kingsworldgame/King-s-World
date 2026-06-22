"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { calculateBarracksRosterPreview } from "@/core/GameBalance";
import type { BuildingId } from "@/lib/buildings";
import type { CityClass, CityOriginKind, TerrainKind } from "@/lib/cities";
import type { HeroSpecialistId } from "@/lib/council";
import type { KingProfileId } from "@/lib/king-profiles";
import {
  DEFAULT_WORKFORCE_ALLOCATIONS,
  EMPTY_MILITARY_TECH_TREE,
  normalizeMilitaryTechTree,
  normalizeWorkforceAllocations,
  type DragonChoice,
  type MilitaryTechTree,
  type WorkforceAllocations,
} from "@/lib/empire-systems";
import type { VillageSummary } from "@/lib/mock-data";
import type { SandboxStrategyId } from "@/lib/sandbox-playbooks";
import {
  buildDefaultSenateState,
  normalizeSenateState,
  type SenateMeeting,
  type SenateState,
} from "@/lib/senate-meetings";

export type ImperialResources = {
  materials: number;
  supplies: number;
  influence: number;
};

export type ImperialTroops = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};

export type CityProductionFocus = "materials" | "supplies" | "commerce" | "logistics";
export type CitySocietyFocus = "medics" | "crafts" | "order" | "scholars";
export type CityBarracksFocus = "garrison" | "shock" | "scouts" | "siege";
export type CityDefenseProtocol = "hold" | "recall" | "alarm";
export type HeroBuildId = "leadership" | "logistics" | "discipline" | "lore";
export type CityJobId = "medics" | "crafts" | "order" | "scholars";
export type TroopRecruitId = "militia" | "shooters" | "scouts" | "machinery";
export type CityDefenseRecruitId = "guards" | "archers" | "ballistae";
export type BuildingSkillSlotId = "a" | "b" | "c" | "d";
export type CityStructureId = "crown" | "economy" | "society" | "recruitment" | "defense";
export type CityJobAllocations = Record<CityJobId, number>;
export type CityProductionAllocations = Record<CityProductionFocus, number>;
export type CityRecruitAllocations = Record<TroopRecruitId, number>;
export type CityDefenseAllocations = Record<CityDefenseRecruitId, number>;
export type BuildingSkillDots = Record<BuildingSkillSlotId, number>;
export type VillageBuildingSkills = Partial<Record<CityStructureId, BuildingSkillDots>>;
export type VillageBuildingLevels = Partial<Record<CityStructureId, number>>;
export type MapMovementType = "attack" | "annex" | "support" | "spy" | "transport" | "scout";
export type MapCommandAction = "build" | "go" | "attack" | "annex" | "spy" | "explore";
export type MapBuildMode = "outpost" | "road";
export type ExplorationDiscoveryType = "empty" | "opportunity" | "threat" | "ruins" | "dragon";
export type ExplorationDiscoveryStatus = "new" | "seen" | "resolved" | "ignored";
export type MapTroopPreset = "light" | "balanced" | "heavy" | "custom";
export type MapTroopSelection = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};
export type ImperialExplorationDiscovery = {
  coordKey: string;
  type: ExplorationDiscoveryType;
  status: ExplorationDiscoveryStatus;
  title: string;
  summary: string;
  imageSrc: string;
  riskLabel: string;
  rewardLabel: string;
  actionLabel: string;
};
export type ImperialDecisionSeverity = "high" | "medium" | "low";
export type ImperialDecisionStatus = "pending" | "resolved" | "expired";
export type ImperialDecisionConsequenceType = "materials" | "supplies" | "troops" | "satisfaction";
export type ImperialDecisionInboxItem = {
  id: string;
  title: string;
  severity: ImperialDecisionSeverity;
  source: "senate" | "field" | "intel";
  createdAtDay: number;
  expiresAtDay: number;
  status: ImperialDecisionStatus;
  consequenceApplied: boolean;
  consequenceType: ImperialDecisionConsequenceType;
  consequenceAmount: number;
  consequenceLabel: string;
};
export type ImperialMapMovement = {
  id: string;
  worldId: string;
  sourceCoord: string;
  targetCoord: string;
  movementType: MapMovementType;
  commandAction: MapCommandAction;
  launchedAt: string;
  arrivalAt: string;
  etaMinutes: number;
  route: string[];
  routeSteps?: Array<{
    coordKey: string;
    legMinutes: number;
    elapsedMinutes: number;
    arrivalAt?: string;
  }>;
  status: "traveling" | "arrived" | "failed";
  meta: {
    buildMode: MapBuildMode | null;
    district: string;
    settlementOrigin?: CityOriginKind;
    settlementTerrainKind?: TerrainKind;
    settlementTerrainLabel?: string;
    settlementRecommendedClass?: CityClass;
    portalGateRequired?: number;
    sovereigntyAtLaunch?: number;
    regroupMode?: "phase4_free_mobilization";
    troopsSent?: MapTroopSelection;
    troopsTotal?: number;
    troopsQuality?: number;
    troopPreset?: MapTroopPreset;
    annexConsumesDiplomat?: boolean;
    diplomatToken?: string;
    targetLabel?: string;
    reportedIntelCoordKeys?: string[];
  };
};
export type ImperialMobilizationState = {
  active: boolean;
  startedAtDay: number | null;
};

export type CapitalTransferState = {
  active: boolean;
  sourceVillageId: string | null;
  targetVillageId: string | null;
  startedAtDay: number;
  endsAtDay: number;
  materialsCost: number;
  suppliesCost: number;
  influenceCost: number;
  // Após uma transferência completar, não dá pra começar outra até este dia.
  // Impede fuga infinita do rei.
  cooldownUntilDay: number;
};

export type SandboxSnapshot = {
  resources: ImperialResources;
  troops: ImperialTroops;
  heroByVillage: Record<string, string | "none">;
  heroBuildByVillage: Record<string, HeroBuildId>;
  diplomatByVillage: Record<string, boolean>;
  recruitedDiplomats: number;
  recruitedTribeEnvoys: number;
  tribeEnvoysCommitted: number;
  annexEnvoysCommitted: number;
  cityClassByVillage: Record<string, CityClass>;
  cityClassLockedByVillage: Record<string, boolean>;
  villageNameByVillage: Record<string, string>;
  populationByVillage: Record<string, number>;
  productionWorkersByVillage: Record<string, CityProductionAllocations>;
  jobsByVillage: Record<string, CityJobAllocations>;
  recruitsByVillage: Record<string, CityRecruitAllocations>;
  defenseRecruitsByVillage: Record<string, CityDefenseAllocations>;
  buildingSkillsByVillage: Record<string, VillageBuildingSkills>;
  deployedByVillage: Record<string, number>;
  buildingLevelsByVillage: Record<string, VillageBuildingLevels>;
  constructionLoadByVillage: Record<string, number>;
  extraVillages: ImperialVillageClaim[];
  sandboxStrategyId: SandboxStrategyId | null;
  sandboxCompletedActionIds: string[];
  sandboxQuestsCompleted: number;
  sandboxWondersBuilt: number;
  sandboxDomeActive: boolean;
  sandboxMarchStarted: boolean;
  workforceByFocus: WorkforceAllocations;
  militaryTechTree: MilitaryTechTree;
  dragonChoice: DragonChoice;
  productionFocusByVillage: Record<string, CityProductionFocus>;
  societyFocusByVillage: Record<string, CitySocietyFocus>;
  barracksFocusByVillage: Record<string, CityBarracksFocus>;
  defenseProtocolByVillage: Record<string, CityDefenseProtocol>;
  promotedHeroByVillage: Record<string, HeroSpecialistId | "none">;
  kingProfileId: KingProfileId | null;
  kingName: string | null;
  royalCapitalVillageId: string | null;
  capitalTransfer: CapitalTransferState;
  senate: SenateState;
  mapMovements: ImperialMapMovement[];
  mobilization: ImperialMobilizationState;
  exploredCoordKeys: string[];
  discoveriesByCoord: Record<string, ImperialExplorationDiscovery>;
  decisionInbox: ImperialDecisionInboxItem[];
  logs: string[];
};

export type ImperialState = {
  version: number;
  resources: ImperialResources;
  troops: ImperialTroops;
  heroByVillage: Record<string, string | "none">;
  heroBuildByVillage: Record<string, HeroBuildId>;
  diplomatByVillage: Record<string, boolean>;
  recruitedDiplomats: number;
  recruitedTribeEnvoys: number;
  tribeEnvoysCommitted: number;
  annexEnvoysCommitted: number;
  cityClassByVillage: Record<string, CityClass>;
  cityClassLockedByVillage: Record<string, boolean>;
  villageNameByVillage: Record<string, string>;
  populationByVillage: Record<string, number>;
  productionWorkersByVillage: Record<string, CityProductionAllocations>;
  jobsByVillage: Record<string, CityJobAllocations>;
  recruitsByVillage: Record<string, CityRecruitAllocations>;
  defenseRecruitsByVillage: Record<string, CityDefenseAllocations>;
  buildingSkillsByVillage: Record<string, VillageBuildingSkills>;
  deployedByVillage: Record<string, number>;
  buildingLevelsByVillage: Record<string, VillageBuildingLevels>;
  constructionLoadByVillage: Record<string, number>;
  extraVillages: ImperialVillageClaim[];
  sandboxStrategyId: SandboxStrategyId | null;
  sandboxCompletedActionIds: string[];
  sandboxQuestsCompleted: number;
  sandboxWondersBuilt: number;
  sandboxDomeActive: boolean;
  sandboxMarchStarted: boolean;
  workforceByFocus: WorkforceAllocations;
  militaryTechTree: MilitaryTechTree;
  dragonChoice: DragonChoice;
  productionFocusByVillage: Record<string, CityProductionFocus>;
  societyFocusByVillage: Record<string, CitySocietyFocus>;
  barracksFocusByVillage: Record<string, CityBarracksFocus>;
  defenseProtocolByVillage: Record<string, CityDefenseProtocol>;
  promotedHeroByVillage: Record<string, HeroSpecialistId | "none">;
  kingProfileId: KingProfileId | null;
  kingName: string | null;
  royalCapitalVillageId: string | null;
  capitalTransfer: CapitalTransferState;
  senate: SenateState;
  sandboxLastSyncedDay: number;
  sandboxSnapshots: Record<string, SandboxSnapshot>;
  mapMovements: ImperialMapMovement[];
  mobilization: ImperialMobilizationState;
  exploredCoordKeys: string[];
  discoveriesByCoord: Record<string, ImperialExplorationDiscovery>;
  decisionInbox: ImperialDecisionInboxItem[];
  logs: string[];
};

export type ImperialVillageClaim = VillageSummary & {
  coord: string;
  axial: {
    q: number;
    r: number;
  };
  cityClass?: CityClass;
  cityClassLocked?: boolean;
  originKind?: CityOriginKind;
  terrainKind?: TerrainKind;
  terrainLabel?: string;
  owner: string;
  relation: "Proprio";
  state: string;
};

type ImperialStore = {
  state: ImperialState;
  listeners: Set<() => void>;
};

const STRUCTURE_IDS: CityStructureId[] = ["crown", "economy", "society", "recruitment", "defense"];

export function mapLegacyBuildingToStructureId(buildingId: string): CityStructureId | null {
  if (STRUCTURE_IDS.includes(buildingId as CityStructureId)) return buildingId as CityStructureId;
  if (buildingId === "palace" || buildingId === "senate") return "crown";
  if (buildingId === "mines" || buildingId === "farms" || buildingId === "roads") return "economy";
  if (buildingId === "housing" || buildingId === "research") return "society";
  if (buildingId === "barracks" || buildingId === "arsenal") return "recruitment";
  if (buildingId === "wall") return "defense";
  return null;
}

export function projectStructureLevelsToBuildingLevels(levels: VillageBuildingLevels): Partial<Record<BuildingId, number>> {
  const crown = Math.max(0, Math.floor(levels.crown ?? 0));
  const economy = Math.max(0, Math.floor(levels.economy ?? 0));
  const society = Math.max(0, Math.floor(levels.society ?? 0));
  const recruitment = Math.max(0, Math.floor(levels.recruitment ?? 0));
  const defense = Math.max(0, Math.floor(levels.defense ?? 0));

  return {
    palace: crown,
    senate: crown,
    mines: economy,
    farms: economy,
    roads: economy,
    housing: society,
    research: society,
    barracks: recruitment,
    arsenal: recruitment,
    wall: defense,
  };
}

function sanitizeStructureLevel(level: unknown): number {
  return Math.max(0, Math.min(10, Math.floor(normalizeNumber(level))));
}

export function deriveStructureLevelsFromBuildingLevels(
  levels: Partial<Record<BuildingId, number>>,
): VillageBuildingLevels {
  const derived: VillageBuildingLevels = {};

  for (const [buildingId, rawLevel] of Object.entries(levels)) {
    const structureId = mapLegacyBuildingToStructureId(buildingId);
    if (!structureId) continue;
    const nextLevel = sanitizeStructureLevel(rawLevel);
    derived[structureId] = Math.max(derived[structureId] ?? 0, nextLevel);
  }

  return derived;
}

type ImperialVillage = Pick<
  VillageSummary,
  "id" | "materials" | "supplies" | "buildingLevels"
>;

const IMPERIAL_STATE_VERSION = 18;
const stores = new Map<string, ImperialStore>();

function emptyTroops(): ImperialTroops {
  return {
    militia: 0,
    shooters: 0,
    scouts: 0,
    machinery: 0,
  };
}

function emptyCapitalTransfer(): CapitalTransferState {
  return {
    active: false,
    sourceVillageId: null,
    targetVillageId: null,
    startedAtDay: 0,
    endsAtDay: 0,
    materialsCost: 0,
    suppliesCost: 0,
    influenceCost: 0,
    cooldownUntilDay: 0,
  };
}

function emptyMobilization(): ImperialMobilizationState {
  return {
    active: false,
    startedAtDay: null,
  };
}

function isHeroSpecialist(value: string): value is HeroSpecialistId {
  return value === "engineer" || value === "marshal" || value === "navigator" || value === "intendente" || value === "erudite";
}

function isKingProfileId(value: unknown): value is KingProfileId {
  return (
    value === "aurelian" ||
    value === "serenna" ||
    value === "magnor" ||
    value === "valerius" ||
    value === "isolde" ||
    value === "orian" ||
    value === "maelis" ||
    value === "corven" ||
    value === "nyra"
  );
}

function normalizeProductionFocusMap(value: unknown): Record<string, CityProductionFocus> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry === "materials" || entry === "supplies" || entry === "commerce" || entry === "logistics"),
  ) as Record<string, CityProductionFocus>;
}

function normalizeHeroBuildMap(value: unknown): Record<string, HeroBuildId> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry === "leadership" || entry === "logistics" || entry === "discipline" || entry === "lore"),
  ) as Record<string, HeroBuildId>;
}

function normalizeSocietyFocusMap(value: unknown): Record<string, CitySocietyFocus> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry === "medics" || entry === "crafts" || entry === "order" || entry === "scholars"),
  ) as Record<string, CitySocietyFocus>;
}

function normalizeBarracksFocusMap(value: unknown): Record<string, CityBarracksFocus> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry === "garrison" || entry === "shock" || entry === "scouts" || entry === "siege"),
  ) as Record<string, CityBarracksFocus>;
}

function normalizeDefenseProtocolMap(value: unknown): Record<string, CityDefenseProtocol> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry === "hold" || entry === "recall" || entry === "alarm"),
  ) as Record<string, CityDefenseProtocol>;
}

function normalizePromotedHeroMap(value: unknown): Record<string, HeroSpecialistId | "none"> {
  return normalizeStringMap(value, (entry) => entry === "none" || isHeroSpecialist(entry)) as Record<
    string,
    HeroSpecialistId | "none"
  >;
}

function emptyJobAllocations(): CityJobAllocations {
  return {
    medics: 0,
    crafts: 0,
    order: 0,
    scholars: 0,
  };
}

function emptyProductionAllocations(): CityProductionAllocations {
  return {
    materials: 0,
    supplies: 0,
    commerce: 0,
    logistics: 0,
  };
}

function emptyRecruitAllocations(): CityRecruitAllocations {
  return {
    militia: 0,
    shooters: 0,
    scouts: 0,
    machinery: 0,
  };
}

function emptyDefenseAllocations(): CityDefenseAllocations {
  return {
    guards: 0,
    archers: 0,
    ballistae: 0,
  };
}

function normalizeBuildingSkillsMap(value: unknown): Record<string, VillageBuildingSkills> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, entry]) => {
      if (!entry || typeof entry !== "object") {
        return [villageId, {}];
      }

      const buildingSkills: VillageBuildingSkills = {};

      for (const [buildingId, rawDots] of Object.entries(entry as Record<string, unknown>)) {
        const structureId = mapLegacyBuildingToStructureId(buildingId);
        if (!structureId) continue;
        const dots = rawDots && typeof rawDots === "object" ? (rawDots as Partial<Record<BuildingSkillSlotId, unknown>>) : {};
        const normalized = {
          a: Math.max(0, Math.min(3, Math.floor(normalizeNumber(dots.a)))),
          b: Math.max(0, Math.min(3, Math.floor(normalizeNumber(dots.b)))),
          c: Math.max(0, Math.min(3, Math.floor(normalizeNumber(dots.c)))),
          d: Math.max(0, Math.min(3, Math.floor(normalizeNumber(dots.d)))),
        };
        const current = buildingSkills[structureId];
        buildingSkills[structureId] = current
          ? {
              a: Math.max(current.a, normalized.a),
              b: Math.max(current.b, normalized.b),
              c: Math.max(current.c, normalized.c),
              d: Math.max(current.d, normalized.d),
            }
          : normalized;
      }

      return [villageId, buildingSkills];
    }),
  );
}

function normalizeMapMovements(value: unknown): ImperialMapMovement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is ImperialMapMovement => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      ...entry,
      route: Array.isArray(entry.route) ? entry.route.filter((item): item is string => typeof item === "string") : [],
      routeSteps: Array.isArray(entry.routeSteps)
        ? entry.routeSteps
            .filter((step) => Boolean(step && typeof step === "object" && typeof (step as { coordKey?: unknown }).coordKey === "string"))
            .map((step) => {
              const raw = step as { coordKey?: unknown; legMinutes?: unknown; elapsedMinutes?: unknown; arrivalAt?: unknown };
              return {
                coordKey: String(raw.coordKey),
                legMinutes: Math.max(0, normalizeNumber(raw.legMinutes)),
                elapsedMinutes: Math.max(0, normalizeNumber(raw.elapsedMinutes)),
                arrivalAt: typeof raw.arrivalAt === "string" ? raw.arrivalAt : undefined,
              };
            })
        : undefined,
      meta: {
        ...entry.meta,
        buildMode: entry.meta?.buildMode === "outpost" || entry.meta?.buildMode === "road" ? entry.meta.buildMode : null,
        district: typeof entry.meta?.district === "string" ? entry.meta.district : "A",
        reportedIntelCoordKeys: normalizeStringArray(entry.meta?.reportedIntelCoordKeys).slice(0, 160),
      },
    }));
}

function normalizeMobilizationState(value: unknown): ImperialMobilizationState {
  if (!value || typeof value !== "object") {
    return emptyMobilization();
  }

  const raw = value as Partial<Record<keyof ImperialMobilizationState, unknown>>;
  return {
    active: Boolean(raw.active),
    startedAtDay: typeof raw.startedAtDay === "number" ? raw.startedAtDay : null,
  };
}

function normalizeCityJobsMap(value: unknown): Record<string, CityJobAllocations> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, entry]) => {
      const raw = entry && typeof entry === "object" ? (entry as Partial<Record<CityJobId, unknown>>) : {};
      return [
        villageId,
        {
          medics: Math.max(0, Math.floor(normalizeNumber(raw.medics))),
          crafts: Math.max(0, Math.floor(normalizeNumber(raw.crafts))),
          order: Math.max(0, Math.floor(normalizeNumber(raw.order))),
          scholars: Math.max(0, Math.floor(normalizeNumber(raw.scholars))),
        },
      ];
    }),
  );
}

function normalizeProductionWorkersMap(value: unknown): Record<string, CityProductionAllocations> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, entry]) => {
      const raw = entry && typeof entry === "object" ? (entry as Partial<Record<CityProductionFocus, unknown>>) : {};
      return [
        villageId,
        {
          materials: Math.max(0, Math.floor(normalizeNumber(raw.materials))),
          supplies: Math.max(0, Math.floor(normalizeNumber(raw.supplies))),
          commerce: Math.max(0, Math.floor(normalizeNumber(raw.commerce))),
          logistics: Math.max(0, Math.floor(normalizeNumber(raw.logistics))),
        },
      ];
    }),
  );
}

function normalizeCityRecruitsMap(value: unknown): Record<string, CityRecruitAllocations> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, entry]) => {
      const raw = entry && typeof entry === "object" ? (entry as Partial<Record<TroopRecruitId, unknown>>) : {};
      return [
        villageId,
        {
          militia: Math.max(0, Math.floor(normalizeNumber(raw.militia))),
          shooters: Math.max(0, Math.floor(normalizeNumber(raw.shooters))),
          scouts: Math.max(0, Math.floor(normalizeNumber(raw.scouts))),
          machinery: Math.max(0, Math.floor(normalizeNumber(raw.machinery))),
        },
      ];
    }),
  );
}

function normalizeCityDefenseMap(value: unknown): Record<string, CityDefenseAllocations> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, entry]) => {
      const raw = entry && typeof entry === "object" ? (entry as Partial<Record<CityDefenseRecruitId, unknown>>) : {};
      return [
        villageId,
        {
          guards: Math.max(0, Math.floor(normalizeNumber(raw.guards))),
          archers: Math.max(0, Math.floor(normalizeNumber(raw.archers))),
          ballistae: Math.max(0, Math.floor(normalizeNumber(raw.ballistae))),
        },
      ];
    }),
  );
}

function sumVillageResources(villages: ImperialVillage[]): ImperialResources {
  return villages.reduce(
    (acc, village) => ({
      materials: acc.materials + village.materials,
      supplies: acc.supplies + village.supplies,
      influence: 0,
    }),
    { materials: 0, supplies: 0, influence: 0 },
  );
}

function sumVillageTroops(villages: ImperialVillage[]): ImperialTroops {
  return villages.reduce((acc, village) => {
    const projectedLevels = projectStructureLevelsToBuildingLevels(
      deriveStructureLevelsFromBuildingLevels(village.buildingLevels),
    );
    const barracksLevel = Math.max(0, Math.min(10, Math.floor(projectedLevels.barracks ?? 0)));
    const preview = calculateBarracksRosterPreview(barracksLevel);
    acc.militia += Math.round(preview.militia * 0.34);
    acc.shooters += Math.round(preview.shooters * 0.32);
    acc.scouts += Math.round(preview.scouts * 0.3);
    acc.machinery += Math.round(preview.machinery * 0.28);
    return acc;
  }, emptyTroops());
}

function buildDefaultImperialState(villages: ImperialVillage[]): ImperialState {
  const defaultCapitalId =
    villages.find((village) => ("type" in village ? (village as VillageSummary).type === "Capital" : false))?.id ??
    (villages[0] as { id?: string } | undefined)?.id ??
    null;
  return {
    version: IMPERIAL_STATE_VERSION,
    resources: sumVillageResources(villages),
    troops: sumVillageTroops(villages),
    heroByVillage: {},
    heroBuildByVillage: {},
    diplomatByVillage: {},
    recruitedDiplomats: 0,
    recruitedTribeEnvoys: 0,
    tribeEnvoysCommitted: 0,
    annexEnvoysCommitted: 0,
    cityClassByVillage: {},
    cityClassLockedByVillage: {},
    villageNameByVillage: {},
    populationByVillage: {},
    productionWorkersByVillage: {},
    jobsByVillage: {},
    recruitsByVillage: {},
    defenseRecruitsByVillage: {},
    buildingSkillsByVillage: {},
    deployedByVillage: {},
    buildingLevelsByVillage: {},
    constructionLoadByVillage: {},
    extraVillages: [],
    sandboxStrategyId: null,
    sandboxCompletedActionIds: [],
    sandboxQuestsCompleted: 0,
    sandboxWondersBuilt: 0,
    sandboxDomeActive: false,
    sandboxMarchStarted: false,
    workforceByFocus: { ...DEFAULT_WORKFORCE_ALLOCATIONS },
    militaryTechTree: { ...EMPTY_MILITARY_TECH_TREE },
    dragonChoice: "none",
    productionFocusByVillage: {},
    societyFocusByVillage: {},
    barracksFocusByVillage: {},
    defenseProtocolByVillage: {},
    promotedHeroByVillage: {},
    kingProfileId: null,
    kingName: null,
    royalCapitalVillageId: defaultCapitalId,
    capitalTransfer: emptyCapitalTransfer(),
    senate: buildDefaultSenateState(),
    mapMovements: [],
    mobilization: emptyMobilization(),
    exploredCoordKeys: [],
    discoveriesByCoord: {},
    decisionInbox: [],
    sandboxLastSyncedDay: 0,
    sandboxSnapshots: {},
    logs: [],
  };
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeTroops(value: unknown): ImperialTroops {
  if (!value || typeof value !== "object") {
    return emptyTroops();
  }

  const troopValue = value as Partial<ImperialTroops>;
  return {
    militia: Math.max(0, Math.floor(normalizeNumber(troopValue.militia))),
    shooters: Math.max(0, Math.floor(normalizeNumber(troopValue.shooters))),
    scouts: Math.max(0, Math.floor(normalizeNumber(troopValue.scouts))),
    machinery: Math.max(0, Math.floor(normalizeNumber(troopValue.machinery))),
  };
}

function normalizeResources(value: unknown): ImperialResources {
  if (!value || typeof value !== "object") {
    return { materials: 0, supplies: 0, influence: 0 };
  }

  const resourceValue = value as Partial<ImperialResources>;
  return {
    materials: Math.max(0, Math.floor(normalizeNumber(resourceValue.materials))),
    supplies: Math.max(0, Math.floor(normalizeNumber(resourceValue.supplies))),
    influence: Math.max(0, Math.floor(normalizeNumber(resourceValue.influence))),
  };
}

function normalizeCapitalTransfer(value: unknown): CapitalTransferState {
  if (!value || typeof value !== "object") {
    return emptyCapitalTransfer();
  }

  const raw = value as Partial<CapitalTransferState>;
  return {
    active: Boolean(raw.active),
    sourceVillageId: typeof raw.sourceVillageId === "string" ? raw.sourceVillageId : null,
    targetVillageId: typeof raw.targetVillageId === "string" ? raw.targetVillageId : null,
    startedAtDay: Math.max(0, Math.floor(normalizeNumber(raw.startedAtDay))),
    endsAtDay: Math.max(0, Math.floor(normalizeNumber(raw.endsAtDay))),
    materialsCost: Math.max(0, Math.floor(normalizeNumber(raw.materialsCost))),
    suppliesCost: Math.max(0, Math.floor(normalizeNumber(raw.suppliesCost))),
    influenceCost: Math.max(0, Math.floor(normalizeNumber(raw.influenceCost))),
    cooldownUntilDay: Math.max(0, Math.floor(normalizeNumber(raw.cooldownUntilDay))),
  };
}

function normalizeStringMap(
  value: unknown,
  validator?: (entry: string) => boolean,
): Record<string, string | "none"> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "string")
      .filter(([, entry]) => (validator ? validator(entry as string) : true))
      .map(([key, entry]) => [key, entry as string | "none"]),
  );
}

function normalizeCityClassMap(value: unknown): Record<string, CityClass> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "string")
      .map(([key, entry]) => {
        const normalized =
          entry === "metropole" ||
          entry === "posto_avancado" ||
          entry === "bastiao" ||
          entry === "celeiro" ||
          entry === "neutral"
            ? (entry as CityClass)
            : "neutral";
        return [key, normalized];
      }),
  );
}

function normalizeBooleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, Boolean(entry)]),
  );
}

function normalizeStrategyId(value: unknown): SandboxStrategyId | null {
  if (value === "metropole" || value === "posto_avancado" || value === "bastiao" || value === "celeiro") {
    return value;
  }

  return null;
}

function normalizeDragonChoice(value: unknown): DragonChoice {
  if (value === "fire" || value === "ice") {
    return value;
  }
  return "none";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string").slice(0, 400);
}

function isExplorationDiscoveryType(value: unknown): value is ExplorationDiscoveryType {
  return value === "empty" || value === "opportunity" || value === "threat" || value === "ruins" || value === "dragon";
}

function isExplorationDiscoveryStatus(value: unknown): value is ExplorationDiscoveryStatus {
  return value === "new" || value === "seen" || value === "resolved" || value === "ignored";
}

function normalizeExplorationDiscoveries(value: unknown): Record<string, ImperialExplorationDiscovery> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, raw]) => raw && typeof raw === "object")
      .map(([coordKey, raw]) => {
        const entry = raw as Partial<ImperialExplorationDiscovery>;
        return [
          coordKey,
          {
            coordKey,
            type: isExplorationDiscoveryType(entry.type) ? entry.type : "empty",
            status: isExplorationDiscoveryStatus(entry.status) ? entry.status : "new",
            title: typeof entry.title === "string" ? entry.title.slice(0, 80) : "Área explorada",
            summary: typeof entry.summary === "string" ? entry.summary.slice(0, 240) : "Nada relevante foi encontrado.",
            imageSrc: typeof entry.imageSrc === "string" ? entry.imageSrc : "/images/territory-known-empty.jpg",
            riskLabel: typeof entry.riskLabel === "string" ? entry.riskLabel.slice(0, 48) : "Baixo risco",
            rewardLabel: typeof entry.rewardLabel === "string" ? entry.rewardLabel.slice(0, 48) : "Leitura do terreno",
            actionLabel: typeof entry.actionLabel === "string" ? entry.actionLabel.slice(0, 48) : "Marcar no mapa",
          } satisfies ImperialExplorationDiscovery,
        ];
      }),
  );
}

function isDecisionSeverity(value: unknown): value is ImperialDecisionSeverity {
  return value === "high" || value === "medium" || value === "low";
}

function isDecisionStatus(value: unknown): value is ImperialDecisionStatus {
  return value === "pending" || value === "resolved" || value === "expired";
}

function isDecisionConsequenceType(value: unknown): value is ImperialDecisionConsequenceType {
  return value === "materials" || value === "supplies" || value === "troops" || value === "satisfaction";
}

function normalizeDecisionInbox(value: unknown): ImperialDecisionInboxItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Partial<ImperialDecisionInboxItem> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: typeof entry.id === "string" ? entry.id : `decision-${index + 1}`,
      title: typeof entry.title === "string" ? entry.title.slice(0, 120) : "Decisao do reino",
      severity: isDecisionSeverity(entry.severity) ? entry.severity : "medium",
      source: entry.source === "senate" || entry.source === "field" || entry.source === "intel" ? entry.source : "intel",
      createdAtDay: Math.max(0, Math.floor(normalizeNumber(entry.createdAtDay))),
      expiresAtDay: Math.max(0, Math.floor(normalizeNumber(entry.expiresAtDay))),
      status: isDecisionStatus(entry.status) ? entry.status : "pending",
      consequenceApplied: Boolean(entry.consequenceApplied),
      consequenceType: isDecisionConsequenceType(entry.consequenceType) ? entry.consequenceType : "supplies",
      consequenceAmount: Math.max(0, Math.floor(normalizeNumber(entry.consequenceAmount))),
      consequenceLabel:
        typeof entry.consequenceLabel === "string" && entry.consequenceLabel.trim().length > 0
          ? entry.consequenceLabel.slice(0, 180)
          : "Perda de ritmo do reino",
    }))
    .slice(0, 120);
}

function normalizeVillageNameMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "string")
      .map(([key, entry]) => [key, (entry as string).trim()])
      .filter(([, entry]) => entry.length > 0),
  );
}

function normalizeSandboxSnapshots(value: unknown): Record<string, SandboxSnapshot> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([day]) => /^\d+$/.test(day))
      .map(([day, raw]) => {
        const snapshot = raw as Partial<SandboxSnapshot> | undefined;
        return [
          day,
          {
            resources: normalizeResources(snapshot?.resources),
            troops: normalizeTroops(snapshot?.troops),
            heroByVillage: normalizeStringMap(snapshot?.heroByVillage),
            heroBuildByVillage: normalizeHeroBuildMap(snapshot?.heroBuildByVillage),
            diplomatByVillage: normalizeBooleanMap(snapshot?.diplomatByVillage),
            recruitedDiplomats: Math.max(0, Math.min(9, Math.floor(normalizeNumber(snapshot?.recruitedDiplomats)))),
            recruitedTribeEnvoys: Math.max(0, Math.min(2, Math.floor(normalizeNumber(snapshot?.recruitedTribeEnvoys)))),
            tribeEnvoysCommitted: Math.max(0, Math.min(2, Math.floor(normalizeNumber(snapshot?.tribeEnvoysCommitted)))),
            annexEnvoysCommitted: Math.max(0, Math.min(9, Math.floor(normalizeNumber(snapshot?.annexEnvoysCommitted)))),
            cityClassByVillage: normalizeCityClassMap(snapshot?.cityClassByVillage),
            cityClassLockedByVillage: normalizeBooleanMap(snapshot?.cityClassLockedByVillage),
            villageNameByVillage: normalizeVillageNameMap(snapshot?.villageNameByVillage),
            populationByVillage: normalizeNumberMap(snapshot?.populationByVillage),
            productionWorkersByVillage: normalizeProductionWorkersMap(snapshot?.productionWorkersByVillage),
            jobsByVillage: normalizeCityJobsMap(snapshot?.jobsByVillage),
            recruitsByVillage: normalizeCityRecruitsMap(snapshot?.recruitsByVillage),
            defenseRecruitsByVillage: normalizeCityDefenseMap(snapshot?.defenseRecruitsByVillage),
            buildingSkillsByVillage: normalizeBuildingSkillsMap(snapshot?.buildingSkillsByVillage),
            deployedByVillage: normalizeNumberMap(snapshot?.deployedByVillage),
            buildingLevelsByVillage: normalizeBuildingOverrides(snapshot?.buildingLevelsByVillage),
            constructionLoadByVillage: normalizeNumberMap(snapshot?.constructionLoadByVillage),
            extraVillages: normalizeExtraVillages(snapshot?.extraVillages),
            sandboxStrategyId: normalizeStrategyId(snapshot?.sandboxStrategyId),
            sandboxCompletedActionIds: normalizeStringArray(snapshot?.sandboxCompletedActionIds),
            sandboxQuestsCompleted: Math.max(0, Math.min(3, Math.floor(normalizeNumber(snapshot?.sandboxQuestsCompleted)))),
            sandboxWondersBuilt: Math.max(0, Math.min(5, Math.floor(normalizeNumber(snapshot?.sandboxWondersBuilt)))),
            sandboxDomeActive: Boolean(snapshot?.sandboxDomeActive),
            sandboxMarchStarted: Boolean(snapshot?.sandboxMarchStarted),
            workforceByFocus: normalizeWorkforceAllocations(snapshot?.workforceByFocus),
            militaryTechTree: normalizeMilitaryTechTree(snapshot?.militaryTechTree),
            dragonChoice: normalizeDragonChoice(snapshot?.dragonChoice),
            productionFocusByVillage: normalizeProductionFocusMap(snapshot?.productionFocusByVillage),
            societyFocusByVillage: normalizeSocietyFocusMap(snapshot?.societyFocusByVillage),
            barracksFocusByVillage: normalizeBarracksFocusMap(snapshot?.barracksFocusByVillage),
            defenseProtocolByVillage: normalizeDefenseProtocolMap(snapshot?.defenseProtocolByVillage),
            promotedHeroByVillage: {},
            kingProfileId: isKingProfileId(snapshot?.kingProfileId) ? snapshot.kingProfileId : null,
            kingName: typeof snapshot?.kingName === "string" && snapshot.kingName.trim().length > 0 ? snapshot.kingName.trim().slice(0, 32) : null,
            royalCapitalVillageId: typeof snapshot?.royalCapitalVillageId === "string" ? snapshot.royalCapitalVillageId : null,
            capitalTransfer: normalizeCapitalTransfer(snapshot?.capitalTransfer),
            senate: normalizeSenateState(snapshot?.senate),
            mapMovements: normalizeMapMovements(snapshot?.mapMovements),
            mobilization: normalizeMobilizationState(snapshot?.mobilization),
            exploredCoordKeys: normalizeStringArray(snapshot?.exploredCoordKeys),
            discoveriesByCoord: normalizeExplorationDiscoveries(snapshot?.discoveriesByCoord),
            decisionInbox: normalizeDecisionInbox(snapshot?.decisionInbox),
            logs: normalizeStringArray(snapshot?.logs).slice(0, 12),
          } satisfies SandboxSnapshot,
        ];
      }),
  );
}

function normalizeNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      Math.max(0, Math.floor(normalizeNumber(entry))),
    ]),
  );
}

function normalizeBuildingOverrides(
  value: unknown,
): Record<string, VillageBuildingLevels> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, overrides]) => {
      if (!overrides || typeof overrides !== "object") {
        return [villageId, {}];
      }

      const normalized: VillageBuildingLevels = {};

      for (const structureId of STRUCTURE_IDS) {
        const rawLevel = (overrides as Record<string, unknown>)[structureId];
        if (typeof rawLevel === "number") {
          normalized[structureId] = sanitizeStructureLevel(rawLevel);
        }
      }

      for (const [buildingId, rawLevel] of Object.entries(overrides as Record<string, unknown>)) {
        const structureId = mapLegacyBuildingToStructureId(buildingId);
        if (!structureId) continue;
        normalized[structureId] = Math.max(normalized[structureId] ?? 0, sanitizeStructureLevel(rawLevel));
      }

      return [villageId, normalized];
    }),
  );
}

function normalizeExtraVillages(value: unknown): ImperialVillageClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Partial<ImperialVillageClaim> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: typeof entry.id === "string" ? entry.id : `extra-village-${index + 1}`,
      name: typeof entry.name === "string" ? entry.name : `Nova Aldeia ${index + 1}`,
      type: entry.type === "Capital" ? "Capital" : "Colonia",
      cityClass:
        entry.cityClass === "metropole" ||
        entry.cityClass === "posto_avancado" ||
        entry.cityClass === "bastiao" ||
        entry.cityClass === "celeiro" ||
        entry.cityClass === "neutral"
          ? entry.cityClass
          : "neutral",
      cityClassLocked: Boolean(entry.cityClassLocked),
      originKind:
        entry.originKind === "claimed_city" ||
        entry.originKind === "wild_empty" ||
        entry.originKind === "abandoned_city" ||
        entry.originKind === "frontier_ruins" ||
        entry.originKind === "hotspot"
          ? entry.originKind
          : "wild_empty",
      terrainKind:
        entry.terrainKind === "crown_heartland" ||
        entry.terrainKind === "riverlands" ||
        entry.terrainKind === "frontier_pass" ||
        entry.terrainKind === "ironridge" ||
        entry.terrainKind === "ashen_fields"
          ? entry.terrainKind
          : "ashen_fields",
      terrainLabel: typeof entry.terrainLabel === "string" ? entry.terrainLabel : "Campos de Cinza",
      politicalState: typeof entry.politicalState === "string" ? entry.politicalState : "Fundada no mapa",
      materials: Math.max(0, Math.floor(normalizeNumber(entry.materials))),
      supplies: Math.max(0, Math.floor(normalizeNumber(entry.supplies))),
      influence: Math.max(0, Math.floor(normalizeNumber(entry.influence))),
      palaceLevel: Math.max(0, Math.min(10, Math.floor(normalizeNumber(entry.palaceLevel)))),
      kingHere: Boolean(entry.kingHere),
      princeHere: Boolean(entry.princeHere),
      underAttack: Boolean(entry.underAttack),
      deficits: Array.isArray(entry.deficits) ? entry.deficits.filter((item): item is string => typeof item === "string") : [],
      buildingLevels: {
        ...entry.buildingLevels,
        ...projectStructureLevelsToBuildingLevels(
          normalizeBuildingOverrides({ current: entry.buildingLevels }).current ?? {},
        ),
      },
      coord: typeof entry.coord === "string" ? entry.coord : "00:00",
      axial:
        entry.axial && typeof entry.axial === "object"
          ? {
              q: Math.floor(normalizeNumber((entry.axial as { q?: number }).q)),
              r: Math.floor(normalizeNumber((entry.axial as { r?: number }).r)),
            }
          : { q: 0, r: 0 },
      owner: typeof entry.owner === "string" ? entry.owner : "Seu reino",
      relation: "Proprio",
      state: typeof entry.state === "string" ? entry.state : "Nova base imperial",
    }));
}

function mergeImperialState(base: ImperialState, incoming: unknown): ImperialState {
  if (!incoming || typeof incoming !== "object") {
    return base;
  }

  const raw = incoming as Partial<ImperialState>;
  const incomingVersion = typeof raw.version === "number" ? raw.version : 0;
  if (incomingVersion !== IMPERIAL_STATE_VERSION) {
    return base;
  }

  return {
    version: IMPERIAL_STATE_VERSION,
    resources: {
      ...base.resources,
      ...normalizeResources(raw.resources),
    },
    troops: normalizeTroops(raw.troops),
    heroByVillage: {
      ...base.heroByVillage,
      ...normalizeStringMap(raw.heroByVillage),
    },
    heroBuildByVillage: {
      ...base.heroBuildByVillage,
      ...normalizeHeroBuildMap(raw.heroBuildByVillage),
    },
    diplomatByVillage: {
      ...base.diplomatByVillage,
      ...normalizeBooleanMap(raw.diplomatByVillage),
    },
    recruitedDiplomats: Math.max(0, Math.min(9, Math.floor(normalizeNumber(raw.recruitedDiplomats)))),
    recruitedTribeEnvoys: Math.max(0, Math.min(2, Math.floor(normalizeNumber(raw.recruitedTribeEnvoys)))),
    tribeEnvoysCommitted: Math.max(0, Math.min(2, Math.floor(normalizeNumber(raw.tribeEnvoysCommitted)))),
    annexEnvoysCommitted: Math.max(0, Math.min(9, Math.floor(normalizeNumber(raw.annexEnvoysCommitted)))),
    cityClassByVillage: {
      ...base.cityClassByVillage,
      ...normalizeCityClassMap(raw.cityClassByVillage),
    },
    cityClassLockedByVillage: {
      ...base.cityClassLockedByVillage,
      ...normalizeBooleanMap(raw.cityClassLockedByVillage),
    },
    villageNameByVillage: {
      ...base.villageNameByVillage,
      ...normalizeVillageNameMap(raw.villageNameByVillage),
    },
    populationByVillage: {
      ...base.populationByVillage,
      ...normalizeNumberMap(raw.populationByVillage),
    },
    productionWorkersByVillage: {
      ...base.productionWorkersByVillage,
      ...normalizeProductionWorkersMap(raw.productionWorkersByVillage),
    },
    jobsByVillage: {
      ...base.jobsByVillage,
      ...normalizeCityJobsMap(raw.jobsByVillage),
    },
    recruitsByVillage: {
      ...base.recruitsByVillage,
      ...normalizeCityRecruitsMap(raw.recruitsByVillage),
    },
    defenseRecruitsByVillage: {
      ...base.defenseRecruitsByVillage,
      ...normalizeCityDefenseMap(raw.defenseRecruitsByVillage),
    },
    buildingSkillsByVillage: {
      ...base.buildingSkillsByVillage,
      ...normalizeBuildingSkillsMap(raw.buildingSkillsByVillage),
    },
    deployedByVillage: {
      ...base.deployedByVillage,
      ...normalizeNumberMap(raw.deployedByVillage),
    },
    buildingLevelsByVillage: {
      ...base.buildingLevelsByVillage,
      ...normalizeBuildingOverrides(raw.buildingLevelsByVillage),
    },
    constructionLoadByVillage: {
      ...base.constructionLoadByVillage,
      ...normalizeNumberMap(raw.constructionLoadByVillage),
    },
    extraVillages: normalizeExtraVillages(raw.extraVillages),
    sandboxStrategyId: normalizeStrategyId(raw.sandboxStrategyId),
    sandboxCompletedActionIds: normalizeStringArray(raw.sandboxCompletedActionIds),
    sandboxQuestsCompleted: Math.max(0, Math.min(3, Math.floor(normalizeNumber(raw.sandboxQuestsCompleted)))),
    sandboxWondersBuilt: Math.max(0, Math.min(5, Math.floor(normalizeNumber(raw.sandboxWondersBuilt)))),
    sandboxDomeActive: Boolean(raw.sandboxDomeActive),
    sandboxMarchStarted: Boolean(raw.sandboxMarchStarted),
    workforceByFocus: normalizeWorkforceAllocations(raw.workforceByFocus),
    militaryTechTree: normalizeMilitaryTechTree(raw.militaryTechTree),
    dragonChoice: normalizeDragonChoice(raw.dragonChoice),
    productionFocusByVillage: {
      ...base.productionFocusByVillage,
      ...normalizeProductionFocusMap(raw.productionFocusByVillage),
    },
    societyFocusByVillage: {
      ...base.societyFocusByVillage,
      ...normalizeSocietyFocusMap(raw.societyFocusByVillage),
    },
    barracksFocusByVillage: {
      ...base.barracksFocusByVillage,
      ...normalizeBarracksFocusMap(raw.barracksFocusByVillage),
    },
    defenseProtocolByVillage: {
      ...base.defenseProtocolByVillage,
      ...normalizeDefenseProtocolMap(raw.defenseProtocolByVillage),
    },
    promotedHeroByVillage: {},
    kingProfileId: isKingProfileId(raw.kingProfileId) ? raw.kingProfileId : base.kingProfileId,
    kingName: typeof raw.kingName === "string" && raw.kingName.trim().length > 0 ? raw.kingName.trim().slice(0, 32) : base.kingName,
    royalCapitalVillageId: typeof raw.royalCapitalVillageId === "string" ? raw.royalCapitalVillageId : base.royalCapitalVillageId,
    capitalTransfer: normalizeCapitalTransfer(raw.capitalTransfer),
    senate: normalizeSenateState(raw.senate),
    mapMovements: normalizeMapMovements(raw.mapMovements),
    mobilization: normalizeMobilizationState(raw.mobilization),
    exploredCoordKeys: normalizeStringArray(raw.exploredCoordKeys),
    discoveriesByCoord: normalizeExplorationDiscoveries(raw.discoveriesByCoord),
    decisionInbox: normalizeDecisionInbox(raw.decisionInbox),
    sandboxLastSyncedDay: Math.max(0, Math.min(120, Math.floor(normalizeNumber(raw.sandboxLastSyncedDay)))),
    sandboxSnapshots: normalizeSandboxSnapshots(raw.sandboxSnapshots),
    logs: Array.isArray(raw.logs) ? raw.logs.filter((entry): entry is string => typeof entry === "string").slice(0, 12) : base.logs,
  };
}

function ensureStore(worldId: string, villages: ImperialVillage[]): ImperialStore {
  const existing = stores.get(worldId);
  if (existing && existing.state.version === IMPERIAL_STATE_VERSION) {
    return existing;
  }

  if (existing) {
    stores.delete(worldId);
  }

  const store: ImperialStore = {
    state: buildDefaultImperialState(villages),
    listeners: new Set(),
  };
  stores.set(worldId, store);
  return store;
}

function emit(store: ImperialStore) {
  store.listeners.forEach((listener) => listener());
}

export function useImperialState(worldId: string, villages: ImperialVillage[]) {
  const store = useMemo(() => ensureStore(worldId, villages), [worldId, villages]);
  const serverSnapshotRef = useRef<ImperialState>(buildDefaultImperialState(villages));
  const [isImperialStateReady, setIsImperialStateReady] = useState(false);
  const [isImperialStateHydrated, setIsImperialStateHydrated] = useState(false);

  useEffect(() => {
    setIsImperialStateReady(false);
    setIsImperialStateHydrated(false);
  }, [worldId]);

  useEffect(() => {
    serverSnapshotRef.current = buildDefaultImperialState(villages);
    const fallback = buildDefaultImperialState(villages);
    const next = mergeImperialState(fallback, store.state);
    
    // Use a simple JSON check to avoid infinite loops if objects are structurally same but new refs
    if (JSON.stringify(next) !== JSON.stringify(store.state)) {
      store.state = next;
      emit(store);
    }
  }, [villages, store]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(`/api/worlds/${worldId}/imperial-state`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        if (active) {
          setIsImperialStateHydrated(true);
        }

        const payload = (await response.json()) as { imperialState?: unknown };
        if (!active || !payload.imperialState) {
          return;
        }

        store.state = mergeImperialState(buildDefaultImperialState(villages), payload.imperialState);
        emit(store);
      } catch {
        // keep derived fallback if the persistent state is temporarily unavailable
      } finally {
        window.clearTimeout(timeout);
        if (active) {
          setIsImperialStateReady(true);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [store, villages, worldId]);

  const subscribe = useMemo(() => (listener: () => void) => {
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
    };
  }, [store]);

  const getSnapshot = useMemo(() => () => store.state, [store]);
  const getServerSnapshot = useMemo(() => () => serverSnapshotRef.current, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setState = (updater: ImperialState | ((current: ImperialState) => ImperialState)): Promise<boolean> => {
    const nextRaw = typeof updater === "function" ? updater(store.state) : updater;
    if (nextRaw === store.state) {
      return Promise.resolve(false);
    }

    const next = mergeImperialState(buildDefaultImperialState(villages), nextRaw);
    if (JSON.stringify(next) === JSON.stringify(store.state)) {
      return Promise.resolve(false);
    }

    store.state = next;
    emit(store);

    const persist = fetch(`/api/worlds/${worldId}/imperial-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(next),
    })
      .then((response) => response.ok)
      .catch(() => false);

    void persist;
    return persist;
  };

  return {
    imperialState: state,
    setImperialState: setState,
    isImperialStateReady,
    isImperialStateHydrated,
  };
}

type ImperialStateContextValue = ReturnType<typeof useImperialState>;

const ImperialStateContext = createContext<ImperialStateContextValue | null>(null);

export function ImperialStateProvider({ value, children }: { value: ImperialStateContextValue; children: ReactNode }) {
  return createElement(ImperialStateContext.Provider, { value }, children);
}

export function useImperialStateContext() {
  const value = useContext(ImperialStateContext);
  if (!value) {
    throw new Error("useImperialStateContext must be used inside ImperialStateProvider");
  }
  return value;
}

export function mergeImperialVillages(
  baseVillages: VillageSummary[],
  imperialState: ImperialState,
): VillageSummary[] {
  const activeCapitalId =
    imperialState.royalCapitalVillageId ??
    baseVillages.find((village) => village.type === "Capital")?.id ??
    baseVillages[0]?.id ??
    null;
  const transferTargetId = imperialState.capitalTransfer.active ? imperialState.capitalTransfer.targetVillageId : null;
  const resolveSettlementType = (villageId: string): VillageSummary["type"] => (villageId === activeCapitalId ? "Capital" : "Colonia");
  const mergedBase = baseVillages.map((village) => ({
    ...village,
    name: imperialState.villageNameByVillage[village.id] ?? village.name,
    type: resolveSettlementType(village.id),
    kingHere: imperialState.capitalTransfer.active ? false : village.id === activeCapitalId,
    princeHere: transferTargetId ? village.id === transferTargetId : village.princeHere,
    cityClass: imperialState.cityClassByVillage[village.id] ?? village.cityClass,
    cityClassLocked: imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked,
    buildingLevels: {
      ...village.buildingLevels,
      ...projectStructureLevelsToBuildingLevels(imperialState.buildingLevelsByVillage[village.id] ?? {}),
    },
  }));

  const mergedExtra = imperialState.extraVillages.map((village) => ({
    ...village,
    name: imperialState.villageNameByVillage[village.id] ?? village.name,
    type: resolveSettlementType(village.id),
    kingHere: imperialState.capitalTransfer.active ? false : village.id === activeCapitalId,
    princeHere: transferTargetId ? village.id === transferTargetId : village.princeHere,
    cityClass: imperialState.cityClassByVillage[village.id] ?? village.cityClass,
    cityClassLocked: imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked,
    buildingLevels: {
      ...village.buildingLevels,
      ...projectStructureLevelsToBuildingLevels(imperialState.buildingLevelsByVillage[village.id] ?? {}),
    },
  }));

  return [...mergedBase, ...mergedExtra];
}
