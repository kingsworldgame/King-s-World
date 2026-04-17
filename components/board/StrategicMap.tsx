"use client";

import { Compass, Minus, Plus, RotateCcw } from "lucide-react";
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
  type HexLayout,
  type PixelPoint,
} from "@/lib/hex-grid";
import {
  CITY_DIPLOMAT_UNLOCK_DEVELOPMENT,
  MAX_CITY_DIPLOMATS,
  SOVEREIGNTY_PORTAL_CUT,
  calculateMapConstructionCost,
  calculateMarchTimeMinutes,
  calculateSovereigntyScore,
  calculateTribeProgressStage,
  calculateSpyOperationCost,
  calculateVillageDevelopment,
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
import { useImperialState } from "@/lib/imperial-state";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";
import { getDefaultBuildingLevels, getZeroBuildingLevels } from "@/lib/buildings";
import type { BoardSite } from "@/lib/mock-data";
import type { VillageSummary } from "@/lib/mock-data";
import {
  CORE_RING_LIMIT,
  MID_RING_LIMIT,
  WORLD_HEX_RADIUS,
  WORLD_HEX_TILE_COUNT,
  WORLD_HEX_TILE_SIZE_PX,
} from "@/lib/world-map-config";

type Faction = "self" | "tribe" | "ally" | "enemy" | "abandoned" | "neutral";
type RelationFilter = "all" | "self" | "tribe" | "ally" | "enemy" | "abandoned";
type MapZone = "outer" | "mid" | "core";
type DistrictId = "A" | "B" | "C" | "D" | "E" | "F";
type HotspotKind = "oasis" | "ruins" | "rare_mine";

type MapSite = BoardSite & {
  id: string;
  q: number;
  r: number;
  coordKey: string;
  faction: Faction;
  occupationKind?: CityOriginKind;
  terrainKind?: TerrainKind;
  terrainLabel?: string;
  recommendedCityClass?: CityClass;
};

type WorldHexTile = {
  q: number;
  r: number;
  coordKey: string;
  distance: number;
  zone: MapZone;
  district: DistrictId;
  terrainKind: TerrainKind;
  isCentralThrone: boolean;
  center: PixelPoint;
  points: string;
};

type DistrictLabel = {
  district: DistrictId;
  x: number;
  y: number;
};

type FrontierLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ScenicDecoration = {
  key: string;
  d: string;
  fill: string;
  opacity: number;
};

type Hotspot = {
  id: string;
  q: number;
  r: number;
  coordKey: string;
  district: DistrictId;
  kind: HotspotKind;
  name: string;
  terrainBonus: TerrainModifiers;
};

type FactionInfluenceOverlay = {
  coordKey: string;
  points: string;
  faction: Faction;
  strength: number;
};

type BuiltWorld = {
  width: number;
  height: number;
  layout: HexLayout;
  tiles: WorldHexTile[];
  centerByKey: Map<string, PixelPoint>;
  districtLabels: DistrictLabel[];
  frontierLines: FrontierLine[];
  centerPoint: PixelPoint;
};

type StrategicMapProps = {
  worldId: string;
  tribeName: string;
  sites: BoardSite[];
  villages: Pick<VillageSummary, "id" | "name" | "type" | "materials" | "supplies" | "energy" | "influence" | "buildingLevels">[];
  currentDay: number;
  sovereigntyScore: number;
};

type TileActionKind = "inspect" | "build" | "go" | "attack" | "annex" | "spy";

type ActionStep = "choose" | "configure";

type TileActionOption = {
  kind: TileActionKind;
  label: string;
  enabled: boolean;
  reason?: string;
};

function describeTileAction(kind: TileActionKind): string {
  if (kind === "build") return "Funda rota ou cidade";
  if (kind === "go") return "Marcha, apoio ou portal";
  if (kind === "attack") return "Tomada por combate";
  if (kind === "annex") return "Posse diplomatica";
  if (kind === "spy") return "Leitura do alvo";
  return "Leitura do hex";
}

function actionTone(kind: TileActionKind): string {
  if (kind === "attack") return "border-rose-300/45 bg-rose-500/12 text-rose-100";
  if (kind === "annex") return "border-cyan-300/45 bg-cyan-500/12 text-cyan-100";
  if (kind === "build") return "border-emerald-300/45 bg-emerald-500/12 text-emerald-100";
  if (kind === "go") return "border-amber-300/45 bg-amber-500/12 text-amber-100";
  if (kind === "spy") return "border-violet-300/45 bg-violet-500/12 text-violet-100";
  return "border-white/20 bg-white/8 text-slate-100";
}

function relationFilterLabel(filter: RelationFilter): string {
  if (filter === "all") return "Tudo";
  if (filter === "self") return "So eu";
  if (filter === "tribe") return "Tribo";
  if (filter === "ally") return "Aliados";
  if (filter === "enemy") return "Inimigos";
  return "Abandonadas";
}

function relationFilterTone(filter: RelationFilter, active: boolean): string {
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

type TroopTypeId = "militia" | "shooters" | "scouts" | "machinery";

type TroopSelection = Record<TroopTypeId, number>;

type TroopPreset = "light" | "balanced" | "heavy" | "custom";

type MovementDraft = {
  action: Exclude<TileActionKind, "inspect">;
  from: AxialCoord;
  to: AxialCoord;
  etaMinutes: number;
  route: AxialCoord[];
};

const ZERO_AXIAL: AxialCoord = { q: 0, r: 0 };
const ZOOM_MIN = 0.42;
const ZOOM_MAX = 5;
const DEFAULT_WORLD_ZOOM = 1;
const ZOOM_STEP = 0.2;
const DETAIL_ZOOM_THRESHOLD = 3;
const DETAIL_RING_LIMIT = MID_RING_LIMIT - 1;
const HOTSPOT_TARGET = 30;
const PHASE4_REGROUP_SPEED_MULT = 5;
const INTERNAL_AID_SPEED_MULT = 5;
const THRONE_TOOLTIP = "Trono de Kingsworld - acesso condicionado a Influencia minima de 1500";
const PLAYER_VILLAGE_CAP = 10;

const DISTRICT_IDS: DistrictId[] = ["A", "B", "C", "D", "E", "F"];

const TROOP_ORDER: TroopTypeId[] = ["militia", "shooters", "scouts", "machinery"];

const TROOP_LABELS: Record<TroopTypeId, { label: string; short: string; qualityWeight: number }> = {
  militia: { label: "Milicia", short: "MI", qualityWeight: 1 },
  shooters: { label: "Atiradores", short: "AT", qualityWeight: 1.4 },
  scouts: { label: "Batedores", short: "BD", qualityWeight: 1.8 },
  machinery: { label: "Maquinaria", short: "MQ", qualityWeight: 2.8 },
};

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

function sameTroopSelection(a: TroopSelection, b: TroopSelection): boolean {
  return a.militia === b.militia && a.shooters === b.shooters && a.scouts === b.scouts && a.machinery === b.machinery;
}


const TILE_STYLE_BY_ZONE: Record<MapZone, { fill: string; stroke: string }> = {
  outer: {
    fill: "rgba(15, 23, 42, 0.32)",
    stroke: "rgba(148, 163, 184, 0.22)",
  },
  mid: {
    fill: "rgba(30, 41, 59, 0.34)",
    stroke: "rgba(125, 211, 252, 0.24)",
  },
  core: {
    fill: "rgba(56, 189, 248, 0.16)",
    stroke: "rgba(186, 230, 253, 0.36)",
  },
};

const DISTRICT_META: Record<DistrictId, { tint: string; badge: string }> = {
  A: { tint: "rgba(56, 189, 248, 0.05)", badge: "border-cyan-300/55 bg-cyan-400/15 text-cyan-100" },
  B: { tint: "rgba(52, 211, 153, 0.05)", badge: "border-emerald-300/55 bg-emerald-400/15 text-emerald-100" },
  C: { tint: "rgba(147, 197, 253, 0.05)", badge: "border-blue-300/55 bg-blue-400/15 text-blue-100" },
  D: { tint: "rgba(196, 181, 253, 0.05)", badge: "border-violet-300/55 bg-violet-400/15 text-violet-100" },
  E: { tint: "rgba(251, 191, 36, 0.05)", badge: "border-amber-300/55 bg-amber-400/15 text-amber-100" },
  F: { tint: "rgba(244, 114, 182, 0.05)", badge: "border-pink-300/55 bg-pink-400/15 text-pink-100" },
};

const HOTSPOT_META: Record<HotspotKind, { icon: string; label: string; chipClass: string }> = {
  oasis: { icon: "O", label: "Oasis", chipClass: "border-cyan-300/80 bg-cyan-500/30 text-cyan-100" },
  ruins: { icon: "R", label: "Ruinas", chipClass: "border-amber-300/80 bg-amber-500/30 text-amber-100" },
  rare_mine: { icon: "M", label: "Mina Rara", chipClass: "border-emerald-300/80 bg-emerald-500/30 text-emerald-100" },
};

const TERRAIN_VISUAL_META: Record<TerrainKind, { tint: string; badgeClass: string; short: string }> = {
  crown_heartland: {
    tint: "rgba(120, 184, 120, 0.06)",
    badgeClass: "border-slate-200/60 bg-slate-200/10 text-slate-100",
    short: "Metro",
  },
  riverlands: {
    tint: "rgba(66, 153, 104, 0.06)",
    badgeClass: "border-cyan-300/60 bg-cyan-400/10 text-cyan-100",
    short: "Celeiro",
  },
  frontier_pass: {
    tint: "rgba(116, 123, 138, 0.08)",
    badgeClass: "border-amber-300/60 bg-amber-400/10 text-amber-100",
    short: "Posto",
  },
  ironridge: {
    tint: "rgba(98, 107, 124, 0.08)",
    badgeClass: "border-rose-300/60 bg-rose-400/10 text-rose-100",
    short: "Bastiao",
  },
  ashen_fields: {
    tint: "rgba(106, 138, 96, 0.05)",
    badgeClass: "border-sky-300/45 bg-sky-400/8 text-sky-100",
    short: "Neutra",
  },
};

function scenicTreePath(center: PixelPoint, scale = 1): string {
  const w = WORLD_HEX_TILE_SIZE_PX * 0.92 * scale;
  const h = WORLD_HEX_TILE_SIZE_PX * 1.06 * scale;
  const trunkW = WORLD_HEX_TILE_SIZE_PX * 0.18 * scale;
  const trunkH = WORLD_HEX_TILE_SIZE_PX * 0.28 * scale;
  const topY = center.y - h * 0.62;
  const midY = center.y - h * 0.12;
  const baseY = center.y + h * 0.34;
  const trunkTopY = center.y + h * 0.16;
  const trunkBottomY = trunkTopY + trunkH;

  return [
    `M ${center.x.toFixed(2)} ${topY.toFixed(2)}`,
    `L ${(center.x - w * 0.42).toFixed(2)} ${(topY + h * 0.38).toFixed(2)}`,
    `L ${(center.x - w * 0.18).toFixed(2)} ${(midY).toFixed(2)}`,
    `L ${(center.x - w * 0.5).toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${(center.x - trunkW / 2).toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${(center.x - trunkW / 2).toFixed(2)} ${trunkBottomY.toFixed(2)}`,
    `L ${(center.x + trunkW / 2).toFixed(2)} ${trunkBottomY.toFixed(2)}`,
    `L ${(center.x + trunkW / 2).toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${(center.x + w * 0.5).toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${(center.x + w * 0.18).toFixed(2)} ${midY.toFixed(2)}`,
    `L ${(center.x + w * 0.42).toFixed(2)} ${(topY + h * 0.38).toFixed(2)}`,
    "Z",
    `M ${(center.x - trunkW / 2).toFixed(2)} ${trunkTopY.toFixed(2)}`,
    `L ${(center.x + trunkW / 2).toFixed(2)} ${trunkTopY.toFixed(2)}`,
    `L ${(center.x + trunkW / 2).toFixed(2)} ${trunkBottomY.toFixed(2)}`,
    `L ${(center.x - trunkW / 2).toFixed(2)} ${trunkBottomY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function scenicMountainPath(center: PixelPoint, scale = 1): string {
  const w = WORLD_HEX_TILE_SIZE_PX * 1.2 * scale;
  const h = WORLD_HEX_TILE_SIZE_PX * 0.96 * scale;
  const leftX = center.x - w * 0.62;
  const rightX = center.x + w * 0.62;
  const baseY = center.y + h * 0.42;
  const saddleY = center.y - h * 0.04;
  const leftPeakX = center.x - w * 0.2;
  const rightPeakX = center.x + w * 0.3;
  const leftPeakY = center.y - h * 0.82;
  const rightPeakY = center.y - h * 0.68;

  return [
    `M ${leftX.toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${leftPeakX.toFixed(2)} ${leftPeakY.toFixed(2)}`,
    `L ${center.x.toFixed(2)} ${saddleY.toFixed(2)}`,
    `L ${rightPeakX.toFixed(2)} ${rightPeakY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${baseY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function scenicForestBandPath(center: PixelPoint, scale = 1): string {
  const w = WORLD_HEX_TILE_SIZE_PX * 1.28 * scale;
  const h = WORLD_HEX_TILE_SIZE_PX * 0.88 * scale;
  const leftX = center.x - w * 0.52;
  const rightX = center.x + w * 0.52;
  const baseY = center.y + h * 0.42;

  return [
    `M ${leftX.toFixed(2)} ${baseY.toFixed(2)}`,
    `L ${(center.x - w * 0.26).toFixed(2)} ${(center.y - h * 0.44).toFixed(2)}`,
    `L ${(center.x - w * 0.08).toFixed(2)} ${(center.y + h * 0.08).toFixed(2)}`,
    `L ${center.x.toFixed(2)} ${(center.y - h * 0.62).toFixed(2)}`,
    `L ${(center.x + w * 0.12).toFixed(2)} ${(center.y + h * 0.04).toFixed(2)}`,
    `L ${(center.x + w * 0.3).toFixed(2)} ${(center.y - h * 0.38).toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${baseY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function buildScenicDecoration(tile: WorldHexTile): ScenicDecoration | null {
  const scenicSeed = hashSeed(`scenic:${tile.coordKey}`);
  const center = tile.center;

  if (tile.terrainKind === "ironridge" || tile.terrainKind === "frontier_pass") {
    if (scenicSeed % 100 >= 58) {
      return null;
    }

    return {
      key: `scenic-${tile.coordKey}`,
      d: scenicMountainPath(
        {
          x: center.x + ((scenicSeed % 7) - 3) * 0.4,
          y: center.y + ((Math.floor(scenicSeed / 7) % 7) - 3) * 0.25,
        },
        1 + (scenicSeed % 3) * 0.08,
      ),
      fill: tile.terrainKind === "ironridge" ? "rgba(220,226,235,0.72)" : "rgba(202,210,222,0.68)",
      opacity: 1,
    };
  }

  if (scenicSeed % 100 >= 34) {
    return null;
  }

  const forestScale = tile.terrainKind === "riverlands" ? 1.06 : tile.terrainKind === "crown_heartland" ? 1 : 0.94;
  const forestPath = scenicSeed % 2 === 0 ? scenicForestBandPath(center, forestScale) : scenicTreePath(center, forestScale);

  return {
    key: `scenic-${tile.coordKey}`,
    d: forestPath,
    fill: tile.terrainKind === "riverlands" ? "rgba(46,126,87,0.76)" : "rgba(58,118,72,0.74)",
    opacity: 1,
  };
}

function parseLegacyCoord(coord: string): AxialCoord {
  const normalized = coord.includes(":") ? coord : coord.replace(",", ":");
  const [sq, sr] = normalized.split(":");
  const q = Number.parseInt(sq ?? "", 10);
  const r = Number.parseInt(sr ?? "", 10);
  if (Number.isNaN(q) || Number.isNaN(r)) {
    return { q: 0, r: 0 };
  }
  return { q, r };
}

function formatLegacyCoord(coord: AxialCoord): string {
  return `${String(coord.q).padStart(2, "0")}:${String(coord.r).padStart(2, "0")}`;
}

function zoneForDistance(distance: number): MapZone {
  if (distance <= CORE_RING_LIMIT) {
    return "core";
  }
  if (distance <= MID_RING_LIMIT) {
    return "mid";
  }
  return "outer";
}

function districtForCoord(coord: AxialCoord): DistrictId {
  if (coord.q === 0 && coord.r === 0) {
    return "A";
  }

  const x = Math.sqrt(3) * (coord.q + coord.r / 2);
  const y = 1.5 * coord.r;
  const angle = Math.atan2(y, x);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
  const sector = Math.floor(normalized / (Math.PI / 3)) % 6;
  return DISTRICT_IDS[sector] ?? "A";
}

function clampAxialToRadius(coord: AxialCoord): AxialCoord {
  const distance = axialDistance(coord, ZERO_AXIAL);
  if (distance <= WORLD_HEX_RADIUS) {
    return coord;
  }

  const factor = WORLD_HEX_RADIUS / Math.max(1, distance);
  return axialRound({
    q: coord.q * factor,
    r: coord.r * factor,
  });
}

function normalizeAxial(site: BoardSite): AxialCoord {
  const raw = site.axial && Number.isFinite(site.axial.q) && Number.isFinite(site.axial.r)
    ? { q: site.axial.q, r: site.axial.r }
    : parseLegacyCoord(site.coord);

  return clampAxialToRadius(raw);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function classifyFaction(site: BoardSite, tribeName: string): Faction {
  if (site.relation === "Proprio") {
    return "self";
  }
  if (site.owner === tribeName) {
    return "tribe";
  }
  if (site.relation === "Aliado") {
    return "ally";
  }
  if (site.relation === "Inimigo") {
    return "enemy";
  }

  if (site.occupationKind === "abandoned_city") {
    return "abandoned";
  }

  if (site.occupationKind === "frontier_ruins" || site.occupationKind === "wild_empty" || site.occupationKind === "hotspot") {
    return "neutral";
  }

  const hint = `${site.type} ${site.state} ${site.owner}`.toLowerCase();
  if (hint.includes("aband") || hint.includes("devast") || hint.includes("ruina") || site.owner === "Neutro") {
    return "abandoned";
  }

  return "neutral";
}

function terrainKindForDistrict(district: DistrictId, roll: number): TerrainKind {
  switch (district) {
    case "A":
      return roll % 3 === 0 ? "riverlands" : "crown_heartland";
    case "B":
      return roll % 2 === 0 ? "riverlands" : "crown_heartland";
    case "C":
      return roll % 3 === 0 ? "ashen_fields" : "frontier_pass";
    case "D":
      return roll % 4 === 0 ? "riverlands" : "ironridge";
    case "E":
      return roll % 3 === 0 ? "ashen_fields" : "ironridge";
    default:
      return roll % 2 === 0 ? "frontier_pass" : "ashen_fields";
  }
}

function terrainKindForCoord(coord: AxialCoord): TerrainKind {
  const district = districtForCoord(coord);
  const seed = hashSeed(`terrain:${coord.q},${coord.r}`);
  return terrainKindForDistrict(district, seed);
}

function occupationKindForRoll(roll: number): CityOriginKind {
  if (roll < 28) {
    return "abandoned_city";
  }
  if (roll < 62) {
    return "frontier_ruins";
  }
  return "wild_empty";
}

function buildHexWorld(): BuiltWorld {
  const coords: AxialCoord[] = [];
  for (let q = -WORLD_HEX_RADIUS; q <= WORLD_HEX_RADIUS; q += 1) {
    const rMin = Math.max(-WORLD_HEX_RADIUS, -q - WORLD_HEX_RADIUS);
    const rMax = Math.min(WORLD_HEX_RADIUS, -q + WORLD_HEX_RADIUS);
    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }

  const baseLayout = {
    orientation: "pointy" as const,
    size: WORLD_HEX_TILE_SIZE_PX,
    origin: { x: 0, y: 0 },
  };

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const coord of coords) {
    const center = axialToPixel(coord, baseLayout);
    minX = Math.min(minX, center.x - WORLD_HEX_TILE_SIZE_PX);
    maxX = Math.max(maxX, center.x + WORLD_HEX_TILE_SIZE_PX);
    minY = Math.min(minY, center.y - WORLD_HEX_TILE_SIZE_PX);
    maxY = Math.max(maxY, center.y + WORLD_HEX_TILE_SIZE_PX);
  }

  const padding = WORLD_HEX_TILE_SIZE_PX * 2;
  const shiftedLayout = {
    orientation: "pointy" as const,
    size: WORLD_HEX_TILE_SIZE_PX,
    origin: {
      x: padding - minX,
      y: padding - minY,
    },
  };

  const tiles: WorldHexTile[] = [];
  const centerByKey = new Map<string, PixelPoint>();

  for (const coord of coords) {
    const center = axialToPixel(coord, shiftedLayout);
    const corners = hexCorners(coord, shiftedLayout);
    const points = corners.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    const distance = axialDistance(coord, ZERO_AXIAL);
    const zone = zoneForDistance(distance);
    const district = districtForCoord(coord);
    const terrainKind = terrainKindForCoord(coord);
    const coordKey = axialKey(coord);

    tiles.push({
      q: coord.q,
      r: coord.r,
      coordKey,
      distance,
      zone,
      district,
      terrainKind,
      isCentralThrone: distance <= 1,
      center,
      points,
    });

    centerByKey.set(coordKey, center);
  }

  const tileByKey = new Map(tiles.map((tile) => [tile.coordKey, tile] as const));
  const frontierLines: FrontierLine[] = [];

  for (const tile of tiles) {
    for (let direction = 0; direction < 6; direction += 1) {
      const neighborCoord = axialNeighbor({ q: tile.q, r: tile.r }, direction);
      const neighbor = tileByKey.get(axialKey(neighborCoord));
      if (!neighbor || neighbor.district === tile.district) {
        continue;
      }
      if (tile.coordKey > neighbor.coordKey) {
        continue;
      }

      frontierLines.push({
        id: `${tile.coordKey}-${neighbor.coordKey}`
          + "",
        x1: tile.center.x,
        y1: tile.center.y,
        x2: neighbor.center.x,
        y2: neighbor.center.y,
      });
    }
  }

  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  const centerPoint = centerByKey.get(axialKey(ZERO_AXIAL)) ?? { x: width / 2, y: height / 2 };
  const labelRadius = Math.min(width, height) * 0.34;
  const districtLabels: DistrictLabel[] = DISTRICT_IDS.map((district, index) => {
    const angle = (index + 0.5) * (Math.PI / 3);
    return {
      district,
      x: centerPoint.x + Math.cos(angle) * labelRadius,
      y: centerPoint.y + Math.sin(angle) * labelRadius,
    };
  });

  return {
    width,
    height,
    layout: shiftedLayout,
    tiles,
    centerByKey,
    districtLabels,
    frontierLines,
    centerPoint,
  };
}

function generateAmbientSites(worldId: string, existing: Set<string>): MapSite[] {
  const generated: MapSite[] = [];
  let seed = hashSeed(worldId);

  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };

  const target = 42;
  let guard = 0;

  while (generated.length < target && guard < 20000) {
    guard += 1;

    const q = (nextRand() % (WORLD_HEX_RADIUS * 2 + 1)) - WORLD_HEX_RADIUS;
    const r = (nextRand() % (WORLD_HEX_RADIUS * 2 + 1)) - WORLD_HEX_RADIUS;

    if (axialDistance({ q, r }, ZERO_AXIAL) > WORLD_HEX_RADIUS) {
      continue;
    }

    const coordKey = axialKey({ q, r });
    if (existing.has(coordKey)) {
      continue;
    }
    existing.add(coordKey);

    const terrainKind = terrainKindForCoord({ q, r });
    const terrainMeta = TERRAIN_META[terrainKind];
    const occupationKind = occupationKindForRoll(nextRand() % 100);
    const index = generated.length + 1;
    if (occupationKind === "wild_empty") {
      continue;
    }

    const abandoned = occupationKind === "abandoned_city";

    generated.push({
      id: `ambient-${index}`,
      name: abandoned ? `Cidade Ruinosa ${index}` : `Fundacao Instavel ${index}`,
      owner: "Neutro",
      type: abandoned ? "Cidade" : "Colonia",
      relation: "Neutro",
      occupationKind,
      terrainKind,
      terrainLabel: terrainMeta.label,
      recommendedCityClass: abandoned ? "neutral" : terrainMeta.recommendedCityClass,
      coord: formatLegacyCoord({ q, r }),
      axial: { q, r },
      state: abandoned ? "Cidade abandonada com muralhas antigas" : "Ruinas leves prontas para estabilizacao",
      q,
      r,
      coordKey,
      faction: abandoned ? "abandoned" : "neutral",
    });
  }

  return generated;
}

function terrainBonusForKind(kind: HotspotKind): TerrainModifiers {
  if (kind === "oasis") {
    return {
      terrainProductionMultiplier: 1.08,
      terrainMovementMultiplier: 1.06,
    };
  }
  if (kind === "ruins") {
    return {
      terrainCombatMultiplier: 1.08,
      terrainCostMultiplier: 0.96,
    };
  }
  return {
    terrainProductionMultiplier: 1.12,
    terrainCostMultiplier: 0.94,
  };
}

function generateHotspots(worldId: string, world: BuiltWorld): Hotspot[] {
  let seed = hashSeed(`${worldId}:hotspots:v1`);
  const nextRand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed;
  };

  const candidates = world.tiles.filter((tile) => !tile.isCentralThrone && tile.distance > 3);
  const byDistrict = new Map<DistrictId, WorldHexTile[]>();
  for (const district of DISTRICT_IDS) {
    byDistrict.set(district, candidates.filter((tile) => tile.district === district));
  }

  const selectedKeys = new Set<string>();
  const hotspots: Hotspot[] = [];
  const requiredByDistrict = Math.floor(HOTSPOT_TARGET / DISTRICT_IDS.length);

  const pickKind = (): HotspotKind => {
    const roll = nextRand() % 3;
    if (roll === 0) return "oasis";
    if (roll === 1) return "ruins";
    return "rare_mine";
  };

  const makeHotspot = (tile: WorldHexTile, index: number): Hotspot => {
    const kind = pickKind();
    const label = HOTSPOT_META[kind].label;
    return {
      id: `hotspot-${index}-${tile.coordKey}`
        + "",
      q: tile.q,
      r: tile.r,
      coordKey: tile.coordKey,
      district: tile.district,
      kind,
      name: `${label} ${index + 1}`
        + "",
      terrainBonus: terrainBonusForKind(kind),
    };
  };

  let serial = 0;

  for (const district of DISTRICT_IDS) {
    const pool = [...(byDistrict.get(district) ?? [])];
    let guard = 0;
    while (pool.length && guard < 800 && hotspots.length < HOTSPOT_TARGET) {
      guard += 1;
      if (hotspots.filter((entry) => entry.district === district).length >= requiredByDistrict) {
        break;
      }

      const idx = nextRand() % pool.length;
      const tile = pool.splice(idx, 1)[0];
      if (!tile || selectedKeys.has(tile.coordKey)) {
        continue;
      }

      selectedKeys.add(tile.coordKey);
      hotspots.push(makeHotspot(tile, serial));
      serial += 1;
    }
  }

  const leftovers = candidates.filter((tile) => !selectedKeys.has(tile.coordKey));
  while (hotspots.length < HOTSPOT_TARGET && leftovers.length) {
    const idx = nextRand() % leftovers.length;
    const tile = leftovers.splice(idx, 1)[0];
    if (!tile) {
      continue;
    }
    selectedKeys.add(tile.coordKey);
    hotspots.push(makeHotspot(tile, serial));
    serial += 1;
  }

  return hotspots;
}

function markerBorderClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "border-yellow-300/95";
    case "tribe":
      return "border-rose-300/95";
    case "ally":
      return "border-violet-300/95";
    case "enemy":
      return "border-emerald-300/95";
    case "abandoned":
      return "border-amber-300/95";
    default:
      return "border-sky-300/90";
  }
}

function markerFillClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "bg-yellow-300";
    case "tribe":
      return "bg-rose-400";
    case "ally":
      return "bg-violet-400";
    case "enemy":
      return "bg-emerald-400";
    case "abandoned":
      return "bg-amber-400";
    default:
      return "bg-sky-400";
  }
}

function labelClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "border-yellow-300/80 bg-yellow-400/20 text-yellow-50";
    case "tribe":
      return "border-rose-300/80 bg-rose-500/20 text-rose-100";
    case "ally":
      return "border-violet-300/80 bg-violet-500/20 text-violet-100";
    case "enemy":
      return "border-emerald-300/80 bg-emerald-500/20 text-emerald-100";
    case "abandoned":
      return "border-amber-300/80 bg-amber-500/20 text-amber-100";
    default:
      return "border-sky-300/70 bg-sky-500/20 text-sky-100";
  }
}

function markerGlowStyle(faction: Faction, selected: boolean, muted: boolean): CSSProperties {
  const blur = selected ? 18 : 12;
  const spread = selected ? 6 : 2;
  const opacity = muted ? 0.16 : selected ? 0.92 : 0.6;

  const color =
    faction === "self"
      ? `rgba(253, 224, 71, ${opacity})`
      : faction === "tribe"
        ? `rgba(251, 113, 133, ${opacity})`
        : faction === "ally"
          ? `rgba(167, 139, 250, ${opacity})`
          : faction === "enemy"
            ? `rgba(74, 222, 128, ${opacity})`
            : faction === "abandoned"
              ? `rgba(251, 191, 36, ${opacity})`
              : `rgba(56, 189, 248, ${opacity})`;

  return {
    boxShadow: `0 0 ${blur}px ${spread}px ${color}`,
  };
}

function factionInfluenceColor(faction: Faction, opacity: number): string {
  if (faction === "self") return `rgba(253, 224, 71, ${opacity})`;
  if (faction === "tribe") return `rgba(251, 113, 133, ${opacity})`;
  if (faction === "ally") return `rgba(167, 139, 250, ${opacity})`;
  if (faction === "enemy") return `rgba(74, 222, 128, ${opacity})`;
  if (faction === "abandoned") return `rgba(251, 191, 36, ${opacity})`;
  return `rgba(56, 189, 248, ${opacity})`;
}

function influenceRadiusForSite(site: MapSite): number {
  if (site.faction === "self") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "tribe") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "ally") return isVillageSite(site) ? 2 : 1;
  if (site.faction === "enemy") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "abandoned") return 1;
  return 1;
}

function influenceWeight(site: MapSite, distance: number): number {
  const base =
    site.faction === "self"
      ? 1.18
      : site.faction === "tribe"
        ? 1.08
        : site.faction === "ally"
          ? 0.96
          : site.faction === "enemy"
            ? 1.02
            : site.faction === "abandoned"
              ? 0.72
              : 0.64;

  const siteBonus =
    site.type.toLowerCase().includes("capital")
      ? 0.28
      : isVillageSite(site)
        ? 0.18
        : 0;

  return Math.max(0.16, base + siteBonus - distance * 0.28);
}

function isVillageSite(site: MapSite): boolean {
  const haystack = `${site.type} ${site.name}`.toLowerCase();
  return (
    haystack.includes("capital") ||
    haystack.includes("colonia") ||
    haystack.includes("aldeia") ||
    haystack.includes("cidade") ||
    haystack.includes("cidadela") ||
    haystack.includes("citadel") ||
    haystack.includes("outpost")
  );
}

function siteMarkerText(site: MapSite): string {
  const typeText = site.type.toLowerCase();
  if (typeText.includes("capital")) return "K";
  if (typeText.includes("cidadela") || typeText.includes("citadel")) return "C";
  if (typeText.includes("ruina") || typeText.includes("ruin")) return "R";
  if (typeText.includes("colonia") || typeText.includes("cidade") || typeText.includes("outpost")) return "V";
  return site.name.slice(0, 1).toUpperCase();
}

function createClaimedVillageName(index: number): string {
  return `Nova Cidade ${index}`;
}

type BuildMode = "outpost" | "road";

type StoredMapMovement = {
  id: string;
  worldId: string;
  sourceCoord: string;
  targetCoord: string;
  movementType: "attack" | "annex" | "support" | "spy" | "transport";
  commandAction: Exclude<TileActionKind, "inspect">;
  launchedAt: string;
  arrivalAt: string;
  etaMinutes: number;
  route: string[];
  status: "traveling" | "arrived" | "failed";
  meta: {
    buildMode: BuildMode | null;
    district: DistrictId;
    settlementOrigin?: CityOriginKind;
    settlementTerrainKind?: TerrainKind;
    settlementTerrainLabel?: string;
    settlementRecommendedClass?: CityClass;
    portalGateRequired?: number;
    sovereigntyAtLaunch?: number;
    regroupMode?: "phase4_free_mobilization";
    troopsSent?: TroopSelection;
    troopsTotal?: number;
    troopsQuality?: number;
    troopPreset?: TroopPreset;
    annexConsumesDiplomat?: boolean;
    diplomatToken?: string;
    targetLabel?: string;
  };
};

const HAS_SPY_HERO = true;

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

function mapActionToMovementType(action: Exclude<TileActionKind, "inspect">): StoredMapMovement["movementType"] {
  if (action === "attack") {
    return "attack";
  }
  if (action === "annex") {
    return "annex";
  }
  if (action === "spy") {
    return "spy";
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

async function registerMapMovement(
  worldId: string,
  draft: MovementDraft,
  meta: StoredMapMovement["meta"],
): Promise<StoredMapMovement> {
  const now = new Date();
  const launchedAt = now.toISOString();
  const arrivalAt = new Date(now.getTime() + draft.etaMinutes * 60_000).toISOString();

  const stored: StoredMapMovement = {
    id: generateMovementId(),
    worldId,
    sourceCoord: axialKey(draft.from),
    targetCoord: axialKey(draft.to),
    movementType: mapActionToMovementType(draft.action),
    commandAction: draft.action,
    launchedAt,
    arrivalAt,
    etaMinutes: draft.etaMinutes,
    route: draft.route.map((coord) => axialKey(coord)),
    status: "traveling",
    meta,
  };

  if (typeof window !== "undefined") {
    try {
      const key = `map_movements:${worldId}`;
      const current = window.localStorage.getItem(key);
      const parsed = current ? (JSON.parse(current) as StoredMapMovement[]) : [];
      parsed.unshift(stored);
      window.localStorage.setItem(key, JSON.stringify(parsed.slice(0, 1200)));
    } catch {
      // Silencioso: sem bloqueio de UX se localStorage indisponivel.
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
  return stored;
}

function readStoredMovements(worldId: string): StoredMapMovement[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const key = `map_movements:${worldId}`;
    const current = window.localStorage.getItem(key);
    return current ? (JSON.parse(current) as StoredMapMovement[]) : [];
  } catch {
    return [];
  }
}

export function StrategicMap({ worldId, tribeName, sites, villages, currentDay: initialDay, sovereigntyScore: initialSovereigntyScore }: StrategicMapProps) {
  const { world: liveWorld } = useLiveWorld(worldId);
  const currentDay = liveWorld.day ?? initialDay;
  const { imperialState, setImperialState } = useImperialState(worldId, villages);
  const tribeInfluenceStage = calculateTribeProgressStage({
    currentDay,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: liveWorld.sovereignty.kingAlive,
  });
  const sovereigntyScore = useMemo(
    () =>
      calculateSovereigntyScore({
        villageDevelopments: villages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
        councilHeroes: liveWorld.sovereignty.councilHeroes,
        militaryRankingPoints: liveWorld.sovereignty.militaryRankingPoints,
        eraQuestsCompleted: liveWorld.sovereignty.eraQuestsCompleted,
        wondersControlled: liveWorld.sovereignty.wondersControlled,
        currentDay,
        hasTribeDome: liveWorld.sovereignty.tribeDomeUnlocked,
        tribeLoyaltyStage: tribeInfluenceStage,
        kingAlive: liveWorld.sovereignty.kingAlive,
      }).total,
    [currentDay, liveWorld.sovereignty, tribeInfluenceStage, villages],
  ) || initialSovereigntyScore;
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);

  const [zoom, setZoom] = useState(DEFAULT_WORLD_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [selectedCoordKey, setSelectedCoordKey] = useState<string | null>(null);
  const [relationFilter, setRelationFilter] = useState<RelationFilter>("all");
  const [activeAction, setActiveAction] = useState<TileActionKind>("inspect");
  const [actionStep, setActionStep] = useState<ActionStep>("choose");
  const [buildMode, setBuildMode] = useState<BuildMode>("outpost");
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(null);
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementMessage, setMovementMessage] = useState<string | null>(null);
  const [storedMovements, setStoredMovements] = useState<StoredMapMovement[]>([]);
  const [mobilizationActive, setMobilizationActive] = useState(false);
  const [mobilizationStartedAtDay, setMobilizationStartedAtDay] = useState<number | null>(null);
  const [troopPreset, setTroopPreset] = useState<TroopPreset>("balanced");
  const [troopDispatch, setTroopDispatch] = useState<TroopSelection>({
    militia: 0,
    shooters: 0,
    scouts: 0,
    machinery: 0,
  });
  const [selectedAnnexDiplomatToken, setSelectedAnnexDiplomatToken] = useState<string>("");
  const world = useMemo(() => buildHexWorld(), []);

  const hotspots = useMemo(() => generateHotspots(worldId, world), [worldId, world]);
  const isPhase4 = currentDay >= 91;
  const portalEligible = canEnterPortal(sovereigntyScore);
  const portalTooltip = portalEligible
    ? `Portal Central: acesso liberado (${sovereigntyScore}/${SOVEREIGNTY_PORTAL_CUT})`
    : `Portal Central: bloqueado (${sovereigntyScore}/${SOVEREIGNTY_PORTAL_CUT})`;
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const key = `phase4_mobilization:${worldId}`;
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as { active?: boolean; startedAtDay?: number | null };
      if (parsed.active) {
        setMobilizationActive(true);
        setMobilizationStartedAtDay(typeof parsed.startedAtDay === "number" ? parsed.startedAtDay : null);
      }
    } catch {
      // silencioso
    }
  }, [worldId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const key = `phase4_mobilization:${worldId}`;
    if (!mobilizationActive) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(
      key,
      JSON.stringify({
        active: mobilizationActive,
        startedAtDay: mobilizationStartedAtDay,
      }),
    );
  }, [mobilizationActive, mobilizationStartedAtDay, worldId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncMovements = () => {
      setStoredMovements(readStoredMovements(worldId));
    };

    syncMovements();
    const timer = window.setInterval(syncMovements, 10_000);
    return () => window.clearInterval(timer);
  }, [worldId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `map_movements:${worldId}`;

    const settleMovements = () => {
      try {
        const rawStored = window.localStorage.getItem(storageKey);
        if (!rawStored) {
          return;
        }

        const parsed = JSON.parse(rawStored) as StoredMapMovement[];
        const now = Date.now();
        let changed = false;
        let latestMessage: string | null = null;

        const next: StoredMapMovement[] = parsed.map((movement): StoredMapMovement => {
          if (movement.status !== "traveling") {
            return movement;
          }

          const arrivalTs = Date.parse(movement.arrivalAt);
          if (!Number.isFinite(arrivalTs) || arrivalTs > now) {
            return movement;
          }

          changed = true;
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
              const seededClass = movement.meta.settlementRecommendedClass ?? "neutral";
              const shouldLockClass = seededClass !== "neutral";
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
                    energy: 900,
                    influence: 90,
                    palaceLevel: 0,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: zeroLevels,
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Afonso",
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
                    energy: 940,
                    influence: 120,
                    palaceLevel: 2,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: getDefaultBuildingLevels(2),
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Afonso",
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
            };
          }

          if (movement.commandAction === "attack") {
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
                    originKind: "claimed_city",
                    terrainKind: movement.meta.settlementTerrainKind ?? "ashen_fields",
                    terrainLabel: movement.meta.settlementTerrainLabel ?? "Campos de Cinza",
                    politicalState: "Cidade tomada pela Coroa",
                    materials: 1000,
                    supplies: 920,
                    energy: 880,
                    influence: 110,
                    palaceLevel: 2,
                    kingHere: false,
                    princeHere: false,
                    underAttack: false,
                    deficits: [],
                    buildingLevels: getDefaultBuildingLevels(2),
                    coord: formatLegacyCoord({ q, r }),
                    axial: { q, r },
                    owner: "Afonso",
                    relation: "Proprio",
                    state: "Cidade sob administracao militar",
                  },
                ],
                logs: [`Ataque bem-sucedido em ${q}:${r}`, ...current.logs].slice(0, 12),
              }));
            }

            latestMessage = `Ataque concluido em ${q}:${r}. A cidade agora esta sob sua administracao.`;
            return {
              ...movement,
              status: "arrived",
            };
          }

          latestMessage = `Movimento ${movement.id.slice(0, 8)} concluido.`;
          return {
            ...movement,
            status: "arrived",
          };
        });

        if (!changed) {
          return;
        }

        window.localStorage.setItem(storageKey, JSON.stringify(next));
        setStoredMovements(next);
        if (latestMessage) {
          setMovementMessage(latestMessage);
        }
      } catch {
        // silencioso
      }
    };

    settleMovements();
    const timer = window.setInterval(settleMovements, 15_000);
    return () => window.clearInterval(timer);
  }, [imperialState.extraVillages, setImperialState, sovereigntyScore, worldId]);
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

  const selectedTile = selectedCoordKey ? (tileByCoordKey.get(selectedCoordKey) ?? null) : null;
  const selectedSite = selectedCoordKey ? (siteByCoordKey.get(selectedCoordKey) ?? null) : null;
  const selectedFriendlySite = Boolean(selectedSite && (selectedSite.faction === "self" || selectedSite.faction === "tribe" || selectedSite.faction === "ally"));
  const selectedHotspot = selectedCoordKey ? (hotspotByCoordKey.get(selectedCoordKey) ?? null) : null;

  const focusSite = useMemo(() => {
    return mappedSites.find((site) => site.faction === "self")
      ?? mappedSites.find((site) => site.faction === "tribe")
      ?? mappedSites[0]
      ?? null;
  }, [mappedSites]);

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
        terrainMovementMultiplier,
      });
      totalMinutes += leg.totalMinutes * phase4SlowdownMult;
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
    };
  }, [hotspotByCoordKey, isPhase4, mobilizationActive, roadNetwork.edges, routeToSelection]);

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

  const spyCost = useMemo(() => {
    return calculateSpyOperationCost({
      hexDistance: Math.max(1, routeSummary.hexCount),
      spyMasteryLevel: 3,
      terrainCostMultiplier: selectedHotspot?.terrainBonus.terrainCostMultiplier,
      terrainTimeMultiplier: selectedHotspot?.terrainBonus.terrainTimeMultiplier,
    });
  }, [routeSummary.hexCount, selectedHotspot?.coordKey, selectedHotspot?.terrainBonus.terrainCostMultiplier, selectedHotspot?.terrainBonus.terrainTimeMultiplier]);

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

    const tileHasOwner = Boolean(selectedSite);
    const isAbandonedTile = selectedSite?.occupationKind === "abandoned_city";
    const isFrontierRuins = selectedSite?.occupationKind === "frontier_ruins";
    const isUnownedHotspot = Boolean(selectedHotspot) && !tileHasOwner;
    const isEmptyTile = !tileHasOwner && !selectedHotspot;
    const isEnemyTile = selectedSite?.faction === "enemy";
    const isFoundationTile = isEmptyTile || isUnownedHotspot || isFrontierRuins;
    const targetingPortal = selectedTile.isCentralThrone;
    const centralBlocked = targetingPortal && !isPhase4;

    let buildEnabled = isFoundationTile && !targetingPortal;
    let buildReason: string | undefined;
    if (!buildEnabled) {
      buildReason = targetingPortal
        ? "Portal Central nao aceita construcao."
        : "Somente vazio duro, hotspot livre ou ruina instavel aceita fundacao.";
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
      goReason = "Sua linhagem nao possui Influencia suficiente (1500 pts) para desafiar o Portal";
    }

    let attackEnabled = Boolean(marchOriginKey) && isEnemyTile && !targetingPortal;
    let attackReason: string | undefined;
    if (!attackEnabled) {
      attackReason = targetingPortal
        ? "Portal Central nao aceita ataque."
        : "Atacar so aparece quando a cidade ainda possui dono.";
    } else if (selectedTile.coordKey === marchOriginKey) {
      attackEnabled = false;
      attackReason = "Tile de origem ja selecionado.";
    }

    let annexEnabled = Boolean(marchOriginKey) && isAbandonedTile && !targetingPortal;
    let annexReason: string | undefined;
    if (!annexEnabled) {
      annexReason = targetingPortal
        ? "Portal Central nao aceita anexacao."
        : "Anexar so aparece quando a cidade esta vazia.";
    } else if (selectedTile.coordKey === marchOriginKey) {
      annexEnabled = false;
      annexReason = "Tile de origem ja selecionado.";
    } else if (colonyDiplomacy.free <= 0) {
      annexEnabled = false;
      annexReason = "Nenhum diplomata livre. Mature uma Colonia e contrate um agente na aba Herois.";
    }

    let spyEnabled = Boolean(isEnemyTile) && !targetingPortal && HAS_SPY_HERO;
    let spyReason: string | undefined;

    if (!spyEnabled) {
      if (targetingPortal) {
        spyReason = "Portal Central nao aceita espionagem.";
      } else if (!isEnemyTile) {
        spyReason = "Espiar so em tile inimigo.";
      } else {
        spyReason = "Necessita Heroi Espiao ativo.";
      }
    } else if (imperialState.resources.influence < spyCost.influence) {
      spyEnabled = false;
      spyReason = `Influencia insuficiente (${spyCost.influence}).`;
    }

    return [
      { kind: "inspect", label: "Inspecionar", enabled: true },
      { kind: "build", label: "Construir", enabled: buildEnabled, reason: buildReason },
      ...(targetingPortal || selectedFriendlySite ? [{ kind: "go", label: goLabel, enabled: goEnabled, reason: goReason }] : []),
      ...(!targetingPortal && isEnemyTile
        ? [{ kind: "attack", label: "Atacar", enabled: attackEnabled, reason: attackReason }]
        : []),
      ...(!targetingPortal && isAbandonedTile
        ? [{ kind: "annex", label: "Anexar", enabled: annexEnabled, reason: annexReason }]
        : []),
      { kind: "spy", label: "Espiar", enabled: spyEnabled, reason: spyReason },
    ] as TileActionOption[];
  }, [colonyDiplomacy.free, imperialState.resources.influence, isPhase4, isRoadConnected, marchOriginKey, mobilizationActive, portalEligible, selectedFriendlySite, selectedHotspot, selectedSite, selectedTile, spyCost.influence]);

  const selectedActionLabel = actionOptions.find((entry) => entry.kind === activeAction)?.label ?? "Inspecionar";

  const canAffordBuild =
    imperialState.resources.materials >= buildCost.materials &&
    imperialState.resources.energy >= buildCost.energy &&
    imperialState.resources.influence >= buildCost.influence;

  const routePoints = useMemo(() => {
    if (!movementDraft) {
      return [] as PixelPoint[];
    }

    return movementDraft.route
      .map((coord) => world.centerByKey.get(axialKey(coord)))
      .filter((point): point is PixelPoint => Boolean(point));
  }, [movementDraft, world.centerByKey]);

  const routePolyline = routePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const scenicDecorations = useMemo(() => {
    return world.tiles
      .map((tile) => buildScenicDecoration(tile))
      .filter((entry): entry is ScenicDecoration => Boolean(entry));
  }, [world]);

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

    setOffset(centerOnPoint(world.centerPoint, DEFAULT_WORLD_ZOOM));
    setSelectedCoordKey(axialKey(ZERO_AXIAL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.w, viewportSize.h, world]);

  useEffect(() => {
    setActiveAction("inspect");
    setActionStep("choose");
    setMovementDraft(null);
    setMovementMessage(null);
  }, [selectedCoordKey]);

  useEffect(() => {
    if (villageCapReached && buildMode === "outpost") {
      setBuildMode("road");
    }
  }, [buildMode, villageCapReached]);

  const applyZoom = (next: number) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    setZoom((current) => {
      const centerX = viewportSize.w / 2;
      const centerY = viewportSize.h / 2;
      const worldX = (centerX - offset.x) / current;
      const worldY = (centerY - offset.y) / current;
      const nextOffsetX = centerX - worldX * clamped;
      const nextOffsetY = centerY - worldY * clamped;
      setOffset(clampOffset(nextOffsetX, nextOffsetY, clamped));
      return clamped;
    });
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!viewportRef.current) {
      return;
    }
    viewportRef.current.setPointerCapture(event.pointerId);
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
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }

    const nextX = dragRef.current.startOffsetX + dx;
    const nextY = dragRef.current.startOffsetY + dy;
    setOffset(clampOffset(nextX, nextY, zoom));
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;

    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }

    if (drag.moved || !viewportRef.current) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left - offset.x) / zoom;
    const py = (event.clientY - rect.top - offset.y) / zoom;
    const tapped = pixelToAxial({ x: px, y: py }, world.layout);

    if (axialDistance(tapped, ZERO_AXIAL) > WORLD_HEX_RADIUS) {
      return;
    }

    const coordKey = axialKey(tapped);
    if (!tileByCoordKey.has(coordKey)) {
      return;
    }

    emitUiFeedback("tap", "light");
    setSelectedCoordKey(coordKey);
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
    setActiveAction(option.kind);
    setMovementMessage(null);

    if (!option.enabled || option.kind === "inspect" || !marchOrigin || !selectedTile) {
      setActionStep("choose");
      setMovementDraft(null);
      return;
    }

    const action = option.kind as Exclude<TileActionKind, "inspect">;

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

    setMovementDraft({
      action,
      from: { q: marchOrigin.q, r: marchOrigin.r },
      to: { q: selectedTile.q, r: selectedTile.r },
      etaMinutes,
      route: routeToSelection,
    });
    setActionStep("configure");
  };

  const handleConfirmMovement = async () => {
    if (!movementDraft || !selectedTile) {
      return;
    }

    emitUiFeedback("route", "medium");

    const targetingPortal = movementDraft.to.q === 0 && movementDraft.to.r === 0;
    if (targetingPortal && !canEnterPortal(sovereigntyScore)) {
      setMovementMessage("Sua linhagem nao possui Influencia suficiente (1500 pts) para desafiar o Portal");
      return;
    }

    if (movementDraft.action === "build" && buildMode === "outpost" && villageCapReached) {
      setMovementMessage(`Limite de ${PLAYER_VILLAGE_CAP} cidades alcancado. Use Estrada ou abandone para abrir espaco.`);
      return;
    }

    if (movementDraft.action === "build" && !canAffordBuild) {
      setMovementMessage("Recursos insuficientes para construir neste tile.");
      return;
    }

    const isTroopAction = movementDraft.action === "go" || movementDraft.action === "attack";
    if (isTroopAction && troopDispatchTotal <= 0) {
      setMovementMessage("Selecione ao menos uma tropa para enviar.");
      return;
    }

    if (movementDraft.action === "annex" && colonyDiplomacy.free <= 0) {
      setMovementMessage("Nenhum diplomata livre para anexar esta cidade.");
      return;
    }

    if (movementDraft.action === "annex" && !selectedAnnexDiplomatToken) {
      setMovementMessage("Escolha 1 diplomata para acompanhar a anexacao.");
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

      if (movementDraft.action === "build") {
        setImperialState((current) => ({
          ...current,
          resources: {
            ...current.resources,
            materials: Math.max(0, current.resources.materials - buildCost.materials),
            energy: Math.max(0, current.resources.energy - buildCost.energy),
            influence: Math.max(0, current.resources.influence - buildCost.influence),
          },
          logs: [
            `${buildMode === "outpost" ? "Fundacao" : "Estrada"} no mapa (${selectedTile.q},${selectedTile.r})`,
            ...current.logs,
          ].slice(0, 12),
        }));
      }

      if (movementDraft.action === "spy") {
        setImperialState((current) => ({
          ...current,
          resources: {
            ...current.resources,
            influence: Math.max(0, current.resources.influence - spyCost.influence),
          },
          logs: [`Espionagem disparada em (${selectedTile.q},${selectedTile.r})`, ...current.logs].slice(0, 12),
        }));
      }

      if (movementDraft.action === "annex") {
        setImperialState((current) => ({
          ...current,
          annexEnvoysCommitted: current.annexEnvoysCommitted + 1,
          logs: [`Anexacao iniciada em ${selectedTile.q}:${selectedTile.r} com ${selectedAnnexDiplomatToken}`, ...current.logs].slice(0, 12),
        }));
      }

      setMovementMessage(
        targetingPortal
          ? `Expedicao ${stored.id.slice(0, 8)} em marcha ao Portal. Se sua Influencia cair abaixo de ${SOVEREIGNTY_PORTAL_CUT}, a entrada falhara no destino.${stored.meta.regroupMode ? ` Mobilizacao Livre x${PHASE4_REGROUP_SPEED_MULT} ativa.` : ""}`
          : movementDraft.action === "attack"
            ? `Ataque ${stored.id.slice(0, 8)} registrado. ETA ${formatMinutesLabel(stored.etaMinutes)} com ${troopDispatchTotal.toLocaleString("pt-BR")} tropas.`
            : movementDraft.action === "annex"
              ? `Anexacao ${stored.id.slice(0, 8)} registrada. ${selectedAnnexDiplomatToken} ficou em missao ate a consolidacao da cidade.`
              : `Movimento ${stored.id.slice(0, 8)} registrado em map_movements. ETA ${formatMinutesLabel(stored.etaMinutes)}.${isTroopAction ? ` Tropa: ${troopDispatchTotal.toLocaleString("pt-BR")} (${troopPreset}).` : ""}`,
      );
      setStoredMovements((current) => [stored, ...current].slice(0, 1200));
    } catch {
      setMovementMessage("Falha ao registrar movimento. Tente novamente.");
    } finally {
      setSubmittingMovement(false);
    }
  };

  const counts = useMemo(() => {
    return {
      all: mappedSites.length,
      self: mappedSites.filter((site) => site.faction === "self").length,
      tribe: mappedSites.filter((site) => site.faction === "tribe").length,
      ally: mappedSites.filter((site) => site.faction === "ally").length,
      enemy: mappedSites.filter((site) => site.faction === "enemy").length,
      abandoned: mappedSites.filter((site) => site.faction === "abandoned").length,
    };
  }, [mappedSites]);

  const movementInfo = useMemo(() => {
    const oneHex = { q: 1, r: 0 };
    const base = calculateMarchTimeMinutes(ZERO_AXIAL, oneHex, { hasRoad: false });
    const road = calculateMarchTimeMinutes(ZERO_AXIAL, oneHex, { hasRoad: true });
    return {
      baseMinutesPerHex: Math.round(base.minutesPerHex),
      roadMinutesPerHex: Math.round(road.minutesPerHex),
    };
  }, []);

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
  const detailModeActive = zoom >= DETAIL_ZOOM_THRESHOLD;

  return (
    <section className="space-y-2">
      <article className="rounded-2xl border border-white/25 bg-white/10 p-2 shadow-[0_18px_36px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 p-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Compass className="h-4 w-4 text-cyan-300" />
            <p className="truncate text-xs font-semibold text-slate-100">
              Mundo Hex R{WORLD_HEX_RADIUS} - {WORLD_HEX_TILE_COUNT.toLocaleString("pt-BR")} tiles
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${
                detailModeActive
                  ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-100"
                  : "border-white/20 bg-white/8 text-slate-300"
              }`}
            >
              {detailModeActive ? "Detalhes 300%+" : "Modo Leve"}
            </span>
            <button
              type="button"
              onClick={() => applyZoom(zoom - ZOOM_STEP)}
              className="rounded-md border border-white/30 bg-white/10 p-1 text-slate-100 hover:bg-white/20"
              aria-label="Diminuir zoom"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center text-[11px] font-bold text-slate-100">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => applyZoom(zoom + ZOOM_STEP)}
              className="rounded-md border border-white/30 bg-white/10 p-1 text-slate-100 hover:bg-white/20"
              aria-label="Aumentar zoom"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOffset(centerOnPoint(world.centerPoint, zoom));
                setSelectedCoordKey(axialKey(ZERO_AXIAL));
              }}
              className="rounded-md border border-white/30 bg-white/10 p-1 text-slate-100 hover:bg-white/20"
              aria-label="Recentralizar"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-200">
          <div className="min-w-0">
            <p className="truncate">
              Mobilizacao Livre: {mobilizationActive ? `ATIVA${mobilizationStartedAtDay ? ` (Dia ${mobilizationStartedAtDay})` : ""}` : "inativa"}
            </p>
            <p className="text-[9px] text-slate-300">
              Fase IV aplica deslocamento x{PHASE4_REGROUP_SPEED_MULT} em marchas para o Centro (0,0).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isPhase4 || mobilizationActive) {
                return;
              }
              setMobilizationActive(true);
              setMobilizationStartedAtDay(currentDay);
              setMovementMessage(`Comando Reagrupar Imperio acionado no Dia ${currentDay}. Movimentos para o Centro entram em modo x${PHASE4_REGROUP_SPEED_MULT}.`);
            }}
            disabled={!isPhase4 || mobilizationActive}
            className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold transition ${
              !isPhase4 || mobilizationActive
                ? "cursor-not-allowed border-white/20 bg-white/10 text-slate-400"
                : "border-cyan-300/70 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
            }`}
          >
            {!isPhase4 ? "Dia 91" : mobilizationActive ? "Reagrupado" : "Reagrupar Imperio"}
          </button>
        </div>

        <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-200">
          <span>Sem estrada: {movementInfo.baseMinutesPerHex}m/hex</span>
          <span className="text-slate-400">|</span>
          <span>Malha Viaria: {movementInfo.roadMinutesPerHex}m/hex</span>
          <span className="text-slate-400">|</span>
          <span>Distritos: 6</span>
          <span className="text-slate-400">|</span>
          <span>Hotspots: {hotspots.length}</span>
        </div>

        <div
          ref={viewportRef}
          className="relative mt-2 h-[56vh] touch-none overflow-hidden rounded-xl border border-white/20 bg-slate-900/45"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: world.width,
              height: world.height,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              width={world.width}
              height={world.height}
              viewBox={`0 0 ${world.width} ${world.height}`}
              className="absolute inset-0 pointer-events-none"
              aria-label="Grid hexagonal do mundo"
            >
              {world.tiles.map((tile) => {
                const style = TILE_STYLE_BY_ZONE[tile.zone];
                return (
                  <polygon
                    key={tile.coordKey}
                    points={tile.points}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={0.9}
                  />
                );
              })}

              {world.tiles.map((tile) => (
                <polygon
                  key={`terrain-${tile.coordKey}`}
                  points={tile.points}
                  fill={TERRAIN_VISUAL_META[tile.terrainKind].tint}
                  stroke="none"
                />
              ))}

              {world.tiles.map((tile) => (
                <polygon
                  key={`district-${tile.coordKey}`}
                  points={tile.points}
                  fill={DISTRICT_META[tile.district].tint}
                  stroke="none"
                />
              ))}

              {factionInfluenceOverlays.map((overlay) => (
                <polygon
                  key={`influence-${overlay.coordKey}`}
                  points={overlay.points}
                  fill={factionInfluenceColor(overlay.faction, Math.min(0.2, 0.05 + overlay.strength * 0.08))}
                  stroke={factionInfluenceColor(overlay.faction, Math.min(0.45, 0.12 + overlay.strength * 0.12))}
                  strokeWidth={0.8}
                  strokeLinejoin="round"
                />
              ))}

              {scenicDecorations.map((decoration) => (
                <path
                  key={decoration.key}
                  d={decoration.d}
                  fill={decoration.fill}
                  opacity={decoration.opacity}
                />
              ))}

              {world.frontierLines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(226,232,240,0.18)"
                  strokeWidth={0.9}
                  strokeDasharray="3 4"
                />
              ))}

              {selectedTile ? (
                <polygon
                  points={selectedTile.points}
                  fill="rgba(96,165,250,0.22)"
                  stroke="rgba(191,219,254,0.95)"
                  strokeWidth={1.45}
                />
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

            {hotspots.map((hotspot) => {
              const center = world.centerByKey.get(hotspot.coordKey);
              if (!center) {
                return null;
              }
              const meta = HOTSPOT_META[hotspot.kind];
              const selected = selectedCoordKey === hotspot.coordKey;
              const hotspotMuted = relationFilter !== "all" && !selected;

              return (
                <button
                  key={hotspot.id}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCoordKey(hotspot.coordKey);
                  }}
                  className="absolute transition-all duration-200"
                  title={`${hotspot.name} - Clique para preparar bonus de terreno`}
                  style={{
                    left: center.x,
                    top: center.y,
                    transform: `translate(-50%, -50%) scale(${selected ? 1.08 : hotspotMuted ? 0.78 : 1})`,
                    opacity: hotspotMuted ? 0.16 : 1,
                  }}
                >
                  <div
                    className={`${"grid h-5 w-5 place-items-center rounded-full border text-[10px] shadow-lg"} ${meta.chipClass} ${selected ? "ring-2 ring-white/80" : ""}`}
                  >
                    {meta.icon}
                  </div>
                </button>
              );
            })}

            {mappedSites.map((site) => {
              const selected = selectedCoordKey === site.coordKey;
              const matchesFilter = relationFilter === "all" || site.faction === relationFilter;
              const muted = !matchesFilter && !selected;
              const showLabel = selected || (!muted && matchesFilter && zoom >= 1.15);
              const center = world.centerByKey.get(site.coordKey);
              if (!center) {
                return null;
              }
              const terrainKind = site.terrainKind ?? tileByCoordKey.get(site.coordKey)?.terrainKind ?? "ashen_fields";
              const terrainRecommended = site.recommendedCityClass ?? TERRAIN_META[terrainKind].recommendedCityClass;

              return (
                <button
                  key={site.id}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCoordKey(site.coordKey);
                  }}
                  className="absolute transition-all duration-200"
                  style={{
                    left: center.x,
                    top: center.y,
                    transform: `translate(-50%, -50%) scale(${selected ? 1.14 : muted ? 0.82 : matchesFilter ? 1.02 : 0.9})`,
                    opacity: muted ? 0.18 : 1,
                    zIndex: selected ? 7 : matchesFilter ? 5 : 2,
                  }}
                >
                  <div
                    className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] font-bold text-slate-950 shadow-lg ${markerBorderClass(site.faction)} ${markerFillClass(site.faction)} ${
                      selected ? "ring-2 ring-white/85" : matchesFilter && relationFilter !== "all" ? "ring-2 ring-white/40" : ""
                    }`}
                    style={markerGlowStyle(site.faction, selected, muted)}
                  >
                    {siteMarkerText(site)}
                  </div>
                  {selected && zoom >= DETAIL_ZOOM_THRESHOLD ? (
                    <span className="pointer-events-none absolute left-1/2 top-[-22%] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-slate-950/80 px-1 py-0.5 text-[8px] font-bold text-slate-100">
                      {cityClassLabel(terrainRecommended)}
                    </span>
                  ) : null}
                  {showLabel ? (
                    <span
                      className={`pointer-events-none absolute left-1/2 top-[115%] -translate-x-1/2 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${labelClass(
                        site.faction,
                      )}`}
                    >
                      {site.name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <aside
            className={`absolute inset-y-2 right-2 z-20 w-[86%] max-w-[290px] rounded-2xl border border-white/35 bg-white/18 p-2 shadow-[0_20px_44px_rgba(2,6,23,0.6)] backdrop-blur-xl transition-all duration-300 ${
              selectedTile ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
            }`}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            {selectedTile ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">Comando do Mapa</p>
                    <p className="text-sm font-bold text-slate-50">Q {selectedTile.q} Â· R {selectedTile.r}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100 hover:bg-white/20"
                    onClick={() => setSelectedCoordKey(null)}
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-1 rounded-lg border border-white/20 bg-slate-950/35 p-2 text-[11px] text-slate-200">
                  <p>Distrito {selectedTile.district} · Zona {selectedTile.zone}</p>
                  <p>{selectedSite ? `Dono: ${selectedSite.owner}` : "Tile vazio"}</p>
                  <p>Cidades proprias: {ownVillageCount}/{PLAYER_VILLAGE_CAP}</p>
                  <p>
                    Terreno: {selectedSite?.terrainLabel ?? TERRAIN_META[selectedTile.terrainKind].label}
                    {" · "}sugere {cityClassLabel(selectedSite?.recommendedCityClass ?? selectedSite?.cityClass ?? TERRAIN_META[selectedTile.terrainKind].recommendedCityClass)}
                  </p>
                  {selectedSite?.terrainLabel ? (
                    <p>
                      Origem: {selectedSite.occupationKind === "abandoned_city" ? "Cidade abandonada" : selectedSite.occupationKind === "frontier_ruins" ? "Ruina instavel" : selectedSite.occupationKind === "claimed_city" ? "Cidade estabelecida" : "Fundacao livre"}
                    </p>
                  ) : null}
                  {selectedSite?.occupationKind === "abandoned_city" ? (
                    <p className="text-amber-100">Cidade abandonada detectada: como esta vazia, voce pode Anexar com diplomata e estabilizar a posse.</p>
                  ) : null}
                  {selectedSite?.faction === "enemy" ? (
                    <p className="text-rose-100">Cidade ocupada por rival: atacar ja e a propria tomada. Se vencer, a cidade muda de lado.</p>
                  ) : null}
                  {selectedSite?.occupationKind === "frontier_ruins" ? (
                    <p className="text-cyan-100">Ruina instavel: fundacao facilitada, mas a cidade nasce zerada e precisa estabilizar.</p>
                  ) : null}
                  {selectedHotspot && !selectedSite ? (
                    <p className="text-cyan-100">Campo de bonus livre: fundar aqui agrega terreno especial e pode travar uma classe de cidade.</p>
                  ) : null}
                  {selectedTile.isCentralThrone ? (
                    <p className={portalEligible ? "text-amber-100" : "text-rose-200"}>
                      {portalEligible
                        ? `Portal liberado para sua linhagem (${sovereigntyScore}/${SOVEREIGNTY_PORTAL_CUT}).`
                        : "Sua linhagem nao possui Influencia suficiente (1500 pts) para desafiar o Portal"}
                    </p>
                  ) : null}
                  {selectedHotspot ? (
                    <p className="text-slate-100">
                      Bonus {HOTSPOT_META[selectedHotspot.kind].label}: mov {selectedHotspot.terrainBonus.terrainMovementMultiplier ?? 1}x Â· custo {selectedHotspot.terrainBonus.terrainCostMultiplier ?? 1}x
                    </p>
                  ) : null}
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px] text-slate-100">
                  <div className="rounded-lg border border-white/15 bg-white/8 p-1.5">
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Leitura</p>
                    <p className="mt-1 font-semibold">
                      {selectedSite?.faction === "enemy"
                        ? "Hostil"
                        : selectedSite?.occupationKind === "abandoned_city"
                          ? "Anexavel"
                          : selectedHotspot && !selectedSite
                            ? "Hotspot livre"
                            : selectedTile.isCentralThrone
                              ? "Portal"
                              : "Fundacao"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-white/8 p-1.5">
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Terreno</p>
                    <p className="mt-1 font-semibold">
                      {selectedSite?.terrainLabel ?? TERRAIN_META[selectedTile.terrainKind].label}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-white/8 p-1.5">
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Vocacao</p>
                    <p className="mt-1 font-semibold">
                      {cityClassLabel(selectedSite?.recommendedCityClass ?? selectedSite?.cityClass ?? TERRAIN_META[selectedTile.terrainKind].recommendedCityClass)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-white/8 p-1.5">
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Regra</p>
                    <p className="mt-1 font-semibold">
                      {selectedTile.isCentralThrone
                        ? portalEligible
                          ? "Portal aberto"
                          : "Falta 1500"
                        : selectedSite?.occupationKind === "abandoned_city"
                          ? "Anexar"
                          : selectedSite?.faction === "enemy"
                            ? "Atacar"
                            : "Construir / Ir"}
                    </p>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-white/20 bg-white/8 p-1.5 text-[10px] text-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold uppercase tracking-[0.16em]">
                      {actionStep === "choose" ? "Etapa 1/2 - Acao" : "Etapa 2/2 - Configurar"}
                    </p>
                    {actionStep === "configure" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionStep("choose");
                          setActiveAction("inspect");
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
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {actionOptions.map((option) => {
                      const selected = option.kind === activeAction;
                      return (
                        <div key={option.kind}>
                          <button
                            type="button"
                            disabled={!option.enabled}
                            onClick={() => handleActionClick(option)}
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition ${
                              selected
                                ? "border-cyan-300/85 bg-cyan-500/18 text-cyan-100"
                                : "border-white/25 bg-white/8 text-slate-100"
                            } ${option.enabled ? "hover:bg-white/20" : "cursor-not-allowed opacity-55"}`}
                          >
                            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${actionTone(option.kind)}`}>
                              {option.label}
                            </span>
                            <span className="mt-1 block text-[10px] font-medium text-slate-300">
                              {describeTileAction(option.kind)}
                            </span>
                          </button>
                          {!option.enabled && option.reason ? (
                            <p className="mt-0.5 px-1 text-[10px] text-rose-200/90">{option.reason}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1.5 rounded-lg border border-cyan-200/40 bg-slate-950/35 p-2 text-[11px] text-slate-100">
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
                    <p>Energia: {buildCost.energy.toLocaleString("pt-BR")}</p>
                    <p>Influencia: {buildCost.influence.toLocaleString("pt-BR")}</p>
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

                {actionStep === "configure" && activeAction === "spy" ? (
                  <div className="mt-2 rounded-lg border border-white/20 bg-white/8 p-2 text-[11px] text-slate-100">
                    <p>Custo de influencia: {spyCost.influence.toLocaleString("pt-BR")}</p>
                    <p>Preparacao: {formatMinutesLabel(spyCost.prepMinutes)}</p>
                    <p>Requisito: Heroi Espiao {HAS_SPY_HERO ? "ativo" : "inativo"}</p>
                  </div>
                ) : null}

                {actionStep === "configure" && movementDraft ? (
                  <div className="mt-2 rounded-lg border border-cyan-200/40 bg-slate-950/35 p-2 text-[11px] text-slate-100">
                    <p className="font-semibold text-cyan-100">Painel de Marcha</p>
                    <p>Rota: {routeSummary.hexCount} hex - {routeSummary.roadSegments} estrada - {routeSummary.offroadSegments} mato</p>
                    <p>ETA total: {formatMinutesLabel(movementDraft.etaMinutes)}</p>
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
                              <div key={troopId} className="rounded-md border border-white/15 bg-slate-950/35 p-1">
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

                {movementMessage ? <p className="mt-2 text-[10px] font-semibold text-cyan-100">{movementMessage}</p> : null}
              </>
            ) : null}
          </aside>
        </div>

        <div className="mt-2 rounded-2xl border border-white/15 bg-white/6 p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Filtro de relacao</p>
            <p className="text-[10px] font-semibold text-slate-400">
              Ativo: <span className="text-slate-100">{relationFilterLabel(relationFilter)}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
            {([
              { id: "all", count: counts.all },
              { id: "self", count: counts.self },
              { id: "tribe", count: counts.tribe },
              { id: "ally", count: counts.ally },
              { id: "enemy", count: counts.enemy },
              { id: "abandoned", count: counts.abandoned },
            ] as const).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  emitUiFeedback("tap", "light");
                  setRelationFilter(entry.id);
                }}
                className={`rounded-lg border px-1.5 py-1 text-left transition ${relationFilterTone(entry.id, relationFilter === entry.id)}`}
              >
                <span className="block">{relationFilterLabel(entry.id)}</span>
                <span className="block text-[9px] opacity-80">{entry.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-2xl border border-white/15 bg-white/6 p-2 text-[10px] text-slate-200">
          <p className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-300">Legenda de faccoes</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "So eu", dot: "bg-yellow-300", chip: "border-yellow-300/70 bg-yellow-400/15 text-yellow-50", note: "marcador + halo + area" },
              { label: "Tudo / neutro", dot: "bg-sky-400", chip: "border-sky-300/70 bg-sky-500/15 text-sky-100", note: "leitura geral do mapa" },
              { label: "Tribo", dot: "bg-rose-400", chip: "border-rose-300/70 bg-rose-500/15 text-rose-100", note: "seu bloco principal" },
              { label: "Aliados", dot: "bg-violet-400", chip: "border-violet-300/70 bg-violet-500/15 text-violet-100", note: "apoio e pacto" },
              { label: "Inimigos", dot: "bg-emerald-400", chip: "border-emerald-300/70 bg-emerald-500/15 text-emerald-100", note: "pressao hostil" },
              { label: "Abandonadas", dot: "bg-amber-400", chip: "border-amber-300/70 bg-amber-500/15 text-amber-100", note: "ruinas e vazios" },
            ].map((entry) => (
              <div key={entry.label} className={`rounded-xl border px-2 py-1.5 ${entry.chip}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_10px_currentColor] ${entry.dot}`} />
                  <span className="font-semibold">{entry.label}</span>
                </div>
                <p className="mt-1 text-[9px] opacity-90">{entry.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-2xl border border-white/15 bg-white/6 p-2 text-[10px] text-slate-200">
          <p className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-300">Terrenos e classe sugerida</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(TERRAIN_META) as [TerrainKind, (typeof TERRAIN_META)[TerrainKind]][]).map(([terrainKind, meta]) => (
              <div key={terrainKind} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TERRAIN_VISUAL_META[terrainKind].badgeClass}`}>
                    {cityClassLabel(meta.recommendedCityClass)}
                  </span>
                  <span className="font-semibold text-slate-100">{meta.label}</span>
                </div>
                <p className="mt-1 text-slate-300">{meta.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}





























































