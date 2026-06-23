﻿"use client";

import { Globe2, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  axialDistance,
  axialKey,
  axialNeighbor,
  axialRound,
  axialToPixel,
  hexCorners,
  hexLine,
  pixelToAxial,
  type AxialCoord,
  type PixelPoint,
} from "@/lib/hex-grid";
import {
  CITY_DIPLOMAT_UNLOCK_DEVELOPMENT,
  FINAL_EXODUS_DAY,
  MAX_CITY_DIPLOMATS,
  SOVEREIGNTY_MILITARY_SCORE_CAP,
  SOVEREIGNTY_PORTAL_CUT,
  calculateDefensePower,
  calculateTroopPower,
  calculateMapConstructionCost,
  calculateMarchTimeMinutes,
  calculateSovereigntyScore,
  calculateTribeProgressStage,
  calculateVillageDevelopment,
  getVillageDefenseLevel,
  canEnterPortal,
  type TerrainModifiers,
} from "@/core/GameBalance";
import {
  TERRAIN_META,
  cityClassLabel,
  type CityClass,
  type CityOriginKind,
  type TerrainKind,
} from "@/lib/cities";
import { projectStructureLevelsToBuildingLevels, useImperialStateContext } from "@/lib/imperial-state";
import { resolveKingGameplayModifiers } from "@/lib/king-profiles";
import type {
  CityDefenseAllocations,
  CityDefenseProtocol,
  ExplorationDiscoveryType,
  HeroBuildId,
  ImperialExplorationDiscovery,
  ImperialVillageClaim,
} from "@/lib/imperial-state";
import { emitUiFeedback, emitUiToast } from "@/lib/ui-feedback";
import { useLiveWorldContext } from "@/lib/world-runtime";
import { getDefaultBuildingLevels, getZeroBuildingLevels } from "@/lib/buildings";
import { processKingsWorldCombat, type CombatArmy, type CombatResult } from "@/lib/combat-engine";
import type { BoardSite } from "@/lib/mock-data";
import { ExplorationRevealModal } from "./ExplorationRevealModal";
import {
  CORE_RING_LIMIT,
  MID_RING_LIMIT,
  WORLD_HEX_RADIUS,
  WORLD_HEX_TILE_COUNT,
  WORLD_HEX_TILE_SIZE_PX,
} from "@/lib/world-map-config";
import {
  DEFAULT_WORLD_ZOOM,
  DETAIL_RING_LIMIT,
  DETAIL_ZOOM_THRESHOLD,
  DISTRICT_IDS,
  DISTRICT_META,
  EXPLORATION_ACTION_COST_BASE,
  FOG_VISUAL_DISABLED,
  HOTSPOT_META,
  HOTSPOT_TARGET,
  INTERNAL_AID_SPEED_MULT,
  MACRO_VISION_THRESHOLD,
  MAP_IMAGE_CALIBRATION,
  MICRO_VISION_THRESHOLD,
  PHASE4_REGROUP_SPEED_MULT,
  PLAYER_VILLAGE_CAP,
  TERRAIN_VISUAL_META,
  THRONE_TOOLTIP,
  TILE_STYLE_BY_ZONE,
  TROOP_LABELS,
  TROOP_ORDER,
  WORLD_MAP_IMAGE_SRC,
  WORLD_OVERVIEW_ZOOM,
  ZOOM_LEVEL_SCALE,
} from "./strategic-map-config";
import {
  actionTone,
  relationFilterLabel,
  relationFilterTone,
} from "./strategic-map-copy";
import {
  buildHexWorld,
  buildBattleLogLine,
  buildTargetDefense,
  cityDetailImageSrc,
  cityIconSrcForSite,
  cityMicroSurfaceStyle,
  clampNumber,
  classifyFaction,
  createClaimedVillageName,
  factionInfluenceColor,
  findBoardSiteByCoord,
  formatLegacyCoord,
  generateAmbientSites,
  generateHotspots,
  hashSeed,
  influenceRadiusForSite,
  influenceWeight,
  isVillageSite,
  labelClass,
  markerBorderClass,
  markerFillClass,
  markerGlowStyle,
  normalizeAxial,
  mergeLoot,
  parseLegacyCoord,
  siteMarkerText,
  strategicNodeTone,
  subtractArmyLosses,
} from "./strategic-map-model";
import type {
  ActionStep,
  BuildMode,
  BuiltWorld,
  DistrictId,
  DistrictLabel,
  Faction,
  FactionInfluenceOverlay,
  FrontierLine,
  Hotspot,
  HotspotKind,
  MapSite,
  MapZone,
  MovementDraft,
  MovementRouteStep,
  RelationFilter,
  StrategicMapProps,
  StrategicNode,
  StrategicNodeState,
  StoredMapMovement,
  TileActionKind,
  TileActionOption,
  TroopPreset,
  TroopSelection,
  TroopTypeId,
  WorldHexTile,
  ZoomLevel,
} from "./strategic-map-types";

function describeTileAction(kind: TileActionKind): string {
  if (kind === "build") return "Criar estrada ou cidade";
  if (kind === "go") return "Operação militar de marcha ou apoio";
  if (kind === "attack") return "Operação militar para tomar cidade";
  if (kind === "annex") return "Tomar cidade vazia";
  if (kind === "explore") return "Explorar área e revelar riscos";
  return "Apenas olhar";
}

const ZERO_AXIAL: AxialCoord = { q: 0, r: 0 };
function clampZoomLevel(level: number): ZoomLevel {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4;
}

function isMapInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, [data-map-hud]"));
}

function explorationSeed(worldId: string, coordKey: string): number {
  return hashSeed(`${worldId}:${coordKey}:explore`);
}

function buildExplorationDiscovery(
  worldId: string,
  tile: WorldHexTile,
  routeSummary: { hexCount: number },
): ImperialExplorationDiscovery {
  const roll = explorationSeed(worldId, tile.coordKey) % 100;
  const farFromCenter = tile.distance >= MID_RING_LIMIT;
  const type: ExplorationDiscoveryType =
    roll < 34
      ? "empty"
      : roll < 58
        ? "opportunity"
        : roll < 82
          ? farFromCenter ? "threat" : "ruins"
          : farFromCenter
            ? "dragon"
            : "threat";

  if (type === "opportunity") {
    return {
      coordKey: tile.coordKey,
      type,
      status: "new",
      title: "Oportunidade revelada",
      summary: "A exploração encontrou sinais de riqueza e posição boa para expansão. A área merece atenção antes que outro reino chegue.",
      imageSrc: "/images/card-opportunity.jpg",
      riskLabel: "Risco médio",
      rewardLabel: "Bônus de fundação",
      actionLabel: "Marcar oportunidade",
    };
  }

  if (type === "ruins") {
    return {
      coordKey: tile.coordKey,
      type,
      status: "new",
      title: "Ruínas antigas",
      summary: "A estrutura está caída, mas o terreno guarda fundações aproveitáveis. Bom ponto para cidade ou evento futuro.",
      imageSrc: "/images/threat-empty-ruins.jpg",
      riskLabel: "Risco leve",
      rewardLabel: "Ruína útil",
      actionLabel: "Marcar ruína",
    };
  }

  if (type === "threat") {
    const demon = explorationSeed(worldId, `${tile.coordKey}:threat`) % 2 === 0;
    return {
      coordKey: tile.coordKey,
      type,
      status: "new",
      title: demon ? "Presença demoníaca" : "Saqueadores avistados",
      summary: demon
        ? "A área pulsa com corrupção e atividade hostil. Ignorar agora pode deixar a fronteira mais cara depois."
        : "Grupos armados leves rondam a região. Não é uma guerra, mas já pressiona qualquer fundação próxima.",
      imageSrc: demon ? "/images/threat-demons.jpg" : "/images/threat-raiders.jpg",
      riskLabel: demon ? "Risco alto" : "Risco médio",
      rewardLabel: "Alvo militar",
      actionLabel: "Marcar ameaça",
    };
  }

  if (type === "dragon") {
    return {
      coordKey: tile.coordKey,
      type,
      status: "new",
      title: "Dragão à vista",
      summary: "Os exploradores recuaram vivos, mas a mensagem é clara: há uma presença rara dominando a área. Isso vira história, risco e valor.",
      imageSrc: "/images/dragon-in-sight.jpg",
      riskLabel: "Risco extremo",
      rewardLabel: "Evento raro",
      actionLabel: "Marcar criatura",
    };
  }

  return {
    coordKey: tile.coordKey,
    type: "empty",
    status: "new",
    title: "Território conhecido",
    summary: routeSummary.hexCount > 5
      ? "Nada decisivo apareceu, mas a área agora está registrada. É um corredor seguro para leitura e expansão futura."
      : "A área não revelou ameaça imediata. Terreno livre, sem dono visível, bom para planejar a próxima rota.",
    imageSrc: "/images/territory-known-empty.jpg",
    riskLabel: "Sem ameaça",
    rewardLabel: "Área conhecida",
    actionLabel: "Marcar terreno",
  };
}

function buildPassageDiscovery(
  worldId: string,
  tile: WorldHexTile,
  routeSummary: { hexCount: number },
  site: BoardSite | null,
): ImperialExplorationDiscovery {
  if (site?.relation === "Inimigo") {
    return {
      coordKey: tile.coordKey,
      type: "threat",
      status: "new",
      title: "Aldeia inimiga avistada",
      summary: `${site.name} apareceu no caminho da exploração. O local foi marcado sem iniciar combate; agora você sabe que existe presença hostil naquela passagem.`,
      imageSrc: "/images/threat-raiders.jpg",
      riskLabel: "Contato hostil",
      rewardLabel: "Intel militar",
      actionLabel: "Avaliar ataque",
    };
  }

  if (site?.occupationKind === "abandoned_city") {
    return {
      coordKey: tile.coordKey,
      type: "ruins",
      status: "new",
      title: "Cidade vazia encontrada",
      summary: `${site.name} está sem dono ativo. Não é conquista automática: a Coroa ainda precisa decidir se manda diplomata, tropas ou deixa a ruína esfriar.`,
      imageSrc: "/images/threat-empty-ruins.jpg",
      riskLabel: "Baixo controle",
      rewardLabel: "Anexação possível",
      actionLabel: "Marcar cidade vazia",
    };
  }

  if (site) {
    return {
      coordKey: tile.coordKey,
      type: "opportunity",
      status: "new",
      title: "Contato local registrado",
      summary: `${site.name} foi registrada durante a passagem. A rota agora tem referência política e pode afetar decisões de fronteira.`,
      imageSrc: "/images/card-opportunity.jpg",
      riskLabel: "Contato diplomático",
      rewardLabel: "Leitura local",
      actionLabel: "Marcar contato",
    };
  }

  return buildExplorationDiscovery(worldId, tile, routeSummary);
}

function discoveryTypeLabel(type: ExplorationDiscoveryType): string {
  switch (type) {
    case "opportunity":
      return "Oportunidade";
    case "threat":
      return "Ameaça";
    case "ruins":
      return "Ruína";
    case "dragon":
      return "Criatura rara";
    default:
      return "Território";
  }
}

function discoveryAccent(type: ExplorationDiscoveryType): {
  chip: string;
  panel: string;
  glow: string;
} {
  switch (type) {
    case "opportunity":
      return {
        chip: "border-amber-300/45 bg-amber-500/12 text-amber-100",
        panel: "border-amber-300/45 bg-slate-950/88",
        glow: "rgba(251,191,36,0.26)",
      };
    case "threat":
      return {
        chip: "border-rose-300/45 bg-rose-500/12 text-rose-100",
        panel: "border-rose-300/45 bg-slate-950/88",
        glow: "rgba(244,63,94,0.24)",
      };
    case "ruins":
      return {
        chip: "border-violet-300/45 bg-violet-500/12 text-violet-100",
        panel: "border-violet-300/45 bg-slate-950/88",
        glow: "rgba(168,85,247,0.22)",
      };
    case "dragon":
      return {
        chip: "border-orange-300/50 bg-orange-500/14 text-orange-100",
        panel: "border-orange-300/45 bg-slate-950/88",
        glow: "rgba(249,115,22,0.26)",
      };
    default:
      return {
        chip: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
        panel: "border-cyan-300/35 bg-slate-950/88",
        glow: "rgba(34,211,238,0.22)",
      };
  }
}

function presetRatio(preset: Exclude<TroopPreset, "custom">): number {
  return preset === "light" ? 0.28 : preset === "heavy" ? 0.78 : 0.52;
}

function buildDispatchFromPreset(pool: TroopSelection, preset: Exclude<TroopPreset, "custom">): TroopSelection {
  const ratio = presetRatio(preset);
  return {
    militia: Math.round(pool.militia * ratio),
    shooters: Math.round(pool.shooters * ratio),
    scouts: Math.round(pool.scouts * ratio),
    machinery: Math.round(pool.machinery * ratio),
  };
}

function clampDispatchToPool(dispatch: TroopSelection, pool: TroopSelection): TroopSelection {
  return {
    militia: Math.max(0, Math.min(dispatch.militia, pool.militia)),
    shooters: Math.max(0, Math.min(dispatch.shooters, pool.shooters)),
    scouts: Math.max(0, Math.min(dispatch.scouts, pool.scouts)),
    machinery: Math.max(0, Math.min(dispatch.machinery, pool.machinery)),
  };
}

function troopSelectionTotal(selection: TroopSelection): number {
  return selection.militia + selection.shooters + selection.scouts + selection.machinery;
}

function formatTroopCommitment(selection: TroopSelection): string {
  const parts: string[] = [];
  if (selection.militia > 0) parts.push(`${selection.militia} milicia`);
  if (selection.shooters > 0) parts.push(`${selection.shooters} atiradores`);
  if (selection.scouts > 0) parts.push(`${selection.scouts} exploradores`);
  if (selection.machinery > 0) parts.push(`${selection.machinery} maquinas`);
  return parts.length > 0 ? parts.join(", ") : "nenhuma";
}

function sameTroopSelection(a: TroopSelection, b: TroopSelection): boolean {
  return a.militia === b.militia && a.shooters === b.shooters && a.scouts === b.scouts && a.machinery === b.machinery;
}


function edgeKeyByCoord(a: AxialCoord, b: AxialCoord): string {
  const ak = axialKey(a);
  const bk = axialKey(b);
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}

function formatMinutesLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return hh > 0 ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

function mapActionToMovementType(action: TileActionKind): StoredMapMovement["movementType"] {
  if (action === "explore") {
    return "scout";
  }
  if (action === "attack") {
    return "attack";
  }
  if (action === "annex") {
    return "annex";
  }
  if (action === "build") {
    return "transport";
  }
  return "support";
}

function generateMovementId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rand = Math.floor(Math.random() * 1_000_000_000).toString(16);
  return `mv-${Date.now().toString(16)}-${rand}`;
}

function revealCorridorKeys(routeKeys: string[]): string[] {
  const revealed = new Set<string>();

  for (const key of routeKeys) {
    const coord = parseLegacyCoord(key);
    if (axialDistance(coord, ZERO_AXIAL) > WORLD_HEX_RADIUS) {
      continue;
    }

    revealed.add(axialKey(coord));
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = axialNeighbor(coord, direction);
      if (axialDistance(neighbor, ZERO_AXIAL) <= WORLD_HEX_RADIUS) {
        revealed.add(axialKey(neighbor));
      }
    }
  }

  return [...revealed];
}

function movementPassedRouteKeys(movement: StoredMapMovement, now: number): string[] {
  if (movement.routeSteps?.length) {
    const passed = movement.routeSteps
      .filter((step) => {
        const arrivalTs = Date.parse(step.arrivalAt ?? "");
        return Number.isFinite(arrivalTs) && arrivalTs <= now;
      })
      .map((step) => step.coordKey);

    return passed.length > 0 ? passed : [movement.sourceCoord];
  }

  const route = movement.route.length > 0 ? movement.route : [movement.sourceCoord, movement.targetCoord];
  const start = Date.parse(movement.launchedAt);
  const end = Date.parse(movement.arrivalAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return route;
  }

  const progress = clampNumber((now - start) / (end - start), 0, 1);
  const lastIndex = Math.max(0, Math.min(route.length - 1, Math.floor(progress * (route.length - 1))));
  return route.slice(0, lastIndex + 1);
}

function normalizeMovementCoordKey(coordKey: string): string {
  return axialKey(parseLegacyCoord(coordKey));
}

function movementActionLabel(movement: StoredMapMovement): string {
  if (movement.commandAction === "explore") return "Exploração";
  if (movement.commandAction === "attack") return "Ataque";
  if (movement.commandAction === "annex") return "Anexacao";
  if (movement.commandAction === "build") return movement.meta.buildMode === "road" ? "Estrada" : "Fundacao";
  if (movement.commandAction === "spy") return "Reconhecimento";
  if (normalizeMovementCoordKey(movement.targetCoord) === axialKey(ZERO_AXIAL)) return "Portal";
  return "Marcha";
}

function buildCorridorIntelReports(revealedKeys: string[], sites: BoardSite[]): Array<{ coordKey: string; text: string }> {
  const visible = new Set(revealedKeys);
  const reports: Array<{ coordKey: string; text: string }> = [];

  for (const site of sites) {
    const coord = normalizeAxial(site);
    const coordKey = axialKey(coord);
    if (!visible.has(coordKey)) {
      continue;
    }

    if (site.relation === "Inimigo") {
      reports.push({ coordKey, text: `Contato hostil em ${coord.q}:${coord.r}: ${site.name} (${site.owner}).` });
    } else if (site.occupationKind === "abandoned_city") {
      reports.push({ coordKey, text: `Cidade vazia avistada em ${coord.q}:${coord.r}: ${site.name}.` });
    } else if (site.relation === "Aliado") {
      reports.push({ coordKey, text: `Contato aliado confirmado em ${coord.q}:${coord.r}: ${site.name}.` });
    }
  }

  return reports.filter((report, index, all) => all.findIndex((entry) => entry.coordKey === report.coordKey) === index).slice(0, 5);
}

async function registerMapMovement(
  worldId: string,
  draft: MovementDraft,
  meta: StoredMapMovement["meta"],
): Promise<StoredMapMovement> {
  const now = new Date();
  const launchedAt = now.toISOString();
  const arrivalAt = new Date(now.getTime() + draft.etaMinutes * 60_000).toISOString();
  const routeSteps = draft.routeSteps.map((step) => ({
    ...step,
    arrivalAt: new Date(now.getTime() + step.elapsedMinutes * 60_000).toISOString(),
  }));

  const stored: StoredMapMovement = {
    id: generateMovementId(),
    worldId,
    sourceCoord: axialKey(draft.from),
    targetCoord: axialKey(draft.to),
    movementType: mapActionToMovementType(draft.action),
    commandAction: draft.action as StoredMapMovement["commandAction"],
    launchedAt,
    arrivalAt,
    etaMinutes: draft.etaMinutes,
    route: draft.route.map((coord) => axialKey(coord)),
    routeSteps,
    status: "traveling",
    meta,
  };

  await new Promise((resolve) => setTimeout(resolve, 180));
  return stored;
}

export function StrategicMap({ worldId, tribeName, sites, villages, currentDay: initialDay, sovereigntyScore: initialSovereigntyScore, readOnly = false, worldStarted = true }: StrategicMapProps) {
  const { world: liveWorld } = useLiveWorldContext();
  const currentDay = liveWorld.day ?? initialDay;
  const { imperialState, setImperialState } = useImperialStateContext();
  const kingModifiers = useMemo(() => resolveKingGameplayModifiers(imperialState.kingProfileId), [imperialState.kingProfileId]);
  const tribeInfluenceStage = calculateTribeProgressStage({
    currentDay,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: liveWorld.sovereignty.kingAlive,
  });
  const assignedHeroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );
  const populationSummary = useMemo(() => {
    return villages.reduce(
      (summary, village) => {
        const cap = Math.min(100, Math.max(0, Math.floor((village.buildingLevels.housing ?? 0) * 10)));
        const productionWorkers = imperialState.productionWorkersByVillage[village.id] ?? { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
        const jobs = imperialState.jobsByVillage[village.id] ?? { medics: 0, crafts: 0, order: 0, scholars: 0 };
        const recruits = imperialState.recruitsByVillage[village.id] ?? { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
        const defenders = imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 };
        const used =
          Object.values(productionWorkers).reduce((sum, value) => sum + value, 0) +
          Object.values(jobs).reduce((sum, value) => sum + value, 0) +
          Object.values(recruits).reduce((sum, value) => sum + value, 0) +
          Object.values(defenders).reduce((sum, value) => sum + value, 0);
        const current = Math.min(cap, Math.max(used, imperialState.populationByVillage[village.id] ?? cap));
        return {
          current: summary.current + current,
          cap: summary.cap + cap,
          employed: summary.employed + Object.values(productionWorkers).reduce((sum, value) => sum + value, 0) + Object.values(jobs).reduce((sum, value) => sum + value, 0),
          recruited: summary.recruited + Object.values(recruits).reduce((sum, value) => sum + value, 0),
          defended: summary.defended + Object.values(defenders).reduce((sum, value) => sum + value, 0),
        };
      },
      { current: 0, cap: 0, employed: 0, recruited: 0, defended: 0 },
    );
  }, [
    imperialState.defenseRecruitsByVillage,
    imperialState.jobsByVillage,
    imperialState.populationByVillage,
    imperialState.productionWorkersByVillage,
    imperialState.recruitsByVillage,
    villages,
  ]);
  const unlockedTechs = useMemo(
    () => Object.values(imperialState.militaryTechTree).reduce((sum, value) => sum + (value ? 1 : 0), 0),
    [imperialState.militaryTechTree],
  );
  const sovereigntyScore = useMemo(
    () =>
      calculateSovereigntyScore({
        villages,
        villageDevelopments: villages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
        councilHeroes: Math.max(liveWorld.sovereignty.councilHeroes, assignedHeroCount),
        militaryRankingPoints: liveWorld.sovereignty.militaryRankingPoints,
        eraQuestsCompleted: liveWorld.sovereignty.eraQuestsCompleted,
        wondersControlled: liveWorld.sovereignty.wondersControlled,
        currentDay,
        hasTribeDome: liveWorld.sovereignty.tribeDomeUnlocked || imperialState.sandboxDomeActive,
        tribeLoyaltyStage: tribeInfluenceStage,
        kingAlive: liveWorld.sovereignty.kingAlive,
        workforce: imperialState.workforceByFocus,
        unlockedMilitaryTechs: unlockedTechs,
        dragonChoice: imperialState.dragonChoice,
        populationCurrent: populationSummary.current,
        populationCapacity: populationSummary.cap,
        employedPopulation: populationSummary.employed,
        recruitedPopulation: populationSummary.recruited,
        senateSatisfaction: imperialState.senate.satisfaction,
        troopPower: calculateTroopPower(imperialState.troops),
        defensePower: villages.reduce(
          (sum, village) => sum + calculateDefensePower(imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 }),
          0,
        ),
      }).total,
    [
      assignedHeroCount,
      currentDay,
      imperialState.dragonChoice,
      imperialState.sandboxDomeActive,
      imperialState.senate.satisfaction,
      imperialState.troops,
      imperialState.workforceByFocus,
      populationSummary,
      liveWorld.sovereignty,
      tribeInfluenceStage,
      unlockedTechs,
      villages,
    ],
  ) || initialSovereigntyScore;
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapLayerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);
  const zoomCinemaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const suppressViewportTapRef = useRef(false);
  const interactionGateRef = useRef<{ coordKey: string; at: number; zoomLevel: ZoomLevel } | null>(null);
  const zoomNavigationLockUntilRef = useRef(0);
  const initialViewAppliedRef = useRef(false);

  const [zoom, setZoom] = useState(DEFAULT_WORLD_ZOOM);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(4);
  const [zoomCinematic, setZoomCinematic] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [selectedCoordKey, setSelectedCoordKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [inspectedCoordKey, setInspectedCoordKey] = useState<string | null>(null);
  const [relationFilter, setRelationFilter] = useState<RelationFilter>("all");
  const [activeAction, setActiveAction] = useState<TileActionKind>("explore");
  const [actionStep, setActionStep] = useState<ActionStep>("choose");
  const [buildMode, setBuildMode] = useState<BuildMode>("outpost");
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(null);
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementMessage, setMovementMessage] = useState<string | null>(null);
  const [submittingExploration, setSubmittingExploration] = useState(false);
  const [explorationReveal, setExplorationReveal] = useState<ImperialExplorationDiscovery | null>(null);
  const [routeClock, setRouteClock] = useState(() => Date.now());
  const storedMovements = (imperialState.mapMovements ?? []) as StoredMapMovement[];
  const latestBattleMovement = useMemo(
    () =>
      storedMovements.find(
        (movement) => movement.commandAction === "attack" && movement.status === "arrived" && Boolean(movement.meta.combatResult),
      ) ?? null,
    [storedMovements],
  );
  const mobilizationActive = imperialState.mobilization?.active ?? false;
  const mobilizationStartedAtDay = imperialState.mobilization?.startedAtDay ?? null;
  const [troopPreset, setTroopPreset] = useState<TroopPreset>("balanced");
  const [troopDispatch, setTroopDispatch] = useState<TroopSelection>({
    militia: 0,
    shooters: 0,
    scouts: 0,
    machinery: 0,
  });
  const [selectedAnnexDiplomatToken, setSelectedAnnexDiplomatToken] = useState<string>("");
  const world = useMemo(() => buildHexWorld(), []);

  useEffect(() => {
    return () => {
      if (zoomCinemaTimerRef.current) {
        clearTimeout(zoomCinemaTimerRef.current);
      }
      if (dragFrameRef.current) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setRouteClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const hotspots = useMemo(() => generateHotspots(worldId, world), [worldId, world]);
  const isPhase4 = currentDay >= FINAL_EXODUS_DAY;
  const portalEligible = canEnterPortal(sovereigntyScore);
  const portalTooltip = portalEligible
    ? `Portal Central: acesso liberado (${sovereigntyScore}/${SOVEREIGNTY_PORTAL_CUT})`
    : `Portal Central: bloqueado (${sovereigntyScore}/${SOVEREIGNTY_PORTAL_CUT})`;
  useEffect(() => {
    const settleMovements = () => {
      try {
        if (storedMovements.length <= 0) {
          return;
        }
        const now = Date.now();
        let changed = false;
        let latestMessage: string | null = null;
        const revealedRouteKeys: string[] = [];
        const intelReports: string[] = [];
        const explorationDiscoveries: ImperialExplorationDiscovery[] = [];

        const next: StoredMapMovement[] = storedMovements.map((movement): StoredMapMovement => {
          if (movement.status !== "traveling") {
            return movement;
          }

          const routeSoFar = movementPassedRouteKeys(movement, now);
          const visibleCorridor = revealCorridorKeys(routeSoFar);
          const alreadyReported = new Set(movement.meta.reportedIntelCoordKeys ?? []);
          const newIntel = buildCorridorIntelReports(
            visibleCorridor.filter((coordKey) => !alreadyReported.has(coordKey)),
            sites,
          );
          if (visibleCorridor.length > 0 || newIntel.length > 0) {
            changed = true;
            revealedRouteKeys.push(...visibleCorridor);
            intelReports.push(...newIntel.map((report) => report.text));
          }

          if (movement.commandAction === "explore") {
            for (const coordKey of routeSoFar.map(normalizeMovementCoordKey)) {
              if (
                normalizeMovementCoordKey(movement.sourceCoord) === coordKey ||
                imperialState.discoveriesByCoord?.[coordKey] ||
                explorationDiscoveries.some((discovery) => discovery.coordKey === coordKey)
              ) {
                continue;
              }

              const site = findBoardSiteByCoord(sites, coordKey);
              const shouldCreateDiscovery = Boolean(site) || coordKey === normalizeMovementCoordKey(movement.targetCoord) || explorationSeed(worldId, `${coordKey}:passage`) % 100 < 38;
              if (!shouldCreateDiscovery) {
                continue;
              }

              const tile = world.tiles.find((entry) => entry.coordKey === coordKey);
              if (!tile) {
                continue;
              }

              explorationDiscoveries.push(buildPassageDiscovery(worldId, tile, { hexCount: movement.route.length }, site));
            }
          }

          const arrivalTs = Date.parse(movement.arrivalAt);
          if (!Number.isFinite(arrivalTs) || arrivalTs > now) {
            return newIntel.length > 0
              ? {
                  ...movement,
                  meta: {
                    ...movement.meta,
                    reportedIntelCoordKeys: Array.from(new Set([
                      ...(movement.meta.reportedIntelCoordKeys ?? []),
                      ...newIntel.map((report) => report.coordKey),
                    ])).slice(0, 160),
                  },
                }
              : movement;
          }

          changed = true;
          revealedRouteKeys.push(...revealCorridorKeys([movement.sourceCoord, movement.targetCoord, ...movement.route]));
          const isPortalTarget = movement.targetCoord === "0,0";

          if (isPortalTarget && typeof movement.meta.portalGateRequired === "number") {
            const gate = movement.meta.portalGateRequired;
            if (!canEnterPortal(sovereigntyScore) || sovereigntyScore < gate) {
              latestMessage = `Expedicao ${movement.id.slice(0, 8)} falhou no Portal: Influencia abaixo de ${gate}.`;
              return {
                ...movement,
                status: "failed",
              };
            }

            latestMessage = `Expedicao ${movement.id.slice(0, 8)} entrou no Portal com sucesso.`;
            return {
              ...movement,
              status: "arrived",
              meta: {
                ...movement.meta,
                reportedIntelCoordKeys: Array.from(new Set([
                  ...(movement.meta.reportedIntelCoordKeys ?? []),
                  ...newIntel.map((report) => report.coordKey),
                ])).slice(0, 160),
              },
            };
          }

          if (movement.commandAction === "explore") {
            const targetTile = world.tiles.find((entry) => entry.coordKey === normalizeMovementCoordKey(movement.targetCoord));
            latestMessage = targetTile
              ? `Exploração concluída em ${targetTile.q}:${targetTile.r}. A rota foi registrada.`
              : `Exploração ${movement.id.slice(0, 8)} concluída.`;

            return {
              ...movement,
              status: "arrived",
              meta: {
                ...movement.meta,
                reportedIntelCoordKeys: Array.from(new Set([
                  ...(movement.meta.reportedIntelCoordKeys ?? []),
                  ...newIntel.map((report) => report.coordKey),
                ])).slice(0, 160),
              },
            };
          }

          if (movement.commandAction === "build" && movement.meta.buildMode === "outpost") {
            const coord = movement.targetCoord.split(",");
            const q = Number.parseInt(coord[0] ?? "0", 10);
            const r = Number.parseInt(coord[1] ?? "0", 10);
            const alreadyExists = imperialState.extraVillages.some(
              (entry) => entry.axial.q === q && entry.axial.r === r,
            );

            if (!alreadyExists) {
              const index = imperialState.extraVillages.length + 1;
              const villageId = `v-claim-${q}-${r}`;
              // Toda cidade nova nasce neutral — o jogador decide a vocação via o seletor
              // destacado na visão da cidade (sem auto-lock por origem).
              const seededClass = "neutral" as const;
              const shouldLockClass = false;
              const originKind = movement.meta.settlementOrigin ?? "wild_empty";
              const zeroLevels = getZeroBuildingLevels();
              setImperialState((current) => ({
                ...current,
                extraVillages: [
                  ...current.extraVillages,
                  {
                    id: villageId,
                    name: createClaimedVillageName(index),
                    type: "Colonia",
                    cityClass: seededClass,
                    cityClassLocked: shouldLockClass,
                    originKind,
                    terrainKind: movement.meta.settlementTerrainKind ?? "ashen_fields",
                    terrainLabel: movement.meta.settlementTerrainLabel ?? "Campos de Cinza",
                    politicalState: originKind === "frontier_ruins" ? "Estabilizacao em curso" : "Fundada pela Coroa",
                    materials: 900,
                    supplies: 900,
                    influence: 90,
                    palaceLevel: 0,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: zeroLevels,
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Seu reino",
                    relation: "Proprio",
                    state: originKind === "frontier_ruins" ? "Ruina estabilizada" : "Colonia em consolidacao",
                  },
                ],
                cityClassByVillage: shouldLockClass
                  ? {
                      ...current.cityClassByVillage,
                      [villageId]: seededClass,
                    }
                  : current.cityClassByVillage,
                cityClassLockedByVillage: shouldLockClass
                  ? {
                      ...current.cityClassLockedByVillage,
                      [villageId]: true,
                    }
                  : current.cityClassLockedByVillage,
                logs: [`Nova cidade fundada em ${q}:${r}`, ...current.logs].slice(0, 12),
              }));
            }

            latestMessage = `Fundacao concluida em ${q}:${r}. Nova cidade entrou no imperio.`;
            return {
              ...movement,
              status: "arrived",
              meta: {
                ...movement.meta,
                reportedIntelCoordKeys: Array.from(new Set([
                  ...(movement.meta.reportedIntelCoordKeys ?? []),
                  ...newIntel.map((report) => report.coordKey),
                ])).slice(0, 160),
              },
            };
          }

          if (movement.commandAction === "annex" && movement.meta.settlementOrigin === "abandoned_city") {
            const coord = movement.targetCoord.split(",");
            const q = Number.parseInt(coord[0] ?? "0", 10);
            const r = Number.parseInt(coord[1] ?? "0", 10);
            const alreadyExists = imperialState.extraVillages.some(
              (entry) => entry.axial.q === q && entry.axial.r === r,
            );

            if (!alreadyExists) {
              const index = imperialState.extraVillages.length + 1;
              const villageId = `v-claim-${q}-${r}`;
              setImperialState((current) => ({
                ...current,
                extraVillages: [
                  ...current.extraVillages,
                  {
                    id: villageId,
                    name: createClaimedVillageName(index),
                    type: "Colonia",
                    cityClass: "neutral",
                    cityClassLocked: false,
                    originKind: "abandoned_city",
                    terrainKind: movement.meta.settlementTerrainKind ?? "ashen_fields",
                    terrainLabel: movement.meta.settlementTerrainLabel ?? "Campos de Cinza",
                    politicalState: "Cidade anexada e estabilizando",
                    materials: 1100,
                    supplies: 980,
                    influence: 120,
                    palaceLevel: 2,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: getDefaultBuildingLevels(2),
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Seu reino",
                    relation: "Proprio",
                    state: "Cidade anexada por diplomata",
                  },
                ],
                annexEnvoysCommitted: Math.max(0, current.annexEnvoysCommitted - 1),
                logs: [`Cidade anexada em ${q}:${r}`, ...current.logs].slice(0, 12),
              }));
            } else if (movement.meta.annexConsumesDiplomat) {
              setImperialState((current) => ({
                ...current,
                annexEnvoysCommitted: Math.max(0, current.annexEnvoysCommitted - 1),
              }));
            }

            latestMessage = `Cidade anexada em ${q}:${r}. Agora ela pode receber uma classe fixa.`;
            return {
              ...movement,
              status: "arrived",
              meta: {
                ...movement.meta,
                reportedIntelCoordKeys: Array.from(new Set([
                  ...(movement.meta.reportedIntelCoordKeys ?? []),
                  ...newIntel.map((report) => report.coordKey),
                ])).slice(0, 160),
              },
            };
          }

          if (movement.commandAction === "attack") {
            const coord = movement.targetCoord.split(",");
            const q = Number.parseInt(coord[0] ?? "0", 10);
            const r = Number.parseInt(coord[1] ?? "0", 10);
            const targetSite = findBoardSiteByCoord(sites, movement.targetCoord);
            const ownedVillage = imperialState.extraVillages.find((entry) => axialKey(entry.axial) === movement.targetCoord) ?? null;
            const targetDefense = buildTargetDefense(
              targetSite,
              movement,
              currentDay,
              ownedVillage
                ? {
                    village: ownedVillage,
                    buildingLevels: {
                      ...ownedVillage.buildingLevels,
                      ...projectStructureLevelsToBuildingLevels(imperialState.buildingLevelsByVillage[ownedVillage.id] ?? {}),
                    },
                    localDefenders: imperialState.defenseRecruitsByVillage[ownedVillage.id] ?? { guards: 0, archers: 0, ballistae: 0 },
                    deployedTroops: imperialState.deployedByVillage[ownedVillage.id] ?? 0,
                    heroId: imperialState.heroByVillage[ownedVillage.id] ?? "none",
                    heroBuild: imperialState.heroBuildByVillage[ownedVillage.id],
                    defenseProtocol: imperialState.defenseProtocolByVillage[ownedVillage.id],
                  }
                : null,
            );
            const troopsSent = movement.meta.troopsSent ?? { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
            const troopsTotal = Math.max(1, movement.meta.troopsTotal ?? troopSelectionTotal(troopsSent));
            const qualityPerTroop = (movement.meta.troopsQuality ?? troopsTotal) / troopsTotal;
            const marshalCount = Object.values(imperialState.heroByVillage).filter((hero) => hero === "marshal").length;
            const combatResult = processKingsWorldCombat({
              atacante: troopsSent,
              defensor: targetDefense.defenders,
              recursosDefensor: targetDefense.resources,
              contexto: {
                wallLevel: targetDefense.wallLevel,
                attackerHeroPower: Math.min(100, marshalCount * 18 + unlockedTechs * 4),
                defenderHeroPower: targetDefense.defenderHeroPower,
                attackerMilitaryBuildBonus: clampNumber((qualityPerTroop - 1) * 0.08 + unlockedTechs * 0.012 + kingModifiers.militaryBuildBonus, -0.03, 0.24),
                defenderMilitaryBuildBonus: targetDefense.defenderBuildBonus,
                defenderSatisfaction: 70,
                militaryScoreAtual: liveWorld.sovereignty.militaryRankingPoints,
                defenderMilitaryScoreAtual: 0,
                militaryScoreCap: SOVEREIGNTY_MILITARY_SCORE_CAP,
                maxRounds: 5,
                defenderLocalForces: targetDefense.localDefenders,
                defenderImperialResponseForces: targetDefense.imperialResponseDefenders,
                defenderResponseReadiness: targetDefense.responseReadiness,
                defenderResponseWindowLabel: targetDefense.responseWindowLabel,
              },
            });

            const alreadyExists = imperialState.extraVillages.some(
              (entry) => entry.axial.q === q && entry.axial.r === r,
            );

            if (combatResult.decisivo && !alreadyExists) {
              const index = imperialState.extraVillages.length + 1;
              const villageId = `v-claim-${q}-${r}`;
              setImperialState((current) => ({
                ...current,
                troops: subtractArmyLosses(current.troops, combatResult.resumoPerdas.atacante.mortos),
                resources: mergeLoot(current.resources, combatResult.recursosSaqueados),
                extraVillages: [
                  ...current.extraVillages,
                  {
                    id: villageId,
                    name: createClaimedVillageName(index),
                    type: "Colonia",
                    cityClass: "neutral",
                    cityClassLocked: false,
                    originKind: "claimed_city",
                    terrainKind: movement.meta.settlementTerrainKind ?? "ashen_fields",
                    terrainLabel: movement.meta.settlementTerrainLabel ?? "Campos de Cinza",
                    politicalState: "Cidade tomada pela Coroa",
                    materials: 1000,
                    supplies: 920,
                    influence: 110,
                    palaceLevel: 2,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: getDefaultBuildingLevels(2),
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Seu reino",
                    relation: "Proprio",
                    state: "Cidade sob administracao militar",
                  },
                ],
                logs: [
                  buildBattleLogLine(combatResult, q, r),
                  ...current.logs,
                ].slice(0, 12),
              }));
            } else {
              setImperialState((current) => ({
                ...current,
                troops: subtractArmyLosses(current.troops, combatResult.resumoPerdas.atacante.mortos),
                resources: combatResult.decisivo ? mergeLoot(current.resources, combatResult.recursosSaqueados) : current.resources,
                logs: [
                  combatResult.decisivo
                    ? `${buildBattleLogLine(combatResult, q, r)} Alvo ja constava no imperio.`
                    : `${buildBattleLogLine(combatResult, q, r)} Perdas atacantes ${troopSelectionTotal(combatResult.resumoPerdas.atacante.mortos as TroopSelection)}.`,
                  ...current.logs,
                ].slice(0, 12),
              }));
            }

            latestMessage = combatResult.decisivo
              ? `Ataque venceu em ${q}:${r}. ${combatResult.battleReport.headline} +${combatResult.scoreMilitarAtacanteFinal} SM, saque ${combatResult.recursosSaqueados.materials ?? 0}M/${combatResult.recursosSaqueados.supplies ?? 0}S.`
              : `Ataque em ${q}:${r} terminou em ${combatResult.vencedor === "defensor" ? "repulsa" : "retirada"}. ${combatResult.battleReport.summary} +${combatResult.scoreMilitarAtacanteFinal} SM por atrito.`;
            return {
              ...movement,
              status: "arrived",
              meta: {
                ...movement.meta,
                reportedIntelCoordKeys: Array.from(new Set([
                  ...(movement.meta.reportedIntelCoordKeys ?? []),
                  ...newIntel.map((report) => report.coordKey),
                ])).slice(0, 160),
                combatResult,
                combatResolvedAt: new Date().toISOString(),
                militaryScoreGained: combatResult.scoreMilitarAtacanteFinal,
                defenderMilitaryScoreGained: combatResult.scoreMilitarDefensorFinal,
                satisfactionDamage: combatResult.impactoSatisfacao,
                loot: combatResult.recursosSaqueados,
              },
            };
          }

          latestMessage = `Movimento ${movement.id.slice(0, 8)} concluido.`;
          return {
            ...movement,
            status: "arrived",
            meta: {
              ...movement.meta,
              reportedIntelCoordKeys: Array.from(new Set([
                ...(movement.meta.reportedIntelCoordKeys ?? []),
                ...newIntel.map((report) => report.coordKey),
              ])).slice(0, 160),
            },
          };
        });

        if (!changed) {
          return;
        }

        setImperialState((current) => ({
          ...current,
          mapMovements: next,
          exploredCoordKeys: Array.from(new Set([...(current.exploredCoordKeys ?? []), ...revealedRouteKeys])).slice(0, 800),
          discoveriesByCoord:
            explorationDiscoveries.length > 0
              ? {
                  ...(current.discoveriesByCoord ?? {}),
                  ...Object.fromEntries(explorationDiscoveries.map((discovery) => [discovery.coordKey, discovery] as const)),
                }
              : current.discoveriesByCoord,
          logs: intelReports.length > 0
            ? [
                ...explorationDiscoveries.map((discovery) => `Acontecimento de mapa: ${discovery.title} em ${discovery.coordKey}.`),
                ...intelReports.map((report) => `Intel de marcha: ${report}`),
                ...current.logs,
              ].slice(0, 12)
            : explorationDiscoveries.length > 0
              ? [...explorationDiscoveries.map((discovery) => `Acontecimento de mapa: ${discovery.title} em ${discovery.coordKey}.`), ...current.logs].slice(0, 12)
            : current.logs,
        }));
        if (intelReports[0] || latestMessage) {
          setMovementMessage(intelReports[0] ? `Relatório de exploração: ${intelReports[0]}` : latestMessage);
        }
        if (explorationDiscoveries[0]) {
          emitUiToast({
            tone: explorationDiscoveries[0].type === "threat" || explorationDiscoveries[0].type === "dragon" ? "error" : "info",
            title: "Acontecimento no mapa",
            message: `${explorationDiscoveries[0].title}: ${explorationDiscoveries[0].summary}`,
          });
        }
      } catch {
        // silencioso
      }
    };

    settleMovements();
    const timer = window.setInterval(settleMovements, 15_000);
    return () => window.clearInterval(timer);
  }, [
    currentDay,
    imperialState.buildingLevelsByVillage,
    imperialState.defenseProtocolByVillage,
    imperialState.defenseRecruitsByVillage,
    imperialState.deployedByVillage,
    imperialState.discoveriesByCoord,
    imperialState.extraVillages,
    imperialState.heroBuildByVillage,
    imperialState.heroByVillage,
    setImperialState,
    sites,
    sovereigntyScore,
    storedMovements,
    unlockedTechs,
    liveWorld.sovereignty.militaryRankingPoints,
    world.tiles,
    worldId,
  ]);
  const mappedSites = useMemo(() => {
    const base = sites.map<MapSite>((site, idx) => {
      const axial = normalizeAxial(site);
      const q = axial.q;
      const r = axial.r;
      const coordKey = axialKey({ q, r });

      return {
        ...site,
        coord: site.coord || formatLegacyCoord({ q, r }),
        axial: { q, r },
        id: `site-${idx}-${coordKey}`,
        q,
        r,
        coordKey,
        faction: classifyFaction(site, tribeName),
      };
    });

    const claimed = imperialState.extraVillages.map<MapSite>((site, idx) => ({
      name: site.name,
      owner: site.owner,
      type: site.type,
      cityClass: site.cityClass,
      recommendedCityClass: site.cityClass,
      occupationKind: site.originKind ?? "claimed_city",
      terrainKind: site.terrainKind,
      terrainLabel: site.terrainLabel,
      relation: "Proprio",
      coord: site.coord,
      axial: site.axial,
      state: site.state,
      id: `claimed-${idx}-${site.coord}`,
      q: site.axial.q,
      r: site.axial.r,
      coordKey: axialKey(site.axial),
      faction: "self",
    }));

    const claimedKeys = new Set(claimed.map((site) => site.coordKey));
    const filteredBase = base.filter((site) => !claimedKeys.has(site.coordKey));

    const occupied = new Set([...filteredBase, ...claimed].map((entry) => entry.coordKey));
    const ambient = generateAmbientSites(worldId, occupied);
    return [...filteredBase, ...claimed, ...ambient];
  }, [imperialState.extraVillages, sites, tribeName, worldId]);

  const ownVillageCount = useMemo(() => {
    return mappedSites.filter((site) => site.faction === "self" && isVillageSite(site)).length;
  }, [mappedSites]);

  const villageCapReached = ownVillageCount >= PLAYER_VILLAGE_CAP;

  const playerCities = useMemo(() => [...villages, ...imperialState.extraVillages], [imperialState.extraVillages, villages]);

  const colonyDiplomacy = useMemo(() => {
    const rows = playerCities
      .filter((entry) => entry.type === "Colonia")
      .map((entry) => {
        const development = calculateVillageDevelopment(entry.buildingLevels);
        return {
          id: entry.id,
          development,
          assigned: imperialState.diplomatByVillage[entry.id] ?? false,
          unlocked: development >= CITY_DIPLOMAT_UNLOCK_DEVELOPMENT,
        };
      });

    const unlocked = Math.min(MAX_CITY_DIPLOMATS, rows.filter((row) => row.unlocked).length);
    const recruited = Math.min(unlocked, Math.max(0, imperialState.recruitedDiplomats ?? 0));
    const assigned = rows.filter((row) => row.assigned).length;
    const tribeCommitted = Math.max(0, imperialState.tribeEnvoysCommitted ?? 0);
    const annexCommitted = Math.max(0, imperialState.annexEnvoysCommitted ?? 0);
    const free = Math.max(0, recruited - assigned - annexCommitted);
    return { unlocked, recruited, assigned, tribeCommitted, annexCommitted, free };
  }, [imperialState.annexEnvoysCommitted, imperialState.diplomatByVillage, imperialState.extraVillages, imperialState.recruitedDiplomats, imperialState.tribeEnvoysCommitted, playerCities]);

  const availableAnnexDiplomatTokens = useMemo(
    () => Array.from({ length: colonyDiplomacy.free }, (_, index) => `Diplomata ${String(index + 1).padStart(2, "0")}`),
    [colonyDiplomacy.free],
  );

  const troopCommitted = useMemo<TroopSelection>(() => {
    return storedMovements.reduce<TroopSelection>(
      (acc, movement) => {
        if (movement.status !== "traveling" || !movement.meta.troopsSent) {
          return acc;
        }
        acc.militia += movement.meta.troopsSent.militia ?? 0;
        acc.shooters += movement.meta.troopsSent.shooters ?? 0;
        acc.scouts += movement.meta.troopsSent.scouts ?? 0;
        acc.machinery += movement.meta.troopsSent.machinery ?? 0;
        return acc;
      },
      { militia: 0, shooters: 0, scouts: 0, machinery: 0 },
    );
  }, [storedMovements]);

  const troopPool = useMemo<TroopSelection>(() => ({
    militia: Math.max(0, imperialState.troops.militia - troopCommitted.militia),
    shooters: Math.max(0, imperialState.troops.shooters - troopCommitted.shooters),
    scouts: Math.max(0, imperialState.troops.scouts - troopCommitted.scouts),
    machinery: Math.max(0, imperialState.troops.machinery - troopCommitted.machinery),
  }), [imperialState.troops, troopCommitted]);

  const activeMovementRoutes = useMemo(() => {
    return storedMovements
      .filter((movement) => movement.status === "traveling")
      .map((movement) => {
        const routeKeys = (movement.route.length > 0 ? movement.route : [movement.sourceCoord, movement.targetCoord])
          .map(normalizeMovementCoordKey);
        const passedKeys = movementPassedRouteKeys(movement, routeClock).map(normalizeMovementCoordKey);
        const revealedKeys = revealCorridorKeys(passedKeys).map(normalizeMovementCoordKey);
        const routePoints = routeKeys
          .map((coordKey) => world.centerByKey.get(coordKey))
          .filter((point): point is PixelPoint => Boolean(point));
        const passedPoints = passedKeys
          .map((coordKey) => world.centerByKey.get(coordKey))
          .filter((point): point is PixelPoint => Boolean(point));
        const launchedAtMs = Date.parse(movement.launchedAt);
        const arrivalAtMs = Date.parse(movement.arrivalAt);
        const progress = Number.isFinite(launchedAtMs) && Number.isFinite(arrivalAtMs) && arrivalAtMs > launchedAtMs
          ? clampNumber((routeClock - launchedAtMs) / (arrivalAtMs - launchedAtMs), 0, 1)
          : movement.status === "arrived" ? 1 : 0;
        const remainingMinutes = Number.isFinite(arrivalAtMs)
          ? Math.max(0, Math.ceil((arrivalAtMs - routeClock) / 60_000))
          : movement.etaMinutes;
        const troopsTotal = movement.meta.troopsTotal ?? (movement.meta.troopsSent ? troopSelectionTotal(movement.meta.troopsSent) : 0);

        return {
          id: movement.id,
          commandAction: movement.commandAction,
          label: movementActionLabel(movement),
          targetLabel: movement.meta.targetLabel ?? movement.targetCoord.replace(",", ":"),
          routeKeys,
          passedKeys,
          revealedKeys,
          routePoints,
          passedPoints,
          routePolyline: routePoints.map((point) => `${point.x},${point.y}`).join(" "),
          passedPolyline: passedPoints.map((point) => `${point.x},${point.y}`).join(" "),
          progress,
          remainingMinutes,
          troopsTotal,
        };
      })
      .filter((route) => route.routePoints.length >= 2);
  }, [routeClock, storedMovements, world.centerByKey]);

  const activeMovementRouteKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const route of activeMovementRoutes) {
      for (const coordKey of route.routeKeys) keys.add(coordKey);
    }
    return keys;
  }, [activeMovementRoutes]);

  const activeMovementRevealedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const route of activeMovementRoutes) {
      for (const coordKey of route.revealedKeys) keys.add(coordKey);
    }
    return keys;
  }, [activeMovementRoutes]);

  const troopCommittedTotal = troopSelectionTotal(troopCommitted);
  const primaryActiveRoute = activeMovementRoutes[0] ?? null;
  const primaryExplorationRoute = primaryActiveRoute?.commandAction === "explore" ? primaryActiveRoute : null;

  useEffect(() => {
    setTroopDispatch((current) => {
      const next = troopPreset === "custom"
        ? clampDispatchToPool(current, troopPool)
        : buildDispatchFromPreset(troopPool, troopPreset);
      return sameTroopSelection(current, next) ? current : next;
    });
  }, [troopPool, troopPreset]);

  useEffect(() => {
    if (availableAnnexDiplomatTokens.length <= 0) {
      if (selectedAnnexDiplomatToken) {
        setSelectedAnnexDiplomatToken("");
      }
      return;
    }

    if (!selectedAnnexDiplomatToken || !availableAnnexDiplomatTokens.includes(selectedAnnexDiplomatToken)) {
      setSelectedAnnexDiplomatToken(availableAnnexDiplomatTokens[0] ?? "");
    }
  }, [availableAnnexDiplomatTokens, selectedAnnexDiplomatToken]);

  const troopDispatchTotal = troopSelectionTotal(troopDispatch);
  const troopDispatchQuality = Math.round(
    troopDispatch.militia * TROOP_LABELS.militia.qualityWeight +
      troopDispatch.shooters * TROOP_LABELS.shooters.qualityWeight +
      troopDispatch.scouts * TROOP_LABELS.scouts.qualityWeight +
      troopDispatch.machinery * TROOP_LABELS.machinery.qualityWeight,
  );

  const tileByCoordKey = useMemo(() => {
    return new Map(world.tiles.map((tile) => [tile.coordKey, tile] as const));
  }, [world]);

  const siteByCoordKey = useMemo(() => {
    return new Map(mappedSites.map((site) => [site.coordKey, site] as const));
  }, [mappedSites]);

  const hotspotByCoordKey = useMemo(() => {
    return new Map(hotspots.map((hotspot) => [hotspot.coordKey, hotspot] as const));
  }, [hotspots]);

  const factionInfluenceOverlays = useMemo<FactionInfluenceOverlay[]>(() => {
    const overlays: FactionInfluenceOverlay[] = [];

    for (const tile of world.tiles) {
      let winner: { faction: Faction; score: number } | null = null;

      for (const site of mappedSites) {
        if (site.faction === "neutral") {
          continue;
        }

        const distance = axialDistance({ q: tile.q, r: tile.r }, { q: site.q, r: site.r });
        const radius = influenceRadiusForSite(site);
        if (distance > radius) {
          continue;
        }

        const score = influenceWeight(site, distance);
        if (!winner || score > winner.score) {
          winner = { faction: site.faction, score };
        }
      }

      if (!winner) {
        continue;
      }

      overlays.push({
        coordKey: tile.coordKey,
        points: tile.points,
        faction: winner.faction,
        strength: winner.score,
      });
    }

    return overlays;
  }, [mappedSites, world.tiles]);

  const focusCoordKey = zoomLevel === 4 ? (selectedCoordKey ?? inspectedCoordKey) : (inspectedCoordKey ?? null);
  const selectedVisualCoordKey = zoomLevel === 4 ? selectedCoordKey : null;
  const selectedTile = focusCoordKey ? (tileByCoordKey.get(focusCoordKey) ?? null) : null;
  const rawSelectedSite = focusCoordKey ? (siteByCoordKey.get(focusCoordKey) ?? null) : null;
  const rawSelectedHotspot = focusCoordKey ? (hotspotByCoordKey.get(focusCoordKey) ?? null) : null;
  const rawSelectedDiscovery = focusCoordKey ? (imperialState.discoveriesByCoord?.[focusCoordKey] ?? null) : null;
  const selectedCoordKnown = Boolean(
    selectedTile?.isCentralThrone ||
      rawSelectedSite?.faction === "self" ||
      rawSelectedSite?.faction === "tribe" ||
      rawSelectedSite?.faction === "ally" ||
      (focusCoordKey && activeMovementRevealedKeys.has(focusCoordKey)) ||
      (focusCoordKey && (imperialState.exploredCoordKeys ?? []).includes(focusCoordKey)) ||
      rawSelectedDiscovery,
  );
  const selectedSite = selectedCoordKnown ? rawSelectedSite : null;
  const selectedFriendlySite = Boolean(selectedSite && (selectedSite.faction === "self" || selectedSite.faction === "tribe" || selectedSite.faction === "ally"));
  const selectedHotspot = selectedCoordKnown ? rawSelectedHotspot : null;
  const selectedDiscovery = selectedCoordKnown ? rawSelectedDiscovery : null;
  const selectedDiscoveryAccent = selectedDiscovery ? discoveryAccent(selectedDiscovery.type) : null;
  const selectedDetailImage = selectedDiscovery?.imageSrc ?? (selectedTile ? cityDetailImageSrc(selectedSite, selectedHotspot, portalEligible) : "/images/cidade.jpg");

  const focusSite = useMemo(() => {
    return mappedSites.find((site) => site.faction === "self")
      ?? mappedSites.find((site) => site.faction === "tribe")
      ?? mappedSites[0]
      ?? null;
  }, [mappedSites]);
  const ownCapitalSite = useMemo(() => {
    return mappedSites.find((site) => site.faction === "self" && site.type.toLowerCase().includes("capital"))
      ?? mappedSites.find((site) => site.faction === "self")
      ?? focusSite;
  }, [focusSite, mappedSites]);

  const marchOrigin = focusSite ? ({ q: focusSite.q, r: focusSite.r } as AxialCoord) : null;
  const marchOriginKey = focusSite?.coordKey ?? null;

  const roadNetwork = useMemo(() => {
    const nodes = new Set<string>();
    const edges = new Set<string>();

    if (!marchOrigin || !marchOriginKey) {
      return { nodes, edges };
    }

    nodes.add(marchOriginKey);

    const ownSites = mappedSites.filter((site) => site.faction === "self" || site.faction === "tribe" || site.faction === "ally");

    for (const site of ownSites) {
      const route = hexLine(marchOrigin, { q: site.q, r: site.r });
      for (let idx = 0; idx < route.length; idx += 1) {
        const coord = route[idx];
        nodes.add(axialKey(coord));
        if (idx > 0) {
          edges.add(edgeKeyByCoord(route[idx - 1]!, coord));
        }
      }
    }

    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = axialNeighbor(marchOrigin, direction);
      if (axialDistance(neighbor, ZERO_AXIAL) <= WORLD_HEX_RADIUS) {
        nodes.add(axialKey(neighbor));
        edges.add(edgeKeyByCoord(marchOrigin, neighbor));
      }
    }

    return { nodes, edges };
  }, [mappedSites, marchOrigin, marchOriginKey]);

  const routeToSelection = useMemo(() => {
    if (!marchOrigin || !selectedTile) {
      return [] as AxialCoord[];
    }
    return hexLine(marchOrigin, { q: selectedTile.q, r: selectedTile.r });
  }, [marchOrigin, selectedTile]);

  const routeSummary = useMemo(() => {
    let totalMinutes = 0;
    let roadSegments = 0;
    let offroadSegments = 0;
    const routeSteps: MovementRouteStep[] = routeToSelection.length > 0
      ? [{ coordKey: axialKey(routeToSelection[0]!), legMinutes: 0, elapsedMinutes: 0 }]
      : [];

    const lastCoord = routeToSelection.length ? routeToSelection[routeToSelection.length - 1] : null;
    const toCapital = Boolean(lastCoord && lastCoord.q === 0 && lastCoord.r === 0);
    const phase4SlowdownMult = isPhase4 && mobilizationActive && toCapital ? PHASE4_REGROUP_SPEED_MULT : 1;

    for (let idx = 1; idx < routeToSelection.length; idx += 1) {
      const from = routeToSelection[idx - 1]!;
      const to = routeToSelection[idx]!;
      const hasRoad = roadNetwork.edges.has(edgeKeyByCoord(from, to));
      const terrainMovementMultiplier = hotspotByCoordKey.get(axialKey(to))?.terrainBonus.terrainMovementMultiplier;
      const leg = calculateMarchTimeMinutes(from, to, {
        hasRoad,
        terrainMovementMultiplier: terrainMovementMultiplier ? terrainMovementMultiplier / kingModifiers.explorationSpeedMultiplier : 1 / kingModifiers.explorationSpeedMultiplier,
      });
      const legMinutes = leg.totalMinutes * phase4SlowdownMult;
      totalMinutes += legMinutes;
      routeSteps.push({
        coordKey: axialKey(to),
        legMinutes,
        elapsedMinutes: totalMinutes,
      });
      if (hasRoad) {
        roadSegments += 1;
      } else {
        offroadSegments += 1;
      }
    }

    return {
      totalMinutes,
      hexCount: Math.max(0, routeToSelection.length - 1),
      roadSegments,
      offroadSegments,
      phase4SlowdownMult,
      toCapital,
      routeSteps,
    };
  }, [hotspotByCoordKey, isPhase4, kingModifiers.explorationSpeedMultiplier, mobilizationActive, roadNetwork.edges, routeToSelection]);

  const navigatorActive = useMemo(() => {
    return Object.values(imperialState.heroByVillage).includes("navigator");
  }, [imperialState.heroByVillage]);

  const activeRouteCoordKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const movement of storedMovements) {
      if (movement.status !== "traveling") {
        continue;
      }
      for (const coordKey of movement.route) {
        keys.add(normalizeMovementCoordKey(coordKey));
      }
    }
    return keys;
  }, [storedMovements]);

  const visitedCoordKeys = useMemo(() => {
    const keys = new Set<string>([axialKey(ZERO_AXIAL)]);

    for (const site of mappedSites) {
      // Só auto-revela o que é seu/aliado. Inimigo (NPC rival) fica na névoa
      // até você explorar/scoutar a coord dele.
      if (site.faction === "self" || site.faction === "ally" || site.faction === "tribe") {
        keys.add(site.coordKey);
      }
    }

    for (const nodeKey of roadNetwork.nodes) {
      keys.add(nodeKey);
    }

    for (const movement of storedMovements) {
      keys.add(normalizeMovementCoordKey(movement.sourceCoord));
      for (const coordKey of movementPassedRouteKeys(movement, routeClock)) {
        keys.add(normalizeMovementCoordKey(coordKey));
      }
    }

    for (const coordKey of imperialState.exploredCoordKeys ?? []) {
      keys.add(coordKey);
    }

    return keys;
  }, [imperialState.exploredCoordKeys, mappedSites, roadNetwork.nodes, routeClock, storedMovements]);

  const currentVisionCoordKeys = useMemo(() => {
    const keys = new Set<string>(visitedCoordKeys);
    const revealRadius = navigatorActive ? 2 : 1;
    const anchors: AxialCoord[] = [];

    if (marchOrigin) {
      anchors.push(marchOrigin);
    }
    if (focusCoordKey && visitedCoordKeys.has(focusCoordKey)) {
      const selected = tileByCoordKey.get(focusCoordKey);
      if (selected) {
        anchors.push({ q: selected.q, r: selected.r });
      }
    }

    for (const movement of storedMovements) {
      if (movement.status !== "traveling") {
        continue;
      }
      for (const coordKey of movementPassedRouteKeys(movement, routeClock)) {
        const normalized = normalizeMovementCoordKey(coordKey);
        keys.add(normalized);
        const passed = tileByCoordKey.get(normalized);
        if (passed) {
          anchors.push({ q: passed.q, r: passed.r });
        }
      }
    }

    for (const tile of world.tiles) {
      if (anchors.some((anchor) => axialDistance({ q: tile.q, r: tile.r }, anchor) <= revealRadius)) {
        keys.add(tile.coordKey);
      }
    }

    return keys;
  }, [focusCoordKey, marchOrigin, navigatorActive, routeClock, storedMovements, tileByCoordKey, visitedCoordKeys, world.tiles]);

  const strategicNodes = useMemo<StrategicNode[]>(() => {
    const candidates = new Set<string>();
    const selectedFocusTile = focusCoordKey ? tileByCoordKey.get(focusCoordKey) : null;
    const focusCoord = selectedFocusTile ? { q: selectedFocusTile.q, r: selectedFocusTile.r } : marchOrigin;
    const focusDistance = (coord: AxialCoord) => (focusCoord ? axialDistance(coord, focusCoord) : 0);
    const revealRadius = navigatorActive ? 2 : 1;

    if (focusCoordKey) {
      candidates.add(focusCoordKey);
    }
    if (marchOriginKey) {
      candidates.add(marchOriginKey);
    }
    candidates.add(axialKey(ZERO_AXIAL));

    for (const site of mappedSites) {
      candidates.add(site.coordKey);
    }
    for (const hotspot of hotspots) {
      candidates.add(hotspot.coordKey);
    }

    const pathToCenter = marchOrigin ? hexLine(marchOrigin, ZERO_AXIAL) : [];
    for (const coord of pathToCenter.slice(0, navigatorActive ? 8 : 6)) {
      candidates.add(axialKey(coord));
    }

    for (const nodeKey of roadNetwork.nodes) {
      candidates.add(nodeKey);
      const tile = tileByCoordKey.get(nodeKey);
      if (!tile) continue;
      for (let direction = 0; direction < 6; direction += 1) {
        const neighbor = axialNeighbor({ q: tile.q, r: tile.r }, direction);
        const neighborKey = axialKey(neighbor);
        if (!tileByCoordKey.has(neighborKey) || roadNetwork.nodes.has(neighborKey)) {
          continue;
        }
        candidates.add(neighborKey);
      }
    }

    const scored = Array.from(candidates)
      .map((coordKey) => {
        const tile = tileByCoordKey.get(coordKey);
        if (!tile) return null;
        const site = siteByCoordKey.get(coordKey) ?? null;
        const hotspot = hotspotByCoordKey.get(coordKey) ?? null;
        const connected = roadNetwork.nodes.has(coordKey);
        const enemy = site?.faction === "enemy";
        const owned = site?.faction === "self";
        const allied = site?.faction === "tribe" || site?.faction === "ally";
        const hasRouteActivity = activeRouteCoordKeys.has(coordKey);
        const routeDistance = focusDistance({ q: tile.q, r: tile.r });
        const discovered =
          connected ||
          Boolean(site) ||
          Boolean(hotspot) ||
          coordKey === selectedCoordKey ||
          coordKey === marchOriginKey ||
          routeDistance <= revealRadius ||
          Array.from(roadNetwork.nodes).some((roadKey) => {
            const roadTile = tileByCoordKey.get(roadKey);
            return roadTile ? axialDistance({ q: tile.q, r: tile.r }, { q: roadTile.q, r: roadTile.r }) <= revealRadius : false;
          });

        const nearbyEnemy = Array.from(siteByCoordKey.values()).some(
          (entry) =>
            entry.faction === "enemy" &&
            axialDistance({ q: tile.q, r: tile.r }, { q: entry.q, r: entry.r }) <= (navigatorActive ? 2 : 1),
        );
        const pressured = hasRouteActivity || (connected && nearbyEnemy) || Boolean(site?.state?.match(/risco|press|horda|combate|ataque/i));

        let state: StrategicNodeState = "unknown";
        if (enemy) {
          state = pressured ? "pressured" : "enemy";
        } else if (owned || allied) {
          state = pressured ? "pressured" : "owned";
        } else if (pressured) {
          state = "pressured";
        } else if (connected) {
          state = "connected";
        } else if (discovered) {
          state = "discovered";
        }

        const label = site?.name ?? hotspot?.name ?? (tile.isCentralThrone ? "Portal Central" : discovered ? `Ponto ${tile.q}:${tile.r}` : "No desconhecido");
        const caption = site
          ? site.faction === "enemy"
            ? "Cidade inimiga"
            : site.faction === "abandoned"
              ? "Cidade vazia"
              : site.faction === "self"
                ? "Sua cidade"
                : "Ponto visivel"
          : hotspot
            ? HOTSPOT_META[hotspot.kind].label
            : tile.isCentralThrone
              ? "Direcao do centro"
              : connected
                ? "Rota aberta"
                : discovered
                  ? "Rota possivel"
                  : "Exploracao";

        const route = marchOrigin ? hexLine(marchOrigin, { q: tile.q, r: tile.r }) : [];
        let etaMinutes = 0;
        for (let idx = 1; idx < route.length; idx += 1) {
          const from = route[idx - 1]!;
          const to = route[idx]!;
          etaMinutes += calculateMarchTimeMinutes(from, to, {
            hasRoad: roadNetwork.edges.has(edgeKeyByCoord(from, to)),
            terrainMovementMultiplier:
              (hotspotByCoordKey.get(axialKey(to))?.terrainBonus.terrainMovementMultiplier ?? 1) / kingModifiers.explorationSpeedMultiplier,
          }).totalMinutes;
        }

        const score =
          (coordKey === selectedCoordKey ? 200 : 0) +
          (coordKey === marchOriginKey ? 140 : 0) +
          (tile.isCentralThrone ? 120 : 0) +
          (site ? 95 : 0) +
          (hotspot ? 66 : 0) +
          (pressured ? 54 : 0) +
          (hasRouteActivity ? 40 : 0) +
          (connected ? 32 : 0) +
          (discovered ? 16 : 0) -
          routeDistance * 4;

        return {
          coordKey,
          q: tile.q,
          r: tile.r,
          center: tile.center,
          tile,
          site,
          hotspot,
          label,
          caption,
          kind: tile.isCentralThrone ? "portal" : site ? "village" : hotspot ? "strategic" : "route",
          state,
          isSelected: coordKey === selectedVisualCoordKey,
          isFocus: coordKey === marchOriginKey,
          isCenter: tile.isCentralThrone,
          isConnected: connected,
          isOwned: owned,
          isEnemy: enemy,
          isPressured: pressured,
          isDiscovered: discovered,
          hasRouteActivity,
          distance: Math.max(0, route.length - 1),
          etaMinutes: route.length > 1 ? etaMinutes : null,
          score,
        };
      })
      .filter((entry): entry is StrategicNode => Boolean(entry))
      .sort((left, right) => right.score - left.score);

    const visibleLimit = zoom < MACRO_VISION_THRESHOLD ? 48 : zoom < 1.8 ? 24 : 18;
    const scoped = zoom >= MICRO_VISION_THRESHOLD
      ? scored.filter((entry) => entry.isSelected || entry.isFocus || entry.isCenter || entry.distance <= 2 || entry.isOwned || entry.hasRouteActivity)
      : scored;
    const chosen = scoped.slice(0, visibleLimit);
    const visibleKeys = new Set(chosen.map((node) => node.coordKey));

    for (const key of [focusCoordKey, marchOriginKey, axialKey(ZERO_AXIAL)]) {
      if (!key || visibleKeys.has(key)) continue;
      const found = scored.find((entry) => entry.coordKey === key);
      if (found) {
        chosen.push(found);
        visibleKeys.add(key);
      }
    }

    return chosen;
  }, [
    activeRouteCoordKeys,
    hotspots,
    mappedSites,
    marchOrigin,
    marchOriginKey,
    navigatorActive,
    kingModifiers.explorationSpeedMultiplier,
    roadNetwork.edges,
    roadNetwork.nodes,
    focusCoordKey,
    selectedVisualCoordKey,
    siteByCoordKey,
    hotspotByCoordKey,
    storedMovements,
    tileByCoordKey,
    zoom,
  ]);

  const strategicNodeByKey = useMemo(() => new Map(strategicNodes.map((node) => [node.coordKey, node] as const)), [strategicNodes]);

  const visibleRouteEdges = useMemo(() => {
    const edges = new Map<string, { from: StrategicNode; to: StrategicNode; active: boolean }>();
    for (const edgeKey of roadNetwork.edges) {
      const [fromKey, toKey] = edgeKey.split("|");
      const from = fromKey ? strategicNodeByKey.get(fromKey) : null;
      const to = toKey ? strategicNodeByKey.get(toKey) : null;
      if (!from || !to) continue;
      edges.set(edgeKey, {
        from,
        to,
        active: activeRouteCoordKeys.has(from.coordKey) || activeRouteCoordKeys.has(to.coordKey),
      });
    }
    return Array.from(edges.values());
  }, [activeRouteCoordKeys, roadNetwork.edges, strategicNodeByKey]);

  const centerHeading = useMemo(() => {
    if (!marchOrigin) return 0;
    const originPoint = world.centerByKey.get(axialKey(marchOrigin));
    if (!originPoint) return 0;
    return Math.atan2(world.centerPoint.y - originPoint.y, world.centerPoint.x - originPoint.x) * (180 / Math.PI);
  }, [marchOrigin, world.centerByKey, world.centerPoint.x, world.centerPoint.y]);

  const selectedStrategicNode = selectedCoordKey ? (strategicNodeByKey.get(selectedCoordKey) ?? null) : null;

  const buildCost = useMemo(() => {
    const targetKind =
      selectedSite?.occupationKind === "frontier_ruins"
        ? "frontier_ruins"
        : selectedSite?.faction === "abandoned"
          ? "abandoned_city"
          : selectedHotspot
            ? "hotspot"
            : "empty";

    return calculateMapConstructionCost(buildMode, {
      distanceFromNetwork: Math.max(0, routeSummary.hexCount - 1),
      logisticsLevel: 5,
      ownedVillages: ownVillageCount,
      targetKind,
      terrainCostMultiplier: selectedHotspot?.terrainBonus.terrainCostMultiplier,
      terrainTimeMultiplier: selectedHotspot?.terrainBonus.terrainTimeMultiplier,
    });
  }, [buildMode, ownVillageCount, routeSummary.hexCount, selectedHotspot?.coordKey, selectedHotspot?.terrainBonus.terrainCostMultiplier, selectedHotspot?.terrainBonus.terrainTimeMultiplier, selectedSite?.faction, selectedSite?.occupationKind]);

  const exploreCost = useMemo(() => {
    const zoneTax = selectedTile?.zone === "core" ? 12 : selectedTile?.zone === "mid" ? 26 : 44;
    const terrainTax =
      selectedTile?.terrainKind === "frontier_pass" ? 18 :
      selectedTile?.terrainKind === "ironridge" ? 24 :
      selectedTile?.terrainKind === "ashen_fields" ? 12 :
      0;
    return EXPLORATION_ACTION_COST_BASE + routeSummary.hexCount * 12 + zoneTax + terrainTax;
  }, [routeSummary.hexCount, selectedTile?.terrainKind, selectedTile?.zone]);

  const isRoadConnected = useMemo(() => {
    if (!selectedTile) {
      return false;
    }
    if (roadNetwork.nodes.has(selectedTile.coordKey)) {
      return true;
    }
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = axialNeighbor({ q: selectedTile.q, r: selectedTile.r }, direction);
      if (roadNetwork.nodes.has(axialKey(neighbor))) {
        return true;
      }
    }
    return false;
  }, [roadNetwork.nodes, selectedTile]);

  const actionOptions = useMemo<TileActionOption[]>(() => {
    if (!selectedTile) {
      return [];
    }

    if (readOnly || !worldStarted) {
      const reason = readOnly
        ? "Temporada encerrada: mapa apenas em leitura."
        : "O mundo ainda não começou. Aguarde o GM dar play ou o horário agendado.";
      return [
        { kind: "explore", label: "Explorar área", enabled: false, reason },
        { kind: "build", label: "Construir", enabled: false, reason },
        { kind: "attack", label: "Operação militar", enabled: false, reason },
        { kind: "annex", label: "Anexar", enabled: false, reason },
      ];
    }

    const knownForOrders = selectedCoordKnown;
    const tileHasOwner = Boolean(selectedSite);
    const isAbandonedTile = selectedSite?.occupationKind === "abandoned_city";
    const isFrontierRuins = selectedSite?.occupationKind === "frontier_ruins";
    const isUnownedHotspot = Boolean(selectedHotspot) && !tileHasOwner;
    const isEmptyTile = !tileHasOwner && !selectedHotspot;
    const isEnemyTile = selectedSite?.faction === "enemy";
    const isFoundationTile = isEmptyTile || isUnownedHotspot || isFrontierRuins;
    const targetingPortal = selectedTile.isCentralThrone;
    const centralBlocked = targetingPortal && !isPhase4;
    const alreadyExplored = visitedCoordKeys.has(selectedTile.coordKey) || Boolean(selectedDiscovery);

    let buildEnabled = knownForOrders && isFoundationTile && !targetingPortal;
    let buildReason: string | undefined;
    if (!buildEnabled) {
      buildReason = !knownForOrders
        ? "Explore a área antes de construir."
        : targetingPortal
        ? "Portal Central não aceita construção."
        : "Somente vazio duro, hotspot livre ou ruína instável aceita fundação.";
    } else if (!isRoadConnected) {
      buildEnabled = false;
      buildReason = "Precisa estar conectado a sua Malha Viaria.";
    }

    const goLabel = targetingPortal
      ? !isPhase4
        ? "Entrar no Portal"
        : mobilizationActive
        ? "Marchar ao Portal"
        : "Agrupar na Capital"
      : "Ir";
    let goEnabled = Boolean(marchOriginKey);
    let goReason: string | undefined;

    if (!goEnabled) {
      goReason = "Sem origem de marcha.";
    } else if (selectedTile.coordKey === marchOriginKey) {
      goEnabled = false;
      goReason = "Tile de origem ja selecionado.";
    } else if (centralBlocked) {
      goEnabled = false;
      goReason = "Acesso ao Portal apenas na Fase 4 (Dia 91).";
    } else if (targetingPortal && isPhase4 && !mobilizationActive) {
      goEnabled = false;
      goReason = "Ative Reagrupar Imperio para liberar a marcha ao Portal.";
    } else if (targetingPortal && !portalEligible) {
      goEnabled = false;
      goReason = "Sua linhagem não possui Influência suficiente (1500 pts) para desafiar o Portal.";
    }

    // Atacar serve p/ cidade COM dono (combate/conquista) E p/ abandonada
    // (claim por combate: vence a guarnição + ocupa, herdando a infra).
    let attackEnabled = knownForOrders && Boolean(marchOriginKey) && (isEnemyTile || isAbandonedTile) && !targetingPortal;
    let attackReason: string | undefined;
    if (!attackEnabled) {
      attackReason = !knownForOrders
        ? "Explore a área antes de atacar."
        : targetingPortal
        ? "Portal Central não aceita ataque."
        : "Atacar/ocupar só aparece em cidade com dono ou abandonada.";
    } else if (selectedTile.coordKey === marchOriginKey) {
      attackEnabled = false;
      attackReason = "Tile de origem ja selecionado.";
    }

    let annexEnabled = knownForOrders && Boolean(marchOriginKey) && isAbandonedTile && !targetingPortal;
    let annexReason: string | undefined;
    if (!annexEnabled) {
      annexReason = !knownForOrders
        ? "Explore a área antes de anexar."
        : targetingPortal
        ? "Portal Central não aceita anexação."
        : "Anexar só aparece quando a cidade está vazia.";
    } else if (selectedTile.coordKey === marchOriginKey) {
      annexEnabled = false;
      annexReason = "Tile de origem ja selecionado.";
    } else if (colonyDiplomacy.free <= 0) {
      annexEnabled = false;
      annexReason = "Nenhum diplomata livre. Mature uma Colonia e contrate um agente na aba Herois.";
    }

    let exploreEnabled = !knownForOrders && !targetingPortal && !alreadyExplored;
    let exploreReason: string | undefined;
    if (!exploreEnabled) {
      exploreReason = targetingPortal
        ? "O centro não pode ser explorado."
        : "A area ja esta conhecida.";
    } else if (imperialState.resources.supplies < exploreCost) {
      exploreEnabled = false;
      exploreReason = "Suprimentos insuficientes para a expedição.";
    }

    return [
      { kind: "explore", label: "Explorar área", enabled: exploreEnabled, reason: exploreReason },
      { kind: "build", label: "Construir", enabled: buildEnabled, reason: buildReason },
      ...(targetingPortal || selectedFriendlySite ? [{ kind: "go", label: "Operação militar", enabled: goEnabled, reason: goReason ?? goLabel }] : []),
      ...(!targetingPortal && (isEnemyTile || isAbandonedTile)
        ? [{ kind: "attack", label: isAbandonedTile && !isEnemyTile ? "Ocupar (tropas)" : "Operação militar", enabled: attackEnabled, reason: attackReason }]
        : []),
      ...(!targetingPortal && isAbandonedTile
        ? [{ kind: "annex", label: "Anexar (diplomata)", enabled: annexEnabled, reason: annexReason }]
        : []),
    ] as TileActionOption[];
  }, [colonyDiplomacy.free, exploreCost, imperialState.resources.supplies, isPhase4, isRoadConnected, marchOriginKey, mobilizationActive, portalEligible, readOnly, selectedCoordKnown, selectedDiscovery, selectedFriendlySite, selectedHotspot, selectedSite, selectedTile, visitedCoordKeys, worldStarted]);

  const selectedActionLabel = actionOptions.find((entry) => entry.kind === activeAction)?.label ?? "Ordem";
  const militaryActionOption = useMemo(() => {
    const attack = actionOptions.find((entry) => entry.kind === "attack");
    if (attack) return attack;
    const go = actionOptions.find((entry) => entry.kind === "go");
    return go ?? null;
  }, [actionOptions]);

  const canAffordBuild = imperialState.resources.materials >= buildCost.materials;

  const routePoints = useMemo(() => {
    if (!movementDraft) {
      return [] as PixelPoint[];
    }

    return movementDraft.route
      .map((coord) => world.centerByKey.get(axialKey(coord)))
      .filter((point): point is PixelPoint => Boolean(point));
  }, [movementDraft, world.centerByKey]);

  const routePolyline = routePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  const clampOffset = (candidateX: number, candidateY: number, atZoom: number) => {
    const scaledW = world.width * atZoom;
    const scaledH = world.height * atZoom;
    const minX = viewportSize.w - scaledW;
    const minY = viewportSize.h - scaledH;

    let x = candidateX;
    let y = candidateY;

    if (scaledW <= viewportSize.w) {
      x = (viewportSize.w - scaledW) / 2;
    } else {
      x = Math.min(0, Math.max(minX, x));
    }

    if (scaledH <= viewportSize.h) {
      y = (viewportSize.h - scaledH) / 2;
    } else {
      y = Math.min(0, Math.max(minY, y));
    }

    return { x, y };
  };

  const centerOn = (site: MapSite, atZoom: number) => {
    const center = world.centerByKey.get(site.coordKey);
    if (!center) {
      return clampOffset(offset.x, offset.y, atZoom);
    }

    const targetX = viewportSize.w / 2 - center.x * atZoom;
    const targetY = viewportSize.h / 2 - center.y * atZoom;
    return clampOffset(targetX, targetY, atZoom);
  };

  const centerOnPoint = (point: PixelPoint, atZoom: number) => {
    const targetX = viewportSize.w / 2 - point.x * atZoom;
    const targetY = viewportSize.h / 2 - point.y * atZoom;
    return clampOffset(targetX, targetY, atZoom);
  };

  const applyLayerTransform = (nextOffset: { x: number; y: number }, atZoom: number, animated: boolean) => {
    if (!mapLayerRef.current) {
      return;
    }
    mapLayerRef.current.style.transition = animated ? "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    mapLayerRef.current.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0) scale(${atZoom})`;
  };

  useEffect(() => {
    applyLayerTransform(offset, zoom, !dragRef.current);
  }, [offset, zoom]);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    const updateSize = () => {
      if (!viewportRef.current) {
        return;
      }
      const rect = viewportRef.current.getBoundingClientRect();
      setViewportSize({ w: rect.width, h: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewportSize.w === 0 || viewportSize.h === 0) {
      return;
    }
    if (initialViewAppliedRef.current) {
      return;
    }
    initialViewAppliedRef.current = true;

    if (ownCapitalSite) {
      setZoomLevel(4);
      setZoom(DEFAULT_WORLD_ZOOM);
      setOffset(centerOn(ownCapitalSite, DEFAULT_WORLD_ZOOM));
      setSelectedCoordKey(ownCapitalSite.coordKey);
      setInspectedCoordKey(ownCapitalSite.coordKey);
      setDetailOpen(false);
      return;
    }

    setZoomLevel(1);
    setZoom(WORLD_OVERVIEW_ZOOM);
    setOffset(centerOnPoint(world.centerPoint, WORLD_OVERVIEW_ZOOM));
    setSelectedCoordKey(null);
    setInspectedCoordKey(axialKey(ZERO_AXIAL));
    setDetailOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.w, viewportSize.h, world, ownCapitalSite]);

  useEffect(() => {
    setActiveAction("explore");
    setActionStep("choose");
    setMovementDraft(null);
    setMovementMessage(null);
  }, [worldId]);

  useEffect(() => {
    setActiveAction("explore");
    setActionStep("choose");
    setMovementDraft(null);
    setMovementMessage(null);
  }, [inspectedCoordKey, selectedCoordKey]);

  useEffect(() => {
    if (villageCapReached && buildMode === "outpost") {
      setBuildMode("road");
    }
  }, [buildMode, villageCapReached]);

  const applyZoomLevel = (nextLevel: ZoomLevel, anchor?: PixelPoint) => {
    const nextZoom = ZOOM_LEVEL_SCALE[nextLevel];
    zoomNavigationLockUntilRef.current = Date.now() + 420;
    if (Math.abs(nextZoom - zoom) > 0.01) {
      setZoomCinematic(true);
      if (zoomCinemaTimerRef.current) {
        clearTimeout(zoomCinemaTimerRef.current);
      }
      zoomCinemaTimerRef.current = setTimeout(() => setZoomCinematic(false), 860);
    }
    setZoomLevel(nextLevel);
    setZoom((current) => {
      const centerX = viewportSize.w / 2;
      const centerY = viewportSize.h / 2;
      const worldX = anchor ? anchor.x : (centerX - offset.x) / current;
      const worldY = anchor ? anchor.y : (centerY - offset.y) / current;
      const nextOffsetX = centerX - worldX * nextZoom;
      const nextOffsetY = centerY - worldY * nextZoom;
      setOffset(clampOffset(nextOffsetX, nextOffsetY, nextZoom));
      return nextZoom;
    });
  };

  const stepZoomLevel = (direction: -1 | 1, anchor?: PixelPoint) => {
    const nextLevel = clampZoomLevel(zoomLevel + direction);
    if (nextLevel < 4) {
      setSelectedCoordKey(null);
      setDetailOpen(false);
    }
    applyZoomLevel(nextLevel, anchor);
  };

  const swallowHudPointer: React.PointerEventHandler<HTMLElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    suppressViewportTapRef.current = true;
    window.setTimeout(() => {
      suppressViewportTapRef.current = false;
    }, 360);
  };

  const swallowHudClick: React.MouseEventHandler<HTMLElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    suppressViewportTapRef.current = true;
    window.setTimeout(() => {
      suppressViewportTapRef.current = false;
    }, 360);
  };

  const focusWorldView = () => {
    const nextZoom = ZOOM_LEVEL_SCALE[1];
    setZoomLevel(1);
    setZoom(nextZoom);
    setOffset(centerOnPoint(world.centerPoint, nextZoom));
    setSelectedCoordKey(null);
    setInspectedCoordKey(axialKey(ZERO_AXIAL));
    setDetailOpen(false);
  };

  const focusCapitalView = () => {
    if (!ownCapitalSite) {
      focusWorldView();
      return;
    }
    const nextZoom = ZOOM_LEVEL_SCALE[4];
    setZoomLevel(4);
    setZoom(nextZoom);
    setOffset(centerOn(ownCapitalSite, nextZoom));
    setSelectedCoordKey(ownCapitalSite.coordKey);
    setInspectedCoordKey(ownCapitalSite.coordKey);
    setDetailOpen(false);
  };

  const focusCenterView = () => {
    const nextZoom = ZOOM_LEVEL_SCALE[2];
    setZoomLevel(2);
    setZoom(nextZoom);
    setOffset(centerOnPoint(world.centerPoint, nextZoom));
    setSelectedCoordKey(null);
    setInspectedCoordKey(axialKey(ZERO_AXIAL));
    setDetailOpen(false);
  };

  const focusCoordLayer = (coordKey: string) => {
    const tile = tileByCoordKey.get(coordKey);
    if (!tile) {
      return;
    }
    const nextLevel = clampZoomLevel(zoomLevel + 1);
    if (nextLevel === zoomLevel) return;
    applyZoomLevel(nextLevel, tile.center);
  };

  const zoomIntoCoord = (coordKey: string) => {
    const tile = tileByCoordKey.get(coordKey);
    if (!tile) {
      return;
    }
    const nextLevel = clampZoomLevel(zoomLevel + 1);
    applyZoomLevel(nextLevel, tile.center);
  };

  const handleCoordInteraction = (coordKey: string) => {
    const tile = tileByCoordKey.get(coordKey);
    if (!tile) return;
    const now = Date.now();
    if (zoomLevel < 4 && now < zoomNavigationLockUntilRef.current) {
      return;
    }
    const gate = interactionGateRef.current;
    if (gate && gate.coordKey === coordKey && gate.zoomLevel === zoomLevel && now - gate.at < 240) {
      return;
    }
    interactionGateRef.current = { coordKey, at: now, zoomLevel };

    if (zoomLevel < 4) {
      setInspectedCoordKey(coordKey);
      setSelectedCoordKey(null);
      setDetailOpen(false);
      setMovementDraft(null);
      setMovementMessage(null);
      setOffset(centerOnPoint(tile.center, zoom));
      return;
    }

    const sameTarget = selectedCoordKey === coordKey;
    setSelectedCoordKey(coordKey);
    setInspectedCoordKey(coordKey);
    setDetailOpen(sameTarget);
    setOffset(centerOnPoint(tile.center, zoom));
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!viewportRef.current) {
      return;
    }
    if (isMapInteractiveTarget(event.target)) {
      suppressViewportTapRef.current = true;
      return;
    }
    viewportRef.current.setPointerCapture(event.pointerId);
    applyLayerTransform(offset, zoom, false);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      moved: false,
    };
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    if (isMapInteractiveTarget(event.target)) {
      dragRef.current = null;
      suppressViewportTapRef.current = true;
      return;
    }
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }

    const nextX = dragRef.current.startOffsetX + dx;
    const nextY = dragRef.current.startOffsetY + dy;
    pendingDragOffsetRef.current = clampOffset(nextX, nextY, zoom);
    if (dragFrameRef.current) {
      return;
    }
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      if (pendingDragOffsetRef.current) {
        applyLayerTransform(pendingDragOffsetRef.current, zoom, false);
      }
    });
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (dragFrameRef.current) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const finalOffset = pendingDragOffsetRef.current;
    if (pendingDragOffsetRef.current) {
      applyLayerTransform(pendingDragOffsetRef.current, zoom, false);
      setOffset(pendingDragOffsetRef.current);
      pendingDragOffsetRef.current = null;
    }

    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }

    if (drag.moved || !viewportRef.current) {
      return;
    }

    if (suppressViewportTapRef.current) {
      suppressViewportTapRef.current = false;
      return;
    }

    if (zoomLevel < 4 && Date.now() < zoomNavigationLockUntilRef.current) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const clickOffset = finalOffset ?? offset;
    const px = (event.clientX - rect.left - clickOffset.x) / zoom;
    const py = (event.clientY - rect.top - clickOffset.y) / zoom;
    const tapped = pixelToAxial({ x: px, y: py }, world.layout);

    if (axialDistance(tapped, ZERO_AXIAL) > WORLD_HEX_RADIUS) {
      return;
    }

    const coordKey = axialKey(tapped);
    if (!tileByCoordKey.has(coordKey)) {
      return;
    }

    emitUiFeedback("tap", "light");
    handleCoordInteraction(coordKey);
  };

  const handlePointerCancel: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    if (dragFrameRef.current) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragOffsetRef.current = null;

    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const setDispatchFromPreset = (preset: Exclude<TroopPreset, "custom">) => {
    setTroopPreset(preset);
    setTroopDispatch(buildDispatchFromPreset(troopPool, preset));
  };

  const adjustTroopDispatch = (troopId: TroopTypeId, delta: number) => {
    setTroopPreset("custom");
    setTroopDispatch((current) => {
      const next = clampDispatchToPool(
        {
          ...current,
          [troopId]: current[troopId] + delta,
        },
        troopPool,
      );
      return sameTroopSelection(current, next) ? current : next;
    });
  };

  const setTroopDispatchValue = (troopId: TroopTypeId, value: number) => {
    setTroopPreset("custom");
    setTroopDispatch((current) => {
      const next = clampDispatchToPool(
        {
          ...current,
          [troopId]: value,
        },
        troopPool,
      );
      return sameTroopSelection(current, next) ? current : next;
    });
  };

  const handleActionClick = (option: TileActionOption) => {
    emitUiFeedback(option.enabled ? "open" : "tap", option.enabled ? "medium" : "light");
    if (!option.enabled) {
      const message = option.reason ?? "Esta ação ainda não está disponível neste ponto.";
      setMovementMessage(message);
      emitUiToast({
        tone: "info",
        title: "Ordem bloqueada",
        message,
      });
    }
    if (readOnly) {
      setActiveAction("explore");
      setActionStep("choose");
      setMovementDraft(null);
      return;
    }
    setActiveAction(option.kind);
    if (option.enabled) {
      setMovementMessage(null);
    }

    if (!option.enabled || !selectedTile) {
      setActionStep("choose");
      setMovementDraft(null);
      return;
    }

    if (option.kind === "explore") {
      setMovementDraft(null);
      setActionStep("configure");
      return;
    }

    if (!marchOrigin) {
      setActionStep("choose");
      setMovementDraft(null);
      return;
    }

    const action = option.kind;

    if (action === "attack") {
      setTroopPreset("custom");
      setTroopDispatch((current) => {
        const clamped = clampDispatchToPool(current, troopPool);
        if (troopSelectionTotal(clamped) > 0) {
          return clamped;
        }
        return buildDispatchFromPreset(troopPool, "balanced");
      });
    } else if (action === "go") {
      const nextPreset: Exclude<TroopPreset, "custom"> = troopPreset === "custom" ? "balanced" : troopPreset;
      setDispatchFromPreset(nextPreset);
    }

    const internalAidBoost = action === "go" && selectedFriendlySite;
    const etaMinutes = internalAidBoost
      ? Math.max(1, Math.round(routeSummary.totalMinutes / INTERNAL_AID_SPEED_MULT))
      : routeSummary.totalMinutes;
    const routeSpeedDivisor = internalAidBoost ? INTERNAL_AID_SPEED_MULT : 1;
    const routeSteps = routeSummary.routeSteps.map((step) => ({
      ...step,
      legMinutes: step.legMinutes / routeSpeedDivisor,
      elapsedMinutes: step.elapsedMinutes / routeSpeedDivisor,
    }));

    setMovementDraft({
      action,
      from: { q: marchOrigin.q, r: marchOrigin.r },
      to: { q: selectedTile.q, r: selectedTile.r },
      etaMinutes,
      route: routeToSelection,
      routeSteps,
    });
    setActionStep("configure");
  };

  const handleConfirmExploration = async () => {
    if (readOnly) {
      return;
    }
    if (!selectedTile || visitedCoordKeys.has(selectedTile.coordKey) || imperialState.resources.supplies < exploreCost) {
      return;
    }

    setSubmittingExploration(true);
    emitUiFeedback("open", "medium");

    try {
      const stored = await registerMapMovement(
        worldId,
        {
          action: "explore",
          from: { q: marchOrigin?.q ?? 0, r: marchOrigin?.r ?? 0 },
          to: { q: selectedTile.q, r: selectedTile.r },
          etaMinutes: Math.max(1, routeSummary.totalMinutes),
          route: routeToSelection,
          routeSteps: routeSummary.routeSteps,
        },
        {
          buildMode: null,
          district: selectedTile.district,
          targetLabel: `Explorar ${selectedTile.q}:${selectedTile.r}`,
          troopsSent: { militia: 0, shooters: 0, scouts: troopPool.scouts > 0 ? 1 : 0, machinery: 0 },
          troopsTotal: troopPool.scouts > 0 ? 1 : 0,
          troopPreset: "light",
        },
      );
      const launchRevealKeys = revealCorridorKeys([stored.sourceCoord]);

      setImperialState((current) => ({
        ...current,
        resources: {
          ...current.resources,
          supplies: Math.max(0, current.resources.supplies - exploreCost),
        },
        exploredCoordKeys: Array.from(new Set([...(current.exploredCoordKeys ?? []), ...launchRevealKeys])).slice(0, 800),
        mapMovements: [stored, ...current.mapMovements].slice(0, 1200),
        logs: [`Exploração enviada para ${selectedTile.q}:${selectedTile.r}. Equipe em rota.`, ...current.logs].slice(0, 12),
      }));

      const explorationMessage = `Exploração enviada. ETA ${formatMinutesLabel(stored.etaMinutes)}. Gasto: ${exploreCost.toLocaleString("pt-BR")} suprimentos. Equipe ocupada: ${stored.meta.troopsTotal ?? 0}.`;

      setActionStep("choose");
      setActiveAction("explore");
      setMovementDraft(null);
      setMovementMessage(explorationMessage);
      emitUiToast({
        tone: "success",
        title: "Exploração computada",
        message: explorationMessage,
      });
    } catch {
      const message = "Falha ao lançar exploração. Tente novamente.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Exploração falhou", message });
    } finally {
      setSubmittingExploration(false);
    }
  };

  const handleReturnExploration = () => {
    if (!primaryExplorationRoute) {
      return;
    }

    const now = new Date();
    const returnRoute = [...primaryExplorationRoute.passedKeys].reverse();
    const route = returnRoute.length >= 2 ? returnRoute : primaryExplorationRoute.routeKeys.slice(0, 2).reverse();
    const etaMinutes = Math.max(1, Math.ceil(route.length * 0.75));
    const arrivalAt = new Date(now.getTime() + etaMinutes * 60_000).toISOString();
    const routeSteps = route.slice(1).map((coordKey, index) => ({
      coordKey,
      legMinutes: 0.75,
      elapsedMinutes: (index + 1) * 0.75,
      arrivalAt: new Date(now.getTime() + (index + 1) * 0.75 * 60_000).toISOString(),
    }));

    setImperialState((current) => ({
      ...current,
      mapMovements: current.mapMovements.map((movement) =>
        movement.id === primaryExplorationRoute.id
          ? {
              ...movement,
              launchedAt: now.toISOString(),
              arrivalAt,
              etaMinutes,
              sourceCoord: route[0] ?? movement.sourceCoord,
              targetCoord: route[route.length - 1] ?? movement.sourceCoord,
              route,
              routeSteps,
              meta: {
                ...movement.meta,
                targetLabel: "Retorno à capital",
              },
            }
          : movement,
      ),
      logs: [`Exploração chamada de volta. Retorno estimado em ${etaMinutes}m.`, ...current.logs].slice(0, 12),
    }));

    const message = `Retorno computado. Exploração voltando para a capital/origem em ${etaMinutes}m.`;
    setMovementMessage(message);
    emitUiToast({ tone: "info", title: "Retorno computado", message });
  };

  const handleStartMilitaryOperation = () => {
    if (!militaryActionOption) {
      setMovementMessage("Operação militar indisponível neste ponto do mapa.");
      return;
    }
    if (!militaryActionOption.enabled) {
      setMovementMessage(`Operação militar bloqueada: ${militaryActionOption.reason ?? "condição não atendida."}`);
      emitUiFeedback("tap", "light");
      return;
    }
    handleActionClick(militaryActionOption);
  };

  const dismissExplorationReveal = () => {
    if (explorationReveal) {
      setImperialState((current) => ({
        ...current,
        discoveriesByCoord: {
          ...(current.discoveriesByCoord ?? {}),
          [explorationReveal.coordKey]: {
            ...explorationReveal,
            status: "seen",
          },
        },
      }));
    }
    setExplorationReveal(null);
  };

  const handleConfirmMovement = async () => {
    if (readOnly) {
      return;
    }
    if (!movementDraft || !selectedTile) {
      return;
    }

    emitUiFeedback("route", "medium");

    const targetingPortal = movementDraft.to.q === 0 && movementDraft.to.r === 0;
    if (targetingPortal && !canEnterPortal(sovereigntyScore)) {
      const message = "Sua linhagem não possui Influência suficiente (1500 pts) para desafiar o Portal.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Movimento bloqueado", message });
      return;
    }

    if (movementDraft.action === "build" && buildMode === "outpost" && villageCapReached) {
      const message = `Limite de ${PLAYER_VILLAGE_CAP} cidades alcancado. Use Estrada ou abandone para abrir espaco.`;
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Construção bloqueada", message });
      return;
    }

    if (movementDraft.action === "build" && !canAffordBuild) {
      const message = "Recursos insuficientes para construir neste tile.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Construção bloqueada", message });
      return;
    }

    const isTroopAction = movementDraft.action === "go" || movementDraft.action === "attack";
    if (isTroopAction && troopDispatchTotal <= 0) {
      const message = "Selecione ao menos uma tropa para enviar.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Movimento bloqueado", message });
      return;
    }

    if (movementDraft.action === "annex" && colonyDiplomacy.free <= 0) {
      const message = "Nenhum diplomata livre para anexar esta cidade.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Anexação bloqueada", message });
      return;
    }

    if (movementDraft.action === "annex" && !selectedAnnexDiplomatToken) {
      const message = "Escolha 1 diplomata para acompanhar a anexacao.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Anexação bloqueada", message });
      return;
    }

    setSubmittingMovement(true);

    try {
      const stored = await registerMapMovement(worldId, movementDraft, {
        buildMode: movementDraft.action === "build" ? buildMode : null,
        district: selectedTile.district,
        settlementOrigin:
          movementDraft.action === "build"
            ? selectedSite?.occupationKind === "frontier_ruins"
              ? "frontier_ruins"
              : selectedHotspot
                ? "hotspot"
                : "wild_empty"
            : movementDraft.action === "annex" && selectedSite?.occupationKind === "abandoned_city"
              ? "abandoned_city"
              : movementDraft.action === "attack"
                ? "claimed_city"
              : undefined,
        settlementTerrainKind:
          selectedSite?.terrainKind ??
          selectedTile.terrainKind ??
          (selectedHotspot?.kind === "oasis"
            ? "riverlands"
            : selectedHotspot?.kind === "rare_mine"
              ? "ironridge"
              : selectedHotspot?.kind === "ruins"
                ? "frontier_pass"
                : undefined),
        settlementTerrainLabel:
          selectedSite?.terrainLabel ??
          (selectedHotspot
            ? HOTSPOT_META[selectedHotspot.kind].label
            : TERRAIN_META[selectedTile.terrainKind].label),
        settlementRecommendedClass:
          selectedSite?.recommendedCityClass ??
          selectedSite?.cityClass ??
          (selectedHotspot?.kind === "oasis"
            ? "celeiro"
            : selectedHotspot?.kind === "rare_mine"
              ? "bastiao"
              : selectedHotspot?.kind === "ruins"
                ? "posto_avancado"
                : TERRAIN_META[selectedTile.terrainKind].recommendedCityClass),
        portalGateRequired: targetingPortal ? SOVEREIGNTY_PORTAL_CUT : undefined,
        sovereigntyAtLaunch: targetingPortal ? sovereigntyScore : undefined,
        regroupMode: targetingPortal && isPhase4 && mobilizationActive ? "phase4_free_mobilization" : undefined,
        troopsSent: isTroopAction ? troopDispatch : undefined,
        troopsTotal: isTroopAction ? troopDispatchTotal : undefined,
        troopsQuality: isTroopAction ? troopDispatchQuality : undefined,
        troopPreset: isTroopAction ? troopPreset : undefined,
        annexConsumesDiplomat: movementDraft.action === "annex",
        diplomatToken: movementDraft.action === "annex" ? selectedAnnexDiplomatToken : undefined,
        targetLabel: selectedSite?.name ?? `${selectedTile.q}:${selectedTile.r}`,
      });

      // Ponte PvP / P->NPC: se o alvo é uma cidade REAL inimiga (veio do servidor,
      // logo carrega siteId), dispara uma ORDEM REAL no servidor. O tick a resolve
      // via kw_resolve_attack (combate + saque + conquista por herói). É aditivo:
      // o movimento sandbox continua sendo registrado para feedback visual local.
      let serverAttackSent = false;
      let serverAttackError: string | null = null;
      // Cidade abandonada (neutra, sem dono): claim por COMBATE — mandar tropas,
      // vencer a guarnição e ocupar (o ramo abandonado do kw_resolve_attack cuida).
      const isAbandonedTarget = selectedSite?.occupationKind === "abandoned_city";
      const isRealEnemyAttack =
        movementDraft.action === "attack" &&
        Boolean(selectedSite?.siteId) &&
        (selectedSite?.relation === "Inimigo" ||
          Boolean(selectedSite?.ownerWorldPlayerId) ||
          isAbandonedTarget);
      if (isRealEnemyAttack && selectedSite?.siteId) {
        try {
          const withHero = Object.values(imperialState.heroByVillage).includes("marshal");
          const res = await fetch(`/api/worlds/${worldId}/attack`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetSiteId: selectedSite.siteId,
              troops: {
                militia: troopDispatch.militia,
                shooters: troopDispatch.shooters,
                scouts: troopDispatch.scouts,
                machinery: troopDispatch.machinery,
              },
              withHero,
            }),
          });
          serverAttackSent = res.ok;
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            serverAttackError = data?.error ?? `HTTP ${res.status}`;
          }
        } catch (err) {
          serverAttackError = err instanceof Error ? err.message : "rede";
        }
      }

      if (movementDraft.action === "build") {
        setImperialState((current) => ({
          ...current,
          resources: {
            ...current.resources,
            materials: Math.max(0, current.resources.materials - buildCost.materials),
          },
          logs: [
            `${buildMode === "outpost" ? "Fundacao" : "Estrada"} no mapa (${selectedTile.q},${selectedTile.r})`,
            ...current.logs,
          ].slice(0, 12),
        }));
      }

      if (movementDraft.action === "annex") {
        setImperialState((current) => ({
          ...current,
          annexEnvoysCommitted: current.annexEnvoysCommitted + 1,
          logs: [`Anexacao iniciada em ${selectedTile.q}:${selectedTile.r} com ${selectedAnnexDiplomatToken}`, ...current.logs].slice(0, 12),
        }));
      }

      const successMessage = targetingPortal
        ? `Expedicao ${stored.id.slice(0, 8)} em marcha ao Portal. Se sua Influencia cair abaixo de ${SOVEREIGNTY_PORTAL_CUT}, a entrada falhara no destino.${stored.meta.regroupMode ? ` Mobilizacao Livre x${PHASE4_REGROUP_SPEED_MULT} ativa.` : ""}`
        : movementDraft.action === "attack"
          ? isRealEnemyAttack
            ? serverAttackSent
              ? isAbandonedTarget
                ? `Tropas enviadas para OCUPAR ${selectedSite?.name ?? "a cidade abandonada"}. ETA ~2 min. Comprometido: ${troopDispatchTotal.toLocaleString("pt-BR")} tropas (${formatTroopCommitment(troopDispatch)}).`
                : `Ataque REAL enviado ao servidor contra ${selectedSite?.name ?? "alvo"}. ETA ~2 min. Comprometido: ${troopDispatchTotal.toLocaleString("pt-BR")} tropas (${formatTroopCommitment(troopDispatch)}).`
              : `Servidor recusou o ataque: ${serverAttackError ?? "erro desconhecido"}.`
            : `Operação militar registrada. ETA ${formatMinutesLabel(stored.etaMinutes)}. Comprometido: ${troopDispatchTotal.toLocaleString("pt-BR")} tropas (${formatTroopCommitment(troopDispatch)}). Gasto imediato: 0 suprimentos.`
          : movementDraft.action === "annex"
            ? `Anexacao ${stored.id.slice(0, 8)} registrada. ${selectedAnnexDiplomatToken} ficou em missao ate a consolidacao da cidade.`
            : movementDraft.action === "go"
              ? `Operação militar de marcha registrada. ETA ${formatMinutesLabel(stored.etaMinutes)}. Comprometido: ${troopDispatchTotal.toLocaleString("pt-BR")} tropas (${formatTroopCommitment(troopDispatch)}). Gasto imediato: 0 suprimentos.`
              : `Movimento ${stored.id.slice(0, 8)} registrado em map_movements. ETA ${formatMinutesLabel(stored.etaMinutes)}.${isTroopAction ? ` Tropa: ${troopDispatchTotal.toLocaleString("pt-BR")} (${troopPreset}).` : ""}`;

      setMovementMessage(successMessage);
      emitUiToast({
        tone: serverAttackError ? "error" : "success",
        title: serverAttackError ? "Ordem recusada" : "Ordem computada",
        message: successMessage,
      });
      setImperialState((current) => ({
        ...current,
        mapMovements: [stored, ...current.mapMovements].slice(0, 1200),
      }));
    } catch {
      const message = "Falha ao registrar movimento. Tente novamente.";
      setMovementMessage(message);
      emitUiToast({ tone: "error", title: "Movimento falhou", message });
    } finally {
      setSubmittingMovement(false);
    }
  };

  const counts = useMemo(() => {
    const visibleSites = mappedSites.filter((site) => currentVisionCoordKeys.has(site.coordKey) || visitedCoordKeys.has(site.coordKey));
    return {
      all: visibleSites.length,
      self: visibleSites.filter((site) => site.faction === "self").length,
      tribe: visibleSites.filter((site) => site.faction === "tribe").length,
      ally: visibleSites.filter((site) => site.faction === "ally").length,
      enemy: visibleSites.filter((site) => site.faction === "enemy").length,
      abandoned: visibleSites.filter((site) => site.faction === "abandoned").length,
    };
  }, [currentVisionCoordKeys, mappedSites, visitedCoordKeys]);

  const movementInfo = useMemo(() => {
    const oneHex = { q: 1, r: 0 };
    const base = calculateMarchTimeMinutes(ZERO_AXIAL, oneHex, { hasRoad: false, terrainMovementMultiplier: 1 / kingModifiers.explorationSpeedMultiplier });
    const road = calculateMarchTimeMinutes(ZERO_AXIAL, oneHex, { hasRoad: true, terrainMovementMultiplier: 1 / kingModifiers.explorationSpeedMultiplier });
    return {
      baseMinutesPerHex: Math.round(base.minutesPerHex),
      roadMinutesPerHex: Math.round(road.minutesPerHex),
    };
  }, [kingModifiers.explorationSpeedMultiplier]);

  const portalVisual = portalEligible
    ? {
        stroke: "rgba(251,191,36,0.9)",
        fill: "rgba(250,204,21,0.22)",
        ring: "rgba(251,191,36,0.45)",
        chipClass: "border-amber-300/75 bg-amber-500/25 text-amber-100",
        label: "Portal Central Liberado",
      }
    : {
        stroke: "rgba(248,113,113,0.9)",
        fill: "rgba(185,28,28,0.22)",
        ring: "rgba(248,113,113,0.35)",
        chipClass: "border-rose-300/75 bg-rose-500/25 text-rose-100",
        label: "Portal Central Bloqueado",
      };
  const selectedMapStatus = submittingExploration
    ? "EXPLORANDO"
    : selectedDiscovery || (selectedTile && visitedCoordKeys.has(selectedTile.coordKey))
      ? "RETORNANDO"
      : "PARADO";
  const selectedMapStatusClass =
    selectedMapStatus === "EXPLORANDO"
      ? "border-cyan-300/70 bg-cyan-500/22 text-cyan-50"
      : selectedMapStatus === "RETORNANDO"
        ? "border-amber-300/70 bg-amber-500/20 text-amber-100"
        : "border-slate-300/35 bg-slate-500/12 text-slate-200";
  const selectedTileHidden = Boolean(selectedTile && !selectedCoordKnown && !selectedTile.isCentralThrone);
  const mapEventCards = useMemo(
    () =>
      Object.values(imperialState.discoveriesByCoord ?? {})
        .filter((discovery) => discovery.status === "new")
        .slice(0, 3),
    [imperialState.discoveriesByCoord],
  );
  const detailModeActive = zoom >= DETAIL_ZOOM_THRESHOLD;
  const macroVisionActive = zoom < MACRO_VISION_THRESHOLD;
  const microVisionActive = zoom >= MICRO_VISION_THRESHOLD;
  const renderTiles = useMemo(() => {
    if (!microVisionActive) {
      return world.tiles;
    }

    const centers = [
      selectedTile && selectedCoordKnown ? { q: selectedTile.q, r: selectedTile.r } : ZERO_AXIAL,
      marchOrigin ?? ZERO_AXIAL,
      ZERO_AXIAL,
    ];
    const visibleKeys = new Set<string>();

    return world.tiles.filter((tile) => {
      const close = centers.some((center) => axialDistance(tile, center) <= 8);
      if (close || currentVisionCoordKeys.has(tile.coordKey) || visitedCoordKeys.has(tile.coordKey)) {
        visibleKeys.add(tile.coordKey);
        return true;
      }
      return false;
    });
  }, [currentVisionCoordKeys, marchOrigin, microVisionActive, selectedCoordKnown, selectedTile, visitedCoordKeys, world.tiles]);
  return (
    <section className="space-y-2 bg-black text-slate-100 lg:bg-transparent" data-smoke="strategic-map">
      <article className="overflow-hidden rounded-none border border-white/10 bg-black p-1 shadow-[0_0_70px_rgba(34,211,238,0.08)] sm:rounded-2xl sm:p-2">
        <div
          ref={viewportRef}
          data-smoke="map-viewport"
          className="kw-tactical-map relative min-h-[560px] touch-none overflow-hidden rounded-xl border border-cyan-300/12 bg-black lg:min-h-[720px]"
          style={{ height: "calc(100vh - 168px - env(safe-area-inset-bottom))" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div
            ref={mapLayerRef}
            className="absolute left-0 top-0"
            style={{
              width: world.width,
              height: world.height,
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: dragRef.current ? undefined : "transform 680ms cubic-bezier(0.16, 1, 0.3, 1)",
              willChange: "transform",
              backfaceVisibility: "hidden",
              contain: "layout paint style",
            }}
          >
            <svg
              width={world.width}
              height={world.height}
              viewBox={`0 0 ${world.width} ${world.height}`}
              className="absolute inset-0 pointer-events-none"
              aria-label="Grid hexagonal do mundo"
            >
              <image
                href={WORLD_MAP_IMAGE_SRC}
                x={MAP_IMAGE_CALIBRATION.x}
                y={MAP_IMAGE_CALIBRATION.y}
                width={world.width * MAP_IMAGE_CALIBRATION.scale}
                height={world.height * MAP_IMAGE_CALIBRATION.scale}
                preserveAspectRatio="xMidYMid slice"
                opacity={1}
              />

              {renderTiles.map((tile) => {
                const style = TILE_STYLE_BY_ZONE[tile.zone];
                const visited = visitedCoordKeys.has(tile.coordKey);
                const inVision = currentVisionCoordKeys.has(tile.coordKey);
                return (
                  <polygon
                    key={tile.coordKey}
                    points={tile.points}
                    fill={macroVisionActive ? "rgba(0,0,0,0.03)" : style.fill}
                    stroke={FOG_VISUAL_DISABLED ? "rgba(148,163,184,0.08)" : inVision ? "rgba(34,211,238,0.24)" : visited ? "rgba(148,163,184,0.30)" : "rgba(51,65,85,0.14)"}
                    strokeWidth={macroVisionActive ? 0.6 : 0.35}
                    opacity={FOG_VISUAL_DISABLED ? 0.18 : inVision ? 0.72 : visited ? 0.46 : 0.14}
                  />
                );
              })}

              {!macroVisionActive ? renderTiles.map((tile) => (
                <polygon
                  key={`terrain-${tile.coordKey}`}
                  points={tile.points}
                  fill={TERRAIN_VISUAL_META[tile.terrainKind].tint}
                  stroke="none"
                  opacity={FOG_VISUAL_DISABLED ? 0.08 : currentVisionCoordKeys.has(tile.coordKey) ? 0.35 : visitedCoordKeys.has(tile.coordKey) ? 0.22 : 0}
                />
              )) : null}

              {!microVisionActive ? renderTiles.map((tile) => (
                <polygon
                  key={`district-${tile.coordKey}`}
                  points={tile.points}
                  fill={DISTRICT_META[tile.district].tint}
                  stroke="none"
                  opacity={FOG_VISUAL_DISABLED ? 0.05 : currentVisionCoordKeys.has(tile.coordKey) ? 0.22 : visitedCoordKeys.has(tile.coordKey) ? 0.08 : 0}
                />
              )) : null}

              {!FOG_VISUAL_DISABLED ? renderTiles.map((tile) => {
                const inVision = currentVisionCoordKeys.has(tile.coordKey);
                const visited = visitedCoordKeys.has(tile.coordKey);
                if (inVision) return null;
                return (
                  <polygon
                    key={`fog-${tile.coordKey}`}
                    points={tile.points}
                    fill={visited ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.9)"}
                    stroke={visited ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.6)"}
                    strokeWidth={visited ? 0.55 : 0.35}
                    opacity={visited ? 0.5 : 0.97}
                  />
                );
              }) : null}

              {renderTiles.map((tile) => {
                const revealedByMarch = activeMovementRevealedKeys.has(tile.coordKey);
                const onActiveRoute = activeMovementRouteKeys.has(tile.coordKey);
                if (!revealedByMarch && !onActiveRoute) return null;
                return (
                  <polygon
                    key={`movement-reveal-${tile.coordKey}`}
                    points={tile.points}
                    fill={revealedByMarch ? "rgba(34,211,238,0.14)" : "rgba(250,204,21,0.09)"}
                    stroke={revealedByMarch ? "rgba(103,232,249,0.62)" : "rgba(250,204,21,0.36)"}
                    strokeWidth={revealedByMarch ? 1.05 : 0.75}
                    opacity={revealedByMarch ? 0.92 : 0.68}
                  />
                );
              })}

              {factionInfluenceOverlays.map((overlay) => (
                <polygon
                  key={`influence-${overlay.coordKey}`}
                  points={overlay.points}
                  fill={factionInfluenceColor(overlay.faction, Math.min(0.1, 0.03 + overlay.strength * 0.05))}
                  stroke="none"
                  strokeLinejoin="round"
                  opacity={FOG_VISUAL_DISABLED ? 0.14 : currentVisionCoordKeys.has(overlay.coordKey) ? 1 : visitedCoordKeys.has(overlay.coordKey) ? 0.18 : 0}
                />
              ))}

              {!microVisionActive ? world.frontierLines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(226,232,240,0.08)"
                  strokeWidth={0.5}
                  strokeDasharray="3 4"
                />
              )) : null}

              {visibleRouteEdges.map((edge) => {
                const tone = strategicNodeTone(edge.active ? "pressured" : edge.from.state);
                return (
                  <line
                    key={`route-node-${edge.from.coordKey}-${edge.to.coordKey}`}
                    x1={edge.from.center.x}
                    y1={edge.from.center.y}
                    x2={edge.to.center.x}
                    y2={edge.to.center.y}
                    stroke={edge.active ? "rgba(250,204,21,0.55)" : tone.route}
                    strokeWidth={edge.active ? 2.4 : 1.45}
                    strokeLinecap="round"
                    strokeDasharray={edge.active ? "3 4" : undefined}
                  />
                );
              })}

              {activeMovementRoutes.map((route) => {
                const start = route.routePoints[0]!;
                const end = route.routePoints[route.routePoints.length - 1]!;
                const head = route.passedPoints[route.passedPoints.length - 1] ?? start;
                return (
                  <g key={`active-movement-${route.id}`}>
                    <polyline
                      points={route.routePolyline}
                      fill="none"
                      stroke="rgba(250,204,21,0.74)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="7 5"
                    />
                    {route.passedPoints.length >= 2 ? (
                      <polyline
                        points={route.passedPolyline}
                        fill="none"
                        stroke="rgba(34,211,238,0.94)"
                        strokeWidth={3.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    <circle cx={start.x} cy={start.y} r={5.3} fill="rgba(34,197,94,0.95)" />
                    <circle cx={head.x} cy={head.y} r={6.2} fill="rgba(34,211,238,0.96)" stroke="rgba(236,254,255,0.86)" strokeWidth={1.2} />
                    <circle cx={end.x} cy={end.y} r={5.4} fill="rgba(244,114,182,0.94)" />
                  </g>
                );
              })}

              {selectedTile ? (
                <>
                  <circle
                    cx={selectedTile.center.x}
                    cy={selectedTile.center.y}
                    r={WORLD_HEX_TILE_SIZE_PX * 0.98}
                    fill="rgba(96,165,250,0.18)"
                    stroke="rgba(191,219,254,0.92)"
                    strokeWidth={1.35}
                  />
                  <circle
                    cx={selectedTile.center.x}
                    cy={selectedTile.center.y}
                    r={WORLD_HEX_TILE_SIZE_PX * 0.38}
                    fill="rgba(191,219,254,0.16)"
                    stroke="rgba(191,219,254,0.7)"
                    strokeWidth={1}
                  />
                </>
              ) : null}

              {routePoints.length >= 2 ? (
                <>
                  <polyline
                    points={routePolyline}
                    fill="none"
                    stroke="rgba(56,189,248,0.95)"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="2 3"
                  />
                  <circle cx={routePoints[0]!.x} cy={routePoints[0]!.y} r={4.6} fill="rgba(34,197,94,0.95)" />
                  <circle
                    cx={routePoints[routePoints.length - 1]!.x}
                    cy={routePoints[routePoints.length - 1]!.y}
                    r={4.6}
                    fill="rgba(244,114,182,0.95)"
                  />
                </>
              ) : null}

              {world.tiles.filter((tile) => tile.isCentralThrone).map((tile) => (
                <polygon
                  key={`throne-${tile.coordKey}`}
                  points={tile.points}
                  fill={portalVisual.fill}
                  stroke={portalVisual.stroke}
                  strokeWidth={1.3}
                />
              ))}

              <circle
                cx={world.centerPoint.x}
                cy={world.centerPoint.y}
                r={WORLD_HEX_TILE_SIZE_PX * 2.8}
                fill={portalVisual.fill}
                stroke={portalVisual.ring}
                strokeWidth={1.2}
              />
            </svg>

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(250,204,21,0.08)_0%,rgba(15,23,42,0)_24%,rgba(2,6,23,0.58)_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(15,23,42,0)_0%,rgba(2,6,23,0.52)_100%)]" />

            {zoom >= 1.6 ? world.districtLabels.map((label) => (
              <div
                key={`district-label-${label.district}`}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${DISTRICT_META[label.district].badge}`}
                style={{ left: label.x, top: label.y }}
              >
                Distrito {label.district}
              </div>
            )) : null}

            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: world.centerPoint.x, top: world.centerPoint.y }}
              title={portalTooltip}
            >
              <div className={`rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-lg ${portalVisual.chipClass}`}>
                {portalVisual.label}
              </div>
            </div>

            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-cyan-300/35 bg-slate-950/55 px-2 py-1 text-[10px] font-bold text-cyan-100 shadow-lg backdrop-blur">
              Centro
              <span className="ml-1 inline-block" style={{ transform: `rotate(${centerHeading}deg)` }}>↑</span>
            </div>

            {strategicNodes.map((node) => {
              const tone = strategicNodeTone(node.state);
              const matchesFilter =
                relationFilter === "all" ||
                (relationFilter === "self" && node.site?.faction === "self") ||
                (relationFilter === "tribe" && node.site?.faction === "tribe") ||
                (relationFilter === "ally" && node.site?.faction === "ally") ||
                (relationFilter === "enemy" && node.site?.faction === "enemy") ||
                (relationFilter === "abandoned" && node.site?.faction === "abandoned") ||
                !node.site;
              const muted = !matchesFilter && !node.isSelected;
              const inVision = currentVisionCoordKeys.has(node.coordKey);
              const visited = visitedCoordKeys.has(node.coordKey);
              const memoryOnly = !FOG_VISUAL_DISABLED && visited && !inVision;
              const fogged = !FOG_VISUAL_DISABLED && !visited && !inVision;
              if (fogged && !node.isCenter && !node.hasRouteActivity) {
                return null;
              }
              const showLabel = zoomLevel < 4 && !macroVisionActive && (node.isSelected || microVisionActive || (!muted && zoom >= 1.35 && node.state !== "unknown"));
              const icon = node.isCenter
                ? "◎"
                : node.site
                  ? siteMarkerText(node.site)
                  : node.hotspot
                    ? HOTSPOT_META[node.hotspot.kind].icon
                    : node.state === "unknown"
                      ? "?"
                      : "•";

              const cityIconSrc = node.site ? cityIconSrcForSite(node.site) : null;

              return (
                <button
                  key={`node-${node.coordKey}`}
                  type="button"
                  onPointerDown={
                    zoomLevel === 4
                      ? (event) => {
                          suppressViewportTapRef.current = true;
                          event.stopPropagation();
                        }
                      : undefined
                  }
                  onPointerUp={
                    zoomLevel === 4
                      ? (event) => {
                          suppressViewportTapRef.current = true;
                          event.stopPropagation();
                        }
                      : undefined
                  }
                  onClick={
                    zoomLevel === 4
                      ? (event) => {
                          event.stopPropagation();
                          suppressViewportTapRef.current = true;
                          emitUiFeedback("tap", "light");
                          handleCoordInteraction(node.coordKey);
                        }
                      : undefined
                  }
                  className={`absolute transition-all duration-200 ${zoomLevel === 4 ? "" : "pointer-events-none"}`}
                  style={{
                    left: node.center.x,
                    top: node.center.y,
                    transform: `translate(-50%, -50%) scale(${node.isSelected ? 1.16 : node.isFocus ? 1.06 : macroVisionActive ? 0.72 : muted ? 0.82 : 1})`,
                    opacity: fogged ? 0.1 : muted ? 0.2 : memoryOnly ? 0.42 : 1,
                    filter: memoryOnly ? "grayscale(1) saturate(0.2)" : undefined,
                    zIndex: node.isSelected ? 12 : node.isPressured ? 10 : node.isOwned || node.isEnemy ? 9 : 6,
                  }}
                  title={`${node.label} · ${node.caption}`}
                >
                  {node.isPressured || node.hasRouteActivity ? (
                    <span
                      className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
                      style={{
                        background: `radial-gradient(circle, ${tone.pulse} 0%, rgba(15,23,42,0) 68%)`,
                      }}
                    />
                  ) : null}
                  <div
                    className={`relative z-10 grid ${
                      cityIconSrc
                        ? macroVisionActive
                          ? "h-7 w-7 text-[0px]"
                          : zoomLevel >= 4
                            ? "h-16 w-16 text-[0px]"
                            : "h-10 w-10 text-[0px]"
                        : macroVisionActive
                          ? "h-4 w-4 text-[0px]"
                          : microVisionActive
                            ? "h-9 w-9 text-[11px]"
                            : "h-6 w-6 text-[10px]"
                    } place-items-center rounded-full border font-black shadow-lg transition-all duration-300 ${tone.chip} ${
                      node.isSelected ? "ring-2 ring-white/85" : node.isFocus ? "ring-2 ring-cyan-200/45" : ""
                    }`}
                    style={{
                      boxShadow: node.isSelected
                        ? "0 0 0 10px rgba(34,211,238,0.12), 0 0 34px rgba(34,211,238,0.42)"
                        : FOG_VISUAL_DISABLED || inVision
                          ? tone.glow
                          : "none",
                    }}
                  >
                    {cityIconSrc ? (
                      <img
                        src={cityIconSrc}
                        alt=""
                        className={`${macroVisionActive ? "h-6 w-6" : zoomLevel >= 4 ? "h-14 w-14" : "h-9 w-9"} object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.55)]`}
                      />
                    ) : (
                      macroVisionActive ? "" : icon
                    )}
                  </div>
                  {macroVisionActive && (node.isPressured || node.hasRouteActivity || node.isEnemy || node.hotspot || node.isCenter) ? (
                    <span className="pointer-events-none absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full border border-cyan-300/30 bg-black text-[8px] text-cyan-100">
                      {node.isEnemy ? "!" : node.hotspot ? "*" : node.isCenter ? "O" : "^"}
                    </span>
                  ) : null}
                  {showLabel && microVisionActive && node.site && inVision ? (
                    <span className="pointer-events-none absolute left-1/2 top-[132%] z-20 min-w-24 -translate-x-1/2 rounded-lg border border-cyan-300/20 bg-black/88 px-2 py-1 text-center text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur">
                      <span className="block max-w-32 truncate text-[9px] font-black leading-none">{node.label}</span>
                      <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                        {cityClassLabel(node.site.recommendedCityClass ?? node.site.cityClass ?? TERRAIN_META[node.tile.terrainKind].recommendedCityClass)}
                      </span>
                    </span>
                  ) : showLabel ? (
                    <span className="pointer-events-none absolute left-1/2 top-[122%] z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-300/18 bg-black/82 px-1.5 py-0.5 text-[9px] font-semibold text-slate-100 backdrop-blur">
                      {node.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="pointer-events-none absolute left-3 right-16 top-3 z-20 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/14 bg-black/58 px-2 py-1 text-[10px] font-bold text-slate-100 backdrop-blur">
              Sinais {counts.all}
            </span>
            <span className="rounded-full border border-cyan-300/40 bg-cyan-400/16 px-2 py-1 text-[10px] font-bold text-cyan-50 backdrop-blur">
              Suas {counts.self}
            </span>
            <span className="rounded-full border border-rose-300/40 bg-rose-500/16 px-2 py-1 text-[10px] font-bold text-rose-100 backdrop-blur">
              Inimigos {counts.enemy}
            </span>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold backdrop-blur ${portalVisual.chipClass}`}>
              Portal {portalEligible ? "ok" : `${SOVEREIGNTY_PORTAL_CUT}`}
            </span>
          </div>

          <div className="pointer-events-none absolute left-3 right-16 top-16 z-20 flex flex-wrap gap-1.5 sm:top-14">
            {[
              { label: "Você", tone: "border-cyan-300/60 bg-cyan-400/16 text-cyan-50" },
              { label: "Tribo", tone: "border-violet-300/60 bg-violet-500/14 text-violet-100" },
              { label: "Aliado", tone: "border-emerald-300/60 bg-emerald-500/14 text-emerald-100" },
              { label: "Inimigo", tone: "border-rose-300/60 bg-rose-500/16 text-rose-100" },
              { label: "Abandonada", tone: "border-amber-300/60 bg-amber-500/14 text-amber-100" },
            ].map((entry) => (
              <span key={entry.label} className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.30)] backdrop-blur ${entry.tone}`}>
                {entry.label}
              </span>
            ))}
          </div>

          {mapEventCards.length > 0 ? (
            <div
              data-smoke="map-event-stack"
              className="pointer-events-none absolute left-3 top-[5.7rem] z-20 flex w-[min(21rem,calc(100%-6.5rem))] flex-col gap-2"
            >
              {mapEventCards.map((event, index) => {
                const accent = discoveryAccent(event.type);
                const coord = parseLegacyCoord(event.coordKey);
                return (
                  <button
                    key={`${event.coordKey}-${event.title}`}
                    type="button"
                    data-map-hud="true"
                    onPointerDown={swallowHudPointer}
                    onPointerUp={swallowHudPointer}
                    onClick={(clickEvent) => {
                      swallowHudClick(clickEvent);
                      setSelectedCoordKey(event.coordKey);
                      setInspectedCoordKey(event.coordKey);
                      setDetailOpen(true);
                      setExplorationReveal(event);
                      emitUiFeedback("open", "medium");
                    }}
                    className={`pointer-events-auto w-full rounded-2xl border p-2.5 text-left shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl transition hover:-translate-y-0.5 ${accent.panel}`}
                    style={{
                      transform: `translateY(${index * -2}px) scale(${1 - index * 0.025})`,
                      opacity: 1 - index * 0.1,
                      boxShadow: `0 0 28px ${accent.glow}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${accent.chip}`}>
                          {discoveryTypeLabel(event.type)}
                        </p>
                        <p className="mt-1 truncate text-xs font-black text-slate-50">{event.title}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[9px] font-bold text-slate-200">
                        {coord.q}:{coord.r}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-300">
                      {event.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            data-smoke="troop-occupation-strip"
            className={`pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-2xl border px-3 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.38)] backdrop-blur-xl ${
              troopCommittedTotal > 0
                ? "border-amber-300/35 bg-amber-950/58 text-amber-50"
                : activeMovementRoutes.length > 0
                  ? "border-cyan-300/45 bg-slate-950/90 text-cyan-50"
                  : "border-emerald-300/35 bg-slate-950/90 text-emerald-50"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                  {troopCommittedTotal > 0 ? "Tropas ocupadas" : activeMovementRoutes.length > 0 ? "Rotas ativas" : "Tropas paradas"}
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-100">
                  {primaryActiveRoute
                    ? `${primaryActiveRoute.label} para ${primaryActiveRoute.targetLabel} · ETA ${formatMinutesLabel(primaryActiveRoute.remainingMinutes)}`
                    : "Nenhuma marcha ativa agora. O exercito esta livre para nova ordem."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200">
                <span>{troopCommittedTotal.toLocaleString("pt-BR")} usadas</span>
                <span className="text-slate-500">/</span>
                <span>{troopSelectionTotal(troopPool).toLocaleString("pt-BR")} livres</span>
                {activeMovementRoutes.length > 1 ? <span className="text-cyan-100">+{activeMovementRoutes.length - 1} rota</span> : null}
                {primaryExplorationRoute ? (
                  <button
                    type="button"
                    data-map-hud="true"
                    onPointerDown={swallowHudPointer}
                    onPointerUp={swallowHudPointer}
                    onClick={(event) => {
                      swallowHudClick(event);
                      handleReturnExploration();
                    }}
                    className="pointer-events-auto rounded-full border border-cyan-200/45 bg-cyan-500/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 hover:bg-cyan-500/24"
                  >
                    Retornar
                  </button>
                ) : null}
              </div>
            </div>
            {primaryActiveRoute ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-rose-300"
                  style={{ width: `${Math.max(4, Math.round(primaryActiveRoute.progress * 100))}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
            <button
              type="button"
              data-map-hud="true"
              data-smoke="map-zoom-in"
              onPointerDown={swallowHudPointer}
              onPointerUp={swallowHudPointer}
              onClick={(event) => {
                swallowHudClick(event);
                stepZoomLevel(1);
              }}
              aria-label="Aumentar zoom"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/62 text-slate-100 shadow-lg backdrop-blur hover:border-cyan-300/45 hover:bg-cyan-500/10"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="pointer-events-none rounded-full border border-cyan-300/25 bg-black/58 px-2 py-1 text-center text-[10px] font-bold text-cyan-100 backdrop-blur">
              Z{zoomLevel}
            </div>
            <button
              type="button"
              data-map-hud="true"
              data-smoke="map-zoom-out"
              onPointerDown={swallowHudPointer}
              onPointerUp={swallowHudPointer}
              onClick={(event) => {
                swallowHudClick(event);
                stepZoomLevel(-1);
              }}
              aria-label="Diminuir zoom"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/62 text-slate-100 shadow-lg backdrop-blur hover:border-cyan-300/45 hover:bg-cyan-500/10"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-map-hud="true"
              data-smoke="map-focus-capital"
              onPointerDown={swallowHudPointer}
              onPointerUp={swallowHudPointer}
              onClick={(event) => {
                swallowHudClick(event);
                focusCapitalView();
              }}
              aria-label="Ir para capital"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/12 text-cyan-50 shadow-lg backdrop-blur hover:border-cyan-200/70 hover:bg-cyan-500/18"
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>

          {zoomCinematic ? (
            <div className="kw-zoom-cinema pointer-events-none absolute inset-0 z-[18]">
              <div className="kw-zoom-cinema__scan" />
              <div className="kw-zoom-cinema__iris" />
            </div>
          ) : null}

          <aside
            data-smoke="map-detail-sheet"
            className={`absolute inset-x-3 z-30 max-h-[54vh] overflow-y-auto rounded-2xl border border-cyan-300/24 bg-black/82 p-3 text-slate-100 shadow-[0_0_42px_rgba(34,211,238,0.14)] backdrop-blur-xl transition-all duration-300 ${
              selectedTile && detailOpen && zoomLevel === 4 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[110%] opacity-0"
            }`}
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 58px)" }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            {selectedTile && detailOpen && zoomLevel === 4 ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      {selectedTile.isCentralThrone
                        ? "Portal"
                        : selectedTileHidden
                          ? "Região oculta"
                          : selectedSite
                            ? "Cidade"
                            : selectedHotspot
                              ? "Ponto especial"
                              : "Território"}
                    </p>
                    <p className="text-base font-black text-slate-50">
                      {selectedTileHidden ? "Região sob névoa" : selectedStrategicNode?.label ?? `Hex ${selectedTile.q}:${selectedTile.r}`}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {selectedTileHidden
                        ? "Explore para revelar"
                        : selectedSite?.faction === "self"
                        ? "Sua área"
                        : selectedSite?.faction === "enemy"
                          ? "Hostil"
                        : selectedSite?.occupationKind === "abandoned_city"
                            ? "Cidade vazia"
                            : selectedTile.isCentralThrone
                              ? "Centro do mundo"
                              : selectedHotspot
                                ? "Oportunidade"
                                : "Terreno livre"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${selectedMapStatusClass}`}>
                    {selectedMapStatus}
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100 hover:bg-white/20"
                    onClick={() => {
                      setSelectedCoordKey(null);
                      setMovementDraft(null);
                      setMovementMessage(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>

                {readOnly ? (
                  <div className="mt-2 rounded-2xl border border-amber-300/24 bg-amber-500/12 px-3 py-2 text-[11px] font-semibold text-amber-100">
                    Temporada encerrada. O mapa segue apenas em leitura.
                  </div>
                ) : null}

                {!worldStarted && !readOnly ? (
                  <div className="mt-2 rounded-2xl border border-cyan-300/24 bg-cyan-500/12 px-3 py-2 text-[11px] font-semibold text-cyan-100">
                    Mundo aguardando início. Inspeção é livre, mas ordens de jogo só entram depois do play do GM ou do horário agendado.
                  </div>
                ) : null}

                <div
                  className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/88"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.68)), url('${selectedDetailImage}')`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                >
                  <div className="flex min-h-[118px] items-end justify-between p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                        {selectedTileHidden ? "Terreno sob névoa" : selectedSite?.terrainLabel ?? TERRAIN_META[selectedTile.terrainKind].label}
                      </p>
                      <p className="mt-1 text-base font-black text-slate-50">
                        {selectedTileHidden
                          ? "Conteúdo oculto"
                          : selectedTile.isCentralThrone
                          ? portalEligible ? "Centro Liberado" : "Centro Bloqueado"
                          : selectedDiscovery
                            ? selectedDiscovery.title
                            : selectedSite?.cityClass
                              ? cityClassLabel(selectedSite.cityClass)
                              : selectedSite?.recommendedCityClass
                                ? cityClassLabel(selectedSite.recommendedCityClass)
                                : "Cidade comum"}
                      </p>
                    </div>
                    {selectedSite ? (
                      <img
                        src={cityIconSrcForSite(selectedSite)}
                        alt=""
                        className="h-16 w-16 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]"
                      />
                    ) : null}
                  </div>
                </div>

                {selectedDiscovery ? (
                  <div
                    className={`mt-2 rounded-2xl border p-2 text-[11px] text-slate-100 ${selectedDiscoveryAccent?.panel ?? "border-cyan-300/20 bg-cyan-500/10"}`}
                    style={{
                      boxShadow: selectedDiscoveryAccent ? `0 0 30px ${selectedDiscoveryAccent.glow}` : undefined,
                    }}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`inline-flex rounded-full border bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${selectedDiscoveryAccent?.chip ?? "border-cyan-300/35 text-cyan-100"}`}>
                        {discoveryTypeLabel(selectedDiscovery.type)}
                      </span>
                      <span className="inline-flex rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-100">
                        {selectedDiscovery.riskLabel}
                      </span>
                      <span className="inline-flex rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-100">
                        {selectedDiscovery.rewardLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-200">
                      {selectedDiscovery.summary}
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] p-2">
                    <span className="block text-slate-500">ETA</span>
                    <span className="mt-1 block text-slate-100">{formatMinutesLabel(routeSummary.totalMinutes)}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] p-2">
                    <span className="block text-slate-500">DIST</span>
                    <span className="mt-1 block text-slate-100">{routeSummary.hexCount}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] p-2">
                    <span className="block text-slate-500">TIPO</span>
                    <span className="mt-1 block truncate text-slate-100">
                      {selectedTileHidden
                        ? "Oculto"
                        : selectedDiscovery
                        ? discoveryTypeLabel(selectedDiscovery.type)
                        : selectedSite?.occupationKind === "abandoned_city"
                          ? "Vazia"
                          : selectedSite?.faction === "enemy"
                            ? "Hostil"
                            : selectedTile.isCentralThrone
                              ? "Portal"
                              : "Livre"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.045] p-2">
                    <span className="block text-slate-500">STATUS</span>
                    <span className="mt-1 block truncate text-slate-100">{selectedMapStatus}</span>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[11px] font-semibold text-slate-300">
                  <p>
                    {selectedTileHidden
                      ? "Conteúdo oculto. Envie exploração para revelar aldeia, risco, ruína ou oportunidade real deste hex."
                      : selectedSite?.faction === "enemy"
                      ? "Cidade ocupada por rival. Ação principal: atacar."
                      : selectedSite?.occupationKind === "abandoned_city"
                        ? "Cidade vazia. Ação principal: anexar com diplomata."
                        : selectedTile.isCentralThrone
                          ? portalEligible
                            ? "Portal liberado. Você pode marchar para o centro."
                            : "Portal bloqueado: precisa de 1500 de Influência."
                          : selectedHotspot
                            ? "Ponto especial. Bom candidato para fundação."
                            : "Terreno livre. Construa estrada ou funde uma cidade."}
                  </p>
                  {selectedDiscovery ? (
                    <p className="mt-2 text-cyan-100">
                      Descoberta registrada. Ação sugerida: {selectedDiscovery.actionLabel.toLowerCase()}.
                    </p>
                  ) : null}
                </div>

                <div className="mt-2 rounded-lg border border-white/20 bg-white/8 p-1.5 text-[10px] text-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold uppercase tracking-[0.16em]">
                      {actionStep === "choose" ? "Toque numa ordem" : "Confirme a ordem"}
                    </p>
                    {actionStep === "configure" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionStep("choose");
                          setActiveAction("explore");
                          setMovementDraft(null);
                          setMovementMessage(null);
                        }}
                        className="rounded-md border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-100 hover:bg-white/20"
                      >
                        Voltar
                      </button>
                    ) : null}
                  </div>
                </div>

                {actionStep === "choose" ? (
                  (() => {
                    const possible = actionOptions.filter((option) => option.enabled);
                    if (possible.length === 0) {
                      return (
                        <p className="mt-2 rounded-xl border border-white/10 bg-slate-950/70 px-2.5 py-3 text-center text-[11px] font-semibold text-slate-300">
                          Nada a fazer aqui
                        </p>
                      );
                    }
                    return (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {possible.map((option) => {
                          const selected = option.kind === activeAction;
                          return (
                            <button
                              key={option.kind}
                              type="button"
                              onClick={() => handleActionClick(option)}
                              className={`w-full rounded-xl border px-2.5 py-3 text-center text-sm font-black transition active:scale-[0.97] ${
                                selected
                                  ? "border-cyan-300/85 bg-cyan-500/25 text-cyan-50"
                                  : `${actionTone(option.kind)} hover:brightness-110`
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <div className="mt-1.5 rounded-lg border border-cyan-200/40 bg-slate-950/88 p-2 text-[11px] text-slate-100">
                    <p className="font-semibold text-cyan-100">Acao selecionada: {selectedActionLabel}</p>
                    <p className="text-[10px] text-slate-300">Ajuste parametros e confirme a execucao da ordem. Apoio e recurso interno funcionam como doacao (sem troca).</p>
                  </div>
                )}

                {actionStep === "configure" && activeAction === "build" ? (
                  <div className="mt-2 rounded-lg border border-white/20 bg-white/8 p-2 text-[11px] text-slate-100">
                    <div className="mb-1.5 flex gap-1">
                      <button
                        type="button"
                        disabled={villageCapReached}
                        onClick={() => setBuildMode("outpost")}
                        className={`flex-1 rounded-md border px-2 py-1 font-semibold ${
                          villageCapReached
                            ? "cursor-not-allowed border-white/20 bg-white/5 text-slate-500"
                            : buildMode === "outpost"
                            ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                            : "border-white/20 bg-white/5 text-slate-200"
                        }`}
                      >
                        Entreposto
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuildMode("road")}
                        className={`flex-1 rounded-md border px-2 py-1 font-semibold ${
                          buildMode === "road"
                            ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                            : "border-white/20 bg-white/5 text-slate-200"
                        }`}
                      >
                        Estrada
                      </button>
                    </div>
                    <p>Materiais: {buildCost.materials.toLocaleString("pt-BR")}</p>
                    <p>Tempo de obra: {formatMinutesLabel(buildCost.buildMinutes)}</p>
                    {buildMode === "outpost" ? (
                      <p className="mt-1 text-slate-300">
                        Cidade nova nasce como Colonia. Em vazio duro ou ruina instavel ela entra zerada; em terreno especial pode ja vir com classe travada pelo mapa.
                      </p>
                    ) : null}
                    {!canAffordBuild ? <p className="mt-1 text-amber-200">Recursos atuais insuficientes.</p> : null}
                    {villageCapReached ? (
                      <p className="mt-1 text-amber-100">Cap de cidades atingido: {ownVillageCount}/{PLAYER_VILLAGE_CAP}. Entreposto bloqueado.</p>
                    ) : (
                      <p className="mt-1 text-slate-300">Cidades ativas: {ownVillageCount}/{PLAYER_VILLAGE_CAP}. Vazio duro, hotspot, cidade abandonada e ruina instavel entram em loops diferentes.</p>
                    )}
                  </div>
                ) : null}

                {actionStep === "configure" && activeAction === "explore" ? (
                  <div
                    className="mt-2 overflow-hidden rounded-2xl border border-cyan-200/25 bg-slate-950/88 text-[11px] text-slate-100"
                    style={{
                      backgroundImage: "linear-gradient(180deg, rgba(2,6,23,0.16), rgba(2,6,23,0.82)), url('/images/military-explore.jpg')",
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  >
                    <div className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
                        Exploração
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        Revelar esta área
                      </p>
                      <p className="mt-1 max-w-[28ch] text-[11px] leading-4 text-slate-200">
                        A exploração abre o terreno, registra risco e pode encontrar cidade vazia, ruína, ameaça ou oportunidade em qualquer ponto da rota.
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] font-bold text-slate-100">
                        <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-2">
                          Explorar área: consome suprimentos, leva tempo e pode revelar acontecimentos em qualquer tile atravessado.
                        </div>
                        <div className="rounded-xl border border-rose-300/35 bg-rose-500/12 px-2.5 py-2">
                          Operação militar (usa tropas do Império): compromete tropas até chegada.
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                        <div className="rounded-xl border border-white/15 bg-black/30 px-2 py-2">
                          <span className="block text-slate-400">SUPRIMENTOS</span>
                          <span className="mt-1 block text-white">{exploreCost.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-black/30 px-2 py-2">
                          <span className="block text-slate-400">ETA</span>
                          <span className="mt-1 block text-white">{formatMinutesLabel(Math.max(5, Math.round(routeSummary.totalMinutes * 0.45)))}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmExploration}
                          disabled={submittingExploration || imperialState.resources.supplies < exploreCost || visitedCoordKeys.has(selectedTile.coordKey)}
                          className="w-full rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-3 py-2 text-center text-xs font-black text-cyan-50 transition hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submittingExploration ? "Explorando..." : "Explorar área"}
                        </button>
                        <button
                          type="button"
                          onClick={handleStartMilitaryOperation}
                          disabled={!militaryActionOption || !militaryActionOption.enabled}
                          className="w-full rounded-xl border border-rose-300/60 bg-rose-500/20 px-3 py-2 text-center text-xs font-black text-rose-50 transition hover:bg-rose-500/28 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Operação militar (usa tropas do Império)
                        </button>
                        {militaryActionOption && !militaryActionOption.enabled && militaryActionOption.reason ? (
                          <p className="text-[10px] font-semibold text-rose-100">
                            Bloqueio militar: {militaryActionOption.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {actionStep === "configure" && movementDraft ? (
                  <div className="mt-2 rounded-lg border border-cyan-200/40 bg-slate-950/88 p-2 text-[11px] text-slate-100">
                    <p className="font-semibold text-cyan-100">Painel de Marcha</p>
                    <p>Rota: {routeSummary.hexCount} hex - {routeSummary.roadSegments} estrada - {routeSummary.offroadSegments} mato</p>
                    <p>ETA total: {formatMinutesLabel(movementDraft.etaMinutes)}</p>
                    <p className="text-[10px] text-slate-300">
                      Passos: {Math.max(0, movementDraft.routeSteps.length - 1)} tiles, resolvidos um por um durante a marcha.
                    </p>
                    {movementDraft.action === "go" && selectedFriendlySite ? (
                      <p className="text-[10px] text-cyan-100">Rota interna de apoio/doacao ativa: velocidade x{INTERNAL_AID_SPEED_MULT}.</p>
                    ) : null}

                                        {movementDraft.action === "go" || movementDraft.action === "attack" ? (
                      <div className="mt-1 rounded-lg border border-white/20 bg-white/8 p-1.5">
                        <p className="text-[10px] font-semibold text-slate-200">Composicao da marcha</p>

                        {movementDraft.action === "attack" ? (
                          <p className="mt-1 text-[10px] text-amber-100">
                            Ataque: escolha manualmente quantas unidades de cada tipo vao na ofensiva. Se vencer, a cidade ocupada passa a ser sua.
                          </p>
                        ) : (
                          <div className="mt-1 flex gap-1">
                            {([
                              { id: "light", label: "Leve" },
                              { id: "balanced", label: "Media" },
                              { id: "heavy", label: "Pesada" },
                            ] as const).map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => setDispatchFromPreset(preset.id)}
                                className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold ${
                                  troopPreset === preset.id
                                    ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                                    : "border-white/20 bg-white/5 text-slate-200"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {movementDraft.action === "attack" ? (
                          <div className="mt-1 flex gap-1">
                            {([
                              { id: "light", label: "25%" },
                              { id: "balanced", label: "52%" },
                              { id: "heavy", label: "78%" },
                            ] as const).map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => setDispatchFromPreset(preset.id)}
                                className="flex-1 rounded-md border border-white/20 bg-white/5 px-1.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-1 space-y-1">
                          {TROOP_ORDER.map((troopId) => {
                            const label = TROOP_LABELS[troopId];
                            const total = troopPool[troopId];
                            const sent = troopDispatch[troopId];
                            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                            const step = Math.max(1, Math.ceil(total * 0.05));
                            return (
                              <div key={troopId} className="rounded-md border border-white/15 bg-slate-950/88 p-1">
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  <span className="font-semibold text-slate-100">{label.short} {label.label}</span>
                                  <span className="text-slate-300">{sent.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")}</span>
                                </div>

                                {movementDraft.action === "attack" ? (
                                  <div className="mt-0.5 flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => adjustTroopDispatch(troopId, -step)}
                                      className="rounded border border-white/25 bg-white/10 p-0.5 text-slate-100 hover:bg-white/20"
                                      aria-label={`Reduzir ${label.label}`}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={total}
                                      value={sent}
                                      onChange={(event) => {
                                        const parsed = Number.parseInt(event.target.value, 10);
                                        const safeValue = Number.isFinite(parsed) ? parsed : 0;
                                        setTroopDispatchValue(troopId, safeValue);
                                      }}
                                      className="w-16 rounded border border-white/25 bg-white/10 px-1 py-0.5 text-[10px] font-semibold text-slate-100"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => adjustTroopDispatch(troopId, step)}
                                      className="rounded border border-white/25 bg-white/10 p-0.5 text-slate-100 hover:bg-white/20"
                                      aria-label={`Aumentar ${label.label}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                    <span className="ml-auto text-[10px] text-slate-300">Max {total.toLocaleString("pt-BR")}</span>
                                  </div>
                                ) : (
                                  <div className="mt-0.5 h-1 overflow-hidden rounded-full border border-white/15 bg-slate-900/60">
                                    <div className="h-full bg-cyan-400/90" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <p className="mt-1 text-[10px] text-cyan-100">
                          Total enviado: {troopDispatchTotal.toLocaleString("pt-BR")} · Qualidade: {troopDispatchQuality.toLocaleString("pt-BR")}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-300">
                          Pool livre na Capital: {troopSelectionTotal(troopPool).toLocaleString("pt-BR")} · Em marcha: {troopSelectionTotal(troopCommitted).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ) : null}
                    {routeSummary.toCapital && routeSummary.phase4SlowdownMult > 1 ? (
                      <p className="text-[10px] text-amber-100">
                        Mobilizacao Livre aplicada: velocidade reduzida em x{routeSummary.phase4SlowdownMult}.
                      </p>
                    ) : null}
                    {movementDraft.action === "annex" ? (
                      <div className="mt-1 rounded-lg border border-white/20 bg-white/8 p-1.5">
                        <p className="text-[10px] font-semibold text-slate-200">Diplomata da missao</p>
                        <select
                          value={selectedAnnexDiplomatToken}
                          onChange={(event) => setSelectedAnnexDiplomatToken(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-slate-100"
                        >
                          <option value="">Escolher diplomata</option>
                          {availableAnnexDiplomatTokens.map((token) => (
                            <option key={token} value={token}>
                              {token}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {movementDraft.action === "annex" ? (
                      <p className="text-[10px] text-cyan-100">
                        Anexar usa 1 diplomata recrutado do pool das Colonias. Hoje: {colonyDiplomacy.recruited} contratados, {colonyDiplomacy.free} livres e {colonyDiplomacy.annexCommitted} em missao.
                      </p>
                    ) : null}
                    {movementDraft.to.q === 0 && movementDraft.to.r === 0 ? (
                      <p className="mt-1 text-[10px] text-amber-100">
                        A expedicao falhara ao chegar se sua Influencia cair abaixo de {SOVEREIGNTY_PORTAL_CUT} durante a marcha.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleConfirmMovement}
                      disabled={submittingMovement || ((movementDraft.action === "go" || movementDraft.action === "attack") && troopDispatchTotal <= 0)}
                      className="mt-2 w-full rounded-lg border border-cyan-300/70 bg-cyan-500/25 px-2 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-cyan-500/35 disabled:cursor-wait disabled:opacity-60"
                    >
                      {submittingMovement ? "Registrando..." : "Confirmar"}
                    </button>
                  </div>
                ) : null}

                {currentDay <= 0 ? (
                  <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/12 p-2 text-[10px] text-amber-50">
                    <p className="font-semibold uppercase tracking-[0.14em]">Modo de teste · Dia 0</p>
                    <p className="mt-1 text-amber-100/90">
                      Antes do início oficial, ações podem estar liberadas para validação de fluxo. No mundo ao vivo, o ritmo segue a fase/dia da temporada.
                    </p>
                  </div>
                ) : null}
                {movementMessage ? (
                  <div className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/12 p-2 text-[10px] font-semibold text-cyan-100">
                    {movementMessage}
                  </div>
                ) : null}
                {latestBattleMovement?.meta.combatResult ? (
                  <div className="mt-2 rounded-lg border border-rose-300/25 bg-rose-500/10 p-2 text-[10px] text-rose-50">
                    <p className="font-semibold uppercase tracking-[0.14em] text-rose-100">Report de Batalha</p>
                    <p className="mt-1 font-semibold text-rose-50">{latestBattleMovement.meta.combatResult.battleReport.headline}</p>
                    <p className="mt-1 text-rose-100/90">{latestBattleMovement.meta.combatResult.battleReport.summary}</p>
                    <p className="mt-1 text-rose-100/80">
                      Dano defensor {latestBattleMovement.meta.combatResult.leitura.danoDefensorPct}% ·
                      Dano atacante {latestBattleMovement.meta.combatResult.leitura.danoAtacantePct}% ·
                      SM +{latestBattleMovement.meta.combatResult.scoreMilitarAtacanteFinal}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </aside>

          {explorationReveal ? (
            <ExplorationRevealModal discovery={explorationReveal} onDismiss={dismissExplorationReveal} />
          ) : null}
        </div>

      </article>
    </section>
  );
}


