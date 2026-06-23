import type { TerrainModifiers } from "@/core/GameBalance";
import type { CityClass, CityOriginKind, TerrainKind } from "@/lib/cities";
import type { AxialCoord, HexLayout, PixelPoint } from "@/lib/hex-grid";
import type { BoardSite, VillageSummary } from "@/lib/mock-data";
import type { CombatResult } from "@/lib/combat-engine";

export type Faction = "self" | "tribe" | "ally" | "enemy" | "abandoned" | "neutral";
export type RelationFilter = "all" | "self" | "tribe" | "ally" | "enemy" | "abandoned";
export type MapZone = "outer" | "mid" | "core";
export type DistrictId = "A" | "B" | "C" | "D" | "E" | "F";
export type HotspotKind = "oasis" | "ruins" | "rare_mine";

export type MapSite = BoardSite & {
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

export type WorldHexTile = {
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

export type DistrictLabel = {
  district: DistrictId;
  x: number;
  y: number;
};

export type FrontierLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Hotspot = {
  id: string;
  q: number;
  r: number;
  coordKey: string;
  district: DistrictId;
  kind: HotspotKind;
  name: string;
  terrainBonus: TerrainModifiers;
};

export type FactionInfluenceOverlay = {
  coordKey: string;
  points: string;
  faction: Faction;
  strength: number;
};

export type StrategicNodeState = "unknown" | "discovered" | "connected" | "owned" | "enemy" | "pressured";

export type StrategicNode = {
  coordKey: string;
  q: number;
  r: number;
  center: PixelPoint;
  tile: WorldHexTile;
  site: MapSite | null;
  hotspot: Hotspot | null;
  label: string;
  caption: string;
  kind: "portal" | "village" | "strategic" | "route";
  state: StrategicNodeState;
  isSelected: boolean;
  isFocus: boolean;
  isCenter: boolean;
  isConnected: boolean;
  isOwned: boolean;
  isEnemy: boolean;
  isPressured: boolean;
  isDiscovered: boolean;
  hasRouteActivity: boolean;
  suspiciousActivity?: {
    tone: "warning" | "danger" | "rare";
    label: string;
    summary: string;
  };
  distance: number;
  etaMinutes: number | null;
  score: number;
};

export type BuiltWorld = {
  width: number;
  height: number;
  layout: HexLayout;
  tiles: WorldHexTile[];
  centerByKey: Map<string, PixelPoint>;
  districtLabels: DistrictLabel[];
  frontierLines: FrontierLine[];
  centerPoint: PixelPoint;
};

export type StrategicMapProps = {
  worldId: string;
  tribeName: string;
  sites: BoardSite[];
  villages: Pick<VillageSummary, "id" | "name" | "type" | "materials" | "supplies" | "influence" | "buildingLevels">[];
  currentDay: number;
  sovereigntyScore: number;
  readOnly?: boolean;
  worldStarted?: boolean;
};

export type TileActionKind = "build" | "go" | "attack" | "annex" | "explore";
export type StoredMapCommandAction = TileActionKind | "spy";
export type ZoomLevel = 1 | 2 | 3 | 4;
export type ActionStep = "choose" | "configure";

export type TileActionOption = {
  kind: TileActionKind;
  label: string;
  enabled: boolean;
  reason?: string;
};

export type TroopTypeId = "militia" | "shooters" | "scouts" | "machinery";
export type TroopSelection = Record<TroopTypeId, number>;
export type TroopPreset = "light" | "balanced" | "heavy" | "custom";

export type MovementRouteStep = {
  coordKey: string;
  legMinutes: number;
  elapsedMinutes: number;
  arrivalAt?: string;
};

export type MovementDraft = {
  action: TileActionKind;
  from: AxialCoord;
  to: AxialCoord;
  etaMinutes: number;
  route: AxialCoord[];
  routeSteps: MovementRouteStep[];
};

export type BuildMode = "outpost" | "road";

export type StoredMapMovement = {
  id: string;
  worldId: string;
  sourceCoord: string;
  targetCoord: string;
  movementType: "attack" | "annex" | "support" | "spy" | "transport" | "scout";
  commandAction: StoredMapCommandAction;
  launchedAt: string;
  arrivalAt: string;
  etaMinutes: number;
  route: string[];
  routeSteps?: MovementRouteStep[];
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
    combatResult?: CombatResult;
    combatResolvedAt?: string;
    militaryScoreGained?: number;
    defenderMilitaryScoreGained?: number;
    satisfactionDamage?: number;
    loot?: Record<string, number>;
    annexConsumesDiplomat?: boolean;
    diplomatToken?: string;
    targetLabel?: string;
    reportedIntelCoordKeys?: string[];
  };
};
