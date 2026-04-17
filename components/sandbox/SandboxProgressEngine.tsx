"use client";

import { useEffect, useMemo, useRef } from "react";

import { mergeImperialVillages, useImperialState, type ImperialState, type SandboxSnapshot } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { collectCompletedActionsForDay, resolveSandboxDay } from "@/lib/sandbox-day-resolution";

type SandboxProgressEngineProps = {
  worldId: string;
  currentDay: number;
  villages: VillageSummary[];
};

function cloneState(state: ImperialState): ImperialState {
  return {
    ...state,
    resources: { ...state.resources },
    troops: { ...state.troops },
    heroByVillage: { ...state.heroByVillage },
    diplomatByVillage: { ...state.diplomatByVillage },
    cityClassByVillage: { ...state.cityClassByVillage },
    cityClassLockedByVillage: { ...state.cityClassLockedByVillage },
    deployedByVillage: { ...state.deployedByVillage },
    buildingLevelsByVillage: Object.fromEntries(
      Object.entries(state.buildingLevelsByVillage).map(([villageId, levels]) => [villageId, { ...levels }]),
    ),
    constructionLoadByVillage: { ...state.constructionLoadByVillage },
    extraVillages: state.extraVillages.map((village) => ({
      ...village,
      axial: { ...village.axial },
      buildingLevels: { ...village.buildingLevels },
      deficits: [...village.deficits],
    })),
    sandboxCompletedActionIds: [...state.sandboxCompletedActionIds],
    sandboxSnapshots: { ...state.sandboxSnapshots },
    logs: [...state.logs],
  };
}

function createSnapshot(state: ImperialState): SandboxSnapshot {
  return {
    resources: { ...state.resources },
    troops: { ...state.troops },
    heroByVillage: { ...state.heroByVillage },
    diplomatByVillage: { ...state.diplomatByVillage },
    recruitedDiplomats: state.recruitedDiplomats,
    recruitedTribeEnvoys: state.recruitedTribeEnvoys,
    tribeEnvoysCommitted: state.tribeEnvoysCommitted,
    annexEnvoysCommitted: state.annexEnvoysCommitted,
    cityClassByVillage: { ...state.cityClassByVillage },
    cityClassLockedByVillage: { ...state.cityClassLockedByVillage },
    deployedByVillage: { ...state.deployedByVillage },
    buildingLevelsByVillage: Object.fromEntries(
      Object.entries(state.buildingLevelsByVillage).map(([villageId, levels]) => [villageId, { ...levels }]),
    ),
    constructionLoadByVillage: { ...state.constructionLoadByVillage },
    extraVillages: state.extraVillages.map((village) => ({
      ...village,
      axial: { ...village.axial },
      buildingLevels: { ...village.buildingLevels },
      deficits: [...village.deficits],
    })),
    sandboxStrategyId: state.sandboxStrategyId,
    sandboxCompletedActionIds: [...state.sandboxCompletedActionIds],
    sandboxQuestsCompleted: state.sandboxQuestsCompleted,
    sandboxWondersBuilt: state.sandboxWondersBuilt,
    sandboxDomeActive: state.sandboxDomeActive,
    sandboxMarchStarted: state.sandboxMarchStarted,
    logs: [...state.logs],
  };
}

function restoreSnapshot(state: ImperialState, snapshot: SandboxSnapshot, day: number): ImperialState {
  return {
    ...state,
    resources: { ...snapshot.resources },
    troops: { ...snapshot.troops },
    heroByVillage: { ...snapshot.heroByVillage },
    diplomatByVillage: { ...snapshot.diplomatByVillage },
    recruitedDiplomats: snapshot.recruitedDiplomats,
    recruitedTribeEnvoys: snapshot.recruitedTribeEnvoys,
    tribeEnvoysCommitted: snapshot.tribeEnvoysCommitted,
    annexEnvoysCommitted: snapshot.annexEnvoysCommitted,
    cityClassByVillage: { ...snapshot.cityClassByVillage },
    cityClassLockedByVillage: { ...snapshot.cityClassLockedByVillage },
    deployedByVillage: { ...snapshot.deployedByVillage },
    buildingLevelsByVillage: Object.fromEntries(
      Object.entries(snapshot.buildingLevelsByVillage).map(([villageId, levels]) => [villageId, { ...levels }]),
    ),
    constructionLoadByVillage: { ...snapshot.constructionLoadByVillage },
    extraVillages: snapshot.extraVillages.map((village) => ({
      ...village,
      axial: { ...village.axial },
      buildingLevels: { ...village.buildingLevels },
      deficits: [...village.deficits],
    })),
    sandboxStrategyId: snapshot.sandboxStrategyId,
    sandboxCompletedActionIds: [...snapshot.sandboxCompletedActionIds],
    sandboxQuestsCompleted: snapshot.sandboxQuestsCompleted,
    sandboxWondersBuilt: snapshot.sandboxWondersBuilt,
    sandboxDomeActive: snapshot.sandboxDomeActive,
    sandboxMarchStarted: snapshot.sandboxMarchStarted,
    sandboxLastSyncedDay: day,
    logs: [...snapshot.logs],
  };
}

function resolveStateForDay(state: ImperialState, targetDay: number, villages: VillageSummary[]): ImperialState {
  const exactSnapshot = state.sandboxSnapshots[String(targetDay)];
  if (exactSnapshot) {
    return restoreSnapshot(state, exactSnapshot, targetDay);
  }

  const candidateDays = Object.keys(state.sandboxSnapshots)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry <= targetDay)
    .sort((left, right) => right - left);

  const baseDay = candidateDays[0] ?? 0;
  const baseSnapshot = state.sandboxSnapshots[String(baseDay)];
  let working = baseSnapshot ? restoreSnapshot(state, baseSnapshot, baseDay) : { ...state, sandboxLastSyncedDay: 0 };
  const nextSnapshots = { ...state.sandboxSnapshots };

  for (let day = baseDay + 1; day <= targetDay; day += 1) {
    working = passiveDailyIncome(working, villages, day);
    nextSnapshots[String(day)] = createSnapshot(working);
  }

  return {
    ...working,
    sandboxLastSyncedDay: targetDay,
    sandboxSnapshots: nextSnapshots,
  };
}

function passiveDailyIncome(state: ImperialState, villages: VillageSummary[], day: number): ImperialState {
  void villages;
  const completedActions = collectCompletedActionsForDay(state.sandboxCompletedActionIds, day);
  const resolution = resolveSandboxDay(day, completedActions);
  const logLine =
    resolution.actionCount > 0
      ? `Dia ${day} resolvido: ${resolution.actionCount} acao(oes) geraram progresso real.`
      : `Dia ${day} resolvido: sem ordens registradas, sem ganho automatico.`;

  return {
    ...state,
    resources: {
      materials: state.resources.materials + resolution.resources.materials,
      supplies: state.resources.supplies + resolution.resources.supplies,
      energy: state.resources.energy + resolution.resources.energy,
      influence: state.resources.influence + resolution.resources.influence,
    },
    troops: {
      militia: state.troops.militia + resolution.troops.militia,
      shooters: state.troops.shooters + resolution.troops.shooters,
      scouts: state.troops.scouts + resolution.troops.scouts,
      machinery: state.troops.machinery + resolution.troops.machinery,
    },
    logs: [logLine, ...state.logs].slice(0, 12),
  };
}

export function SandboxProgressEngine({ worldId, currentDay, villages }: SandboxProgressEngineProps) {
  const { imperialState, setImperialState } = useImperialState(worldId, villages);
  const hydratingRef = useRef(false);

  const snapshotKey = useMemo(() => String(Math.max(0, currentDay)), [currentDay]);

  useEffect(() => {
    if (hydratingRef.current) {
      return;
    }

    if (imperialState.sandboxLastSyncedDay !== currentDay) {
      return;
    }

    const currentSnapshot = imperialState.sandboxSnapshots[snapshotKey];
    const nextSnapshot = createSnapshot(imperialState);
    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      sandboxSnapshots: {
        ...current.sandboxSnapshots,
        [snapshotKey]: createSnapshot(current),
      },
    }));
  }, [imperialState, setImperialState, snapshotKey]);

  useEffect(() => {
    const targetDay = Math.max(0, currentDay);
    const syncedDay = imperialState.sandboxLastSyncedDay ?? 0;

    if (targetDay === syncedDay) {
      return;
    }

    if (targetDay < syncedDay) {
      hydratingRef.current = true;
      setImperialState((current) => resolveStateForDay(current, targetDay, villages));
      queueMicrotask(() => {
        hydratingRef.current = false;
      });
      return;
    }

    hydratingRef.current = true;
    setImperialState((current) => {
      let working = { ...current };
      const nextSnapshots = { ...current.sandboxSnapshots };

      for (let day = syncedDay + 1; day <= targetDay; day += 1) {
        working = passiveDailyIncome(working, villages, day);
        nextSnapshots[String(day)] = createSnapshot(working);
      }

      return {
        ...working,
        sandboxLastSyncedDay: targetDay,
        sandboxSnapshots: nextSnapshots,
      };
    });
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [currentDay, imperialState.sandboxLastSyncedDay, imperialState.sandboxSnapshots, setImperialState, villages]);

  return null;
}
