import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { ensureWorldFilled } from "@/lib/npc-fill";
import { supabaseSelect } from "@/lib/supabase-rest";

type WorldRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  day_number: number;
  join_code: string;
  joins_closed_at: string | null;
};

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAppUser();

    const body = await request.json().catch(() => ({})) as { code?: unknown };
    const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!raw) {
      return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("select", "id,slug,name,status,day_number,join_code,joins_closed_at");
    params.set("join_code", `eq.${raw}`);
    params.set("limit", "1");

    const rows = await supabaseSelect<WorldRow>("worlds", params);
    const world = rows[0] ?? null;

    if (!world) {
      return NextResponse.json({ error: "Código inválido ou mundo não encontrado." }, { status: 404 });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Este mundo já foi finalizado." }, { status: 410 });
    }

    if (world.status !== "open") {
      return NextResponse.json({ error: "A entrada deste mundo ja foi encerrada - o reino comecou." }, { status: 403 });
    }

    if (world.joins_closed_at) {
      return NextResponse.json({ error: "A entrada deste mundo já foi encerrada — o reino começou." }, { status: 403 });
    }

    // Auto-fill: garante que o mundo tem NPCs ativos quando um humano entra.
    // Não-fatal — se falhar, o jogador entra na mesma.
    void ensureWorldFilled(world.id, world.slug).catch(() => undefined);

    const href = `/world/${world.slug}/intelligence`;

    return NextResponse.json({
      ok: true,
      world: { slug: world.slug, name: world.name, href },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar mundo.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
