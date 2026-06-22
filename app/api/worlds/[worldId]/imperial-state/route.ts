import { NextResponse } from "next/server";

import { calculateCityDailyProduction } from "@/core/GameBalance";
import { normalizeImperialVillageIds, stripDedicatedImperialClientState } from "@/lib/imperial-persistence";
import { supabaseDelete, supabasePatchReturning, supabaseRpc, supabaseSelect, supabaseUpsert } from "@/lib/supabase-rest";
import { getWorldPayload } from "@/lib/world-data";
import { calculateCachedPowerScore } from "@/lib/world-rules";

type StoredImperialStateRow = {
  version: number;
  materials_stock: number;
  supplies_stock: number;
  // Âncora+taxa (modelo servidor fonte da verdade)
  materials_anchor_value: number;
  materials_anchor_at: string;
  materials_rate_per_sec: number;
  materials_capacity: number;
  supplies_anchor_value: number;
  supplies_anchor_at: string;
  supplies_rate_per_sec: number;
  supplies_capacity: number;
  militia_count: number;
  shooters_count: number;
  scouts_count: number;
  machinery_count: number;
  recruited_diplomats: number;
  recruited_tribe_envoys: number;
  tribe_envoys_committed: number;
  annex_envoys_committed: number;
  sandbox_strategy_id: string | null;
  sandbox_completed_action_ids: string[];
  sandbox_quests_completed: number;
  sandbox_wonders_built: number;
  sandbox_dome_active: boolean;
  sandbox_march_started: boolean;
  sandbox_last_synced_day: number;
  sandbox_snapshots_json: Record<string, unknown>;
  logs_json: string[];
};

const RUNTIME_MAP_KEY = "__runtimeMap";
const CLIENT_STATE_KEY = "__clientState";
const STRUCTURE_IDS = ["crown", "economy", "society", "recruitment", "defense"] as const;

type CityStructureId = (typeof STRUCTURE_IDS)[number];
type StructureSlotId = "a" | "b" | "c" | "d";
type StructureDots = Record<StructureSlotId, number>;
type VillageStructureRow = {
  world_id: string;
  world_player_id: string;
  village_site_id: string;
  structure_code: CityStructureId;
  slot_a: number;
  slot_b: number;
  slot_c: number;
  slot_d: number;
  level?: number | null;
};
type TroopUnitCode = "militia" | "shooters" | "scouts" | "machinery";
type VillageCityStateRow = {
  village_site_id: string;
  world_id: string;
  world_player_id: string;
  population_current: number;
  production_focus: string;
  society_focus: string;
  barracks_focus: string;
  defense_protocol: string;
  production_materials_workers: number;
  production_supplies_workers: number;
  production_commerce_workers: number;
  production_logistics_workers: number;
  jobs_medics: number;
  jobs_crafts: number;
  jobs_order: number;
  jobs_scholars: number;
  recruits_militia: number;
  recruits_shooters: number;
  recruits_scouts: number;
  recruits_machinery: number;
  defense_guards: number;
  defense_archers: number;
  defense_ballistae: number;
  deployed_count: number;
};
type TroopStackRow = {
  site_id: string;
  owner_world_player_id: string;
  unit_code: TroopUnitCode;
  unit_grade: "bronze";
  stationing_type: "home";
  quantity: number;
};
type KingStateRow = {
  world_player_id: string;
  world_id: string;
  king_profile_id: string;
  king_name: string;
};
type ExplorationStateRow = {
  world_player_id: string;
  world_id: string;
  coord_key: string;
  q: number;
  r: number;
  discovery_type: string;
  status: string;
  title: string;
  summary: string;
  image_src: string;
  risk_label: string;
  reward_label: string;
  action_label: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampDot(value: unknown): number {
  return Math.max(0, Math.min(3, Math.floor(Number(value ?? 0))));
}

function clampLevel(value: unknown): number {
  return Math.max(0, Math.min(10, Math.floor(Number(value ?? 0))));
}

function dotsFromLevel(level: unknown): StructureDots {
  let remaining = clampLevel(level);
  const dots: StructureDots = { a: 0, b: 0, c: 0, d: 0 };
  for (const slot of ["a", "b", "c", "d"] as const) {
    const value = Math.min(3, remaining);
    dots[slot] = value;
    remaining -= value;
  }
  return dots;
}

function mapLegacyBuildingToStructureId(buildingId: string): CityStructureId | null {
  if (STRUCTURE_IDS.includes(buildingId as CityStructureId)) return buildingId as CityStructureId;
  if (buildingId === "palace" || buildingId === "senate") return "crown";
  if (buildingId === "mines" || buildingId === "farms" || buildingId === "roads") return "economy";
  if (buildingId === "housing" || buildingId === "research") return "society";
  if (buildingId === "barracks" || buildingId === "arsenal") return "recruitment";
  if (buildingId === "wall") return "defense";
  return null;
}

function normalizeDots(value: unknown, fallbackLevel?: unknown): StructureDots {
  if (!isRecord(value)) {
    return dotsFromLevel(fallbackLevel);
  }

  return {
    a: clampDot(value.a),
    b: clampDot(value.b),
    c: clampDot(value.c),
    d: clampDot(value.d),
  };
}

function sumDots(dots: StructureDots): number {
  return clampLevel(dots.a + dots.b + dots.c + dots.d);
}

function clampCount(value: unknown): number {
  return Math.max(0, Math.floor(Number(value ?? 0)));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickString(value: unknown, allowed: readonly string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function buildClientStateSnapshot(
  nextState: Record<string, unknown>,
  persistenceFlags: { structure: boolean; city: boolean; king: boolean; exploration: boolean },
) {
  const {
    sandboxSnapshots: _sandboxSnapshots,
    mapMovements: _mapMovements,
    mobilization: _mobilization,
    ...clientState
  } = nextState;
  return stripDedicatedImperialClientState(clientState, persistenceFlags);
}

function splitSandboxPayload(value: Record<string, unknown> | null | undefined) {
  const raw = value ?? {};
  const runtimeMap = raw[RUNTIME_MAP_KEY];
  const clientState = raw[CLIENT_STATE_KEY];
  return {
    clientState: isRecord(clientState) ? clientState : {},
    snapshots: Object.fromEntries(Object.entries(raw).filter(([key]) => key !== RUNTIME_MAP_KEY && key !== CLIENT_STATE_KEY)),
    mapMovements: runtimeMap && typeof runtimeMap === "object" && Array.isArray((runtimeMap as { mapMovements?: unknown[] }).mapMovements)
      ? (runtimeMap as { mapMovements: unknown[] }).mapMovements
      : [],
    mobilization:
      runtimeMap && typeof runtimeMap === "object" && (runtimeMap as { mobilization?: unknown }).mobilization && typeof (runtimeMap as { mobilization: unknown }).mobilization === "object"
        ? (runtimeMap as { mobilization: Record<string, unknown> }).mobilization
        : { active: false, startedAtDay: null },
  };
}

/**
 * Calcula e grava a taxa de produção/consumo por segundo do jogador.
 * Lê o estado de todas as cidades, usa calculateCityDailyProduction e divide
 * pelo número de segundos num dia de jogo (86400 / speedMultiplier).
 * Chamado após qualquer mudança que afecta produção (upgrade, workers, etc.).
 */
async function recalculatePlayerRates(
  worldId: string,
  worldPlayerId: string,
  speedMultiplier: number,
): Promise<void> {
  try {
    const gameDaySeconds = Math.max(1, Math.round(86400 / speedMultiplier));

    // Lê estado das cidades do jogador
    const cityParams = new URLSearchParams();
    cityParams.set("select", "village_site_id,population_current,production_focus,society_focus,production_materials_workers,production_supplies_workers,production_commerce_workers,production_logistics_workers,jobs_medics,jobs_crafts,jobs_order,jobs_scholars");
    cityParams.set("world_player_id", `eq.${worldPlayerId}`);
    cityParams.set("world_id", `eq.${worldId}`);
    const cityStates = await supabaseSelect<VillageCityStateRow>("village_city_states", cityParams);

    // Lê níveis de estrutura das cidades
    const structureParams = new URLSearchParams();
    structureParams.set("select", "village_site_id,structure_code,level");
    structureParams.set("world_player_id", `eq.${worldPlayerId}`);
    structureParams.set("world_id", `eq.${worldId}`);
    const structureStates = await supabaseSelect<VillageStructureRow>("village_structure_states", structureParams);

    // Agrupa estruturas por cidade
    const levelsByVillage = new Map<string, Partial<Record<string, number>>>();
    for (const s of structureStates) {
      if (!levelsByVillage.has(s.village_site_id)) levelsByVillage.set(s.village_site_id, {});
      levelsByVillage.get(s.village_site_id)![s.structure_code] = s.level ?? 0;
    }

    // Soma produção de todas as cidades
    let totalMaterialsPerDay = 0;
    let totalSuppliesPerDay = 0;
    let totalUpkeepPerDay = 0;

    for (const city of cityStates) {
      const rawLevels = levelsByVillage.get(city.village_site_id) ?? {};
      // Mapeia structure codes para BuildingId (simplificado para o esqueleto)
      const levels: Partial<Record<string, number>> = {
        palace: rawLevels.crown ?? 0,
        senate: rawLevels.crown ?? 0,
        mines: rawLevels.economy ?? 0,
        farms: rawLevels.economy ?? 0,
        housing: rawLevels.society ?? 0,
        barracks: rawLevels.recruitment ?? 0,
        wall: rawLevels.defense ?? 0,
      };

      const result = calculateCityDailyProduction({
        levels: levels as any,
        productionWorkers: {
          materials: city.production_materials_workers ?? 0,
          supplies: city.production_supplies_workers ?? 0,
          commerce: city.production_commerce_workers ?? 0,
          logistics: city.production_logistics_workers ?? 0,
        },
        jobs: {
          medics: city.jobs_medics ?? 0,
          crafts: city.jobs_crafts ?? 0,
          order: city.jobs_order ?? 0,
          scholars: city.jobs_scholars ?? 0,
        },
        productionFocus: (city.production_focus as any) ?? "materials",
        societyFocus: (city.society_focus as any) ?? "medics",
        populationCurrent: city.population_current ?? 0,
        worldSpeedMultiplier: speedMultiplier,
      });

      totalMaterialsPerDay += result.materials;
      totalSuppliesPerDay += result.supplies;
      // Upkeep base por cidade (42/dia) — calibrar com tropas nas fatias seguintes
      totalUpkeepPerDay += 42 * speedMultiplier;
    }

    const materialsRatePerSec = totalMaterialsPerDay / gameDaySeconds;
    const suppliesRatePerSec = (totalSuppliesPerDay - totalUpkeepPerDay) / gameDaySeconds;

    // Teto de armazenamento: base + por cidade. Mais infra = mais armazém.
    // Calibrado pra ~3-4 dias de produção (força o jogador a entrar e gastar).
    const cityCount = Math.max(1, cityStates.length);
    const materialsCapacity = 4000 + cityCount * 3000 + totalMaterialsPerDay * 3;
    const suppliesCapacity = 4000 + cityCount * 3000 + Math.max(0, totalSuppliesPerDay) * 3;

    // Settle o jogador e actualiza taxas + tetos
    await supabaseRpc("kw_settle_player", { p_world_player_id: worldPlayerId });
    const rateParams = new URLSearchParams();
    rateParams.set("world_player_id", `eq.${worldPlayerId}`);
    await supabasePatchReturning<
      { materials_rate_per_sec: number; supplies_rate_per_sec: number; materials_capacity: number; supplies_capacity: number },
      { world_player_id: string }
    >("world_player_imperial_states", rateParams, {
      materials_rate_per_sec: materialsRatePerSec,
      supplies_rate_per_sec: suppliesRatePerSec,
      materials_capacity: Math.round(materialsCapacity),
      supplies_capacity: Math.round(suppliesCapacity),
    });
  } catch {
    // Não-fatal: taxa desactualizada é corrigida no próximo tick
  }
}

function deriveAnchorValue(anchorValue: number, ratePerSec: number, anchorAt: string): number {
  const elapsedSeconds = (Date.now() - new Date(anchorAt).getTime()) / 1000;
  return Math.max(0, anchorValue + ratePerSec * elapsedSeconds);
}

function mapRowToImperialState(row: StoredImperialStateRow) {
  const sandboxPayload = splitSandboxPayload(row.sandbox_snapshots_json);
  const clientResources = isRecord(sandboxPayload.clientState.resources) ? sandboxPayload.clientState.resources : {};
  const clientTroops = isRecord(sandboxPayload.clientState.troops) ? sandboxPayload.clientState.troops : {};

  // Deriva materiais e suprimentos da âncora, clampado no teto (capacity)
  const matCap = row.materials_capacity || 8000;
  const supCap = row.supplies_capacity || 8000;
  const materialsFromAnchor = row.materials_anchor_at
    ? Math.min(matCap, deriveAnchorValue(row.materials_anchor_value, row.materials_rate_per_sec, row.materials_anchor_at))
    : row.materials_stock;
  const suppliesFromAnchor = row.supplies_anchor_at
    ? Math.min(supCap, deriveAnchorValue(row.supplies_anchor_value, row.supplies_rate_per_sec, row.supplies_anchor_at))
    : row.supplies_stock;

  return {
    ...sandboxPayload.clientState,
    version: row.version,
    resources: {
      ...clientResources,
      materials: Math.floor(materialsFromAnchor),
      supplies: Math.floor(suppliesFromAnchor),
      influence: 0,
      // Teto de armazenamento — recurso não acumula infinito
      materialsCapacity: matCap,
      suppliesCapacity: supCap,
      // Tripla âncora exposta pro cliente interpolar localmente (suavidade visual)
      materialsAnchor: { value: row.materials_anchor_value, at: row.materials_anchor_at, ratePerSec: row.materials_rate_per_sec },
      suppliesAnchor:  { value: row.supplies_anchor_value,  at: row.supplies_anchor_at,  ratePerSec: row.supplies_rate_per_sec },
    },
    troops: {
      ...clientTroops,
      militia: row.militia_count,
      shooters: row.shooters_count,
      scouts: row.scouts_count,
      machinery: row.machinery_count,
    },
    recruitedDiplomats: row.recruited_diplomats,
    recruitedTribeEnvoys: row.recruited_tribe_envoys,
    tribeEnvoysCommitted: row.tribe_envoys_committed,
    annexEnvoysCommitted: row.annex_envoys_committed,
    sandboxStrategyId: row.sandbox_strategy_id,
    sandboxCompletedActionIds: row.sandbox_completed_action_ids ?? [],
    sandboxQuestsCompleted: row.sandbox_quests_completed,
    sandboxWondersBuilt: row.sandbox_wonders_built,
    sandboxDomeActive: row.sandbox_dome_active,
    sandboxMarchStarted: row.sandbox_march_started,
    sandboxLastSyncedDay: row.sandbox_last_synced_day,
    sandboxSnapshots: sandboxPayload.snapshots,
    mapMovements: sandboxPayload.mapMovements,
    mobilization: sandboxPayload.mobilization,
    logs: row.logs_json ?? [],
  };
}

function totalTroops(troops: Record<TroopUnitCode, number> | null | undefined) {
  if (!troops) return 0;
  return clampCount(troops.militia) + clampCount(troops.shooters) + clampCount(troops.scouts) + clampCount(troops.machinery);
}

async function loadKingState(worldPlayerId: string) {
  try {
    const search = new URLSearchParams();
    search.set("select", "world_player_id,world_id,king_profile_id,king_name");
    search.set("world_player_id", `eq.${worldPlayerId}`);
    search.set("limit", "1");
    const rows = await supabaseSelect<KingStateRow>("world_player_king_states", search);
    const row = rows[0];
    if (!row) return null;
    return {
      kingProfileId: typeof row.king_profile_id === "string" ? row.king_profile_id : null,
      kingName: typeof row.king_name === "string" ? row.king_name : null,
    };
  } catch {
    return null;
  }
}

async function loadExplorationState(worldPlayerId: string) {
  try {
    const search = new URLSearchParams();
    search.set(
      "select",
      "world_player_id,world_id,coord_key,q,r,discovery_type,status,title,summary,image_src,risk_label,reward_label,action_label",
    );
    search.set("world_player_id", `eq.${worldPlayerId}`);
    const rows = await supabaseSelect<ExplorationStateRow>("world_player_exploration_states", search);
    const exploredCoordKeys: string[] = [];
    const discoveriesByCoord: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      exploredCoordKeys.push(row.coord_key);
      discoveriesByCoord[row.coord_key] = {
        coordKey: row.coord_key,
        type: pickString(row.discovery_type, ["empty", "opportunity", "threat", "ruins", "dragon"], "empty"),
        status: pickString(row.status, ["new", "seen", "resolved", "ignored"], "new"),
        title: row.title,
        summary: row.summary,
        imageSrc: row.image_src,
        riskLabel: row.risk_label,
        rewardLabel: row.reward_label,
        actionLabel: row.action_label,
      };
    }
    return {
      exploredCoordKeys,
      discoveriesByCoord,
    };
  } catch {
    return null;
  }
}

async function loadStructureState(worldPlayerId: string) {
  try {
    const search = new URLSearchParams();
    search.set("select", "world_id,world_player_id,village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d,level");
    search.set("world_player_id", `eq.${worldPlayerId}`);
    const rows = await supabaseSelect<VillageStructureRow>("village_structure_states", search);
    const buildingSkillsByVillage: Record<string, Partial<Record<CityStructureId, StructureDots>>> = {};
    const buildingLevelsByVillage: Record<string, Partial<Record<CityStructureId, number>>> = {};

    for (const row of rows) {
      if (!STRUCTURE_IDS.includes(row.structure_code)) continue;
      const dots = normalizeDots({ a: row.slot_a, b: row.slot_b, c: row.slot_c, d: row.slot_d });
      buildingSkillsByVillage[row.village_site_id] = {
        ...(buildingSkillsByVillage[row.village_site_id] ?? {}),
        [row.structure_code]: dots,
      };
      buildingLevelsByVillage[row.village_site_id] = {
        ...(buildingLevelsByVillage[row.village_site_id] ?? {}),
        [row.structure_code]: clampLevel(row.level ?? sumDots(dots)),
      };
    }

    return { buildingSkillsByVillage, buildingLevelsByVillage };
  } catch {
    return { buildingSkillsByVillage: {}, buildingLevelsByVillage: {} };
  }
}

async function persistStructureState(worldId: string, worldPlayerId: string, nextState: Record<string, unknown>) {
  const skillsByVillage = isRecord(nextState.buildingSkillsByVillage) ? nextState.buildingSkillsByVillage : {};
  const levelsByVillage = isRecord(nextState.buildingLevelsByVillage) ? nextState.buildingLevelsByVillage : {};
  const villageIds = Array.from(new Set([...Object.keys(skillsByVillage), ...Object.keys(levelsByVillage)]));
  const rows: VillageStructureRow[] = [];

  for (const villageId of villageIds) {
    const villageSkills = isRecord(skillsByVillage[villageId]) ? skillsByVillage[villageId] : {};
    const villageLevels = isRecord(levelsByVillage[villageId]) ? levelsByVillage[villageId] : {};
    const normalizedSkills: Partial<Record<CityStructureId, StructureDots>> = {};
    const normalizedLevels: Partial<Record<CityStructureId, number>> = {};

    for (const [buildingId, rawDots] of Object.entries(villageSkills)) {
      const structureId = mapLegacyBuildingToStructureId(buildingId);
      if (!structureId) continue;
      const dots = normalizeDots(rawDots, villageLevels[buildingId]);
      const current = normalizedSkills[structureId];
      normalizedSkills[structureId] = current
        ? {
            a: Math.max(current.a, dots.a),
            b: Math.max(current.b, dots.b),
            c: Math.max(current.c, dots.c),
            d: Math.max(current.d, dots.d),
          }
        : dots;
    }

    for (const [buildingId, rawLevel] of Object.entries(villageLevels)) {
      const structureId = mapLegacyBuildingToStructureId(buildingId);
      if (!structureId) continue;
      normalizedLevels[structureId] = Math.max(normalizedLevels[structureId] ?? 0, clampLevel(rawLevel));
    }

    for (const structureCode of STRUCTURE_IDS) {
      const hasSkills = Boolean(normalizedSkills[structureCode]);
      const hasLevel = typeof normalizedLevels[structureCode] === "number";
      if (!hasSkills && !hasLevel) continue;

      const dots = normalizeDots(normalizedSkills[structureCode], normalizedLevels[structureCode]);
      rows.push({
        world_id: worldId,
        world_player_id: worldPlayerId,
        village_site_id: villageId,
        structure_code: structureCode,
        slot_a: dots.a,
        slot_b: dots.b,
        slot_c: dots.c,
        slot_d: dots.d,
        level: normalizedLevels[structureCode] ?? sumDots(dots),
      });
    }
  }

  if (!rows.length) return true;

  try {
    const rowsForUpsert = rows.map(({ level: _generatedLevel, ...row }) => row);
    await supabaseUpsert("village_structure_states", rowsForUpsert, "village_site_id,structure_code");
    return true;
  } catch {
    // The SQL migration may not have been run yet. Keep the legacy snapshot write alive until the table exists.
    return false;
  }
}

async function loadCityState(worldPlayerId: string) {
  try {
    const search = new URLSearchParams();
    search.set(
      "select",
      "village_site_id,world_id,world_player_id,population_current,production_focus,society_focus,barracks_focus,defense_protocol,production_materials_workers,production_supplies_workers,production_commerce_workers,production_logistics_workers,jobs_medics,jobs_crafts,jobs_order,jobs_scholars,recruits_militia,recruits_shooters,recruits_scouts,recruits_machinery,defense_guards,defense_archers,defense_ballistae,deployed_count",
    );
    search.set("world_player_id", `eq.${worldPlayerId}`);
    const rows = await supabaseSelect<VillageCityStateRow>("village_city_states", search);

    return rows.reduce(
      (acc, row) => {
        acc.populationByVillage[row.village_site_id] = clampCount(row.population_current);
        acc.productionFocusByVillage[row.village_site_id] = pickString(row.production_focus, ["materials", "supplies", "commerce", "logistics"], "materials");
        acc.societyFocusByVillage[row.village_site_id] = pickString(row.society_focus, ["medics", "crafts", "order", "scholars"], "order");
        acc.barracksFocusByVillage[row.village_site_id] = pickString(row.barracks_focus, ["garrison", "shock", "scouts", "siege"], "garrison");
        acc.defenseProtocolByVillage[row.village_site_id] = pickString(row.defense_protocol, ["hold", "recall", "alarm"], "hold");
        acc.productionWorkersByVillage[row.village_site_id] = {
          materials: clampCount(row.production_materials_workers),
          supplies: clampCount(row.production_supplies_workers),
          commerce: clampCount(row.production_commerce_workers),
          logistics: clampCount(row.production_logistics_workers),
        };
        acc.jobsByVillage[row.village_site_id] = {
          medics: clampCount(row.jobs_medics),
          crafts: clampCount(row.jobs_crafts),
          order: clampCount(row.jobs_order),
          scholars: clampCount(row.jobs_scholars),
        };
        acc.recruitsByVillage[row.village_site_id] = {
          militia: clampCount(row.recruits_militia),
          shooters: clampCount(row.recruits_shooters),
          scouts: clampCount(row.recruits_scouts),
          machinery: clampCount(row.recruits_machinery),
        };
        acc.defenseRecruitsByVillage[row.village_site_id] = {
          guards: clampCount(row.defense_guards),
          archers: clampCount(row.defense_archers),
          ballistae: clampCount(row.defense_ballistae),
        };
        acc.deployedByVillage[row.village_site_id] = clampCount(row.deployed_count);
        return acc;
      },
      {
        populationByVillage: {} as Record<string, number>,
        productionFocusByVillage: {} as Record<string, string>,
        societyFocusByVillage: {} as Record<string, string>,
        barracksFocusByVillage: {} as Record<string, string>,
        defenseProtocolByVillage: {} as Record<string, string>,
        productionWorkersByVillage: {} as Record<string, Record<string, number>>,
        jobsByVillage: {} as Record<string, Record<string, number>>,
        recruitsByVillage: {} as Record<string, Record<string, number>>,
        defenseRecruitsByVillage: {} as Record<string, Record<string, number>>,
        deployedByVillage: {} as Record<string, number>,
      },
    );
  } catch {
    return {};
  }
}

async function loadTroopStacks(worldPlayerId: string) {
  try {
    const search = new URLSearchParams();
    search.set("select", "site_id,owner_world_player_id,unit_code,unit_grade,stationing_type,quantity");
    search.set("owner_world_player_id", `eq.${worldPlayerId}`);
    search.set("stationing_type", "eq.home");
    const rows = await supabaseSelect<TroopStackRow>("site_troop_stacks", search);
    const troops: Record<TroopUnitCode, number> = { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
    for (const row of rows) {
      if (row.unit_code in troops) {
        troops[row.unit_code] += clampCount(row.quantity);
      }
    }
    return troops;
  } catch {
    return null;
  }
}

async function persistCityState(worldId: string, worldPlayerId: string, nextState: Record<string, unknown>) {
  const villageIds = new Set<string>();
  const mapKeys = [
    "populationByVillage",
    "productionFocusByVillage",
    "societyFocusByVillage",
    "barracksFocusByVillage",
    "defenseProtocolByVillage",
    "productionWorkersByVillage",
    "jobsByVillage",
    "recruitsByVillage",
    "defenseRecruitsByVillage",
    "deployedByVillage",
  ];
  for (const key of mapKeys) {
    const value = isRecord(nextState[key]) ? nextState[key] : {};
    Object.keys(value).forEach((villageId) => {
      if (isUuid(villageId)) villageIds.add(villageId);
    });
  }

  const rows = [...villageIds].map((villageId): VillageCityStateRow => {
    const productionWorkers = isRecord(nextState.productionWorkersByVillage) && isRecord(nextState.productionWorkersByVillage[villageId])
      ? nextState.productionWorkersByVillage[villageId]
      : {};
    const jobs = isRecord(nextState.jobsByVillage) && isRecord(nextState.jobsByVillage[villageId]) ? nextState.jobsByVillage[villageId] : {};
    const recruits = isRecord(nextState.recruitsByVillage) && isRecord(nextState.recruitsByVillage[villageId])
      ? nextState.recruitsByVillage[villageId]
      : {};
    const defense = isRecord(nextState.defenseRecruitsByVillage) && isRecord(nextState.defenseRecruitsByVillage[villageId])
      ? nextState.defenseRecruitsByVillage[villageId]
      : {};

    return {
      village_site_id: villageId,
      world_id: worldId,
      world_player_id: worldPlayerId,
      population_current: isRecord(nextState.populationByVillage) ? clampCount(nextState.populationByVillage[villageId]) : 0,
      production_focus: isRecord(nextState.productionFocusByVillage) ? pickString(nextState.productionFocusByVillage[villageId], ["materials", "supplies", "commerce", "logistics"], "materials") : "materials",
      society_focus: isRecord(nextState.societyFocusByVillage) ? pickString(nextState.societyFocusByVillage[villageId], ["medics", "crafts", "order", "scholars"], "order") : "order",
      barracks_focus: isRecord(nextState.barracksFocusByVillage) ? pickString(nextState.barracksFocusByVillage[villageId], ["garrison", "shock", "scouts", "siege"], "garrison") : "garrison",
      defense_protocol: isRecord(nextState.defenseProtocolByVillage) ? pickString(nextState.defenseProtocolByVillage[villageId], ["hold", "recall", "alarm"], "hold") : "hold",
      production_materials_workers: clampCount(productionWorkers.materials),
      production_supplies_workers: clampCount(productionWorkers.supplies),
      production_commerce_workers: clampCount(productionWorkers.commerce),
      production_logistics_workers: clampCount(productionWorkers.logistics),
      jobs_medics: clampCount(jobs.medics),
      jobs_crafts: clampCount(jobs.crafts),
      jobs_order: clampCount(jobs.order),
      jobs_scholars: clampCount(jobs.scholars),
      recruits_militia: clampCount(recruits.militia),
      recruits_shooters: clampCount(recruits.shooters),
      recruits_scouts: clampCount(recruits.scouts),
      recruits_machinery: clampCount(recruits.machinery),
      defense_guards: clampCount(defense.guards),
      defense_archers: clampCount(defense.archers),
      defense_ballistae: clampCount(defense.ballistae),
      deployed_count: isRecord(nextState.deployedByVillage) ? clampCount(nextState.deployedByVillage[villageId]) : 0,
    };
  });

  if (!rows.length) return true;

  try {
    await supabaseUpsert("village_city_states", rows, "village_site_id");
    return true;
  } catch {
    // Active after 17_SQL_ESTADO_VIVO_DA_CIDADE.sql is run.
    return false;
  }
}

async function persistTroopStacks(worldPlayerId: string, capitalVillageId: string, nextTroops: Record<string, unknown>) {
  if (!isUuid(capitalVillageId)) return;
  const rows: TroopStackRow[] = (["militia", "shooters", "scouts", "machinery"] as const).map((unitCode) => ({
    site_id: capitalVillageId,
    owner_world_player_id: worldPlayerId,
    unit_code: unitCode,
    unit_grade: "bronze",
    stationing_type: "home",
    quantity: clampCount(nextTroops[unitCode]),
  }));

  try {
    await supabaseUpsert("site_troop_stacks", rows, "site_id,owner_world_player_id,unit_code,unit_grade,stationing_type");
  } catch {
    // Keep scalar troop persistence alive even if the stack table is unavailable.
  }
}

async function persistKingState(worldId: string, worldPlayerId: string, nextState: Record<string, unknown>) {
  const kingProfileId = typeof nextState.kingProfileId === "string" ? nextState.kingProfileId : null;
  const kingName = typeof nextState.kingName === "string" ? nextState.kingName.trim().slice(0, 32) : "";

  try {
    // Só persiste se o cliente enviou um rei explícito.
    // Nunca apaga — evita race condition onde PUT chega antes da hidratação.
    if (!kingProfileId || !kingName) {
      return false;
    }

    const params = new URLSearchParams();
    params.set("world_player_id", `eq.${worldPlayerId}`);

    await supabaseUpsert(
      "world_player_king_states",
      {
        world_player_id: worldPlayerId,
        world_id: worldId,
        king_profile_id: kingProfileId,
        king_name: kingName,
      },
      "world_player_id",
    );
    return true;
  } catch {
    // Keep mirrored snapshot as fallback if dedicated king table is unavailable.
    return false;
  }
}

async function persistExplorationState(worldId: string, worldPlayerId: string, nextState: Record<string, unknown>) {
  const discoveriesByCoord = isRecord(nextState.discoveriesByCoord) ? nextState.discoveriesByCoord : {};
  const exploredCoordKeys = Array.isArray(nextState.exploredCoordKeys)
    ? nextState.exploredCoordKeys.filter((entry): entry is string => typeof entry === "string")
    : [];

  try {
    const deleteParams = new URLSearchParams();
    deleteParams.set("world_player_id", `eq.${worldPlayerId}`);
    await supabaseDelete("world_player_exploration_states", deleteParams);

    const rows: ExplorationStateRow[] = exploredCoordKeys.map((coordKey) => {
      const [qRaw, rRaw] = coordKey.split(":");
      const discovery = isRecord(discoveriesByCoord[coordKey]) ? discoveriesByCoord[coordKey] : {};
      return {
        world_player_id: worldPlayerId,
        world_id: worldId,
        coord_key: coordKey,
        q: Math.floor(Number(qRaw ?? 0)),
        r: Math.floor(Number(rRaw ?? 0)),
        discovery_type: pickString(discovery.type, ["empty", "opportunity", "threat", "ruins", "dragon"], "empty"),
        status: pickString(discovery.status, ["new", "seen", "resolved", "ignored"], "new"),
        title: typeof discovery.title === "string" ? discovery.title : "Area conhecida",
        summary: typeof discovery.summary === "string" ? discovery.summary : "Nada relevante encontrado.",
        image_src: typeof discovery.imageSrc === "string" ? discovery.imageSrc : "/images/discovery-default.jpg",
        risk_label: typeof discovery.riskLabel === "string" ? discovery.riskLabel : "baixo",
        reward_label: typeof discovery.rewardLabel === "string" ? discovery.rewardLabel : "baixo",
        action_label: typeof discovery.actionLabel === "string" ? discovery.actionLabel : "Ignorar",
      };
    });

    if (!rows.length) {
      return true;
    }

    await supabaseUpsert("world_player_exploration_states", rows, "world_player_id,coord_key");
    return true;
  } catch {
    // Keep mirrored snapshot as fallback if exploration table is unavailable.
    return false;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const payload = await getWorldPayload(params.worldId);
    if (!payload.worldPlayerId) {
      return NextResponse.json({ imperialState: null });
    }

    const search = new URLSearchParams();
    search.set(
      "select",
      "version,materials_stock,supplies_stock,materials_anchor_value,materials_anchor_at,materials_rate_per_sec,materials_capacity,supplies_anchor_value,supplies_anchor_at,supplies_rate_per_sec,supplies_capacity,militia_count,shooters_count,scouts_count,machinery_count,recruited_diplomats,recruited_tribe_envoys,tribe_envoys_committed,annex_envoys_committed,sandbox_strategy_id,sandbox_completed_action_ids,sandbox_quests_completed,sandbox_wonders_built,sandbox_dome_active,sandbox_march_started,sandbox_last_synced_day,sandbox_snapshots_json,logs_json",
    );
    search.set("world_player_id", `eq.${payload.worldPlayerId}`);
    const rows = await supabaseSelect<StoredImperialStateRow>("world_player_imperial_states", search);

    const imperialStateRaw = rows[0] ? mapRowToImperialState(rows[0]) : null;
    const imperialState = imperialStateRaw
      ? normalizeImperialVillageIds(
          imperialStateRaw,
          payload.world.activeVillageId,
          payload.world.villages.map((village) => village.id),
        )
      : null;
    if (!imperialState) {
      return NextResponse.json({ imperialState: null });
    }

    const [tableStructures, tableCityState, tableTroops, tableKingState, tableExplorationState] = await Promise.all([
      loadStructureState(payload.worldPlayerId),
      loadCityState(payload.worldPlayerId),
      loadTroopStacks(payload.worldPlayerId),
      loadKingState(payload.worldPlayerId),
      loadExplorationState(payload.worldPlayerId),
    ]);
    const imperialStateRecord = imperialState as Record<string, unknown>;
    const scalarTroops = isRecord(imperialStateRecord.troops)
      ? {
          militia: clampCount(imperialStateRecord.troops.militia),
          shooters: clampCount(imperialStateRecord.troops.shooters),
          scouts: clampCount(imperialStateRecord.troops.scouts),
          machinery: clampCount(imperialStateRecord.troops.machinery),
        }
      : null;
    const resolvedTroops =
      totalTroops(scalarTroops) > 0
        ? scalarTroops
        : tableTroops && totalTroops(tableTroops) > 0
          ? tableTroops
          : imperialState.troops;

    return NextResponse.json({
      imperialState: {
        ...imperialState,
        ...tableCityState,
        troops: resolvedTroops,
        buildingSkillsByVillage: {
          ...(isRecord(imperialStateRecord.buildingSkillsByVillage) ? imperialStateRecord.buildingSkillsByVillage : {}),
          ...tableStructures.buildingSkillsByVillage,
        },
        buildingLevelsByVillage: {
          ...(isRecord(imperialStateRecord.buildingLevelsByVillage) ? imperialStateRecord.buildingLevelsByVillage : {}),
          ...tableStructures.buildingLevelsByVillage,
        },
        kingProfileId:
          tableKingState?.kingProfileId ??
          (typeof imperialStateRecord.kingProfileId === "string" ? imperialStateRecord.kingProfileId : null),
        kingName:
          tableKingState?.kingName ??
          (typeof imperialStateRecord.kingName === "string" ? imperialStateRecord.kingName : null),
        exploredCoordKeys:
          tableExplorationState?.exploredCoordKeys && tableExplorationState.exploredCoordKeys.length > 0
            ? tableExplorationState.exploredCoordKeys
            : Array.isArray(imperialStateRecord.exploredCoordKeys)
              ? imperialStateRecord.exploredCoordKeys
              : [],
        discoveriesByCoord:
          tableExplorationState?.discoveriesByCoord && Object.keys(tableExplorationState.discoveriesByCoord).length > 0
            ? tableExplorationState.discoveriesByCoord
            : isRecord(imperialStateRecord.discoveriesByCoord)
              ? imperialStateRecord.discoveriesByCoord
              : {},
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load imperial state." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const payload = await getWorldPayload(params.worldId);
    if (!payload.worldPlayerId) {
      // Local/sandbox flows can still use the in-memory imperial state even without a persisted world player row.
      return NextResponse.json({ ok: true, persisted: false });
    }

    const nextState = await request.json();
    const nextStateRecordRaw = isRecord(nextState) ? nextState : {};
    const nextStateRecord = normalizeImperialVillageIds(
      nextStateRecordRaw,
      payload.world.activeVillageId,
      payload.world.villages.map((village) => village.id),
    );
    const nextResources = isRecord(nextStateRecord.resources) ? nextStateRecord.resources : {};
    const nextTroops = isRecord(nextStateRecord.troops) ? nextStateRecord.troops : {};
    const [persistedStructure, persistedCity, persistedKing, persistedExploration] = await Promise.all([
      persistStructureState(payload.world.id, payload.worldPlayerId, nextStateRecord),
      persistCityState(payload.world.id, payload.worldPlayerId, nextStateRecord),
      persistKingState(payload.world.id, payload.worldPlayerId, nextStateRecord),
      persistExplorationState(payload.world.id, payload.worldPlayerId, nextStateRecord),
    ]);

    await supabaseUpsert("world_player_imperial_states", {
      world_id: payload.world.id,
      world_player_id: payload.worldPlayerId,
      version: Number(nextStateRecord.version ?? 9),
      // materials_stock e supplies_stock são geridos exclusivamente pela âncora (kw_settle_player).
      // O cliente não pode mais sobrescrever estes valores directamente.
      militia_count: Number(nextTroops.militia ?? 0),
      shooters_count: Number(nextTroops.shooters ?? 0),
      scouts_count: Number(nextTroops.scouts ?? 0),
      machinery_count: Number(nextTroops.machinery ?? 0),
      recruited_diplomats: Number(nextStateRecord.recruitedDiplomats ?? 0),
      recruited_tribe_envoys: Number(nextStateRecord.recruitedTribeEnvoys ?? 0),
      tribe_envoys_committed: Number(nextStateRecord.tribeEnvoysCommitted ?? 0),
      annex_envoys_committed: Number(nextStateRecord.annexEnvoysCommitted ?? 0),
      sandbox_strategy_id: nextStateRecord.sandboxStrategyId ?? null,
      sandbox_completed_action_ids: Array.isArray(nextStateRecord.sandboxCompletedActionIds) ? nextStateRecord.sandboxCompletedActionIds : [],
      sandbox_quests_completed: Number(nextStateRecord.sandboxQuestsCompleted ?? 0),
      sandbox_wonders_built: Number(nextStateRecord.sandboxWondersBuilt ?? 0),
      sandbox_dome_active: Boolean(nextStateRecord.sandboxDomeActive),
      sandbox_march_started: Boolean(nextStateRecord.sandboxMarchStarted),
      sandbox_last_synced_day: Number(nextStateRecord.sandboxLastSyncedDay ?? 0),
      sandbox_snapshots_json: {
        ...(isRecord(nextStateRecord.sandboxSnapshots) ? nextStateRecord.sandboxSnapshots : {}),
        [CLIENT_STATE_KEY]: buildClientStateSnapshot(nextStateRecord, {
          structure: persistedStructure,
          city: persistedCity,
          king: persistedKing,
          exploration: persistedExploration,
        }),
        [RUNTIME_MAP_KEY]: {
          mapMovements: Array.isArray(nextStateRecord.mapMovements) ? nextStateRecord.mapMovements : [],
          mobilization: isRecord(nextStateRecord.mobilization) ? nextStateRecord.mobilization : { active: false, startedAtDay: null },
        },
      },
      logs_json: Array.isArray(nextStateRecord.logs) ? nextStateRecord.logs : [],
    });
    await persistTroopStacks(
      payload.worldPlayerId,
      typeof nextStateRecord.royalCapitalVillageId === "string" ? nextStateRecord.royalCapitalVillageId : payload.world.activeVillageId,
      nextTroops,
    );

    const playerPatchParams = new URLSearchParams();
    playerPatchParams.set("id", `eq.${payload.worldPlayerId}`);
    await supabasePatchReturning<{ power_score_cached: number }, { id: string }>("world_players", playerPatchParams, {
      power_score_cached: calculateCachedPowerScore({
        militia: Number(nextTroops.militia ?? 0),
        shooters: Number(nextTroops.shooters ?? 0),
        scouts: Number(nextTroops.scouts ?? 0),
        machinery: Number(nextTroops.machinery ?? 0),
      }),
    });

    // Recalcula taxa de produção/consumo após qualquer mudança de estado
    void recalculatePlayerRates(
      payload.world.id,
      payload.worldPlayerId,
      typeof payload.world.speedMultiplier === "number" ? payload.world.speedMultiplier : 1,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist imperial state." },
      { status: 500 },
    );
  }
}
