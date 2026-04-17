import { NextResponse } from "next/server";

import { supabaseSelect, supabaseUpsert } from "@/lib/supabase-rest";
import { getWorldPayload } from "@/lib/world-data";

type StoredImperialStateRow = {
  version: number;
  materials_stock: number;
  supplies_stock: number;
  energy_stock: number;
  influence_stock: number;
  militia_count: number;
  shooters_count: number;
  scouts_count: number;
  machinery_count: number;
  recruited_diplomats: number;
  recruited_tribe_envoys: number;
  tribe_envoys_committed: number;
  annex_envoys_committed: number;
  sandbox_strategy_id: string | null;
  sandbox_completed_action_ids: string[];
  sandbox_quests_completed: number;
  sandbox_wonders_built: number;
  sandbox_dome_active: boolean;
  sandbox_march_started: boolean;
  sandbox_last_synced_day: number;
  sandbox_snapshots_json: Record<string, unknown>;
  logs_json: string[];
};

function mapRowToImperialState(row: StoredImperialStateRow) {
  return {
    version: row.version,
    resources: {
      materials: row.materials_stock,
      supplies: row.supplies_stock,
      energy: row.energy_stock,
      influence: row.influence_stock,
    },
    troops: {
      militia: row.militia_count,
      shooters: row.shooters_count,
      scouts: row.scouts_count,
      machinery: row.machinery_count,
    },
    heroByVillage: {},
    diplomatByVillage: {},
    recruitedDiplomats: row.recruited_diplomats,
    recruitedTribeEnvoys: row.recruited_tribe_envoys,
    tribeEnvoysCommitted: row.tribe_envoys_committed,
    annexEnvoysCommitted: row.annex_envoys_committed,
    cityClassByVillage: {},
    cityClassLockedByVillage: {},
    deployedByVillage: {},
    buildingLevelsByVillage: {},
    constructionLoadByVillage: {},
    extraVillages: [],
    sandboxStrategyId: row.sandbox_strategy_id,
    sandboxCompletedActionIds: row.sandbox_completed_action_ids ?? [],
    sandboxQuestsCompleted: row.sandbox_quests_completed,
    sandboxWondersBuilt: row.sandbox_wonders_built,
    sandboxDomeActive: row.sandbox_dome_active,
    sandboxMarchStarted: row.sandbox_march_started,
    sandboxLastSyncedDay: row.sandbox_last_synced_day,
    sandboxSnapshots: row.sandbox_snapshots_json ?? {},
    logs: row.logs_json ?? [],
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const payload = await getWorldPayload(params.worldId);
    if (!payload.worldPlayerId) {
      return NextResponse.json({ imperialState: null });
    }

    const search = new URLSearchParams();
    search.set(
      "select",
      "version,materials_stock,supplies_stock,energy_stock,influence_stock,militia_count,shooters_count,scouts_count,machinery_count,recruited_diplomats,recruited_tribe_envoys,tribe_envoys_committed,annex_envoys_committed,sandbox_strategy_id,sandbox_completed_action_ids,sandbox_quests_completed,sandbox_wonders_built,sandbox_dome_active,sandbox_march_started,sandbox_last_synced_day,sandbox_snapshots_json,logs_json",
    );
    search.set("world_player_id", `eq.${payload.worldPlayerId}`);
    const rows = await supabaseSelect<StoredImperialStateRow>("world_player_imperial_states", search);

    return NextResponse.json({
      imperialState: rows[0] ? mapRowToImperialState(rows[0]) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load imperial state." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const payload = await getWorldPayload(params.worldId);
    if (!payload.worldPlayerId) {
      return NextResponse.json({ error: "No world player found for this world." }, { status: 400 });
    }

    const nextState = await request.json();
    await supabaseUpsert("world_player_imperial_states", {
      world_id: payload.world.id,
      world_player_id: payload.worldPlayerId,
      version: Number(nextState?.version ?? 9),
      materials_stock: Number(nextState?.resources?.materials ?? 0),
      supplies_stock: Number(nextState?.resources?.supplies ?? 0),
      energy_stock: Number(nextState?.resources?.energy ?? 0),
      influence_stock: Number(nextState?.resources?.influence ?? 0),
      militia_count: Number(nextState?.troops?.militia ?? 0),
      shooters_count: Number(nextState?.troops?.shooters ?? 0),
      scouts_count: Number(nextState?.troops?.scouts ?? 0),
      machinery_count: Number(nextState?.troops?.machinery ?? 0),
      recruited_diplomats: Number(nextState?.recruitedDiplomats ?? 0),
      recruited_tribe_envoys: Number(nextState?.recruitedTribeEnvoys ?? 0),
      tribe_envoys_committed: Number(nextState?.tribeEnvoysCommitted ?? 0),
      annex_envoys_committed: Number(nextState?.annexEnvoysCommitted ?? 0),
      sandbox_strategy_id: nextState?.sandboxStrategyId ?? null,
      sandbox_completed_action_ids: nextState?.sandboxCompletedActionIds ?? [],
      sandbox_quests_completed: Number(nextState?.sandboxQuestsCompleted ?? 0),
      sandbox_wonders_built: Number(nextState?.sandboxWondersBuilt ?? 0),
      sandbox_dome_active: Boolean(nextState?.sandboxDomeActive),
      sandbox_march_started: Boolean(nextState?.sandboxMarchStarted),
      sandbox_last_synced_day: Number(nextState?.sandboxLastSyncedDay ?? 0),
      sandbox_snapshots_json: nextState?.sandboxSnapshots ?? {},
      logs_json: nextState?.logs ?? [],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist imperial state." },
      { status: 500 },
    );
  }
}
