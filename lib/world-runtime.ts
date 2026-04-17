"use client";

import { useEffect, useMemo, useState } from "react";

import type { WorldPayload } from "@/lib/world-data";
import type { WorldState } from "@/lib/mock-data";

export const WORLD_DURATION_DAYS = 120;
const REAL_DAY_MS = 24 * 60 * 60 * 1000;
const CAMPAIGN_START_UTC_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

function clampDay(day: number): number {
  return Math.max(0, Math.min(WORLD_DURATION_DAYS, Math.floor(day)));
}

export function getCampaignDate(day: number): Date {
  return new Date(CAMPAIGN_START_UTC_MS + clampDay(day) * REAL_DAY_MS);
}

function createFallbackPayload(worldId: string): WorldPayload {
  const placeholderVillage = {
    id: "loading-village",
    name: "Capital",
    type: "Capital" as const,
    politicalState: "Sincronizando",
    materials: 0,
    supplies: 0,
    energy: 0,
    influence: 0,
    palaceLevel: 0,
    kingHere: false,
    princeHere: false,
    underAttack: false,
    deficits: [],
    buildingLevels: {},
  };

  const world: WorldState = {
    id: worldId,
    name: "Carregando mundo",
    day: 0,
    phase: "Sincronizando",
    averageInfluenceScore: 0,
    activeAlerts: ["Lendo mundo persistente do Supabase..."],
    activeVillageId: placeholderVillage.id,
    villages: [placeholderVillage],
    researches: [],
    timeline: [],
    buildings: [],
    boardSites: [],
    reports: [],
    mobilization: {
      available: false,
      active: false,
      speedPenaltyMult: 1,
      interceptRiskMult: 1,
      orderLabel: "Aguardando",
      narrative: "Sincronizando estado persistente.",
    },
    tribe: {
      name: "Sem tribo",
      citadelStatus: "Sincronizando",
      totalScore: 0,
      rank: 0,
      membersAlive: 0,
    },
    sovereignty: {
      kingAlive: false,
      councilHeroes: 0,
      councilComposition: [],
      militaryRankingPoints: 0,
      wondersControlled: 0,
      eraQuestsCompleted: 0,
      tribeDomeUnlocked: false,
      tribeLoyaltyStage: 0,
    },
  };

  return {
    world,
    runtimeState: {
      started: false,
      realTimeEnabled: false,
      anchorDay: 0,
      anchorStartedAtMs: null,
    },
    isSandboxWorld: false,
    routeWorldId: worldId,
    worldPlayerId: null,
  };
}

export function useLiveWorld(worldId: string, initialPayload?: WorldPayload) {
  const [payload, setPayload] = useState<WorldPayload>(initialPayload ?? createFallbackPayload(worldId));

  useEffect(() => {
    if (initialPayload) {
      setPayload(initialPayload);
    }
  }, [initialPayload]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/worlds/${worldId}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const nextPayload = (await response.json()) as WorldPayload;
        if (active) {
          setPayload(nextPayload);
        }
      } catch {
        // keep last good payload on transient failures
      }
    };

    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [worldId]);

  const campaignDate = useMemo(() => getCampaignDate(payload.world.day), [payload.world.day]);

  return {
    world: payload.world,
    runtimeState: payload.runtimeState,
    isSandboxWorld: payload.isSandboxWorld,
    campaignDate,
    worldPlayerId: payload.worldPlayerId,
    beginWorld: (): void => undefined,
    toggleRealTime: (): void => undefined,
    advanceDay: (): void => undefined,
    rewindDay: (): void => undefined,
    setManualDay: (_day: number): void => undefined,
    resetWorld: (): void => undefined,
  };
}
