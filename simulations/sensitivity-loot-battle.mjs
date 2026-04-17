import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "simulations", "output");
const RESULTS_PATH = path.join(OUTPUT_DIR, "season_v2_120d_results.json");
const REPORT_MD = path.join(OUTPUT_DIR, "season_v2_loot_battle_sensitivity.md");
const REPORT_CSV = path.join(OUTPUT_DIR, "season_v2_loot_battle_sensitivity.csv");
const REPORT_JSON = path.join(OUTPUT_DIR, "season_v2_loot_battle_sensitivity.json");

const LOOT_MULTS = [0.6, 0.8, 1.0, 1.2, 1.4];
const BATTLE_MULTS = [0.7, 0.85, 1.0, 1.15, 1.3];

const pct = (value) => Math.round(value * 10000) / 100;
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const avg = (items, selector) => (items.length ? items.reduce((acc, item) => acc + selector(item), 0) / items.length : 0);

function runScenario(raidLootMult, battleLossMult) {
  const env = {
    ...process.env,
    SEED_MODE: "default",
    RAID_LOOT_MULT: String(raidLootMult),
    BATTLE_LOSS_MULT: String(battleLossMult),
  };

  const run = spawnSync(process.execPath, [path.join("simulations", "simulate-season-v2.mjs")], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 120000,
  });

  if (run.status !== 0) {
    throw new Error(`Falha em loot=${raidLootMult} battle=${battleLossMult}\n${run.stdout}\n${run.stderr}`);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
  const records = results.runsDetailed.flatMap((runItem) => runItem.records);
  const players = Math.max(1, records.length);

  const alive1500 = records.filter((record) => record.alive && record.influenceD120 >= 1500).length;
  const day90Eligible = records.filter((record) => record.influenceD90 >= 1500).length;
  const cityLossPlayers = records.filter((record) => record.villagesLostToHorde > 0).length;
  const marchDeaths = records.filter((record) => record.diedOnTrail).length;
  const portalEntries = records.filter((record) => record.enteredPortal).length;
  const etaLate = records.filter((record) => record.portalBlockReason === "eta_late").length;
  const intercepted = records.filter((record) => record.portalBlockReason === "intercepted").length;

  const byProfile = Object.fromEntries(
    ["metropole", "posto", "bastiao", "celeiro"].map((profile) => {
      const group = records.filter((record) => record.profile === profile);
      return [
        profile,
        {
          players: group.length,
          portalPct: pct(group.filter((record) => record.enteredPortal).length / Math.max(1, group.length)),
          alive1500Pct: pct(
            group.filter((record) => record.alive && record.influenceD120 >= 1500).length / Math.max(1, group.length),
          ),
          avgCityLoss: round(avg(group, (record) => record.villagesLostToHorde), 2),
          avgInfluenceD120: round(avg(group, (record) => record.influenceD120), 2),
        },
      ];
    }),
  );

  return {
    raidLootMult,
    battleLossMult,
    players,
    day90EligiblePct: pct(day90Eligible / players),
    alive1500Pct: pct(alive1500 / players),
    cityLossPct: pct(cityLossPlayers / players),
    avgCitiesLost: round(avg(records, (record) => record.villagesLostToHorde), 2),
    marchDeathPct: pct(marchDeaths / players),
    etaLatePct: pct(etaLate / players),
    interceptedPct: pct(intercepted / players),
    portalPct: pct(portalEntries / players),
    avgInfluenceD120: round(avg(records, (record) => record.influenceD120), 2),
    avgTroopsAlive: round(avg(records, (record) => record.troopsAlive), 2),
    profileBreakdown: byProfile,
  };
}

function buildCsv(rows) {
  const header = [
    "raidLootMult",
    "battleLossMult",
    "day90EligiblePct",
    "alive1500Pct",
    "cityLossPct",
    "avgCitiesLost",
    "marchDeathPct",
    "etaLatePct",
    "interceptedPct",
    "portalPct",
    "avgInfluenceD120",
    "avgTroopsAlive",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.raidLootMult,
        row.battleLossMult,
        row.day90EligiblePct,
        row.alive1500Pct,
        row.cityLossPct,
        row.avgCitiesLost,
        row.marchDeathPct,
        row.etaLatePct,
        row.interceptedPct,
        row.portalPct,
        row.avgInfluenceD120,
        row.avgTroopsAlive,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function aggregateBy(rows, key) {
  const values = [...new Set(rows.map((row) => row[key]))].sort((a, b) => a - b);
  return values.map((value) => {
    const group = rows.filter((row) => row[key] === value);
    return {
      value,
      day90EligiblePct: round(avg(group, (row) => row.day90EligiblePct), 2),
      alive1500Pct: round(avg(group, (row) => row.alive1500Pct), 2),
      cityLossPct: round(avg(group, (row) => row.cityLossPct), 2),
      avgCitiesLost: round(avg(group, (row) => row.avgCitiesLost), 2),
      marchDeathPct: round(avg(group, (row) => row.marchDeathPct), 2),
      portalPct: round(avg(group, (row) => row.portalPct), 2),
      avgInfluenceD120: round(avg(group, (row) => row.avgInfluenceD120), 2),
    };
  });
}

function buildMarkdown(rows) {
  const baseline = rows.find((row) => row.raidLootMult === 1 && row.battleLossMult === 1);
  const bestPortal = [...rows].sort((a, b) => b.portalPct - a.portalPct)[0];
  const harshest = [...rows].sort((a, b) => b.cityLossPct - a.cityLossPct || b.marchDeathPct - a.marchDeathPct)[0];
  const safest = [...rows].sort((a, b) => a.cityLossPct - b.cityLossPct || a.marchDeathPct - b.marchDeathPct)[0];

  const byLoot = aggregateBy(rows, "raidLootMult");
  const byBattle = aggregateBy(rows, "battleLossMult");

  const lines = [];
  lines.push("# KingsWorld - Sensibilidade de Saque x Dureza de Batalha");
  lines.push("");
  lines.push("## Grade testada");
  lines.push("");
  lines.push(`- Saque/Exploracao (RAID_LOOT_MULT): ${LOOT_MULTS.join(", ")}`);
  lines.push(`- Dureza de perdas (BATTLE_LOSS_MULT): ${BATTLE_MULTS.join(", ")}`);
  lines.push(`- Total de combinacoes: ${rows.length}`);
  lines.push("");
  lines.push("## Baseline (1.0 / 1.0)");
  lines.push("");
  lines.push(`- D90 com 1500+: ${baseline.day90EligiblePct}%`);
  lines.push(`- D120 vivos com 1500+: ${baseline.alive1500Pct}%`);
  lines.push(`- Perderam cidade: ${baseline.cityLossPct}% (media ${baseline.avgCitiesLost})`);
  lines.push(`- Morreram na marcha: ${baseline.marchDeathPct}%`);
  lines.push(`- Entraram no Portal: ${baseline.portalPct}%`);
  lines.push("");
  lines.push("## Tabela completa");
  lines.push("");
  lines.push("| Saque x | Batalha x | D90 1500+ | D120 vivos 1500+ | Perdem cidade | Media cidades perdidas | Morrem na marcha | ETA tarde | Interceptados | Entram no Portal | Infl. D120 | Tropas vivas |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows) {
    lines.push(
      `| ${row.raidLootMult} | ${row.battleLossMult} | ${row.day90EligiblePct}% | ${row.alive1500Pct}% | ${row.cityLossPct}% | ${row.avgCitiesLost} | ${row.marchDeathPct}% | ${row.etaLatePct}% | ${row.interceptedPct}% | ${row.portalPct}% | ${row.avgInfluenceD120} | ${row.avgTroopsAlive} |`,
    );
  }

  lines.push("");
  lines.push("## Media por eixo de Saque");
  lines.push("");
  lines.push("| Saque x | D90 1500+ | D120 vivos 1500+ | Perdem cidade | Media cidades perdidas | Morrem na marcha | Entram no Portal | Infl. D120 |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of byLoot) {
    lines.push(
      `| ${row.value} | ${row.day90EligiblePct}% | ${row.alive1500Pct}% | ${row.cityLossPct}% | ${row.avgCitiesLost} | ${row.marchDeathPct}% | ${row.portalPct}% | ${row.avgInfluenceD120} |`,
    );
  }

  lines.push("");
  lines.push("## Media por eixo de Dureza de Batalha");
  lines.push("");
  lines.push("| Batalha x | D90 1500+ | D120 vivos 1500+ | Perdem cidade | Media cidades perdidas | Morrem na marcha | Entram no Portal | Infl. D120 |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of byBattle) {
    lines.push(
      `| ${row.value} | ${row.day90EligiblePct}% | ${row.alive1500Pct}% | ${row.cityLossPct}% | ${row.avgCitiesLost} | ${row.marchDeathPct}% | ${row.portalPct}% | ${row.avgInfluenceD120} |`,
    );
  }

  lines.push("");
  lines.push("## Leitura rapida");
  lines.push("");
  lines.push(
    `- Melhor entrada no Portal: saque x${bestPortal.raidLootMult} e batalha x${bestPortal.battleLossMult}, com ${bestPortal.portalPct}% entrando.`,
  );
  lines.push(
    `- Cenário mais punitivo: saque x${harshest.raidLootMult} e batalha x${harshest.battleLossMult}, com ${harshest.cityLossPct}% perdendo cidade e ${harshest.marchDeathPct}% morrendo na marcha.`,
  );
  lines.push(
    `- Cenário mais seguro: saque x${safest.raidLootMult} e batalha x${safest.battleLossMult}, com ${safest.cityLossPct}% perdendo cidade e ${safest.portalPct}% entrando.`,
  );

  lines.push("");
  lines.push("## Breakdown dos extremos por estilo");
  lines.push("");
  for (const [label, row] of [
    ["Melhor Portal", bestPortal],
    ["Mais Punitivo", harshest],
    ["Mais Seguro", safest],
  ]) {
    lines.push(`### ${label} (saque x${row.raidLootMult} / batalha x${row.battleLossMult})`);
    lines.push("");
    lines.push("| Estilo | Portal | Vivos 1500+ | Media cidades perdidas | Infl. D120 |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const profile of ["metropole", "posto", "bastiao", "celeiro"]) {
      const entry = row.profileBreakdown[profile];
      lines.push(
        `| ${profile} | ${entry.portalPct}% | ${entry.alive1500Pct}% | ${entry.avgCityLoss} | ${entry.avgInfluenceD120} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rows = [];
  for (const loot of LOOT_MULTS) {
    for (const battle of BATTLE_MULTS) {
      const row = runScenario(loot, battle);
      rows.push(row);
      process.stdout.write(
        `loot=${loot.toFixed(2)} battle=${battle.toFixed(2)} -> portal=${row.portalPct}% cityLoss=${row.cityLossPct}% march=${row.marchDeathPct}%\n`,
      );
    }
  }

  fs.writeFileSync(REPORT_MD, buildMarkdown(rows));
  fs.writeFileSync(REPORT_CSV, buildCsv(rows));
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

  const baseline = rows.find((row) => row.raidLootMult === 1 && row.battleLossMult === 1);
  process.stdout.write(
    `Sensibilidade concluida. Baseline portal=${baseline.portalPct}% alive1500=${baseline.alive1500Pct}% cityLoss=${baseline.cityLossPct}%\n`,
  );
}

main();
