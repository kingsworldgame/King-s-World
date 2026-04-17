"use client";

import type { ChangeEvent, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { startTransition } from "react";

import { BottomNavigation } from "@/components/BottomNavigation";
import { Header } from "@/components/Header";
import { SandboxDayDeltaModal } from "@/components/sandbox/SandboxDayDeltaModal";
import { SandboxProgressEngine } from "@/components/sandbox/SandboxProgressEngine";
import { WorldAssistant } from "@/components/world-assistant";
import type { EvolutionMode } from "@/core/GameBalance";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { emitUiFeedback } from "@/lib/ui-feedback";
import type { WorldPayload } from "@/lib/world-data";
import { useLiveWorld } from "@/lib/world-runtime";

type WorldTab = "empire" | "operations" | "base" | "board" | "intelligence" | "guide";

const EVOLUTION_MODE_IDS: EvolutionMode[] = ["balanced", "metropole", "vanguard", "bastion", "flow"];

function normalizeEvolutionMode(input: string | null): EvolutionMode | undefined {
  if (!input) {
    return undefined;
  }

  return EVOLUTION_MODE_IDS.includes(input as EvolutionMode) ? (input as EvolutionMode) : undefined;
}

export function WorldShell({
  worldId,
  initialPayload,
  children,
}: {
  worldId: string;
  initialPayload: WorldPayload;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segment = useSelectedLayoutSegment();

  const { world, runtimeState, isSandboxWorld, campaignDate } = useLiveWorld(worldId, initialPayload);
  const { imperialState } = useImperialState(worldId, world.villages);
  const mergedVillages = mergeImperialVillages(world.villages, imperialState);
  const selectedVillageId = searchParams.get("v") ?? world.activeVillageId;
  const evolutionMode = searchParams.get("m");
  const activeVillage = mergedVillages.find((village) => village.id === selectedVillageId) ?? mergedVillages[0];
  const questsCompleted = isSandboxWorld ? imperialState.sandboxQuestsCompleted : world.sovereignty.eraQuestsCompleted;
  const wondersControlled = isSandboxWorld ? imperialState.sandboxWondersBuilt : world.sovereignty.wondersControlled;
  const activeTab: WorldTab =
    segment === "empire" ||
    segment === "operations" ||
    segment === "board" ||
    segment === "intelligence" ||
    segment === "guide" ||
    segment === "base"
      ? segment
      : "base";

  const onVillageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", event.target.value);
    emitUiFeedback("tap", "light");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700">
      {isSandboxWorld ? <SandboxProgressEngine worldId={worldId} currentDay={world.day} villages={mergedVillages} /> : null}
      {isSandboxWorld ? <SandboxDayDeltaModal currentDay={world.day} imperialState={imperialState} /> : null}
      <img
        src="/kingsworld-bg.svg"
        alt="Fundo isometrico do mundo"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25 saturate-50"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(226,232,240,0.35),transparent_28%),radial-gradient(circle_at_84%_88%,rgba(203,213,225,0.2),transparent_36%)]" />

      <Header
        selectedVillageId={activeVillage.id}
        villages={mergedVillages.map((village) => ({
          id: village.id,
          name: `${village.name} (${village.type})`,
        }))}
        resources={imperialState.resources}
        worldDay={world.day}
        worldPhase={world.phase}
        realTimeEnabled={runtimeState.realTimeEnabled}
        worldStarted={runtimeState.started}
        onVillageChange={onVillageChange}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+48px)] pt-[calc(env(safe-area-inset-top)+156px)]">
        <WorldAssistant
          worldId={worldId}
          currentDay={world.day}
          worldPhase={world.phase}
          campaignDate={campaignDate}
          isSandboxWorld={isSandboxWorld}
          realTimeEnabled={runtimeState.realTimeEnabled}
          activeTab={activeTab}
          evolutionMode={normalizeEvolutionMode(evolutionMode)}
          activeVillage={activeVillage}
          villages={mergedVillages}
          imperialState={imperialState}
          questsCompleted={questsCompleted}
          wondersControlled={wondersControlled}
          activeAlerts={world.activeAlerts}
        />
        {children}
      </main>

      <BottomNavigation worldId={worldId} activeTab={activeTab} villageId={activeVillage.id} evolutionMode={evolutionMode} />
    </div>
  );
}
