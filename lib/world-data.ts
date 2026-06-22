import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { cache } from "react";

import { SOVEREIGNTY_MILITARY_SCORE_CAP } from "@/core/GameBalance";
import { normalizeImperialVillageIds, stripDedicatedImperialClientState } from "@/lib/imperial-persistence";
import { getWorldState, worlds as mockWorldSummaries } from "@/lib/mock-data";
import type {
  BoardSite,
  BuildingEntry,
  ReportEntry,
  ResearchEntry,
  TimelineEntry,
  VillageSummary,
  WorldParticipant,
  WorldState,
  WorldSummary,
} from "@/lib/mock-data";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { inFilter, isSupabaseConfigured, looksLikeUuid, shouldUseLocalSupabaseFallback, supabaseInsertReturning, supabasePatchReturning, supabaseSelect } from "@/lib/supabase-rest";
import { calculateCachedPowerScore, normalizeWorldPlayerCap } from "@/lib/world-rules";

const WORLD_DURATION_DAYS = 120;
const EXPRESS_WORLD_DURATION_DAYS = 30;
const IMPERIAL_CLIENT_STATE_VERSION = 16;
const REAL_DAY_MS = 24 * 60 * 60 * 1000;
const STRUCTURE_IDS = ["crown", "economy", "society", "recruitment", "defense"] as const;
type SeasonMode = "classic" | "express";
const WORLD_SELECT_BASE = "id,slug,name,status,phase,day_number,starts_at,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at,sandbox_enabled,player_cap";
const WORLD_SELECT_WITH_MODE = `${WORLD_SELECT_BASE},season_mode,speed_multiplier`;

type CityStructureId = (typeof STRUCTURE_IDS)[number];
type StructureDots = Record<"a" | "b" | "c" | "d", number>;
type VillageStructureLevels = Partial<Record<CityStructureId, number>>;
type VillageStructureSkills = Partial<Record<CityStructureId, StructureDots>>;

type DbWorld = {
  id: string;
  slug: string;
  name: string;
  status: "open" | "running" | "finalized";
  phase: "phase_1" | "phase_2" | "phase_3" | "phase_4" | "closed";
  day_number: number;
  starts_at?: string | null;
  runtime_started?: boolean;
  runtime_real_time_enabled?: boolean;
  runtime_anchor_day?: number;
  runtime_anchor_started_at?: string | null;
  sandbox_enabled?: boolean;
  season_mode?: SeasonMode | null;
  speed_multiplier?: number | null;
  player_cap?: number | null;
};

type DbWorldPlayer = {
  id: string;
  world_id: string;
  user_id: string;
  tribe_id: string | null;
  current_capital_site_id?: string | null;
  power_score_cached: number;
  status: string;
};

type DbKingState = {
  world_player_id: string;
  king_name: string;
};

type DbUser = {
  id: string;
  username: string;
  email?: string;
  auth_user_id?: string | null;
};

type DbVillage = {
  site_id: string;
  owner_world_player_id: string | null;
  name: string;
  village_type: "capital" | "colony";
  political_state: string;
  settlement_role?: string;
  city_class?: string;
  city_class_locked?: boolean;
  origin_kind?: string;
  terrain_kind?: string;
  terrain_label?: string | null;
};

type DbVillageResourceState = {
  village_site_id: string;
  materials_stock: number;
  supplies_stock: number;
};

type DbVillageStructureState = {
  village_site_id: string;
  structure_code: CityStructureId;
  slot_a: number;
  slot_b: number;
  slot_c: number;
  slot_d: number;
  level?: number | null;
};

type DbMapSite = {
  id: string;
  tile_id: string;
  site_type: "village" | "citadel" | "ruin";
  status: string;
};

type DbMapTile = {
  id: string;
  q: number;
  r: number;
};

type DbTribe = {
  id: string;
  name: string;
  total_score_cached: number;
};

type DbTribeCitadel = {
  tribe_id: string;
  status: string;
};

type DbImperialStateRow = {
  world_player_id?: string;
  materials_stock: number;
  supplies_stock: number;
  militia_count?: number;
  shooters_count?: number;
  scouts_count?: number;
  machinery_count?: number;
  sandbox_quests_completed: number;
  sandbox_wonders_built: number;
  sandbox_dome_active: boolean;
  sandbox_snapshots_json?: Record<string, unknown> | null;
  logs_json?: string[] | null;
};

type DbAssignment = {
  hero_slot: string | null;
};

type DbTroopStack = {
  site_id: string;
  owner_world_player_id: string;
  unit_code: "militia" | "shooters" | "scouts" | "machinery";
  unit_grade: "bronze";
  stationing_type: "home";
  quantity: number;
};

type CompactClientState = {
  villageNameByVillage?: Record<string, string>;
  cityClassByVillage?: Record<string, VillageSummary["cityClass"]>;
  cityClassLockedByVillage?: Record<string, boolean>;
  buildingLevelsByVillage?: Record<string, VillageStructureLevels | VillageSummary["buildingLevels"]>;
  buildingSkillsByVillage?: Record<string, unknown>;
  extraVillages?: Array<Partial<VillageSummary> & { id?: string; coord?: string; axial?: { q: number; r: number } }>;
  kingProfileId?: string | null;
  kingName?: string | null;
  royalCapitalVillageId?: string | null;
};

type InitialImperialSeed = {
  materials: number;
  supplies: number;
  troops: {
    militia: number;
    shooters: number;
    scouts: number;
    machinery: number;
  };
  clientState: CompactClientState;
  log: string;
};

type DbExistingRow = {
  id?: string;
  world_player_id?: string;
};

function buildSeedClientState(seed: InitialImperialSeed, extraState: Record<string, unknown> = {}) {
  return stripDedicatedImperialClientState(
    {
      ...seed.clientState,
      ...extraState,
      version: IMPERIAL_CLIENT_STATE_VERSION,
      resources: { materials: seed.materials, supplies: seed.supplies, influence: 0 },
      troops: seed.troops,
    },
    {
      structure: true,
      city: true,
      king: true,
      exploration: true,
    },
  );
}

export type WorldPayload = {
  world: WorldState;
  worldMeta: {
    status: "open" | "running" | "finalized";
    finalReason: "victory" | "timeout" | "collapse" | null;
    readOnly: boolean;
    result: "victorious" | "survived" | "defeated" | "eliminated" | null;
    finalRank: number | null;
    finalScore: number | null;
  };
  runtimeState: {
    started: boolean;
    realTimeEnabled: boolean;
    anchorDay: number;
    anchorStartedAtMs: number | null;
    seasonMode: SeasonMode;
    speedMultiplier: number;
    durationDays: number;
  };
  isSandboxWorld: boolean;
  routeWorldId: string;
  worldPlayerId: string | null;
};

function normalizeSeasonMode(mode: unknown): SeasonMode {
  return mode === "express" ? "express" : "classic";
}

function worldDurationDays(world: Pick<DbWorld, "season_mode">): number {
  return normalizeSeasonMode(world.season_mode) === "express" ? EXPRESS_WORLD_DURATION_DAYS : WORLD_DURATION_DAYS;
}

function worldSpeedMultiplier(world: Pick<DbWorld, "season_mode" | "speed_multiplier">): number {
  const explicit = Number(world.speed_multiplier);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1, Math.min(12, explicit));
  }
  return normalizeSeasonMode(world.season_mode) === "express" ? 4 : 1;
}

function portalStartDay(durationDays: number): number {
  return Math.max(1, Math.floor(durationDays * 0.75) + 1);
}

function clampDay(day: number, durationDays = WORLD_DURATION_DAYS): number {
  return Math.max(0, Math.min(durationDays, Math.floor(day)));
}

function computeRuntime(world: DbWorld) {
  const seasonMode = normalizeSeasonMode(world.season_mode);
  const durationDays = worldDurationDays(world);
  const speedMultiplier = worldSpeedMultiplier(world);
  const scheduledStartMs = world.starts_at ? Date.parse(world.starts_at) : null;
  const scheduledStarted = world.status === "open" && scheduledStartMs !== null && Date.now() >= scheduledStartMs;
  const started = Boolean(world.runtime_started ?? world.status !== "open") || scheduledStarted;
  const realTimeEnabled = Boolean(world.runtime_real_time_enabled);
  const anchorDay = clampDay(world.runtime_anchor_day ?? world.day_number ?? 0, durationDays);
  const anchorStartedAtMs = world.runtime_anchor_started_at
    ? Date.parse(world.runtime_anchor_started_at)
    : scheduledStarted
      ? scheduledStartMs
      : null;

  let day = started ? anchorDay : clampDay(world.day_number ?? 0, durationDays);
  if (started && realTimeEnabled && anchorStartedAtMs) {
    day = clampDay(anchorDay + Math.floor(((Date.now() - anchorStartedAtMs) * speedMultiplier) / REAL_DAY_MS), durationDays);
  }

  return {
    currentDay: day,
    seasonMode,
    speedMultiplier,
    durationDays,
    portalStartDay: portalStartDay(durationDays),
    runtimeState: {
      started,
      realTimeEnabled,
      anchorDay,
      anchorStartedAtMs,
      seasonMode,
      speedMultiplier,
      durationDays,
    },
  };
}

function phaseLabel(day: number, started: boolean, durationDays = WORLD_DURATION_DAYS): string {
  if (!started) return "Aguardando inicio";
  if (day <= 0) return "Dia 0 - Preparacao";
  if (day <= Math.ceil(durationDays / 6)) return "Fase 1 - Consolidacao";
  if (day <= Math.ceil(durationDays / 2)) return "Fase 2 - Expansao";
  if (day <= Math.ceil(durationDays * 0.75)) return "Fase 3 - Fortificacao";
  return "Fase 4 - Exodo";
}

function summaryStatus(status: DbWorld["status"]): WorldSummary["status"] {
  if (status === "running") return "Em Andamento";
  if (status === "finalized") return "Finalizado";
  return "Em Aberto";
}

function normalizePlayerResult(
  worldStatus: DbWorld["status"],
  playerStatus: string | null | undefined,
  finalRank: number | null,
): WorldPayload["worldMeta"]["result"] {
  const normalized = (playerStatus ?? "").trim().toLowerCase();

  if (/(defeat|dead|fallen|collapse)/.test(normalized)) {
    return "defeated";
  }

  if (/eliminated/.test(normalized)) {
    return "eliminated";
  }

  if (/(victor|victorious|winner|won|win)/.test(normalized)) {
    return "victorious";
  }

  if (worldStatus !== "finalized") {
    return null;
  }

  if (finalRank === 1) {
    return "victorious";
  }

  return playerStatus ? "survived" : null;
}

function actionLabel(status: DbWorld["status"]): string {
  if (status === "running") return "Entrar";
  if (status === "finalized") return "Ver relatorio";
  return "Registrar";
}

async function optionalSupabaseSelect<T>(table: string, params: URLSearchParams): Promise<T[]> {
  try {
    return await supabaseSelect<T>(table, params);
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readClientState(row: DbImperialStateRow | null): CompactClientState {
  const raw = row?.sandbox_snapshots_json?.__clientState;
  return isRecord(raw) ? (raw as CompactClientState) : {};
}

function clampStructureDot(value: unknown): number {
  return Math.max(0, Math.min(3, Math.floor(Number(value ?? 0))));
}

function clampStructureLevel(value: unknown): number {
  return Math.max(0, Math.min(10, Math.floor(Number(value ?? 0))));
}

function rowToStructureDots(row: DbVillageStructureState): StructureDots {
  return {
    a: clampStructureDot(row.slot_a),
    b: clampStructureDot(row.slot_b),
    c: clampStructureDot(row.slot_c),
    d: clampStructureDot(row.slot_d),
  };
}

function sumStructureDots(dots: StructureDots): number {
  return clampStructureLevel(dots.a + dots.b + dots.c + dots.d);
}

function projectStructureLevelsToFormulaBuildings(levels: VillageStructureLevels): VillageSummary["buildingLevels"] {
  const crown = clampStructureLevel(levels.crown);
  const economy = clampStructureLevel(levels.economy);
  const society = clampStructureLevel(levels.society);
  const recruitment = clampStructureLevel(levels.recruitment);
  const defense = clampStructureLevel(levels.defense);

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

function buildStructureStateMap(rows: DbVillageStructureState[]) {
  const map = new Map<string, { levels: VillageStructureLevels; skills: VillageStructureSkills }>();

  for (const row of rows) {
    if (!STRUCTURE_IDS.includes(row.structure_code)) continue;
    const current = map.get(row.village_site_id) ?? { levels: {}, skills: {} };
    const dots = rowToStructureDots(row);
    current.skills[row.structure_code] = dots;
    current.levels[row.structure_code] = clampStructureLevel(row.level ?? sumStructureDots(dots));
    map.set(row.village_site_id, current);
  }

  return map;
}

function sumFiveStructureLevels(levels: Record<string, unknown>): number {
  const structureLevels = levels as Partial<Record<"palace" | "mines" | "housing" | "barracks" | "wall" | "crown" | "economy" | "society" | "recruitment" | "defense", number>>;
  return (
    Number(structureLevels.crown ?? structureLevels.palace ?? 0) +
    Number(structureLevels.economy ?? structureLevels.mines ?? 0) +
    Number(structureLevels.society ?? structureLevels.housing ?? 0) +
    Number(structureLevels.recruitment ?? structureLevels.barracks ?? 0) +
    Number(structureLevels.defense ?? structureLevels.wall ?? 0)
  );
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

function normalizeStructureLevelsFromAny(levels: Record<string, unknown>): VillageStructureLevels {
  const normalized: VillageStructureLevels = {};
  for (const [buildingId, rawLevel] of Object.entries(levels)) {
    const structureId = mapLegacyBuildingToStructureId(buildingId);
    if (!structureId) continue;
    normalized[structureId] = Math.max(normalized[structureId] ?? 0, clampStructureLevel(rawLevel));
  }
  return normalized;
}

function buildCompactCapital({
  worldPlayer,
  imperialState,
  username,
}: {
  worldPlayer: DbWorldPlayer;
  imperialState: DbImperialStateRow | null;
  username: string;
}): VillageSummary {
  const clientState = readClientState(imperialState);
  const capitalId = clientState.royalCapitalVillageId ?? worldPlayer.current_capital_site_id ?? `capital-${worldPlayer.id}`;
  const structureLevels = normalizeStructureLevelsFromAny(clientState.buildingLevelsByVillage?.[capitalId] ?? {});
  const buildingLevels = projectStructureLevelsToFormulaBuildings(structureLevels);

  return {
    id: capitalId,
    name: clientState.villageNameByVillage?.[capitalId] ?? `${username} Capital`,
    type: "Capital",
    cityClass: clientState.cityClassByVillage?.[capitalId] ?? "metropole",
    cityClassLocked: clientState.cityClassLockedByVillage?.[capitalId] ?? false,
    originKind: "claimed_city",
    terrainKind: "crown_heartland",
    terrainLabel: "Coracao da Coroa",
    politicalState: worldPlayer.status === "alive" ? "stable" : "fallen",
    materials: imperialState?.materials_stock ?? 0,
    supplies: imperialState?.supplies_stock ?? 0,
    influence: 0,
    palaceLevel: buildingLevels.palace ?? 0,
    kingHere: worldPlayer.status === "alive",
    princeHere: false,
    underAttack: false,
    deficits: [],
    buildingLevels,
  };
}

function buildInitialImperialSeed(world: Pick<DbWorld, "slug">, worldPlayerId: string, username: string): InitialImperialSeed {
  const capitalId = `capital-${worldPlayerId}`;

  if (world.slug === "laboratorio") {
    return {
      materials: 120000,
      supplies: 90000,
      troops: {
        militia: 2400,
        shooters: 900,
        scouts: 360,
        machinery: 80,
      },
      clientState: {
        royalCapitalVillageId: capitalId,
        villageNameByVillage: {
          [capitalId]: `${username} Capital`,
        },
        cityClassByVillage: {
          [capitalId]: "metropole",
        },
        cityClassLockedByVillage: {
          [capitalId]: false,
        },
        buildingLevelsByVillage: {
          [capitalId]: {
            crown: 7,
            economy: 8,
            society: 7,
            recruitment: 6,
            defense: 6,
          },
        },
        buildingSkillsByVillage: {
          [capitalId]: {
            crown: { a: 2, b: 2, c: 2, d: 1 },
            economy: { a: 2, b: 2, c: 2, d: 2 },
            society: { a: 2, b: 2, c: 2, d: 1 },
            recruitment: { a: 2, b: 2, c: 1, d: 1 },
            defense: { a: 2, b: 2, c: 1, d: 1 },
          },
        },
      },
      log: `${username}: laboratorio iniciado com capital desenvolvida.`,
    };
  }

  return {
    materials: 10200,
    supplies: 61200,
    troops: {
      militia: 900,
      shooters: 300,
      scouts: 100,
      machinery: 0,
    },
    clientState: {
      royalCapitalVillageId: capitalId,
      villageNameByVillage: {
        [capitalId]: `${username} Capital`,
      },
      cityClassByVillage: {
        [capitalId]: "metropole",
      },
      cityClassLockedByVillage: {
        [capitalId]: false,
      },
      buildingLevelsByVillage: {
        [capitalId]: {},
      },
      buildingSkillsByVillage: {
        [capitalId]: {},
      },
    },
    log: `${username}: estado imperial inicial criado.`,
  };
}

function stableCoordinateFromId(id: string): { q: number; r: number } {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const q = 2 + (hash % 90);
  const r = 2 + (Math.floor(hash / 90) % 90);
  return { q, r };
}

function seedStructureRows(
  worldId: string,
  worldPlayerId: string,
  villageSiteId: string,
  clientState: CompactClientState,
): DbVillageStructureState[] {
  const rawSkills = clientState.buildingSkillsByVillage?.[clientState.royalCapitalVillageId ?? villageSiteId];
  const rawLevels = clientState.buildingLevelsByVillage?.[clientState.royalCapitalVillageId ?? villageSiteId];

  return STRUCTURE_IDS.map((structure_code) => {
    const dots = isRecord(rawSkills) && isRecord(rawSkills[structure_code])
      ? rowToStructureDots({
          village_site_id: villageSiteId,
          structure_code,
          slot_a: (rawSkills[structure_code] as Record<string, unknown>).a as number,
          slot_b: (rawSkills[structure_code] as Record<string, unknown>).b as number,
          slot_c: (rawSkills[structure_code] as Record<string, unknown>).c as number,
          slot_d: (rawSkills[structure_code] as Record<string, unknown>).d as number,
        })
      : (() => {
          const levelRecord = isRecord(rawLevels) ? (rawLevels as Record<string, unknown>) : {};
          const legacyFallback = Object.entries(levelRecord).reduce((max, [buildingId, rawLevel]) => {
            return mapLegacyBuildingToStructureId(buildingId) === structure_code
              ? Math.max(max, clampStructureLevel(rawLevel))
              : max;
          }, 0);
          let remaining = clampStructureLevel(levelRecord[structure_code] ?? legacyFallback);
          const values: StructureDots = { a: 0, b: 0, c: 0, d: 0 };
          for (const slot of ["a", "b", "c", "d"] as const) {
            values[slot] = Math.min(3, remaining);
            remaining -= values[slot];
          }
          return values;
        })();

    return {
      village_site_id: villageSiteId,
      structure_code,
      slot_a: dots.a,
      slot_b: dots.b,
      slot_c: dots.c,
      slot_d: dots.d,
    } as DbVillageStructureState & { world_id: string; world_player_id: string };
  }).map((row) => ({
    ...row,
    world_id: worldId,
    world_player_id: worldPlayerId,
  } as DbVillageStructureState & { world_id: string; world_player_id: string }));
}

async function fetchWorldRecord(worldId: string): Promise<DbWorld> {
  const params = new URLSearchParams();
  params.set("select", WORLD_SELECT_WITH_MODE);
  params.set("slug", `eq.${worldId}`);
  let bySlug: DbWorld[];
  try {
    bySlug = await supabaseSelect<DbWorld>("worlds", params);
  } catch (error) {
    params.set("select", WORLD_SELECT_BASE);
    bySlug = await supabaseSelect<DbWorld>("worlds", params);
  }
  if (bySlug[0]) {
    return bySlug[0];
  }

  if (!looksLikeUuid(worldId)) {
    throw new Error(`World '${worldId}' was not found in Supabase.`);
  }

  const byIdParams = new URLSearchParams();
  byIdParams.set("select", WORLD_SELECT_WITH_MODE);
  byIdParams.set("id", `eq.${worldId}`);
  let byId: DbWorld[];
  try {
    byId = await supabaseSelect<DbWorld>("worlds", byIdParams);
  } catch (error) {
    byIdParams.set("select", WORLD_SELECT_BASE);
    byId = await supabaseSelect<DbWorld>("worlds", byIdParams);
  }
  if (!byId[0]) {
    throw new Error(`World '${worldId}' was not found in Supabase.`);
  }

  return byId[0];
}

async function fetchWorldPlayers(worldDbId: string): Promise<DbWorldPlayer[]> {
  const params = new URLSearchParams();
  params.set("select", "id,world_id,user_id,tribe_id,current_capital_site_id,power_score_cached,status");
  params.set("world_id", `eq.${worldDbId}`);
  return supabaseSelect<DbWorldPlayer>("world_players", params);
}

async function fetchKingNames(worldPlayerIds: string[]): Promise<Map<string, string>> {
  if (!worldPlayerIds.length) {
    return new Map();
  }

  const params = new URLSearchParams();
  params.set("select", "world_player_id,king_name");
  params.set("world_player_id", inFilter(worldPlayerIds));
  const rows = await optionalSupabaseSelect<DbKingState>("world_player_king_states", params);
  return new Map(rows.filter((row) => row.king_name).map((row) => [row.world_player_id, row.king_name]));
}

function normalizeUsername(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || `jogador_${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchOrCreateAppUser(authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }): Promise<DbUser> {
  const byAuthParams = new URLSearchParams();
  byAuthParams.set("select", "id,username,email,auth_user_id");
  byAuthParams.set("auth_user_id", `eq.${authUser.id}`);
  const existingByAuth = await supabaseSelect<DbUser>("users", byAuthParams);
  if (existingByAuth[0]) {
    return existingByAuth[0];
  }

  const email = authUser.email ?? `${authUser.id.slice(0, 8)}@users.kingsworld.local`;
  const byEmailParams = new URLSearchParams();
  byEmailParams.set("select", "id,username,email,auth_user_id");
  byEmailParams.set("email", `eq.${email}`);
  const existingByEmail = await supabaseSelect<DbUser>("users", byEmailParams);
  if (existingByEmail[0]) {
    if (!existingByEmail[0].auth_user_id) {
      const patched = await supabaseInsertReturning<
        { id: string; auth_user_id: string },
        DbUser
      >("users", { id: existingByEmail[0].id, auth_user_id: authUser.id }, "id");
      return patched[0] ?? existingByEmail[0];
    }
    return existingByEmail[0];
  }

  const rawUsername = String(authUser.user_metadata?.username ?? email.split("@")[0] ?? "jogador");
  const username = `${normalizeUsername(rawUsername)}_${authUser.id.slice(0, 6)}`;
  const created = await supabaseInsertReturning<
    { auth_user_id: string; username: string; email: string },
    DbUser
  >("users", {
    auth_user_id: authUser.id,
    username,
    email,
  });
  if (!created[0]) {
    throw new Error("Failed to create app user profile in Supabase.");
  }
  return created[0];
}

async function ensureImperialState(world: Pick<DbWorld, "id" | "slug">, worldPlayerId: string, username: string): Promise<void> {
  const stateParams = new URLSearchParams();
  stateParams.set("select", "world_player_id");
  stateParams.set("world_player_id", `eq.${worldPlayerId}`);
  stateParams.set("limit", "1");
  const existingState = await supabaseSelect<DbExistingRow>("world_player_imperial_states", stateParams);
  if (!existingState[0]) {
    const seed = buildInitialImperialSeed(world, worldPlayerId, username);
    await supabaseInsertReturning(
      "world_player_imperial_states",
      {
        world_id: world.id,
        world_player_id: worldPlayerId,
          version: IMPERIAL_CLIENT_STATE_VERSION,
        materials_stock: seed.materials,
        supplies_stock: seed.supplies,
        materials_anchor_value: seed.materials,
        materials_anchor_at: new Date().toISOString(),
        materials_rate_per_sec: 0,
        materials_capacity: Math.max(seed.materials, 50000),
        supplies_anchor_value: seed.supplies,
        supplies_anchor_at: new Date().toISOString(),
        supplies_rate_per_sec: 0,
        supplies_capacity: Math.max(seed.supplies, 50000),
        militia_count: seed.troops.militia,
        shooters_count: seed.troops.shooters,
        scouts_count: seed.troops.scouts,
        machinery_count: seed.troops.machinery,
        sandbox_snapshots_json: {
          __clientState: buildSeedClientState(seed),
        },
        logs_json: [seed.log],
      },
      "world_player_id",
    );
  }
}

async function ensurePlayerCapital(world: Pick<DbWorld, "id" | "slug">, worldPlayerId: string, username: string): Promise<void> {
  const playerParams = new URLSearchParams();
  playerParams.set("select", "id,current_capital_site_id");
  playerParams.set("id", `eq.${worldPlayerId}`);
  playerParams.set("limit", "1");
  const players = await supabaseSelect<Pick<DbWorldPlayer, "id" | "current_capital_site_id">>("world_players", playerParams);
  const player = players[0];
  if (!player) return;

  if (player.current_capital_site_id) {
    const villageParams = new URLSearchParams();
    villageParams.set("select", "site_id");
    villageParams.set("site_id", `eq.${player.current_capital_site_id}`);
    villageParams.set("limit", "1");
    const existingVillage = await optionalSupabaseSelect<Pick<DbVillage, "site_id">>("villages", villageParams);
    if (existingVillage[0]) return;
  }

  const existingState = await fetchImperialDbState(world.id, worldPlayerId);
  const seed = existingState
    ? {
        materials: existingState.materials_stock,
        supplies: existingState.supplies_stock,
        troops: {
          militia: existingState.militia_count ?? 0,
          shooters: existingState.shooters_count ?? 0,
          scouts: existingState.scouts_count ?? 0,
          machinery: existingState.machinery_count ?? 0,
        },
        clientState: readClientState(existingState),
        log: "",
      }
    : buildInitialImperialSeed(world, worldPlayerId, username);
  const coord = stableCoordinateFromId(worldPlayerId);

  const tiles = await supabaseInsertReturning<
    { world_id: string; q: number; r: number; biome_type: string; terrain_type: string },
    Pick<DbMapTile, "id">
  >("map_tiles", {
    world_id: world.id,
    q: coord.q,
    r: coord.r,
    biome_type: "crown_heartland",
    terrain_type: "normal",
  }, "world_id,q,r");
  const tileId = tiles[0]?.id;
  if (!tileId) return;

  const sites = await supabaseInsertReturning<
    { world_id: string; tile_id: string; site_type: "village"; status: "active" },
    Pick<DbMapSite, "id">
  >("map_sites", {
    world_id: world.id,
    tile_id: tileId,
    site_type: "village",
    status: "active",
  }, "tile_id");
  const siteId = sites[0]?.id;
  if (!siteId) return;

  await supabaseInsertReturning(
    "villages",
    {
      site_id: siteId,
      world_id: world.id,
      owner_world_player_id: worldPlayerId,
      founder_world_player_id: worldPlayerId,
      name: seed.clientState.villageNameByVillage?.[seed.clientState.royalCapitalVillageId ?? ""] ?? `${username} Capital`,
      village_type: "capital",
      political_state: "stable",
      is_original_capital: true,
    },
    "site_id",
  );

  await supabaseInsertReturning(
    "village_resource_states",
    {
      village_site_id: siteId,
      materials_stock: seed.materials,
      supplies_stock: seed.supplies,
      materials_capacity: Math.max(seed.materials, 50000),
      supplies_capacity: Math.max(seed.supplies, 50000),
    },
    "village_site_id",
  );

  try {
    await supabaseInsertReturning(
      "village_city_states",
      {
        village_site_id: siteId,
        world_id: world.id,
        world_player_id: worldPlayerId,
        population_current: world.slug === "laboratorio" ? 38 : 8,
        production_focus: "materials",
        society_focus: "order",
        barracks_focus: "garrison",
        defense_protocol: "hold",
      },
      "village_site_id",
    );
  } catch {
    // This becomes active as soon as 17_SQL_ESTADO_VIVO_DA_CIDADE.sql is run.
  }

  try {
    const troopRows: DbTroopStack[] = ([
      { unit_code: "militia", quantity: seed.troops.militia },
      { unit_code: "shooters", quantity: seed.troops.shooters },
      { unit_code: "scouts", quantity: seed.troops.scouts },
      { unit_code: "machinery", quantity: seed.troops.machinery },
    ] as const).map((entry) => ({
      site_id: siteId,
      owner_world_player_id: worldPlayerId,
      unit_code: entry.unit_code,
      unit_grade: "bronze",
      stationing_type: "home",
      quantity: entry.quantity,
    }));
    await supabaseInsertReturning("site_troop_stacks", troopRows, "site_id,owner_world_player_id,unit_code,unit_grade,stationing_type");
  } catch {
    // Keep the scalar imperial state as a transition backup if stacks are not available.
  }

  try {
    await supabaseInsertReturning(
      "village_structure_states",
      seedStructureRows(world.id, worldPlayerId, siteId, seed.clientState),
      "village_site_id,structure_code",
    );
  } catch {
    // This becomes active as soon as 16_SQL_CIDADES_E_5_PREDIOS_REAIS.sql is run.
  }

  const patchParams = new URLSearchParams();
  patchParams.set("id", `eq.${worldPlayerId}`);
  await supabasePatchReturning("world_players", patchParams, { current_capital_site_id: siteId });

  const normalizedClientState = normalizeImperialVillageIds(seed.clientState, siteId, [siteId]);
  const clientStateSnapshot = buildSeedClientState(seed, normalizedClientState);
  await supabaseInsertReturning(
    "world_player_imperial_states",
    {
      world_id: world.id,
      world_player_id: worldPlayerId,
      version: IMPERIAL_CLIENT_STATE_VERSION,
      materials_stock: seed.materials,
      supplies_stock: seed.supplies,
      materials_anchor_value: seed.materials,
      materials_anchor_at: new Date().toISOString(),
      materials_rate_per_sec: 0,
      materials_capacity: Math.max(seed.materials, 50000),
      supplies_anchor_value: seed.supplies,
      supplies_anchor_at: new Date().toISOString(),
      supplies_rate_per_sec: 0,
      supplies_capacity: Math.max(seed.supplies, 50000),
      militia_count: seed.troops.militia,
      shooters_count: seed.troops.shooters,
      scouts_count: seed.troops.scouts,
      machinery_count: seed.troops.machinery,
      sandbox_snapshots_json: {
        ...(existingState?.sandbox_snapshots_json ?? {}),
        __clientState: clientStateSnapshot,
      },
      logs_json: existingState?.logs_json ?? (seed.log ? [seed.log] : []),
    },
    "world_player_id",
  );
}

async function ensureWorldPlayer(world: Pick<DbWorld, "id" | "slug">, appUser: DbUser): Promise<void> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("world_id", `eq.${world.id}`);
  params.set("user_id", `eq.${appUser.id}`);
  const existing = await supabaseSelect<Pick<DbWorldPlayer, "id">>("world_players", params);
  if (existing[0]) {
    await ensureImperialState(world, existing[0].id, appUser.username);
    await ensurePlayerCapital(world, existing[0].id, appUser.username);
    return;
  }

  const created = await supabaseInsertReturning<
    { world_id: string; user_id: string; status: "alive"; power_score_cached: number },
    Pick<DbWorldPlayer, "id">
  >("world_players", {
    world_id: world.id,
    user_id: appUser.id,
    status: "alive",
    power_score_cached: 0,
  }, "world_id,user_id");

  if (created[0]) {
    await ensureImperialState(world, created[0].id, appUser.username);
    await ensurePlayerCapital(world, created[0].id, appUser.username);
  }
}

async function fetchUsers(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) {
    return new Map();
  }

  const params = new URLSearchParams();
  params.set("select", "id,username");
  params.set("id", inFilter(userIds));
  const rows = await supabaseSelect<DbUser>("users", params);
  return new Map(rows.map((row) => [row.id, row.username]));
}

async function fetchVillages(worldDbId: string) {
  const villageParams = new URLSearchParams();
  villageParams.set("select", "site_id,owner_world_player_id,name,village_type,political_state,settlement_role,city_class,city_class_locked,origin_kind,terrain_kind,terrain_label");
  villageParams.set("world_id", `eq.${worldDbId}`);
  const villages = await optionalSupabaseSelect<DbVillage>("villages", villageParams);
  const villageIds = villages.map((entry) => entry.site_id);

  if (!villageIds.length) {
    return {
      villages,
      resources: new Map<string, DbVillageResourceState>(),
      structures: new Map<string, { levels: VillageStructureLevels; skills: VillageStructureSkills }>(),
    };
  }

  const resourceParams = new URLSearchParams();
  resourceParams.set("select", "village_site_id,materials_stock,supplies_stock");
  resourceParams.set("village_site_id", inFilter(villageIds));
  const resources = await optionalSupabaseSelect<DbVillageResourceState>("village_resource_states", resourceParams);

  const structureParams = new URLSearchParams();
  structureParams.set("select", "village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d,level");
  structureParams.set("village_site_id", inFilter(villageIds));
  const structures = await optionalSupabaseSelect<DbVillageStructureState>("village_structure_states", structureParams);

  const resourceMap = new Map(resources.map((entry) => [entry.village_site_id, entry]));

  return {
    villages,
    resources: resourceMap,
    structures: buildStructureStateMap(structures),
  };
}

async function fetchMapSites(worldDbId: string): Promise<{ sites: DbMapSite[]; tiles: Map<string, DbMapTile> }> {
  const siteParams = new URLSearchParams();
  siteParams.set("select", "id,tile_id,site_type,status");
  siteParams.set("world_id", `eq.${worldDbId}`);
  const sites = await optionalSupabaseSelect<DbMapSite>("map_sites", siteParams);
  const tileIds = sites.map((entry) => entry.tile_id);

  if (!tileIds.length) {
    return { sites, tiles: new Map() };
  }

  const tileParams = new URLSearchParams();
  tileParams.set("select", "id,q,r");
  tileParams.set("id", inFilter(tileIds));
  const tiles = await optionalSupabaseSelect<DbMapTile>("map_tiles", tileParams);

  return {
    sites,
    tiles: new Map(tiles.map((entry) => [entry.id, entry])),
  };
}

async function fetchTribes(worldDbId: string) {
  const tribeParams = new URLSearchParams();
  tribeParams.set("select", "id,name,total_score_cached");
  tribeParams.set("world_id", `eq.${worldDbId}`);
  const tribes = await optionalSupabaseSelect<DbTribe>("tribes", tribeParams);

  const citadelParams = new URLSearchParams();
  citadelParams.set("select", "tribe_id,status");
  citadelParams.set("world_id", `eq.${worldDbId}`);
  const citadels = await optionalSupabaseSelect<DbTribeCitadel>("tribe_citadels", citadelParams);

  return {
    tribes: new Map(tribes.map((entry) => [entry.id, entry])),
    citadels: new Map(citadels.map((entry) => [entry.tribe_id, entry.status])),
  };
}

function buildLiveTimeline(imperialState: DbImperialStateRow | null): TimelineEntry[] {
  const clientState = readClientState(imperialState);
  const totalInfrastructure = Object.values(clientState.buildingLevelsByVillage ?? {}).reduce(
    (sum, levels) => sum + sumFiveStructureLevels(levels ?? {}),
    0,
  );

  return [
    {
      title: "Estado vivo persistente",
      detail: `Recursos e build carregados do estado imperial. Infraestrutura atual: ${totalInfrastructure}/1000.`,
      eta: "Agora",
      priority: "baixo",
    },
  ];
}

function buildLiveReports(_imperialState: DbImperialStateRow | null): ReportEntry[] {
  return [];
}

async function fetchImperialDbState(worldDbId: string, worldPlayerId: string | null) {
  if (!worldPlayerId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("select", "world_player_id,materials_stock,supplies_stock,militia_count,shooters_count,scouts_count,machinery_count,sandbox_quests_completed,sandbox_wonders_built,sandbox_dome_active,sandbox_snapshots_json");
  params.set("world_id", `eq.${worldDbId}`);
  params.set("world_player_id", `eq.${worldPlayerId}`);
  const rows = await supabaseSelect<DbImperialStateRow>("world_player_imperial_states", params);
  return rows[0] ?? null;
}

async function fetchHeroAssignments(worldPlayerId: string | null): Promise<number> {
  if (!worldPlayerId) {
    return 0;
  }

  const params = new URLSearchParams();
  params.set("select", "hero_slot");
  params.set("world_player_id", `eq.${worldPlayerId}`);
  const rows = await optionalSupabaseSelect<DbAssignment>("village_specialist_assignments", params);
  return rows.filter((entry) => Boolean(entry.hero_slot)).length;
}

export async function listWorldSummaries(): Promise<WorldSummary[]> {
  noStore();

  if (!isSupabaseConfigured()) {
    return mockWorldSummaries.map((world) => ({ ...world }));
  }

  try {
    const params = new URLSearchParams();
    params.set("select", WORLD_SELECT_WITH_MODE);
    let worlds: DbWorld[];
    try {
      worlds = await supabaseSelect<DbWorld>("worlds", params);
    } catch (error) {
      if (shouldUseLocalSupabaseFallback(error)) {
        throw error;
      }
      params.set("select", WORLD_SELECT_BASE);
      worlds = await supabaseSelect<DbWorld>("worlds", params);
    }

    const worldPlayers = await supabaseSelect<Pick<DbWorldPlayer, "world_id">>("world_players", new URLSearchParams([["select", "world_id"]]));
    const counts = new Map<string, number>();
    for (const row of worldPlayers) {
      counts.set(row.world_id, (counts.get(row.world_id) ?? 0) + 1);
    }

    return worlds.map((world) => {
      const runtime = computeRuntime(world);
      return {
        id: world.slug,
        name: world.name,
        status: summaryStatus(world.status),
        day: runtime.currentDay,
        phase: phaseLabel(runtime.currentDay, runtime.runtimeState.started, runtime.durationDays),
        players: counts.get(world.id) ?? 0,
        actionLabel: actionLabel(world.status),
        seasonMode: runtime.seasonMode,
        speedMultiplier: runtime.speedMultiplier,
        durationDays: runtime.durationDays,
      };
    });
  } catch (error) {
    if (shouldUseLocalSupabaseFallback(error)) {
      console.warn("Supabase unavailable in local dev. Using mock world summaries.", error);
      return mockWorldSummaries.map((world) => ({ ...world }));
    }
    throw error;
  }
}

function buildMockWorldPayload(worldRouteId: string): WorldPayload {
  const world = getWorldState(worldRouteId);
  return {
    world,
    worldMeta: {
      status: "running",
      finalReason: null,
      readOnly: false,
      result: null,
      finalRank: null,
      finalScore: null,
    },
    runtimeState: {
      started: world.day > 0,
      realTimeEnabled: false,
      anchorDay: world.day,
      anchorStartedAtMs: null,
      seasonMode: world.seasonMode ?? "classic",
      speedMultiplier: world.speedMultiplier ?? 1,
      durationDays: world.durationDays ?? WORLD_DURATION_DAYS,
    },
    isSandboxWorld: worldRouteId === "world-test",
    routeWorldId: worldRouteId,
    worldPlayerId: null,
  };
}

export const getWorldPayload = cache(async function getWorldPayload(worldRouteId: string): Promise<WorldPayload> {
  noStore();

  if (!isSupabaseConfigured()) {
    return buildMockWorldPayload(worldRouteId);
  }

  try {
  const worldRecord = await fetchWorldRecord(worldRouteId);
  const runtime = computeRuntime(worldRecord);
  const authUser = await getAuthenticatedUser();
  let appUserId: string | null = null;
  if (authUser) {
    const appUser = await fetchOrCreateAppUser(authUser);
    appUserId = appUser.id;
    await ensureWorldPlayer(worldRecord, appUser);
  }

  const worldPlayers = await fetchWorldPlayers(worldRecord.id);
  const currentWorldPlayer = appUserId
    ? worldPlayers.find((entry) => entry.user_id === appUserId) ?? null
    : worldPlayers[0] ?? null;
  const rankedWorldPlayers = [...worldPlayers].sort((a, b) => (b.power_score_cached ?? 0) - (a.power_score_cached ?? 0));
  const finalRank = currentWorldPlayer ? rankedWorldPlayers.findIndex((entry) => entry.id === currentWorldPlayer.id) + 1 : null;
  const playerResult = normalizePlayerResult(worldRecord.status, currentWorldPlayer?.status, finalRank);
  const playerCollapsed = playerResult === "defeated" || playerResult === "eliminated";
  const currentTribeId = currentWorldPlayer?.tribe_id ?? null;
  const usernameMap = await fetchUsers(Array.from(new Set(worldPlayers.map((entry) => entry.user_id))));
  const kingNameMap = await fetchKingNames(worldPlayers.map((entry) => entry.id));

  const [{ villages, resources, structures }, { sites, tiles }, tribeBundle, imperialDbState, heroAssignments] = await Promise.all([
    fetchVillages(worldRecord.id),
    fetchMapSites(worldRecord.id),
    fetchTribes(worldRecord.id),
    fetchImperialDbState(worldRecord.id, currentWorldPlayer?.id ?? null),
    fetchHeroAssignments(currentWorldPlayer?.id ?? null),
  ]);

  const villagesById = new Map(villages.map((entry) => [entry.site_id, entry]));
  const worldPlayersById = new Map(worldPlayers.map((entry) => [entry.id, entry]));
  const currentUserName = currentWorldPlayer ? usernameMap.get(currentWorldPlayer.user_id) ?? "Seu reino" : "Seu reino";
  const clientState = normalizeImperialVillageIds(
    readClientState(imperialDbState),
    currentWorldPlayer?.current_capital_site_id ?? null,
    villages.map((entry) => entry.site_id),
  );

  let villageSummaries: VillageSummary[] = villages.map((entry) => {
    const villageResources = resources.get(entry.site_id);
    const tableStructureState = structures.get(entry.site_id);
    const tableStructureLevels = tableStructureState?.levels ?? null;
    const buildingLevels = tableStructureLevels
      ? {
          ...projectStructureLevelsToFormulaBuildings(tableStructureLevels),
        } as VillageSummary["buildingLevels"]
      : projectStructureLevelsToFormulaBuildings(
          normalizeStructureLevelsFromAny(clientState.buildingLevelsByVillage?.[entry.site_id] ?? {}),
        );
    const currentPlayerHasCrownHere =
      currentWorldPlayer?.status === "alive" && currentWorldPlayer.current_capital_site_id === entry.site_id;
    return {
      id: entry.site_id,
      name: clientState.villageNameByVillage?.[entry.site_id] ?? entry.name,
      type: entry.settlement_role === "Capital" || entry.village_type === "capital" ? "Capital" : "Colonia",
      cityClass: clientState.cityClassByVillage?.[entry.site_id] ?? (entry.city_class as VillageSummary["cityClass"]) ?? "neutral",
      cityClassLocked: clientState.cityClassLockedByVillage?.[entry.site_id] ?? Boolean(entry.city_class_locked),
      originKind: (entry.origin_kind as VillageSummary["originKind"]) ?? "claimed_city",
      terrainKind: (entry.terrain_kind as VillageSummary["terrainKind"]) ?? "ashen_fields",
      terrainLabel: entry.terrain_label ?? "Territorio imperial",
      politicalState: entry.political_state,
      materials: villageResources?.materials_stock ?? 0,
      supplies: villageResources?.supplies_stock ?? 0,
      influence: 0,
      palaceLevel: buildingLevels.palace ?? 0,
      kingHere: currentPlayerHasCrownHere,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels,
    };
  });

  if (!villageSummaries.length && currentWorldPlayer) {
    villageSummaries = [buildCompactCapital({ worldPlayer: currentWorldPlayer, imperialState: imperialDbState, username: currentUserName })];
  }

  const compactExtraVillages = (clientState.extraVillages ?? []).map((entry, index): VillageSummary => {
    const id = entry.id ?? `city-${currentWorldPlayer?.id ?? "local"}-${index + 1}`;
    const structureLevels = normalizeStructureLevelsFromAny({
      ...(entry.buildingLevels ?? {}),
      ...(clientState.buildingLevelsByVillage?.[id] ?? {}),
    });
    const buildingLevels = projectStructureLevelsToFormulaBuildings(structureLevels);
    return {
      id,
      name: clientState.villageNameByVillage?.[id] ?? entry.name ?? `Cidade ${index + 2}`,
      type: entry.type === "Capital" ? "Capital" : "Colonia",
      cityClass: clientState.cityClassByVillage?.[id] ?? entry.cityClass ?? "neutral",
      cityClassLocked: clientState.cityClassLockedByVillage?.[id] ?? entry.cityClassLocked ?? false,
      originKind: entry.originKind ?? "claimed_city",
      terrainKind: entry.terrainKind ?? "ashen_fields",
      terrainLabel: entry.terrainLabel ?? "Territorio imperial",
      politicalState: entry.politicalState ?? "stable",
      materials: entry.materials ?? 0,
      supplies: entry.supplies ?? 0,
      influence: entry.influence ?? 0,
      palaceLevel: Number(buildingLevels.palace ?? entry.palaceLevel ?? 0),
      kingHere: entry.type === "Capital" && currentWorldPlayer?.status === "alive",
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels,
    };
  });
  const existingVillageIds = new Set(villageSummaries.map((village) => village.id));
  villageSummaries = [
    ...villageSummaries,
    ...compactExtraVillages.filter((village) => !existingVillageIds.has(village.id)),
  ];

  let boardSites: BoardSite[] = sites.map((site) => {
    const village = villagesById.get(site.id);
    const tile = tiles.get(site.tile_id);
    const ownerWorldPlayerId = village?.owner_world_player_id ?? null;
    const ownerWorldPlayer = ownerWorldPlayerId ? worldPlayersById.get(ownerWorldPlayerId) : null;
    const ownerName =
      ownerWorldPlayer && usernameMap.get(ownerWorldPlayer.user_id)
        ? usernameMap.get(ownerWorldPlayer.user_id)!
        : ownerWorldPlayerId === currentWorldPlayer?.id
          ? currentUserName
          : ownerWorldPlayerId
            ? "Senhor rival"
            : "Territorio neutro";
    const relation: BoardSite["relation"] =
      ownerWorldPlayerId === currentWorldPlayer?.id
        ? "Proprio"
        : ownerWorldPlayer?.tribe_id && currentTribeId && ownerWorldPlayer.tribe_id === currentTribeId
          ? "Aliado"
          : ownerWorldPlayerId
            ? "Inimigo"
            : "Neutro";

    return {
      siteId: site.id,
      ownerWorldPlayerId: ownerWorldPlayerId,
      name: village?.name ?? `${site.site_type} ${site.id.slice(0, 4)}`,
      owner: ownerName,
      type: village?.settlement_role ?? site.site_type,
      cityClass: (village?.city_class as BoardSite["cityClass"]) ?? undefined,
      recommendedCityClass: (village?.city_class as BoardSite["recommendedCityClass"]) ?? undefined,
      occupationKind: (village?.origin_kind as BoardSite["occupationKind"]) ?? undefined,
      terrainKind: (village?.terrain_kind as BoardSite["terrainKind"]) ?? undefined,
      terrainLabel: village?.terrain_label ?? undefined,
      relation,
      coord: `${tile?.q ?? 0}:${tile?.r ?? 0}`,
      axial: {
        q: tile?.q ?? 0,
        r: tile?.r ?? 0,
      },
      state: site.status,
    };
  });

  if (!boardSites.length && villageSummaries[0]) {
    boardSites = [
      {
        name: villageSummaries[0].name,
        owner: currentUserName,
        type: "Capital",
        cityClass: villageSummaries[0].cityClass,
        recommendedCityClass: villageSummaries[0].cityClass,
        occupationKind: villageSummaries[0].originKind,
        terrainKind: villageSummaries[0].terrainKind,
        terrainLabel: villageSummaries[0].terrainLabel,
        relation: "Proprio",
        coord: "0:0",
        axial: { q: 0, r: 0 },
        state: "compact-schema",
      },
    ];
  }

  const tribeRank =
    currentTribeId && tribeBundle.tribes.has(currentTribeId)
      ? [...tribeBundle.tribes.values()].sort((a, b) => b.total_score_cached - a.total_score_cached).findIndex((entry) => entry.id === currentTribeId) + 1
      : 0;

  const currentTribe = currentTribeId ? tribeBundle.tribes.get(currentTribeId) : undefined;
  const currentKingAlive = villageSummaries.some((village) => village.kingHere);
  const wondersControlled = villageSummaries.filter((village) => (village.buildingLevels.wonder ?? 0) > 0).length;
  const averageInfluenceScore =
    worldPlayers.length > 0
      ? Math.round(worldPlayers.reduce((sum, entry) => sum + (entry.power_score_cached ?? 0), 0) / worldPlayers.length)
      : 0;
  const imperialStateByPlayerId = new Map<string, DbImperialStateRow>();
  if (imperialDbState?.world_player_id) {
    imperialStateByPlayerId.set(imperialDbState.world_player_id, imperialDbState);
  }
  const participants: WorldParticipant[] = [...worldPlayers]
    .map((entry) => {
      const state = imperialStateByPlayerId.get(entry.id);
      const livePower =
        state && (entry.power_score_cached ?? 0) <= 0
          ? calculateCachedPowerScore({
              militia: state.militia_count,
              shooters: state.shooters_count,
              scouts: state.scouts_count,
              machinery: state.machinery_count,
            })
          : entry.power_score_cached ?? 0;
      return { entry, livePower };
    })
    .sort((a, b) => b.livePower - a.livePower)
    .map((entry) => {
      const player = entry.entry;
      const participantTribe = player.tribe_id ? tribeBundle.tribes.get(player.tribe_id) : undefined;
      const relation: WorldParticipant["relation"] =
        player.id === currentWorldPlayer?.id
          ? "self"
          : player.tribe_id && currentTribeId && player.tribe_id === currentTribeId
            ? "ally"
            : player.tribe_id
              ? "wary"
              : "neutral";
      const name = usernameMap.get(player.user_id) ?? "Reino sem nome";

      return {
        id: player.id,
        name,
        influence: entry.livePower,
        status: player.status,
        relation,
        tribeName: participantTribe?.name ?? null,
        kingName: kingNameMap.get(player.id) ?? null,
        isAi: name.startsWith("ia_") || name.startsWith("reino_ia_"),
      };
    });

  const world: WorldState = {
    id: worldRecord.id,
    name: worldRecord.name,
    day: runtime.currentDay,
    phase: phaseLabel(runtime.currentDay, runtime.runtimeState.started, runtime.durationDays),
    seasonMode: runtime.seasonMode,
    speedMultiplier: runtime.speedMultiplier,
    durationDays: runtime.durationDays,
    playerCap: normalizeWorldPlayerCap(worldRecord.player_cap),
    averageInfluenceScore,
    activeAlerts: [
      runtime.runtimeState.realTimeEnabled
        ? `Mundo rodando em tempo real via Supabase (x${runtime.speedMultiplier}).`
        : "Tempo real desligado no banco.",
      runtime.currentDay >= runtime.portalStartDay ? "Portal Central e pressao final ativos." : "Campanha em progresso com estado persistente.",
      `Fonte unica: world ${worldRecord.slug}.`,
    ],
    activeVillageId:
      currentWorldPlayer?.current_capital_site_id && villageSummaries.some((entry) => entry.id === currentWorldPlayer.current_capital_site_id)
        ? currentWorldPlayer.current_capital_site_id
        : villageSummaries.find((entry) => entry.type === "Capital" && entry.kingHere)?.id ??
          villageSummaries.find((entry) => entry.type === "Capital")?.id ??
          villageSummaries[0]?.id ??
          "",
    villages: villageSummaries,
    researches: [] as ResearchEntry[],
    timeline: buildLiveTimeline(imperialDbState),
    buildings: [] as BuildingEntry[],
    boardSites,
    reports: buildLiveReports(imperialDbState),
    participants,
    mobilization: {
      available: runtime.currentDay >= runtime.portalStartDay,
      active: false,
      speedPenaltyMult: 1,
      interceptRiskMult: 1,
      orderLabel: runtime.currentDay >= runtime.portalStartDay ? "Reagrupar Imperio" : `Bloqueado ate D${runtime.portalStartDay}`,
      narrative: runtime.currentDay >= runtime.portalStartDay ? "Mobilizacao final liberada para a reta do Portal." : "Mobilizacao so abre quando a reta final comecar.",
    },
    tribe: {
      name: currentTribe?.name ?? "Sem tribo",
      citadelStatus: currentTribeId ? (tribeBundle.citadels.get(currentTribeId) ?? "Sem cidadela registrada") : "Sem cidadela registrada",
      totalScore: currentTribe?.total_score_cached ?? 0,
      rank: tribeRank,
      membersAlive: currentTribeId ? worldPlayers.filter((entry) => entry.tribe_id === currentTribeId && entry.status === "alive").length : 1,
    },
    sovereignty: {
      kingAlive: currentKingAlive,
      councilHeroes: heroAssignments,
      councilComposition: [],
      militaryRankingPoints: Math.max(0, Math.min(SOVEREIGNTY_MILITARY_SCORE_CAP, currentWorldPlayer?.power_score_cached ?? 0)),
      wondersControlled,
      eraQuestsCompleted: imperialDbState?.sandbox_quests_completed ?? 0,
      tribeDomeUnlocked: imperialDbState?.sandbox_dome_active ?? false,
      tribeLoyaltyStage: imperialDbState?.sandbox_dome_active ? 5 : 0,
    },
  };

  return {
    world,
    worldMeta: {
      status: worldRecord.status,
      finalReason:
        playerResult === "victorious"
          ? "victory"
          : playerCollapsed
            ? "collapse"
            : worldRecord.status === "finalized"
              ? "timeout"
              : null,
      readOnly: worldRecord.status === "finalized" || playerCollapsed,
      result: playerResult,
      finalRank,
      finalScore: currentWorldPlayer?.power_score_cached ?? null,
    },
    runtimeState: runtime.runtimeState,
    isSandboxWorld: Boolean(worldRecord.sandbox_enabled),
    routeWorldId: worldRecord.slug,
    worldPlayerId: currentWorldPlayer?.id ?? null,
  };
  } catch (error) {
    if (shouldUseLocalSupabaseFallback(error)) {
      console.warn(`Supabase unavailable in local dev. Using mock world payload for ${worldRouteId}.`, error);
      return buildMockWorldPayload(worldRouteId);
    }
    throw error;
  }
});
