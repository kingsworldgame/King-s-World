"use client";

import { Crown, FlaskConical, Shield, TreePine, Wheat, X, Zap } from "lucide-react";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  calculateBuildingBenefit,
  calculateBuildingUpgradeLoad,
  calculateBuildingUpgradeCost,
  calculateVillageConstructionCapacity,
  calculateVillageConstructionLoad,
  calculateVillageConstructionRemaining,
  getEvolutionModeProfile,
  type EvolutionMode,
  type SovereignUpgradeCost, // Added
  calculateVillageDevelopment,
} from "@/core/GameBalance";
import {
  BUILDING_LAYOUT,
  BUILDINGS_BY_ID,
  type BuildingId,
  formatBenefit,
  formatCompact, getDefaultBuildingLevels,
} from "@/lib/buildings";
import { CITY_CLASS_META, TERRAIN_META, cityClassToArchetype, type CityClass } from "@/lib/cities";
import { useImperialState } from "@/lib/imperial-state";
import type { ResearchEntry, TimelineEntry, VillageSummary } from "@/lib/mock-data";
import { emitUiFeedback } from "@/lib/ui-feedback";

type LocalCommand = "guard" | "drill" | "sortie" | "fortify" | "rations";

type VillageSceneProps = {
  worldId: string;
  villages: Pick<VillageSummary, "id" | "materials" | "supplies" | "energy" | "influence" | "buildingLevels">[];
  village: Pick<VillageSummary, "id" | "name" | "type" | "cityClass" | "cityClassLocked" | "originKind" | "terrainKind" | "terrainLabel" | "materials" | "supplies" | "energy" | "influence" | "palaceLevel" | "buildingLevels">;
  researchEntries: ResearchEntry[];
  timelineEntries: TimelineEntry[];
  evolutionMode: EvolutionMode;
  localCommand: LocalCommand;
  initialSelectedBuildingId?: BuildingId | null;
};

type ResourceView = { materials: number; supplies: number; energy: number; influence: number };
type SceneBuildingId = Exclude<BuildingId, "roads">;
type CalibrationEntry = {
  xPct: number;
  yPct: number;
  sizePx: number;
  scale: number;
  dx: number;
  dy: number;
  badgeXPct: number;
  badgeYPct: number;
  clickRadius: number;
};

type DragState = {
  mode: "moveBadge";
  id: SceneBuildingId;
  pointerId: number;
  startX: number;
  startY: number;
  start: CalibrationEntry;
  width: number;
  height: number;
  zoom: number;
};

const ART_TUNING: Partial<Record<BuildingId, { scale: number; dx: number; dy: number }>> = {
  palace: { scale: 1.48, dx: 0, dy: 6 },
  senate: { scale: 1.3, dx: 1, dy: 2 },
  mines: { scale: 1.34, dx: 0, dy: -3 },
  farms: { scale: 1.34, dx: 1, dy: 0 },
  housing: { scale: 1.34, dx: 0, dy: 7 },
  research: { scale: 1.3, dx: -2, dy: -5 },
  barracks: { scale: 1.36, dx: -2, dy: 3 },
  arsenal: { scale: 1.34, dx: -1, dy: 4 },
  wonder: { scale: 1.32, dx: 0, dy: -6 },
};

const DEFAULT_ART_TUNING = { scale: 1.36, dx: 0, dy: 0 };
const SCENE_BUILDING_IDS = BUILDING_LAYOUT.map((slot) => slot.id) as SceneBuildingId[];
const DEFAULT_BACKGROUND_ZOOM = 1.09;
const DEFAULT_BACKGROUND_STRETCH_X = 1.07;

function buildCalibrationDefaults(): Record<SceneBuildingId, CalibrationEntry> {
  const defaults = {} as Record<SceneBuildingId, CalibrationEntry>;

  for (const slot of BUILDING_LAYOUT) {
    const tuning = ART_TUNING[slot.id] ?? DEFAULT_ART_TUNING;
    defaults[slot.id] = {
      xPct: slot.xPct,
      yPct: slot.yPct,
      sizePx: slot.sizePx,
      scale: tuning.scale,
      dx: tuning.dx,
      dy: tuning.dy,
      badgeXPct: slot.badgeXPct,
      badgeYPct: slot.badgeYPct,
      clickRadius: slot.clickRadius,
    };
  }

  return defaults;
}

const CALIBRATION_DEFAULTS = buildCalibrationDefaults();

const LOCAL_COMMAND_META: Record<LocalCommand, { label: string; summary: string }> = {
  guard: { label: "Guarnicao", summary: "Defesa local e prontidao de muralha" },
  drill: { label: "Treino", summary: "Preparo de tropa para resposta rapida" },
  sortie: { label: "Sortida", summary: "Pressao ofensiva e patrulha ativa" },
  fortify: { label: "Blindar", summary: "Foco em resistencia estrutural" },
  rations: { label: "Racao", summary: "Ajuste de suprimentos da guarnicao" },
};


function cloneCalibration(): Record<SceneBuildingId, CalibrationEntry> {
  const clone = {} as Record<SceneBuildingId, CalibrationEntry>;
  for (const id of SCENE_BUILDING_IDS) {
    clone[id] = { ...CALIBRATION_DEFAULTS[id] };
  }
  return clone;
}

function canAfford(cost: SovereignUpgradeCost, resources: ResourceView, currentInfluenceScore: number) {
  return (
    resources.materials >= cost.materials &&
    resources.supplies >= cost.supplies &&
    resources.energy >= cost.energy &&
    // Influence is no longer a resource check but a threshold check
    currentInfluenceScore >= cost.requiredInfluence
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function formatEta(minutes: number | null): string {
  if (minutes === null) return "--";
  const safe = Math.max(0, Math.round(minutes));
  if (safe <= 0) return "agora";
  const hh = Math.floor(safe / 60);
  const mm = safe % 60;
  if (hh <= 0) return `${mm}m`;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function VillageScene({
  worldId,
  villages,
  village,
  researchEntries,
  timelineEntries,
  evolutionMode,
  localCommand,
  initialSelectedBuildingId = null,
}: VillageSceneProps) {
  const sceneRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const badgeRefs = useRef<Partial<Record<SceneBuildingId, HTMLButtonElement | null>>>({});
  const [selectedBuildingId, setSelectedBuildingId] = useState<BuildingId | null>(null);
  const [opsLog, setOpsLog] = useState<string[]>([]);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationZoom, setCalibrationZoom] = useState(DEFAULT_BACKGROUND_ZOOM);
  const [backgroundStretchX, setBackgroundStretchX] = useState(DEFAULT_BACKGROUND_STRETCH_X);
  const [activeCalibrationId, setActiveCalibrationId] = useState<SceneBuildingId>("palace");
  const [calibration, setCalibration] = useState<Record<SceneBuildingId, CalibrationEntry>>(() =>
    cloneCalibration(),
  );
  const [jsonFeedback, setJsonFeedback] = useState("");
  const [pulseBadgeId, setPulseBadgeId] = useState<SceneBuildingId | null>(null);
  const [calibrationPanelCollapsed, setCalibrationPanelCollapsed] = useState(false);
  const [calibrationPanelDock, setCalibrationPanelDock] = useState<"top" | "bottom">("bottom");
  const { imperialState, setImperialState } = useImperialState(worldId, villages);
  const resources = imperialState.resources;
  const villageLevelOverrides = imperialState.buildingLevelsByVillage[village.id] ?? {};
  const assignedHero = imperialState.heroByVillage[village.id] ?? "none";
  const hasEngineer = assignedHero === "engineer";
  const cityClass = imperialState.cityClassByVillage[village.id] ?? village.cityClass ?? (village.type === "Capital" ? "metropole" : "neutral");
  const cityClassLocked = imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked ?? (village.type !== "Capital" && cityClass !== "neutral");
  const terrainMeta = village.terrainKind ? TERRAIN_META[village.terrainKind] : null;
  const cityClassMeta = CITY_CLASS_META[cityClass];
  const canChooseCityClass = village.type === "Capital" || !cityClassLocked;
  const localVillageResources = useMemo<ResourceView>(
    () => ({
      materials: village.materials,
      supplies: village.supplies,
      energy: village.energy,
      influence: village.influence,
    }),
    [village.energy, village.influence, village.materials, village.supplies],
  );

  const levels = useMemo(() => {
    const next = getDefaultBuildingLevels(Math.min(10, village.palaceLevel));

    for (const [id, level] of Object.entries(village.buildingLevels ?? {})) {
      if (typeof level !== "number") {
        continue;
      }
      const key = id as BuildingId;
      const definition = BUILDINGS_BY_ID[key];
      const hardCap = Math.min(10, definition?.maxLevel ?? 10);
      next[key] = clamp(Math.floor(level), 0, hardCap);
    }

    for (const [id, level] of Object.entries(villageLevelOverrides)) {
      if (typeof level !== "number") {
        continue;
      }
      const key = id as BuildingId;
      const definition = BUILDINGS_BY_ID[key];
      const hardCap = Math.min(10, definition?.maxLevel ?? 10);
      next[key] = clamp(Math.floor(level), 0, hardCap);
    }

    return next;
  }, [village.buildingLevels, village.palaceLevel, villageLevelOverrides]);

  const currentVillageDevelopment = useMemo(() => calculateVillageDevelopment(levels), [levels]);
  const baseVillageDevelopment = useMemo(() => {
    return calculateVillageDevelopment({
      ...levels,
      wonder: 0,
    });
  }, [levels]);
  const constructionCapacity = useMemo(
    () => calculateVillageConstructionCapacity(levels, hasEngineer),
    [hasEngineer, levels],
  );
  const constructionLoad = useMemo(() => calculateVillageConstructionLoad(levels), [levels]);
  const constructionRemaining = useMemo(
    () => calculateVillageConstructionRemaining(levels, hasEngineer),
    [hasEngineer, levels],
  );

  const modal = useMemo(() => {
    if (!selectedBuildingId) return null;
    const def = BUILDINGS_BY_ID[selectedBuildingId];
    const current = levels[selectedBuildingId] ?? 0;
    const nextLevel = Math.min(def.maxLevel, current + 1);
    const atMax = current >= def.maxLevel;
    const cost: SovereignUpgradeCost = calculateBuildingUpgradeCost(def, nextLevel, {
      evolutionMode,
      archetype: cityClassToArchetype(cityClass),
    });
    const wonderLocked = selectedBuildingId === "wonder" && current <= 0 && baseVillageDevelopment < 90;
    const nextLevels =
      selectedBuildingId === "roads" || atMax
        ? levels
        : {
            ...levels,
            [selectedBuildingId]: nextLevel,
          };
    const currentCap = currentVillageDevelopment;
    const nextCap = selectedBuildingId === "roads" || atMax ? currentCap : calculateVillageDevelopment(nextLevels);
    const nextConstructionLoad =
      selectedBuildingId === "roads" || atMax ? 0 : calculateBuildingUpgradeLoad(selectedBuildingId, nextLevel);
    const nextConstructionRemaining =
      selectedBuildingId === "roads" || atMax ? constructionRemaining : Math.max(0, constructionRemaining - nextConstructionLoad);

    return {
      id: selectedBuildingId,
      def,
      current,
      nextLevel,
      atMax,
      wonderLocked,
      cost,
      currentBenefit: calculateBuildingBenefit(def, current),
      nextBenefit: calculateBuildingBenefit(def, nextLevel),
      currentCap,
      nextCap,
      nextConstructionLoad,
      nextConstructionRemaining,
    };
  }, [baseVillageDevelopment, cityClass, constructionRemaining, currentVillageDevelopment, evolutionMode, levels, selectedBuildingId]);
  const resourceForecast = useMemo(() => {
    const lvMines = levels.mines ?? 0;
    const lvFarms = levels.farms ?? 0;
    const lvHousing = levels.housing ?? 0;
    const lvResearch = levels.research ?? 0;
    const lvPalace = levels.palace ?? 0;
    const lvSenate = levels.senate ?? 0;
    const lvWonder = levels.wonder ?? 0;

    const caps = {
      materials: Math.round(6000 + lvMines * 900 + lvHousing * 250 + lvPalace * 300),
      supplies: Math.round(5000 + lvFarms * 800 + lvHousing * 260 + lvSenate * 200),
      energy: Math.round(4000 + lvResearch * 700 + lvPalace * 250 + lvSenate * 180),
      influence: Math.round(1200 + lvPalace * 120 + lvSenate * 180 + lvWonder * 70),
    };

    const ratesPerMin = {
      materials: Math.max(0.2, 10 + lvMines * 2.5 + lvPalace * 0.8 + lvResearch * 0.3),
      supplies: Math.max(0.2, 9 + lvFarms * 2.4 + lvHousing * 0.6),
      energy: Math.max(0.2, 7 + lvResearch * 2.2 + lvPalace * 0.5),
      influence: Math.max(0.1, 2 + lvSenate * 0.7 + lvPalace * 0.4 + lvWonder * 0.3),
    };

    const eta = (stock: number, cap: number, rate: number): number | null => {
      if (stock >= cap) {
        return 0;
      }
      if (rate <= 0) {
        return null;
      }
      return Math.ceil((cap - stock) / rate);
    };

    return {
      caps,
      ratesPerMin,
      etaMinutes: {
        materials: eta(localVillageResources.materials, caps.materials, ratesPerMin.materials),
        supplies: eta(localVillageResources.supplies, caps.supplies, ratesPerMin.supplies),
        energy: eta(localVillageResources.energy, caps.energy, ratesPerMin.energy),
        influence: eta(localVillageResources.influence, caps.influence, ratesPerMin.influence),
      },
    };
  }, [levels, localVillageResources.energy, localVillageResources.influence, localVillageResources.materials, localVillageResources.supplies]);

  const pushLog = (line: string) => {
    setOpsLog((current) => [line, ...current].slice(0, 6));
  };

  const handleCityClassSelection = (nextClass: CityClass) => {
    if (!canChooseCityClass) {
      return;
    }

    const shouldLock = village.type === "Colonia";
    setImperialState((current) => ({
      ...current,
      cityClassByVillage: {
        ...current.cityClassByVillage,
        [village.id]: nextClass,
      },
      cityClassLockedByVillage: shouldLock
        ? {
            ...current.cityClassLockedByVillage,
            [village.id]: true,
          }
        : current.cityClassLockedByVillage,
      logs: [
        `${village.name}: cidade definida como ${CITY_CLASS_META[nextClass].label}${shouldLock ? " (travada)" : ""}`,
        ...current.logs,
      ].slice(0, 12),
    }));
    pushLog(`${village.name}: ${CITY_CLASS_META[nextClass].label}`);
  };


  const modeProfile = useMemo(() => getEvolutionModeProfile(evolutionMode), [evolutionMode]);

  useEffect(() => {
    setSelectedBuildingId(null);
    setOpsLog([]);
  }, [village.id]);

  useEffect(() => {
    setSelectedBuildingId(initialSelectedBuildingId);
  }, [initialSelectedBuildingId]);

  const activeCalibration = calibration[activeCalibrationId] ?? CALIBRATION_DEFAULTS[activeCalibrationId];

  const resetCurrentCalibration = () => {
    setCalibration((current) => ({
      ...current,
      [activeCalibrationId]: { ...CALIBRATION_DEFAULTS[activeCalibrationId] },
    }));
  };

  const resetAllCalibrations = () => {
    setCalibration(cloneCalibration());
    setCalibrationZoom(DEFAULT_BACKGROUND_ZOOM);
    setBackgroundStretchX(DEFAULT_BACKGROUND_STRETCH_X);
  };

  const copyCalibrationJson = async () => {
    const payload = JSON.stringify(
      {
        backgroundZoom: Number(calibrationZoom.toFixed(3)),
        backgroundStretchX: Number(backgroundStretchX.toFixed(3)),
        buildings: calibration,
      },
      null,
      2,
    );

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand("copy");
        textarea.remove();
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setJsonFeedback("JSON copiado.");
      return;
    }

    try {
      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kingsworld-calibration.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setJsonFeedback("Clipboard bloqueado. Arquivo baixado.");
    } catch {
      setJsonFeedback("Nao foi possivel copiar nem baixar o JSON.");
    }
  };

  useEffect(() => {
    if (!jsonFeedback) return;
    const timer = window.setTimeout(() => setJsonFeedback(""), 2800);
    return () => window.clearTimeout(timer);
  }, [jsonFeedback]);

  useEffect(() => {
    if (!pulseBadgeId) return;
    const timer = window.setTimeout(() => setPulseBadgeId(null), 360);
    return () => window.clearTimeout(timer);
  }, [pulseBadgeId]);

  useEffect(() => {
    if (!calibrationMode) {
      setCalibrationPanelCollapsed(false);
    }
  }, [calibrationMode]);

  const findBadgeHit = (clientX: number, clientY: number): SceneBuildingId | null => {
    let winner: { id: SceneBuildingId; distance: number } | null = null;

    for (const id of SCENE_BUILDING_IDS) {
      const badge = badgeRefs.current[id];
      if (!badge) {
        continue;
      }

      const rect = badge.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      const radius = Math.max(14, calibration[id]?.clickRadius ?? CALIBRATION_DEFAULTS[id].clickRadius);

      if (distance > radius) {
        continue;
      }

      if (!winner || distance < winner.distance) {
        winner = { id, distance };
      }
    }

    return winner?.id ?? null;
  };

  const openBuildingByBadgeHit = (clientX: number, clientY: number) => {
    const hitId = findBadgeHit(clientX, clientY);
    if (!hitId) {
      return;
    }
    emitUiFeedback("open", "light");
    setPulseBadgeId(hitId);
    setSelectedBuildingId(hitId);
  };

  const beginDrag = (event: React.PointerEvent, id: SceneBuildingId, mode: DragState["mode"]) => {
    if (!calibrationMode || !sceneRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveCalibrationId(id);
    setSelectedBuildingId(null);
    const rect = sceneRef.current.getBoundingClientRect();
    dragRef.current = {
      mode,
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...calibration[id] },
      width: rect.width,
      height: rect.height,
      zoom: calibrationZoom,
    };
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const zoom = Math.max(0.01, drag.zoom);

      setCalibration((current) => ({
        ...current,
        [drag.id]: {
          ...current[drag.id],
          badgeXPct: clamp(drag.start.badgeXPct + (dx / (drag.width * zoom)) * 100, 0, 100),
          badgeYPct: clamp(drag.start.badgeYPct + (dy / (drag.height * zoom)) * 100, 0, 100),
        },
      }));
    };

    const onEnd = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [calibrationMode]);

  const onUpgrade = () => {
    const currentInfluenceScore = currentVillageDevelopment;
    const hasConstructionRoom = modal ? modal.nextConstructionLoad <= constructionRemaining : false;

    if (!modal || modal.atMax || modal.wonderLocked || !hasConstructionRoom || !canAfford(modal.cost, resources, currentInfluenceScore)) return;
    setImperialState((current) => ({
      ...current,
      resources: {
        ...current.resources,
        materials: current.resources.materials - modal.cost.materials,
        supplies: current.resources.supplies - modal.cost.supplies,
        energy: current.resources.energy - modal.cost.energy,
      },
      buildingLevelsByVillage: {
        ...current.buildingLevelsByVillage,
        [village.id]: {
          ...(current.buildingLevelsByVillage[village.id] ?? {}),
          [modal.id]: modal.nextLevel,
        },
      },
      logs: [`Upgrade ${modal.def.name} -> Nv ${modal.nextLevel}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Upgrade ${modal.def.name} na cidade para Nv ${modal.nextLevel}`);
  };

  return (
    <>
      <section
        ref={sceneRef}
        className={`relative -mx-2 -mb-0.5 -mt-3 flex min-h-0 flex-1 overflow-hidden rounded-[22px] ${calibrationMode ? "select-none touch-none" : ""
          }`}
        onWheel={(event) => {
          if (!calibrationMode) return;
          event.preventDefault();
          const next = clamp(calibrationZoom + (event.deltaY < 0 ? 0.05 : -0.05), 0.8, 2.2);
          setCalibrationZoom(next);
        }}
        onPointerUp={(event) => {
          if (calibrationMode) return;
          const target = event.target as HTMLElement;
          if (target.closest("[data-scene-control='true']")) {
            return;
          }
          openBuildingByBadgeHit(event.clientX, event.clientY);
        }}
      >
        <button
          type="button"
          data-scene-control="true"
          onClick={() => {
            setCalibrationMode((current) => !current);
            setSelectedBuildingId(null);
          }}
          className={`absolute left-2 top-2 z-30 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-md ${calibrationMode
            ? "border-sky-200/70 bg-sky-400/20 text-sky-100"
            : "border-white/50 bg-slate-900/45 text-slate-100"
            }`}
        >
          {calibrationMode ? "Fechar" : "Gerenciar"}
        </button>

        <button
          type="button"
          data-scene-control="true"
          onClick={() => setSelectedBuildingId("roads")}
          className="absolute right-2 top-2 z-30 rounded-full border border-white/50 bg-slate-900/45 px-2.5 py-1 text-[10px] font-bold text-slate-100 backdrop-blur-md"
        >
          M. Viaria Nv {levels.roads}
        </button>

        {!calibrationMode ? (
          <div className="absolute left-2 right-2 top-12 z-20 rounded-2xl border border-white/20 bg-slate-950/36 p-2 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                  {village.type === "Capital" ? "Capital" : "Colonia"} · Cidade
                </p>
                <p className="text-sm font-black text-slate-100">{village.name}</p>
                <p className="text-[10px] text-slate-300">
                  Classe {cityClassMeta.label}
                  {terrainMeta ? ` · Terreno ${village.terrainLabel ?? terrainMeta.label}` : ""}
                </p>
              </div>
              <div className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">
                {currentVillageDevelopment}/100
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1">
              {(["metropole", "posto_avancado", "bastiao", "celeiro"] as CityClass[]).map((option) => {
                const isActive = cityClass === option;
                const isDisabled = !canChooseCityClass;
                const meta = CITY_CLASS_META[option];
                return (
                  <button
                    key={option}
                    type="button"
                    data-scene-control="true"
                    disabled={isDisabled}
                    onClick={() => handleCityClassSelection(option)}
                    className={`rounded-xl border px-2 py-1.5 text-left transition ${
                      isActive
                        ? "border-cyan-200/70 bg-cyan-400/18 text-cyan-50"
                        : "border-white/12 bg-white/6 text-slate-200"
                    } ${isDisabled ? "cursor-not-allowed opacity-55" : "hover:bg-white/12"}`}
                  >
                    <p className="text-[10px] font-bold">{meta.shortLabel}</p>
                    <p className="line-clamp-2 text-[9px] text-slate-300">{meta.summary}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-1 text-[10px] text-slate-300">
              {canChooseCityClass
                ? village.type === "Capital"
                  ? "A Capital ainda pode redefinir sua classe. Colonias travam a escolha quando voce define."
                  : "Esta colonia ainda esta neutra. Escolha uma classe uma vez para travar a identidade dela."
                : `Classe travada: ${cityClassMeta.label}.`}
            </p>
          </div>
        ) : null}

        <div
          className="absolute inset-0 z-0"
          style={{
            transform: `scale(${calibrationZoom})`,
            transformOrigin: "50% 50%",
          }}
        >
          <Image
            src="/background.jpg?v=3"
            alt={`Cidade ${village.name}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ transform: `scaleX(${backgroundStretchX})`, transformOrigin: "50% 50%" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,transparent_20%,rgba(2,6,23,0.24)_100%)]" />

          {BUILDING_LAYOUT.map((slot) => {
            const def = BUILDINGS_BY_ID[slot.id];
            const badgeSelected = calibrationMode ? activeCalibrationId === slot.id : selectedBuildingId === slot.id;
            const calibrated = calibration[slot.id] ?? CALIBRATION_DEFAULTS[slot.id];
            const hitRadius = clamp(Math.round(calibrated.clickRadius), 14, 120);

            return (
              <Fragment key={slot.id}>
                {calibrationMode ? (
                  <div
                    className={`pointer-events-none absolute rounded-full border ${activeCalibrationId === slot.id
                      ? "border-cyan-200/85 bg-cyan-400/20"
                      : "border-cyan-100/45 bg-cyan-400/10"
                      }`}
                    style={{
                      left: `${calibrated.badgeXPct}%`,
                      top: `${calibrated.badgeYPct}%`,
                      width: hitRadius * 2,
                      height: hitRadius * 2,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ) : null}

                <button
                  ref={(node) => {
                    badgeRefs.current[slot.id] = node;
                  }}
                  type="button"
                  onPointerDown={(event) => {
                    if (!calibrationMode) {
                      return;
                    }
                    beginDrag(event, slot.id, "moveBadge");
                  }}
                  onClick={() => {
                    if (calibrationMode) {
                      setActiveCalibrationId(slot.id);
                    }
                  }}
                  className={`absolute z-10 grid h-7 w-7 place-items-center rounded-full border text-[11px] font-black transition-all duration-150 ${badgeSelected
                    ? "border-sky-100/90 bg-white/30 text-white shadow-[0_0_0_2px_rgba(125,211,252,0.35)]"
                    : "border-white/50 bg-white/15 text-slate-100"
                    } ${calibrationMode ? "cursor-grab backdrop-blur-md" : "pointer-events-none backdrop-blur-lg"} ${pulseBadgeId === slot.id ? "scale-[1.14] border-cyan-200/95 bg-cyan-300/30" : ""
                    }`}
                  style={{
                    left: `${calibrated.badgeXPct}%`,
                    top: `${calibrated.badgeYPct}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-label={`Abrir ${def.name}`}
                  title={def.name}
                >
                  {levels[slot.id]}
                </button>
              </Fragment>
            );
          })}
        </div>

        {calibrationMode ? (
          <div
            data-scene-control="true"
            className={`absolute right-2 z-20 w-[min(360px,calc(100%-16px))] rounded-2xl border border-white/35 bg-slate-950/62 p-2 shadow-xl backdrop-blur-xl ${calibrationPanelDock === "top" ? "top-12" : "bottom-2"
              }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-[11px] font-semibold text-slate-100">
                Ajustando: {BUILDINGS_BY_ID[activeCalibrationId].name}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalibrationPanelDock((dock) => (dock === "bottom" ? "top" : "bottom"))}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100"
                >
                  {calibrationPanelDock === "bottom" ? "Topo" : "Baixo"}
                </button>
                <button
                  type="button"
                  onClick={() => setCalibrationPanelCollapsed((current) => !current)}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100"
                >
                  {calibrationPanelCollapsed ? "Abrir" : "Min"}
                </button>
                <button
                  type="button"
                  onClick={resetCurrentCalibration}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={resetAllCalibrations}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100"
                >
                  Tudo
                </button>
                <button
                  type="button"
                  onClick={() => void copyCalibrationJson()}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100"
                >
                  JSON
                </button>
              </div>
            </div>

            {calibrationPanelCollapsed ? (
              <p className="mt-1 text-[10px] text-slate-300">Painel recolhido. Arraste os badges inferiores sem bloqueio.</p>
            ) : (
              <>
                <p className="mt-1 text-[10px] text-slate-300">
                  Arraste o badge de nivel para posicionar o gatilho de toque. O circulo translucido mostra o raio real de clique (hitbox).
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCalibrationZoom((current) => clamp(current - 0.1, 0.8, 2.2))}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={0.8}
                    max={2.2}
                    step={0.01}
                    value={calibrationZoom}
                    onChange={(event) => setCalibrationZoom(Number(event.target.value))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setCalibrationZoom((current) => clamp(current + 0.1, 0.8, 2.2))}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalibrationZoom(DEFAULT_BACKGROUND_ZOOM)}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    {(DEFAULT_BACKGROUND_ZOOM * 100).toFixed(0)}%
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBackgroundStretchX((current) => clamp(current - 0.02, 0.8, 1.6))}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.01}
                    value={backgroundStretchX}
                    onChange={(event) => setBackgroundStretchX(Number(event.target.value))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setBackgroundStretchX((current) => clamp(current + 0.02, 0.8, 1.6))}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundStretchX(DEFAULT_BACKGROUND_STRETCH_X)}
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    BG {(DEFAULT_BACKGROUND_STRETCH_X * 100).toFixed(0)}%
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCalibration((current) => ({
                        ...current,
                        [activeCalibrationId]: {
                          ...current[activeCalibrationId],
                          clickRadius: clamp((current[activeCalibrationId]?.clickRadius ?? 30) - 2, 14, 120),
                        },
                      }))
                    }
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={14}
                    max={120}
                    step={1}
                    value={activeCalibration.clickRadius}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setCalibration((current) => ({
                        ...current,
                        [activeCalibrationId]: {
                          ...current[activeCalibrationId],
                          clickRadius: clamp(next, 14, 120),
                        },
                      }));
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCalibration((current) => ({
                        ...current,
                        [activeCalibrationId]: {
                          ...current[activeCalibrationId],
                          clickRadius: clamp((current[activeCalibrationId]?.clickRadius ?? 30) + 2, 14, 120),
                        },
                      }))
                    }
                    className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100"
                  >
                    +
                  </button>
                  <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
                    Hitbox {Math.round(activeCalibration.clickRadius)}px
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-300">
                  Zoom {(calibrationZoom * 100).toFixed(0)}% | BG X {backgroundStretchX.toFixed(2)}x | Badge X {activeCalibration.badgeXPct.toFixed(1)}% | Badge Y {activeCalibration.badgeYPct.toFixed(1)}%
                </p>
                {jsonFeedback ? (
                  <p className="mt-1 text-[10px] font-semibold text-sky-100">{jsonFeedback}</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      {!calibrationMode && modal ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => {
              emitUiFeedback("close", "light");
              setSelectedBuildingId(null);
            }}
          />
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+44px)] mx-auto max-h-[72vh] w-[calc(100%-14px)] max-w-md overflow-y-auto rounded-[24px] kw-glass p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300">Edificio</p>
                <h3 className="text-xl font-black text-slate-100">{modal.def.name}</h3>
                <p className="mt-1 inline-flex rounded-full border border-white/20 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">Modo: {modeProfile.label}</p>
                <p className="text-sm text-slate-300">{modal.def.summary}</p>
                <p className="text-[11px] text-cyan-100/90">{LOCAL_COMMAND_META[localCommand].summary}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  emitUiFeedback("close", "light");
                  setSelectedBuildingId(null);
                }}
                className="kw-glass-soft rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-white/15 bg-white/6 p-2">
              <p className="text-[11px] text-slate-300">Classe da cidade</p>
              <p className="text-sm font-semibold text-slate-100">{cityClassMeta.label}</p>
              <p className="text-[10px] text-slate-300">
                {terrainMeta ? `Terreno: ${village.terrainLabel ?? terrainMeta.label}. ` : ""}
                Esta classe define o peso economico e estrutural desta cidade.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="kw-glass-soft rounded-xl p-2"><p className="text-[11px] text-slate-300">Nivel atual</p><p className="text-lg font-bold">Nv {modal.current}</p></div>
              <div className="kw-glass-soft rounded-xl p-2"><p className="text-[11px] text-slate-300">Proximo</p><p className="text-lg font-bold">Nv {modal.nextLevel}</p></div>
            </div>

            {modal.id === "wonder" ? (
              <div className={`mt-2 rounded-xl border p-2 ${modal.wonderLocked ? "border-amber-300/45 bg-amber-400/10 text-amber-100" : "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"}`}>
                <p className="text-[11px] font-semibold">Maravilha local da cidade</p>
                <p className="text-[11px]">
                  Palacio, Senado, Minas, Fazendas, Habitacoes, C. Pesquisa, Quartel, Arsenal e Muralha somam 90. A Maravilha local nao sobe de 0 a 10: ela entra uma vez so, fecha +10 de uma vez e completa os 100 da cidade.
                </p>
                <p className="mt-1 text-[11px] text-slate-200/90">
                  Isso e separado do pilar global de Maravilhas, que continua vindo dos 5 slots mundiais e vale ate 250 de influencia.
                </p>
              </div>
            ) : null}

            <div className="mt-2 kw-glass-soft rounded-xl p-2">
              <p className="text-[11px] text-slate-300">{modal.def.benefit.label}</p>
              <p className="text-sm font-semibold">{formatBenefit(modal.def, modal.currentBenefit)} {"->"} {formatBenefit(modal.def, modal.nextBenefit)}</p>
            </div>

            <div className="kw-status-grid kw-status-grid--2 mt-2">
              <div className={`rounded-lg p-1.5 text-center ${resources.materials >= modal.cost.materials ? "kw-glass-soft" : "border border-rose-300/50 bg-rose-400/15"}`}><TreePine className="mx-auto h-3.5 w-3.5 text-amber-200" /><p className="text-[10px] font-bold">{formatCompact(modal.cost.materials)}</p></div>
              <div className={`rounded-lg p-1.5 text-center ${resources.supplies >= modal.cost.supplies ? "kw-glass-soft" : "border border-rose-300/50 bg-rose-400/15"}`}><Wheat className="mx-auto h-3.5 w-3.5 text-amber-200" /><p className="text-[10px] font-bold">{formatCompact(modal.cost.supplies)}</p></div>
              <div className={`rounded-lg p-1.5 text-center ${resources.energy >= modal.cost.energy ? "kw-glass-soft" : "border border-rose-300/50 bg-rose-400/15"}`}><Zap className="mx-auto h-3.5 w-3.5 text-yellow-200" /><p className="text-[10px] font-bold">{formatCompact(modal.cost.energy)}</p></div>
              <div className={`rounded-lg p-1.5 text-center ${currentVillageDevelopment >= modal.cost.requiredInfluence ? "kw-glass-soft" : "border border-rose-300/50 bg-rose-400/15"}`}><Crown className="mx-auto h-3.5 w-3.5 text-cyan-200" /><p className="text-[10px] font-bold">{formatCompact(modal.cost.requiredInfluence)}</p><p className="text-[9px] text-slate-300">Req.</p></div>
            </div>

            <div className="mt-2 kw-glass-soft rounded-xl p-2">
              <p className="text-[11px] text-slate-300">Tempo de upgrade</p>
              <p className="text-sm font-semibold">Instantaneo</p>
              <p className="text-[10px] text-slate-300">
                Desenvolvimento da cidade: {formatCompact(modal.currentCap)} {"->"} {formatCompact(modal.nextCap)}
              </p>
            </div>

            <div className="mt-2 kw-glass-soft rounded-xl p-2">
              <p className="text-[11px] text-slate-300">Cap de obras da cidade</p>
              <p className="text-sm font-semibold">
                {constructionLoad}/{constructionCapacity} usadas Â· saldo {constructionRemaining}
              </p>
              <p className="text-[10px] text-slate-300">
                Proximo upgrade consome {modal.nextConstructionLoad}. Depois sobra {modal.nextConstructionRemaining}.
                {hasEngineer ? " Engenheiro local ativo." : ""}
              </p>
            </div>

            <div className="mt-2 kw-glass-soft rounded-xl p-2">
              <p className="text-[11px] text-slate-300">Buffer local da cidade e tempo de lotacao</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1">
                  <p className="font-semibold text-slate-100">Materiais</p>
                  <p className="text-slate-300">{formatCompact(localVillageResources.materials)} / {formatCompact(resourceForecast.caps.materials)}</p>
                  <p className="text-cyan-100">Enche em {formatEta(resourceForecast.etaMinutes.materials)}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1">
                  <p className="font-semibold text-slate-100">Suprimentos</p>
                  <p className="text-slate-300">{formatCompact(localVillageResources.supplies)} / {formatCompact(resourceForecast.caps.supplies)}</p>
                  <p className="text-cyan-100">Enche em {formatEta(resourceForecast.etaMinutes.supplies)}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1">
                  <p className="font-semibold text-slate-100">Energia</p>
                  <p className="text-slate-300">{formatCompact(localVillageResources.energy)} / {formatCompact(resourceForecast.caps.energy)}</p>
                  <p className="text-cyan-100">Enche em {formatEta(resourceForecast.etaMinutes.energy)}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1">
                  <p className="font-semibold text-slate-100">Influencia</p>
                  <p className="text-slate-300">{formatCompact(localVillageResources.influence)} / {formatCompact(resourceForecast.caps.influence)}</p>
                  <p className="text-cyan-100">Enche em {formatEta(resourceForecast.etaMinutes.influence)}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-300">
                O pagamento sai do Tesouro Imperial. O buffer acima mostra so a musculatura local desta cidade.
              </p>
            </div>

            <div className="mt-2 kw-glass-soft rounded-xl p-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                {modal.id === "research" ? <FlaskConical className="h-3.5 w-3.5 text-sky-300" /> : <Shield className="h-3.5 w-3.5 text-sky-300" />}
                Painel tatico do edificio
              </div>
              {modal.id === "research" ? (
                <div className="mt-1.5 space-y-1">
                  {researchEntries.slice(0, 3).map((r) => (
                    <p key={r.name} className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px]">
                      {r.name} - Nv {r.level} - {r.progress}%
                    </p>
                  ))}
                </div>
              ) : modal.id === "roads" ? (
                <div className="mt-1.5 space-y-1">
                  {timelineEntries.slice(0, 3).map((t) => (
                    <p key={t.title} className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px]">
                      {t.title} - ETA {t.eta}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-300">
                  Acoes operacionais da cidade ficam nos chips taticos da Base. Este modal mostra status, bonus e upgrade.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={modal.atMax || modal.wonderLocked || modal.nextConstructionLoad > constructionRemaining || !canAfford(modal.cost, resources, currentVillageDevelopment)}
              onClick={onUpgrade}
              className="mt-3 w-full rounded-xl border border-white/20 bg-sky-500/80 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-500/60"
            >
              {modal.atMax
                ? "Nivel maximo alcancado"
                : modal.wonderLocked
                  ? `Maravilha bloqueada ate 90/90 (${baseVillageDevelopment}/90)`
                  : modal.nextConstructionLoad > constructionRemaining
                    ? `Cap de obras insuficiente (${constructionRemaining} livre / precisa ${modal.nextConstructionLoad})`
                  : canAfford(modal.cost, resources, currentVillageDevelopment)
                    ? `Iniciar upgrade para Nv ${modal.nextLevel}`
                    : "Recursos insuficientes"}
            </button>

            {opsLog.length > 0 ? <div className="mt-2 kw-glass-soft rounded-xl p-2">{opsLog.map((line) => <p key={line} className="text-[11px]">{line}</p>)}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}






















































