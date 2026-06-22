// KingsWorld — Edge Function: resolve-combat
// Chamada pelo tick (pg_cron) para resolver ordens de ataque em status resolving.
// Porta processKingsWorldCombat para o servidor.
// Deploy: npx supabase functions deploy resolve-combat --project-ref wdmrdovkkrgzalnpqdxe

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET               = Deno.env.get("CRON_SECRET")!;

// ---------------------------------------------------------------------------
// Motor de combate (portado de lib/combat-engine.ts)
// ---------------------------------------------------------------------------
type CombatUnitId = "militia" | "shooters" | "scouts" | "machinery" | "guards" | "archers" | "ballistae";
type CombatArmy = Partial<Record<CombatUnitId, number>>;
type CombatResources = Record<string, number>;

const UNIT_STATS: Record<CombatUnitId, { attack: number; defense: number; weight: number; carry: number }> = {
  militia:   { attack: 10, defense: 12, weight: 1,    carry: 5 },
  shooters:  { attack: 16, defense: 9,  weight: 1.35, carry: 4 },
  scouts:    { attack: 8,  defense: 7,  weight: 1.2,  carry: 8 },
  machinery: { attack: 38, defense: 22, weight: 3.4,  carry: 2 },
  guards:    { attack: 6,  defense: 15, weight: 1.1,  carry: 0 },
  archers:   { attack: 13, defense: 18, weight: 1.45, carry: 0 },
  ballistae: { attack: 24, defense: 42, weight: 3.7,  carry: 0 },
};

const UNIT_ORDER: CombatUnitId[] = ["militia", "shooters", "scouts", "machinery", "guards", "archers", "ballistae"];

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
function rnd(v: number) { return Math.round(v); }
function norm(v: unknown) { return Math.max(0, Math.floor(Number(v) || 0)); }

function normalizeArmy(army: CombatArmy): Required<CombatArmy> {
  return Object.fromEntries(UNIT_ORDER.map((u) => [u, norm(army[u])])) as Required<CombatArmy>;
}

function totalPower(army: Required<CombatArmy>, mode: "attack" | "defense"): number {
  return UNIT_ORDER.reduce((sum, u) => sum + army[u] * UNIT_STATS[u][mode], 0);
}

function totalTroops(army: Required<CombatArmy>): number {
  return UNIT_ORDER.reduce((sum, u) => sum + army[u], 0);
}

function applyLosses(army: Required<CombatArmy>, lossPct: number): { survivors: Required<CombatArmy>; dead: CombatArmy } {
  const dead: CombatArmy = {};
  const survivors = { ...army } as Required<CombatArmy>;
  for (const u of UNIT_ORDER) {
    const killed = rnd(army[u] * clamp(lossPct, 0, 1));
    dead[u] = killed;
    survivors[u] = Math.max(0, army[u] - killed);
  }
  return { survivors, dead };
}

function resolveCombat(attacker: CombatArmy, defender: CombatArmy, defenderResources: CombatResources, wallLevel = 0) {
  let atk = normalizeArmy(attacker);
  let def = normalizeArmy(defender);
  const wallBonus = 1 + wallLevel * 0.08;
  let rounds = 0;
  const maxRounds = 8;

  while (totalTroops(atk) > 0 && totalTroops(def) > 0 && rounds < maxRounds) {
    rounds++;
    const atkPower = totalPower(atk, "attack");
    const defPower = totalPower(def, "defense") * wallBonus;
    const total = atkPower + defPower || 1;

    const defLossPct = clamp(atkPower / total * 0.35, 0, 0.6);
    const atkLossPct = clamp(defPower / total * 0.35, 0, 0.6);

    const { survivors: atkSurv, dead: atkDead } = applyLosses(atk, atkLossPct);
    const { survivors: defSurv, dead: defDead } = applyLosses(def, defLossPct);
    atk = atkSurv;
    def = defSurv;
  }

  const atkWon = totalTroops(def) === 0 && totalTroops(atk) > 0;
  const draw   = totalTroops(atk) === 0 && totalTroops(def) === 0;

  // Saque (só se atacante venceu)
  const looted: CombatResources = {};
  if (atkWon) {
    for (const [key, val] of Object.entries(defenderResources)) {
      const carryCapacity = UNIT_ORDER.reduce((sum, u) => sum + atk[u] * UNIT_STATS[u].carry, 0);
      looted[key] = Math.min(val, Math.floor(carryCapacity * 0.4));
    }
  }

  return {
    winner:    atkWon ? "attacker" : draw ? "draw" : "defender",
    rounds,
    attackerSurvivors: atk,
    defenderSurvivors: def,
    looted,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca ordens de ataque que chegaram e foram marcadas pelo cron como resolving.
    const { data: orders, error: fetchErr } = await supabase
      .from("world_player_map_orders")
      .select("id, world_id, world_player_id, target_site_id, troop_dispatch_json, meta_json")
      .eq("status", "resolving")
      .eq("command_action", "attack")
      .order("arrival_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ ok: true, resolved: 0 }), { status: 200 });
    }

    let resolved = 0;

    for (const order of orders) {
      try {
        const attackerArmy: CombatArmy = order.troop_dispatch_json ?? {};
        const wallLevel: number = (order.meta_json as any)?.wallLevel ?? 0;
        const defenderArmy: CombatArmy = (order.meta_json as any)?.defenderArmy ?? {};
        const defenderResources: CombatResources = (order.meta_json as any)?.defenderResources ?? {};

        const result = resolveCombat(attackerArmy, defenderArmy, defenderResources, wallLevel);

        // Atualiza tropas sobreviventes do atacante
        const { data: wp } = await supabase
          .from("world_player_imperial_states")
          .select("militia_count, shooters_count, scouts_count, machinery_count")
          .eq("world_player_id", order.world_player_id)
          .single();

        if (wp) {
          await supabase
            .from("world_player_imperial_states")
            .update({
              militia_count:   result.attackerSurvivors.militia   ?? 0,
              shooters_count:  result.attackerSurvivors.shooters  ?? 0,
              scouts_count:    result.attackerSurvivors.scouts    ?? 0,
              machinery_count: result.attackerSurvivors.machinery ?? 0,
              updated_at: new Date().toISOString(),
            })
            .eq("world_player_id", order.world_player_id);
        }

        // Saque: adiciona recursos ao atacante via RPC
        if (result.winner === "attacker") {
          const matLoot = result.looted["materials"] ?? 0;
          const supLoot = result.looted["supplies"] ?? 0;
          if (matLoot > 0 || supLoot > 0) {
            await supabase.rpc("kw_apply_resource_delta", {
              p_world_player_id: order.world_player_id,
              p_materials_delta: matLoot,
              p_supplies_delta:  supLoot,
            });
          }
        }

        // Marca ordem como resolvida
        await supabase
          .from("world_player_map_orders")
          .update({
            status:      "resolved",
            result_code: result.winner,
            resolved_at: new Date().toISOString(),
            meta_json:   { ...(order.meta_json as object), combatResult: result },
            updated_at:  new Date().toISOString(),
          })
          .eq("id", order.id);

        resolved++;
      } catch (err) {
        console.error(`[resolve-combat] order ${order.id}:`, err);
        await supabase
          .from("world_player_map_orders")
          .update({ status: "failed", result_code: String(err), updated_at: new Date().toISOString() })
          .eq("id", order.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, resolved }), { status: 200 });
  } catch (err) {
    console.error("[resolve-combat]", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
