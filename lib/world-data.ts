import "server-only";

import type {
  BoardSite,
  BuildingEntry,
  ReportCategory,
  ReportEntry,
  ResearchEntry,
  TimelineEntry,
  VillageSummary,
  WorldState,
  WorldSummary,
} from "@/lib/mock-data";
import { inFilter, looksLikeUuid, supabaseSelect } from "@/lib/supabase-rest";

const WORLD_DURATION_DAYS = 120;
const REAL_DAY_MS = 24 * 60 * 60 * 1000;

type DbWorld = {
  id: string;
  slug: string;
  name: string;
  status: "open" | "running" | "finalized";
  phase: "phase_1" | "phase_2" | "phase_3" | "phase_4" | "closed";
  day_number: number;
  runtime_started?: boolean;
  runtime_real_time_enabled?: boolean;
  runtime_anchor_day?: number;
  runtime_anchor_started_at?: string | null;
  sandbox_enabled?: boolean;
};

type DbWorldPlayer = {
  id: string;
  world_id: string;
  user_id: string;
  tribe_id: string | null;
  power_score_cached: number;
  status: string;
};

type DbUser = {
  id: string;
  username: string;
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
  energy_stock: number;
  influence_stock: number;
};

type DbVillageBuilding = {
  village_site_id: string;
  building_code: string;
  level: number;
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

type DbRoyalUnit = {
  royal_type: "king" | "prince";
  status: string;
  current_site_id: string | null;
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

type DbResearch = {
  research_code: string;
  current_level: number;
};

type DbResearchCatalog = {
  research_code: string;
  branch_code: string;
};

type DbResearchJob = {
  research_code: string;
  status: string;
  started_at: string | null;
  completes_at: string | null;
};

type DbBuildingJob = {
  village_site_id: string;
  building_code: string;
  status: string;
  completes_at: string | null;
};

type DbReport = {
  id: string;
  report_type: string;
  title: string;
  body_json: { summary?: string; details?: string[] } | null;
  created_at: string;
};

type DbReportRecipient = {
  report_id: string;
  is_read: boolean;
  delivered_at: string;
};

type DbImperialStateRow = {
  sandbox_quests_completed: number;
  sandbox_wonders_built: number;
  sandbox_dome_active: boolean;
};

type DbAssignment = {
  hero_slot: string | null;
};

export type WorldPayload = {
  world: WorldState;
  runtimeState: {
    started: boolean;
    realTimeEnabled: boolean;
    anchorDay: number;
    anchorStartedAtMs: number | null;
  };
  isSandboxWorld: boolean;
  routeWorldId: string;
  worldPlayerId: string | null;
};

function clampDay(day: number): number {
  return Math.max(0, Math.min(WORLD_DURATION_DAYS, Math.floor(day)));
}

function computeRuntime(world: DbWorld) {
  const started = Boolean(world.runtime_started ?? world.status !== "open");
  const realTimeEnabled = Boolean(world.runtime_real_time_enabled);
  const anchorDay = clampDay(world.runtime_anchor_day ?? world.day_number ?? 0);
  const anchorStartedAtMs = world.runtime_anchor_started_at ? Date.parse(world.runtime_anchor_started_at) : null;

  let day = started ? anchorDay : clampDay(world.day_number ?? 0);
  if (started && realTimeEnabled && anchorStartedAtMs) {
    day = clampDay(anchorDay + Math.floor((Date.now() - anchorStartedAtMs) / REAL_DAY_MS));
  }

  return {
    currentDay: day,
    runtimeState: {
      started,
      realTimeEnabled,
      anchorDay,
      anchorStartedAtMs,
    },
  };
}

function phaseLabel(day: number, started: boolean): string {
  if (!started) return "Aguardando inicio";
  if (day <= 0) return "Dia 0 - Preparacao";
  if (day <= 20) return "Fase 1 - Consolidacao";
  if (day <= 60) return "Fase 2 - Expansao";
  if (day <= 90) return "Fase 3 - Fortificacao";
  return "Fase 4 - Exodo";
}

function summaryStatus(status: DbWorld["status"]): WorldSummary["status"] {
  if (status === "running") return "Em Andamento";
  if (status === "finalized") return "Finalizado";
  return "Em Aberto";
}

function actionLabel(status: DbWorld["status"]): string {
  if (status === "running") return "Entrar";
  if (status === "finalized") return "Ver ranking";
  return "Registrar";
}

function formatEta(dateIso: string | null | undefined): string {
  if (!dateIso) {
    return "Sem ETA";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(dateIso));
}

function reportCategory(reportType: string): ReportCategory {
  if (reportType === "battle") return "combate";
  if (reportType === "spy") return "espionagem";
  if (reportType === "support") return "movimento";
  return "economia";
}

async function fetchWorldRecord(worldId: string): Promise<DbWorld> {
  const params = new URLSearchParams();
  params.set("select", "id,slug,name,status,phase,day_number,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at,sandbox_enabled");
  params.set("slug", `eq.${worldId}`);
  const bySlug = await supabaseSelect<DbWorld>("worlds", params);
  if (bySlug[0]) {
    return bySlug[0];
  }

  if (!looksLikeUuid(worldId)) {
    throw new Error(`World '${worldId}' was not found in Supabase.`);
  }

  const byIdParams = new URLSearchParams();
  byIdParams.set("select", "id,slug,name,status,phase,day_number,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at,sandbox_enabled");
  byIdParams.set("id", `eq.${worldId}`);
  const byId = await supabaseSelect<DbWorld>("worlds", byIdParams);
  if (!byId[0]) {
    throw new Error(`World '${worldId}' was not found in Supabase.`);
  }

  return byId[0];
}

async function fetchWorldPlayers(worldDbId: string): Promise<DbWorldPlayer[]> {
  const params = new URLSearchParams();
  params.set("select", "id,world_id,user_id,tribe_id,power_score_cached,status");
  params.set("world_id", `eq.${worldDbId}`);
  return supabaseSelect<DbWorldPlayer>("world_players", params);
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
  const villages = await supabaseSelect<DbVillage>("villages", villageParams);
  const villageIds = villages.map((entry) => entry.site_id);

  if (!villageIds.length) {
    return {
      villages,
      resources: new Map<string, DbVillageResourceState>(),
      buildings: new Map<string, Record<string, number>>(),
      royalsByVillage: new Map<string, DbRoyalUnit[]>(),
    };
  }

  const resourceParams = new URLSearchParams();
  resourceParams.set("select", "village_site_id,materials_stock,supplies_stock,energy_stock,influence_stock");
  resourceParams.set("village_site_id", inFilter(villageIds));
  const resources = await supabaseSelect<DbVillageResourceState>("village_resource_states", resourceParams);

  const buildingParams = new URLSearchParams();
  buildingParams.set("select", "village_site_id,building_code,level");
  buildingParams.set("village_site_id", inFilter(villageIds));
  const buildings = await supabaseSelect<DbVillageBuilding>("village_buildings", buildingParams);

  const royalParams = new URLSearchParams();
  royalParams.set("select", "royal_type,status,current_site_id");
  royalParams.set("current_site_id", inFilter(villageIds));
  const royals = await supabaseSelect<DbRoyalUnit>("royal_units", royalParams);

  const resourceMap = new Map(resources.map((entry) => [entry.village_site_id, entry]));
  const buildingMap = new Map<string, Record<string, number>>();
  for (const entry of buildings) {
    const current = buildingMap.get(entry.village_site_id) ?? {};
    current[entry.building_code] = entry.level;
    buildingMap.set(entry.village_site_id, current);
  }

  const royalsByVillage = new Map<string, DbRoyalUnit[]>();
  for (const entry of royals) {
    if (!entry.current_site_id) continue;
    const current = royalsByVillage.get(entry.current_site_id) ?? [];
    current.push(entry);
    royalsByVillage.set(entry.current_site_id, current);
  }

  return {
    villages,
    resources: resourceMap,
    buildings: buildingMap,
    royalsByVillage,
  };
}

async function fetchMapSites(worldDbId: string): Promise<{ sites: DbMapSite[]; tiles: Map<string, DbMapTile> }> {
  const siteParams = new URLSearchParams();
  siteParams.set("select", "id,tile_id,site_type,status");
  siteParams.set("world_id", `eq.${worldDbId}`);
  const sites = await supabaseSelect<DbMapSite>("map_sites", siteParams);
  const tileIds = sites.map((entry) => entry.tile_id);

  if (!tileIds.length) {
    return { sites, tiles: new Map() };
  }

  const tileParams = new URLSearchParams();
  tileParams.set("select", "id,q,r");
  tileParams.set("id", inFilter(tileIds));
  const tiles = await supabaseSelect<DbMapTile>("map_tiles", tileParams);

  return {
    sites,
    tiles: new Map(tiles.map((entry) => [entry.id, entry])),
  };
}

async function fetchTribes(worldDbId: string) {
  const tribeParams = new URLSearchParams();
  tribeParams.set("select", "id,name,total_score_cached");
  tribeParams.set("world_id", `eq.${worldDbId}`);
  const tribes = await supabaseSelect<DbTribe>("tribes", tribeParams);

  const citadelParams = new URLSearchParams();
  citadelParams.set("select", "tribe_id,status");
  citadelParams.set("world_id", `eq.${worldDbId}`);
  const citadels = await supabaseSelect<DbTribeCitadel>("tribe_citadels", citadelParams);

  return {
    tribes: new Map(tribes.map((entry) => [entry.id, entry])),
    citadels: new Map(citadels.map((entry) => [entry.tribe_id, entry.status])),
  };
}

async function fetchResearches(worldPlayerId: string | null): Promise<ResearchEntry[]> {
  if (!worldPlayerId) {
    return [];
  }

  const researchParams = new URLSearchParams();
  researchParams.set("select", "research_code,current_level");
  researchParams.set("world_player_id", `eq.${worldPlayerId}`);
  const researches = await supabaseSelect<DbResearch>("world_player_research", researchParams);
  if (!researches.length) {
    return [];
  }

  const catalogParams = new URLSearchParams();
  catalogParams.set("select", "research_code,branch_code");
  catalogParams.set("research_code", inFilter(researches.map((entry) => entry.research_code)));
  const catalog = await supabaseSelect<DbResearchCatalog>("research_catalog", catalogParams);
  const catalogMap = new Map(catalog.map((entry) => [entry.research_code, entry]));

  const jobsParams = new URLSearchParams();
  jobsParams.set("select", "research_code,status,started_at,completes_at");
  jobsParams.set("world_player_id", `eq.${worldPlayerId}`);
  const jobs = await supabaseSelect<DbResearchJob>("research_jobs", jobsParams);
  const jobsMap = new Map(jobs.map((entry) => [entry.research_code, entry]));

  return researches.map((entry) => {
    const job = jobsMap.get(entry.research_code);
    const branch = catalogMap.get(entry.research_code)?.branch_code ?? "geral";
    return {
      name: entry.research_code,
      branch,
      level: entry.current_level,
      progress: job?.status === "running" ? 50 : 100,
      eta: formatEta(job?.completes_at),
    };
  });
}

async function fetchTimeline(villageIds: string[], worldPlayerId: string | null): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];

  if (villageIds.length) {
    const buildingJobParams = new URLSearchParams();
    buildingJobParams.set("select", "village_site_id,building_code,status,completes_at");
    buildingJobParams.set("village_site_id", inFilter(villageIds));
    buildingJobParams.set("status", "in.(queued,running)");
    const jobs = await supabaseSelect<DbBuildingJob>("building_jobs", buildingJobParams);
    timeline.push(
      ...jobs.slice(0, 4).map((entry): TimelineEntry => ({
        title: `Obra: ${entry.building_code}`,
        detail: `Fila ${entry.status} na cidade ${entry.village_site_id.slice(0, 8)}.`,
        eta: formatEta(entry.completes_at),
        priority: entry.status === "running" ? "alto" : "medio",
      })),
    );
  }

  if (worldPlayerId) {
    const researchJobParams = new URLSearchParams();
    researchJobParams.set("select", "research_code,status,started_at,completes_at");
    researchJobParams.set("world_player_id", `eq.${worldPlayerId}`);
    researchJobParams.set("status", "in.(queued,running)");
    const jobs = await supabaseSelect<DbResearchJob>("research_jobs", researchJobParams);
    timeline.push(
      ...jobs.slice(0, 3).map((entry): TimelineEntry => ({
        title: `Pesquisa: ${entry.research_code}`,
        detail: `Linha ${entry.status} do reino.`,
        eta: formatEta(entry.completes_at),
        priority: entry.status === "running" ? "alto" : "medio",
      })),
    );
  }

  if (!timeline.length) {
    return [
      {
        title: "Sem fila pendente",
        detail: "O mundo esta sendo lido direto do Supabase e ainda nao encontrou obras ou pesquisas em andamento.",
        eta: "Agora",
        priority: "baixo",
      },
    ];
  }

  return timeline.slice(0, 6);
}

async function fetchReports(worldDbId: string, worldPlayerId: string | null): Promise<ReportEntry[]> {
  if (!worldPlayerId) {
    return [];
  }

  const recipientParams = new URLSearchParams();
  recipientParams.set("select", "report_id,is_read,delivered_at");
  recipientParams.set("world_player_id", `eq.${worldPlayerId}`);
  const recipients = await supabaseSelect<DbReportRecipient>("report_recipients", recipientParams);
  const reportIds = recipients.map((entry) => entry.report_id);
  if (!reportIds.length) {
    return [];
  }

  const reportParams = new URLSearchParams();
  reportParams.set("select", "id,report_type,title,body_json,created_at");
  reportParams.set("world_id", `eq.${worldDbId}`);
  reportParams.set("id", inFilter(reportIds));
  const reports = await supabaseSelect<DbReport>("reports", reportParams);
  const recipientMap = new Map(recipients.map((entry) => [entry.report_id, entry]));

  return reports.slice(0, 20).map((entry) => ({
    id: entry.id,
    category: reportCategory(entry.report_type),
    type: entry.report_type,
    title: entry.title,
    summary: entry.body_json?.summary ?? "Relatorio persistido no Supabase.",
    details: entry.body_json?.details ?? [],
    time: formatEta(recipientMap.get(entry.id)?.delivered_at ?? entry.created_at),
    unread: !recipientMap.get(entry.id)?.is_read,
  }));
}

async function fetchImperialDbState(worldDbId: string, worldPlayerId: string | null) {
  if (!worldPlayerId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("select", "sandbox_quests_completed,sandbox_wonders_built,sandbox_dome_active");
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
  const rows = await supabaseSelect<DbAssignment>("village_specialist_assignments", params);
  return rows.filter((entry) => Boolean(entry.hero_slot)).length;
}

export async function listWorldSummaries(): Promise<WorldSummary[]> {
  const params = new URLSearchParams();
  params.set("select", "id,slug,name,status,phase,day_number,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at");
  const worlds = await supabaseSelect<DbWorld>("worlds", params);

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
      phase: phaseLabel(runtime.currentDay, runtime.runtimeState.started),
      players: counts.get(world.id) ?? 0,
      actionLabel: actionLabel(world.status),
    };
  });
}

export async function getWorldPayload(worldRouteId: string): Promise<WorldPayload> {
  const worldRecord = await fetchWorldRecord(worldRouteId);
  const runtime = computeRuntime(worldRecord);
  const worldPlayers = await fetchWorldPlayers(worldRecord.id);
  const currentWorldPlayer = worldPlayers[0] ?? null;
  const currentTribeId = currentWorldPlayer?.tribe_id ?? null;
  const usernameMap = await fetchUsers(Array.from(new Set(worldPlayers.map((entry) => entry.user_id))));

  const [{ villages, resources, buildings, royalsByVillage }, { sites, tiles }, tribeBundle, researches, imperialDbState, heroAssignments, reports] = await Promise.all([
    fetchVillages(worldRecord.id),
    fetchMapSites(worldRecord.id),
    fetchTribes(worldRecord.id),
    fetchResearches(currentWorldPlayer?.id ?? null),
    fetchImperialDbState(worldRecord.id, currentWorldPlayer?.id ?? null),
    fetchHeroAssignments(currentWorldPlayer?.id ?? null),
    fetchReports(worldRecord.id, currentWorldPlayer?.id ?? null),
  ]);

  const timeline = await fetchTimeline(villages.map((entry) => entry.site_id), currentWorldPlayer?.id ?? null);

  const villagesById = new Map(villages.map((entry) => [entry.site_id, entry]));
  const worldPlayersById = new Map(worldPlayers.map((entry) => [entry.id, entry]));
  const currentUserName = currentWorldPlayer ? usernameMap.get(currentWorldPlayer.user_id) ?? "Seu reino" : "Seu reino";

  const villageSummaries: VillageSummary[] = villages.map((entry) => {
    const villageResources = resources.get(entry.site_id);
    const buildingLevels = buildings.get(entry.site_id) ?? {};
    const royals = royalsByVillage.get(entry.site_id) ?? [];
    return {
      id: entry.site_id,
      name: entry.name,
      type: entry.settlement_role === "Capital" || entry.village_type === "capital" ? "Capital" : "Colonia",
      cityClass: (entry.city_class as VillageSummary["cityClass"]) ?? "neutral",
      cityClassLocked: Boolean(entry.city_class_locked),
      originKind: (entry.origin_kind as VillageSummary["originKind"]) ?? "claimed_city",
      terrainKind: (entry.terrain_kind as VillageSummary["terrainKind"]) ?? "ashen_fields",
      terrainLabel: entry.terrain_label ?? "Territorio imperial",
      politicalState: entry.political_state,
      materials: villageResources?.materials_stock ?? 0,
      supplies: villageResources?.supplies_stock ?? 0,
      energy: villageResources?.energy_stock ?? 0,
      influence: villageResources?.influence_stock ?? 0,
      palaceLevel: buildingLevels.palace ?? 0,
      kingHere: royals.some((royal) => royal.royal_type === "king" && royal.status !== "dead"),
      princeHere: royals.some((royal) => royal.royal_type === "prince" && royal.status !== "dead"),
      underAttack: false,
      deficits: [],
      buildingLevels,
    };
  });

  const boardSites: BoardSite[] = sites.map((site) => {
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

  const world: WorldState = {
    id: worldRecord.id,
    name: worldRecord.name,
    day: runtime.currentDay,
    phase: phaseLabel(runtime.currentDay, runtime.runtimeState.started),
    averageInfluenceScore,
    activeAlerts: [
      runtime.runtimeState.realTimeEnabled ? "Mundo rodando em tempo real via Supabase." : "Tempo real desligado no banco.",
      runtime.currentDay >= 91 ? "Portal Central e pressao final ativos." : "Campanha em progresso com estado persistente.",
      `Fonte unica: world ${worldRecord.slug}.`,
    ],
    activeVillageId: villageSummaries.find((entry) => entry.type === "Capital")?.id ?? villageSummaries[0]?.id ?? "",
    villages: villageSummaries,
    researches,
    timeline,
    buildings: [] as BuildingEntry[],
    boardSites,
    reports,
    mobilization: {
      available: runtime.currentDay >= 91,
      active: false,
      speedPenaltyMult: 1,
      interceptRiskMult: 1,
      orderLabel: runtime.currentDay >= 91 ? "Reagrupar Imperio" : "Bloqueado ate D91",
      narrative: runtime.currentDay >= 91 ? "Mobilizacao final liberada para a reta do Portal." : "Mobilizacao so abre quando a reta final comecar.",
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
      militaryRankingPoints: Math.max(0, Math.min(500, currentWorldPlayer?.power_score_cached ?? 0)),
      wondersControlled,
      eraQuestsCompleted: imperialDbState?.sandbox_quests_completed ?? 0,
      tribeDomeUnlocked: imperialDbState?.sandbox_dome_active ?? false,
      tribeLoyaltyStage: imperialDbState?.sandbox_dome_active ? 5 : 0,
    },
  };

  return {
    world,
    runtimeState: runtime.runtimeState,
    isSandboxWorld: Boolean(worldRecord.sandbox_enabled),
    routeWorldId: worldRecord.slug,
    worldPlayerId: currentWorldPlayer?.id ?? null,
  };
}
