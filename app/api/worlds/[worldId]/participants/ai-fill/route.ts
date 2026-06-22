import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { ensureWorldFilled } from "@/lib/npc-fill";
import { looksLikeUuid, supabaseSelect } from "@/lib/supabase-rest";
import { normalizeWorldPlayerCap } from "@/lib/world-rules";

type WorldRow = {
  id: string;
  slug: string;
  status: "open" | "running" | "finalized";
  player_cap?: number | null;
};

async function fetchWorld(worldId: string): Promise<WorldRow | null> {
  const params = new URLSearchParams();
  params.set("select", "id,slug,status,player_cap");
  params.set(looksLikeUuid(worldId) ? "id" : "slug", `eq.${worldId}`);
  params.set("limit", "1");
  const rows = await supabaseSelect<WorldRow>("worlds", params);
  return rows[0] ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    await requireAuthenticatedAppUser();
    const world = await fetchWorld(params.worldId);
    if (!world) {
      return NextResponse.json({ error: "Mundo nao encontrado." }, { status: 404 });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Mundo finalizado nao recebe IA." }, { status: 409 });
    }

    const targetParticipants = normalizeWorldPlayerCap(world.player_cap);
    const result = await ensureWorldFilled(world.id, world.slug, targetParticipants);

    return NextResponse.json({
      ok: true,
      target: targetParticipants,
      before: result.before,
      created: result.created,
      after: result.after,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao preencher IA." },
      { status: 500 },
    );
  }
}
