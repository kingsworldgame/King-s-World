import { type EvolutionMode } from "@/core/GameBalance";
import { BasePageClient, type BaseSubTab, type LocalCommand } from "@/components/base/BasePageClient";
import type { BuildingId } from "@/lib/buildings";
import { getWorldPayload } from "@/lib/world-data";
import { getSandboxPlaybooks } from "@/lib/sandbox-playbooks";

const MODE_IDS: EvolutionMode[] = ["balanced", "metropole", "vanguard", "bastion", "flow"];
const LOCAL_COMMAND_IDS: LocalCommand[] = ["guard", "drill", "sortie", "fortify", "rations"];
const BUILDING_IDS: BuildingId[] = ["palace", "senate", "mines", "farms", "housing", "research", "roads", "barracks", "arsenal", "wall", "wonder"];

function normalizeMode(input: string | undefined): EvolutionMode {
  if (!input) return "balanced";
  return MODE_IDS.includes(input as EvolutionMode) ? (input as EvolutionMode) : "balanced";
}

function normalizeLocalCommand(input: string | undefined): LocalCommand {
  if (!input) return "guard";
  return LOCAL_COMMAND_IDS.includes(input as LocalCommand) ? (input as LocalCommand) : "guard";
}

function normalizeSubTab(input: string | undefined): BaseSubTab {
  if (!input) return "city";
  return input === "command" ? "command" : "city";
}

function normalizeBuilding(input: string | undefined): BuildingId | null {
  if (!input) return null;
  return BUILDING_IDS.includes(input as BuildingId) ? (input as BuildingId) : null;
}

export default async function BasePage({
  params,
  searchParams,
}: {
  params: { worldId: string };
  searchParams: { v?: string; m?: string; lc?: string; sb?: string; b?: string };
}) {
  const payload = await getWorldPayload(params.worldId);
  const world = payload.world;
  const sandboxPlaybooks = payload.isSandboxWorld ? getSandboxPlaybooks() : undefined;
  const selectedVillageId = typeof searchParams.v === "string" ? searchParams.v : world.activeVillageId;
  const evolutionMode = normalizeMode(typeof searchParams.m === "string" ? searchParams.m : undefined);
  const localCommand = normalizeLocalCommand(typeof searchParams.lc === "string" ? searchParams.lc : undefined);
  const subTab = normalizeSubTab(typeof searchParams.sb === "string" ? searchParams.sb : undefined);
  const selectedBuildingId = normalizeBuilding(typeof searchParams.b === "string" ? searchParams.b : undefined);

  return (
    <BasePageClient
      worldId={params.worldId}
      villages={world.villages}
      researches={world.researches}
      timeline={world.timeline}
      selectedVillageId={selectedVillageId}
      evolutionMode={evolutionMode}
      initialLocalCommand={localCommand}
      initialSubTab={subTab}
      initialSelectedBuildingId={selectedBuildingId}
      sandboxPlaybooks={sandboxPlaybooks}
    />
  );
}
