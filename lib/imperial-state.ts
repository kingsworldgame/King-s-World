"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { calculateBarracksRosterPreview } from "@/core/GameBalance";
import type { BuildingId } from "@/lib/buildings";
import type { CityClass, CityOriginKind, TerrainKind } from "@/lib/cities";
import type { VillageSummary } from "@/lib/mock-data";
import type { SandboxStrategyId } from "@/lib/sandbox-playbooks";

export type ImperialResources = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
};

export type ImperialTroops = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};

export type SandboxSnapshot = {
  resources: ImperialResources;
  troops: ImperialTroops;
  heroByVillage: Record<string, string | "none">;
  diplomatByVillage: Record<string, boolean>;
  recruitedDiplomats: number;
  recruitedTribeEnvoys: number;
  tribeEnvoysCommitted: number;
  annexEnvoysCommitted: number;
  cityClassByVillage: Record<string, CityClass>;
  cityClassLockedByVillage: Record<string, boolean>;
  deployedByVillage: Record<string, number>;
  buildingLevelsByVillage: Record<string, Partial<Record<BuildingId, number>>>;
  constructionLoadByVillage: Record<string, number>;
  extraVillages: ImperialVillageClaim[];
  sandboxStrategyId: SandboxStrategyId | null;
  sandboxCompletedActionIds: string[];
  sandboxQuestsCompleted: number;
  sandboxWondersBuilt: number;
  sandboxDomeActive: boolean;
  sandboxMarchStarted: boolean;
  logs: string[];
};

export type ImperialState = {
  version: number;
  resources: ImperialResources;
  troops: ImperialTroops;
  heroByVillage: Record<string, string | "none">;
  diplomatByVillage: Record<string, boolean>;
  recruitedDiplomats: number;
  recruitedTribeEnvoys: number;
  tribeEnvoysCommitted: number;
  annexEnvoysCommitted: number;
  cityClassByVillage: Record<string, CityClass>;
  cityClassLockedByVillage: Record<string, boolean>;
  deployedByVillage: Record<string, number>;
  buildingLevelsByVillage: Record<string, Partial<Record<BuildingId, number>>>;
  constructionLoadByVillage: Record<string, number>;
  extraVillages: ImperialVillageClaim[];
  sandboxStrategyId: SandboxStrategyId | null;
  sandboxCompletedActionIds: string[];
  sandboxQuestsCompleted: number;
  sandboxWondersBuilt: number;
  sandboxDomeActive: boolean;
  sandboxMarchStarted: boolean;
  sandboxLastSyncedDay: number;
  sandboxSnapshots: Record<string, SandboxSnapshot>;
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

type ImperialVillage = Pick<
  VillageSummary,
  "id" | "materials" | "supplies" | "energy" | "influence" | "buildingLevels"
>;

const IMPERIAL_STATE_VERSION = 9;
const stores = new Map<string, ImperialStore>();

function emptyTroops(): ImperialTroops {
  return {
    militia: 0,
    shooters: 0,
    scouts: 0,
    machinery: 0,
  };
}

function sumVillageResources(villages: ImperialVillage[]): ImperialResources {
  return villages.reduce(
    (acc, village) => ({
      materials: acc.materials + village.materials,
      supplies: acc.supplies + village.supplies,
      energy: acc.energy + village.energy,
      influence: acc.influence + village.influence,
    }),
    { materials: 0, supplies: 0, energy: 0, influence: 0 },
  );
}

function sumVillageTroops(villages: ImperialVillage[]): ImperialTroops {
  return villages.reduce((acc, village) => {
    const barracksLevel = Math.max(0, Math.min(10, Math.floor(village.buildingLevels.barracks ?? 0)));
    const preview = calculateBarracksRosterPreview(barracksLevel);
    acc.militia += Math.round(preview.militia * 0.34);
    acc.shooters += Math.round(preview.shooters * 0.32);
    acc.scouts += Math.round(preview.scouts * 0.3);
    acc.machinery += Math.round(preview.machinery * 0.28);
    return acc;
  }, emptyTroops());
}

function buildDefaultImperialState(villages: ImperialVillage[]): ImperialState {
  return {
    version: IMPERIAL_STATE_VERSION,
    resources: sumVillageResources(villages),
    troops: sumVillageTroops(villages),
    heroByVillage: {},
    diplomatByVillage: {},
    recruitedDiplomats: 0,
    recruitedTribeEnvoys: 0,
    tribeEnvoysCommitted: 0,
    annexEnvoysCommitted: 0,
    cityClassByVillage: {},
    cityClassLockedByVillage: {},
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
    return { materials: 0, supplies: 0, energy: 0, influence: 0 };
  }

  const resourceValue = value as Partial<ImperialResources>;
  return {
    materials: Math.max(0, Math.floor(normalizeNumber(resourceValue.materials))),
    supplies: Math.max(0, Math.floor(normalizeNumber(resourceValue.supplies))),
    energy: Math.max(0, Math.floor(normalizeNumber(resourceValue.energy))),
    influence: Math.max(0, Math.floor(normalizeNumber(resourceValue.influence))),
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string").slice(0, 400);
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
            diplomatByVillage: normalizeBooleanMap(snapshot?.diplomatByVillage),
            recruitedDiplomats: Math.max(0, Math.min(9, Math.floor(normalizeNumber(snapshot?.recruitedDiplomats)))),
            recruitedTribeEnvoys: Math.max(0, Math.min(2, Math.floor(normalizeNumber(snapshot?.recruitedTribeEnvoys)))),
            tribeEnvoysCommitted: Math.max(0, Math.min(2, Math.floor(normalizeNumber(snapshot?.tribeEnvoysCommitted)))),
            annexEnvoysCommitted: Math.max(0, Math.min(9, Math.floor(normalizeNumber(snapshot?.annexEnvoysCommitted)))),
            cityClassByVillage: normalizeCityClassMap(snapshot?.cityClassByVillage),
            cityClassLockedByVillage: normalizeBooleanMap(snapshot?.cityClassLockedByVillage),
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
): Record<string, Partial<Record<BuildingId, number>>> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([villageId, overrides]) => {
      if (!overrides || typeof overrides !== "object") {
        return [villageId, {}];
      }

      const normalized = Object.fromEntries(
        Object.entries(overrides as Record<string, unknown>).map(([buildingId, level]) => [
          buildingId,
          Math.max(0, Math.min(10, Math.floor(normalizeNumber(level)))),
        ]),
      ) as Partial<Record<BuildingId, number>>;

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
      energy: Math.max(0, Math.floor(normalizeNumber(entry.energy))),
      influence: Math.max(0, Math.floor(normalizeNumber(entry.influence))),
      palaceLevel: Math.max(0, Math.min(10, Math.floor(normalizeNumber(entry.palaceLevel)))),
      kingHere: Boolean(entry.kingHere),
      princeHere: Boolean(entry.princeHere),
      underAttack: Boolean(entry.underAttack),
      deficits: Array.isArray(entry.deficits) ? entry.deficits.filter((item): item is string => typeof item === "string") : [],
      buildingLevels: normalizeBuildingOverrides({ current: entry.buildingLevels }).current ?? {},
      coord: typeof entry.coord === "string" ? entry.coord : "00:00",
      axial:
        entry.axial && typeof entry.axial === "object"
          ? {
              q: Math.floor(normalizeNumber((entry.axial as { q?: number }).q)),
              r: Math.floor(normalizeNumber((entry.axial as { r?: number }).r)),
            }
          : { q: 0, r: 0 },
      owner: typeof entry.owner === "string" ? entry.owner : "Afonso",
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

  useEffect(() => {
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
      try {
        const response = await fetch(`/api/worlds/${worldId}/imperial-state`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { imperialState?: unknown };
        if (!active || !payload.imperialState) {
          return;
        }

        store.state = mergeImperialState(buildDefaultImperialState(villages), payload.imperialState);
        emit(store);
      } catch {
        // keep derived fallback if the persistent state is temporarily unavailable
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
  const getServerSnapshot = useMemo(() => () => buildDefaultImperialState(villages), [villages]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setState = (updater: ImperialState | ((current: ImperialState) => ImperialState)) => {
    const nextRaw = typeof updater === "function" ? updater(store.state) : updater;
    const next = mergeImperialState(buildDefaultImperialState(villages), nextRaw);
    store.state = next;
    emit(store);

    void fetch(`/api/worlds/${worldId}/imperial-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(next),
    }).catch(() => {
      // optimistic state stays local in memory until the next successful sync
    });
  };

  return {
    imperialState: state,
    setImperialState: setState,
  };
}

export function mergeImperialVillages(
  baseVillages: VillageSummary[],
  imperialState: ImperialState,
): VillageSummary[] {
  const mergedBase = baseVillages.map((village) => ({
    ...village,
    cityClass: imperialState.cityClassByVillage[village.id] ?? village.cityClass,
    cityClassLocked: imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked,
    buildingLevels: {
      ...village.buildingLevels,
      ...(imperialState.buildingLevelsByVillage[village.id] ?? {}),
    },
  }));

  const mergedExtra = imperialState.extraVillages.map((village) => ({
    ...village,
    cityClass: imperialState.cityClassByVillage[village.id] ?? village.cityClass,
    cityClassLocked: imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked,
    buildingLevels: {
      ...village.buildingLevels,
      ...(imperialState.buildingLevelsByVillage[village.id] ?? {}),
    },
  }));

  return [...mergedBase, ...mergedExtra];
}
