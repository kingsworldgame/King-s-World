import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseInsertReturning, supabaseRpc } from "@/lib/supabase-rest";
import { DEFAULT_WORLD_PLAYER_CAP } from "@/lib/world-rules";

type SeasonMode = "normal" | "express";

function normalizeMode(value: unknown): SeasonMode {
  return value === "express" ? "express" : "normal";
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return base || "mundo";
}

type CreatedWorld = { id: string; slug: string; join_code: string };

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedAppUser();

    const body = (await request.json().catch(() => ({}))) as { name?: unknown; mode?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (name.length < 2) {
      return NextResponse.json({ error: "Dê um nome ao mundo (mín. 2 letras)." }, { status: 400 });
    }
    const mode = normalizeMode(body.mode);
    const durationDays = mode === "express" ? 30 : 120;
    const speedMultiplier = mode === "express" ? 4 : 1;

    const joinCode = await supabaseRpc<string>("generate_world_join_code", {});
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${slugify(name)}-${suffix}`;
    const now = Date.now();
    const day = 86_400_000;
    const iso = (days: number) => new Date(now + days * day).toISOString();

    const base: Record<string, unknown> = {
      slug,
      name,
      status: "open",
      registration_opens_at: new Date(now).toISOString(),
      starts_at: iso(1),
      phase_2_starts_at: iso(1 + Math.ceil(durationDays / 6)),
      ends_at: iso(1 + durationDays),
      player_cap: DEFAULT_WORLD_PLAYER_CAP,
      map_width: 81,
      map_height: 81,
      base_move_time_minutes: Math.max(1, Math.round(45 / speedMultiplier)),
      road_move_time_minutes: Math.max(1, Math.round(15 / speedMultiplier)),
      runtime_started: false,
      runtime_real_time_enabled: false,
      runtime_anchor_day: 0,
      join_code: joinCode,
      created_by_user_id: user.id,
    };

    // Tenta com as colunas de modo; se elas não existirem (SQL não rodado), cai no básico.
    let rows: CreatedWorld[];
    try {
      rows = await supabaseInsertReturning<Record<string, unknown>, CreatedWorld>(
        "worlds",
        { ...base, season_mode: mode, speed_multiplier: speedMultiplier },
        "slug",
      );
    } catch {
      rows = await supabaseInsertReturning<Record<string, unknown>, CreatedWorld>("worlds", base, "slug");
    }

    const world = rows[0];
    if (!world) {
      return NextResponse.json({ error: "Falha ao criar mundo." }, { status: 500 });
    }

    // O onboarding do criador (capital + recursos) roda quando ele acessa o mundo.
    return NextResponse.json({
      ok: true,
      world: { slug: world.slug, joinCode: world.join_code, href: `/world/${world.slug}/intelligence` },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar mundo.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
