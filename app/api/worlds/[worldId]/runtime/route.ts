import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { ensureWorldFilled } from "@/lib/npc-fill";
import { looksLikeUuid, supabasePatchReturning, supabaseSelect } from "@/lib/supabase-rest";
import { normalizeWorldPlayerCap } from "@/lib/world-rules";

type RuntimeAction = "start_now" | "schedule_midnight";

type WorldRow = {
  id: string;
  slug: string;
  status: "open" | "running" | "finalized";
  day_number: number;
  player_cap?: number | null;
};

function normalizeAction(value: unknown): RuntimeAction {
  return value === "schedule_midnight" ? "schedule_midnight" : "start_now";
}

function nextSaoPauloMidnight() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0));
}

async function fetchWorld(worldId: string): Promise<WorldRow | null> {
  const params = new URLSearchParams();
  params.set("select", "id,slug,status,day_number,player_cap");
  params.set(looksLikeUuid(worldId) ? "id" : "slug", `eq.${worldId}`);
  params.set("limit", "1");
  const rows = await supabaseSelect<WorldRow>("worlds", params);
  return rows[0] ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    await requireAuthenticatedAppUser();
    const world = await fetchWorld(params.worldId);
    if (!world) {
      return NextResponse.json({ error: "Mundo nao encontrado." }, { status: 404 });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Mundo finalizado nao pode ser iniciado." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const action = normalizeAction((body as { action?: unknown }).action);
    const now = new Date();
    const startsAt = action === "schedule_midnight" ? nextSaoPauloMidnight() : now;
    const fillResult = await ensureWorldFilled(world.id, world.slug, normalizeWorldPlayerCap(world.player_cap));
    const update =
      action === "schedule_midnight"
        ? {
            status: "open" as const,
            starts_at: startsAt.toISOString(),
            joins_closed_at: now.toISOString(),
            runtime_started: false,
            runtime_real_time_enabled: true,
            runtime_anchor_day: Math.max(0, Math.floor(Number(world.day_number ?? 0))),
            runtime_anchor_started_at: startsAt.toISOString(),
            updated_at: now.toISOString(),
          }
        : {
            status: "running" as const,
            starts_at: startsAt.toISOString(),
            joins_closed_at: now.toISOString(),
            runtime_started: true,
            runtime_real_time_enabled: true,
            runtime_anchor_day: Math.max(0, Math.floor(Number(world.day_number ?? 0))),
            runtime_anchor_started_at: startsAt.toISOString(),
            updated_at: now.toISOString(),
          };

    const patchParams = new URLSearchParams();
    patchParams.set("id", `eq.${world.id}`);
    const rows = await supabasePatchReturning<typeof update, WorldRow>("worlds", patchParams, update);

    return NextResponse.json({
      ok: true,
      action,
      world: rows[0] ?? world,
      startsAt: startsAt.toISOString(),
      participants: fillResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar runtime." },
      { status: 500 },
    );
  }
}
