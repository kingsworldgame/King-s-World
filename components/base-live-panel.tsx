"use client";

import { useEffect, useMemo, useState } from "react";

import { SectionCard, StatusBadge } from "@/components/ui";
import {
  calculateLegacySliceEconomyTick,
  calculateLegacySliceInfluenceCap,
  calculateLegacySliceUpgradeCost,
} from "@/core/GameBalance";

type BuildingId = "palace" | "bastion" | "arsenal" | "roads";

type Building = {
  id: BuildingId;
  name: string;
  level: number;
  effect: string;
  baseCost: {
    materials: number;
    energy: number;
    influence: number;
  };
  baseTimeMin: number;
  curve: number;
};

type Resources = {
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
};

type QueueItem = {
  id: string;
  buildingId: BuildingId;
  remainingMin: number;
};

const MINUTES_PER_DAY = 24 * 60;
const TICK_MS = 1000;
const GAME_MINUTES_PER_TICK = 1;


function format(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatTimeFromMinutes(minutes: number) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

function buildInitialState() {
  const initialBuildings: Building[] = [
    {
      id: "palace",
      name: "Palacio",
      level: 21,
      effect: "+ teto politico e influencia base",
      baseCost: { materials: 1240, energy: 180, influence: 90 },
      baseTimeMin: 84,
      curve: 1.085,
    },
    {
      id: "bastion",
      name: "Bastiao",
      level: 12,
      effect: "+ defesa estrutural da Coroa",
      baseCost: { materials: 2800, energy: 320, influence: 140 },
      baseTimeMin: 130,
      curve: 1.09,
    },
    {
      id: "arsenal",
      name: "Arsenal",
      level: 15,
      effect: "+ oficiais e elite militar",
      baseCost: { materials: 1720, energy: 220, influence: 120 },
      baseTimeMin: 96,
      curve: 1.08,
    },
    {
      id: "roads",
      name: "Malha Viaria Imperial",
      level: 5,
      effect: "+ logistica entre territorios proprios",
      baseCost: { materials: 4900, energy: 640, influence: 220 },
      baseTimeMin: 220,
      curve: 1.1,
    },
  ];

  const initialResources: Resources = {
    materials: 18240,
    supplies: 9550,
    energy: 6120,
    influence: 1340,
  };

  return { initialBuildings, initialResources };
}

function getUpgradeCost(building: Building) {
  return calculateLegacySliceUpgradeCost(building);
}

function getBuildingLevel(buildings: Building[], id: BuildingId): number {
  return buildings.find((building) => building.id === id)?.level ?? 1;
}

function tickEconomy(resources: Resources, buildings: Building[]) {
  const palace = getBuildingLevel(buildings, "palace");
  const bastion = getBuildingLevel(buildings, "bastion");
  const arsenal = getBuildingLevel(buildings, "arsenal");
  const roads = getBuildingLevel(buildings, "roads");

  return calculateLegacySliceEconomyTick({
    resources,
    palaceLevel: palace,
    bastionLevel: bastion,
    arsenalLevel: arsenal,
    roadsLevel: roads,
  }).nextResources;
}

export function BaseLivePanel() {
  const { initialBuildings, initialResources } = useMemo(() => buildInitialState(), []);
  const [buildings, setBuildings] = useState<Building[]>(initialBuildings);
  const [resources, setResources] = useState<Resources>(initialResources);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(94 * MINUTES_PER_DAY);
  const [hordeCountdown, setHordeCountdown] = useState(112);

  useEffect(() => {
    const timer = setInterval(() => {
      setTotalMinutes((current) => current + GAME_MINUTES_PER_TICK);
      setResources((current) => tickEconomy(current, buildings));
      setQueue((currentQueue) => {
        if (!currentQueue.length) {
          return currentQueue;
        }

        const updatedQueue = currentQueue
          .map((item) => ({ ...item, remainingMin: item.remainingMin - GAME_MINUTES_PER_TICK }))
          .filter((item) => item.remainingMin > 0);

        const completed = currentQueue.filter((item) => item.remainingMin <= GAME_MINUTES_PER_TICK);
        if (completed.length) {
          setBuildings((currentBuildings) => currentBuildings.map((building) => {
            const doneCount = completed.filter((item) => item.buildingId === building.id).length;
            if (!doneCount) {
              return building;
            }
            return { ...building, level: building.level + doneCount };
          }));
        }

        return updatedQueue;
      });
      setHordeCountdown((current) => (current <= 1 ? 180 : current - 1));
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [buildings]);

  const day = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const minuteOfDay = totalMinutes % MINUTES_PER_DAY;
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;

  const palaceLevel = buildings.find((building) => building.id === "palace")?.level ?? 1;
  const bastionLevel = buildings.find((building) => building.id === "bastion")?.level ?? 1;
  const arsenalLevel = buildings.find((building) => building.id === "arsenal")?.level ?? 1;
  const influenceCap = calculateLegacySliceInfluenceCap(palaceLevel);
  const kingRisk = bastionLevel >= 14 ? "baixo" : bastionLevel >= 10 ? "moderado" : "alto";
  const princeReady = palaceLevel >= 16 && bastionLevel >= 12;

  const canStartUpgrade = (building: Building) => {
    const cost = getUpgradeCost(building);
    return resources.materials >= cost.materials
      && resources.energy >= cost.energy
      && resources.influence >= cost.influence;
  };

  const startUpgrade = (building: Building) => {
    const cost = getUpgradeCost(building);
    if (!canStartUpgrade(building)) {
      return;
    }

    setResources((current) => ({
      materials: current.materials - cost.materials,
      supplies: current.supplies,
      energy: current.energy - cost.energy,
      influence: current.influence - cost.influence,
    }));
    setQueue((currentQueue) => [
      ...currentQueue,
      {
        id: `${building.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        buildingId: building.id,
        remainingMin: cost.timeMin,
      },
    ]);
  };

  const alerts = [
    resources.supplies < 1800 ? "Suprimentos em faixa critica" : "Suprimentos sob controle",
    resources.influence > influenceCap * 0.92 ? "Influencia perto do teto politico" : "Influencia com folga",
    hordeCountdown <= 35 ? `Horda pesada em ${hordeCountdown} min` : `Horda prevista em ${hordeCountdown} min`,
  ];

  return (
    <div className="dashboard-grid">
      <SectionCard title="Base Viva" eyebrow="Slice jogavel da aldeia ativa">
        <div className="building-grid">
          <div className="building-item">
            <div className="card-row">
              <strong>Relogio do mundo</strong>
              <StatusBadge label={`Dia ${day}`} tone="warning" />
            </div>
            <p className="list-meta">Horario atual: {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}</p>
            <p className="list-meta">Fila de upgrade: {queue.length ? `${queue.length} em progresso` : "vazia"}</p>
            <p className="list-meta">
              Recursos: {format(resources.materials)} M / {format(resources.supplies)} S / {format(resources.energy)} E / {format(resources.influence)} I
            </p>
          </div>

          {buildings.map((building) => {
            const cost = getUpgradeCost(building);
            const queueForBuilding = queue.filter((item) => item.buildingId === building.id);
            return (
              <div key={building.id} className="building-item">
                <div className="card-row">
                  <strong>{building.name}</strong>
                  <StatusBadge label={`Nv ${building.level}`} tone="neutral" />
                </div>
                <p className="list-meta">Efeito: {building.effect}</p>
                <p className="list-meta">
                  Proximo custo: {format(cost.materials)} Materiais / {format(cost.energy)} Energia / {format(cost.influence)} Influencia
                </p>
                <p className="list-meta">Tempo: {formatTimeFromMinutes(cost.timeMin)}</p>
                {queueForBuilding.length ? (
                  <p className="list-meta">
                    Em progresso: {queueForBuilding.map((item) => formatTimeFromMinutes(item.remainingMin)).join(", ")}
                  </p>
                ) : null}
                <div className="inline-actions">
                  <button type="button" className="secondary-button" disabled={!canStartUpgrade(building)} onClick={() => startUpgrade(building)}>
                    Upgrade
                  </button>
                  <span className="ghost-link">Detalhes</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Contexto da Coroa" eyebrow="Estado politico em tempo real">
        <div className="list-stack">
          <div className="timeline-item">
            <strong>Rei</strong>
            <p className="list-meta">Risco atual da capital: {kingRisk}. Bastiao nivel {bastionLevel}.</p>
          </div>
          <div className="timeline-item">
            <strong>Principe</strong>
            <p className="list-meta">
              {princeReady
                ? "Colonia pronta para sucessao se a capital cair."
                : "Ainda nao apto para sucessao; eleve Palacio e Bastiao."}
            </p>
          </div>
          <div className="timeline-item">
            <strong>Guarnicao</strong>
            <p className="list-meta">Arsenal nivel {arsenalLevel}. Cap de influencia: {format(influenceCap)}.</p>
          </div>
          {alerts.map((alert) => (
            <div key={alert} className="card-row">
              <StatusBadge label={alert} tone={alert.includes("critica") || alert.includes("Horda pesada") ? "danger" : "warning"} />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

