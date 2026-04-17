import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "simulations", "output");
const RESULTS_PATH = path.join(OUTPUT_DIR, "season_v2_120d_results.json");
const REPORT_MD = path.join(OUTPUT_DIR, "season_v2_wall_pvp_sensitivity.md");
const REPORT_CSV = path.join(OUTPUT_DIR, "season_v2_wall_pvp_sensitivity.csv");
const REPORT_JSON = path.join(OUTPUT_DIR, "season_v2_wall_pvp_sensitivity.json");

const WALL_MULTS = [0.8, 1.0, 1.2, 1.4, 1.6];
const PVP_MULTS = [0.7, 0.85, 1.0, 1.15, 1.3];

const pct = (value) => Math.round(value * 10000) / 100;
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const avg = (items, selector) => (items.length ? items.reduce((acc, item) => acc + selector(item), 0) / items.length : 0);

function runScenario(wallPeakMult, pvpDeathMult) {
  const env = {
    ...process.env,
    SEED_MODE: "default",
    WALL_PEAK_MULT: String(wallPeakMult),
    PVP_DEATH_MULT: String(pvpDeathMult),
    RAID_LOOT_MULT: "1",
    BATTLE_LOSS_MULT: "1",
  };

  const run = spawnSync(process.execPath, [path.join("simulations", "simulate-season-v2.mjs")], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 120000,
  });

  if (run.status !== 0) {
    throw new Error(`Falha em wall=${wallPeakMult} pvp=${pvpDeathMult}\n${run.stdout}\n${run.stderr}`);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
  const runs = results.runsDetailed;
  const records = runs.flatMap((runItem) => runItem.records);
  const players = Math.max(1, records.length);

  const day90Eligible = records.filter((record) => record.influenceD90 >= 1500).length;
  const alive1500 = records.filter((record) => record.alive && record.influenceD120 >= 1500).length;
  const cityLossPlayers = records.filter((record) => record.totalVillagesLost > 0).length;
  const pvpDeaths = records.filter((record) => record.pvpEliminated).length;
  const marchDeaths = records.filter((record) => record.diedOnTrail).length;
  const portalEntries = records.filter((record) => record.enteredPortal).length;

  return {
    wallPeakMult,
    pvpDeathMult,
    day90EligiblePct: pct(day90Eligible / players),
    day90EligiblePerSeed: round(avg(runs, (runItem) => runItem.records.filter((record) => record.influenceD90 >= 1500).length), 2),
    alive1500Pct: pct(alive1500 / players),
    cityLossPct: pct(cityLossPlayers / players),
    avgCitiesLostTotal: round(avg(records, (record) => record.totalVillagesLost), 2),
    avgCitiesLostHorde: round(avg(records, (record) => record.villagesLostToHorde), 2),
    avgCitiesLostPvp: round(avg(records, (record) => record.villagesLostToPvp), 2),
    pvpDeathPct: pct(pvpDeaths / players),
    pvpDeathsPerSeed: round(avg(runs, (runItem) => runItem.records.filter((record) => record.pvpEliminated).length), 2),
    marchDeathPct: pct(marchDeaths / players),
    marchDeathsPerSeed: round(avg(runs, (runItem) => runItem.records.filter((record) => record.diedOnTrail).length), 2),
    portalPct: pct(portalEntries / players),
    portalPerSeed: round(avg(runs, (runItem) => runItem.records.filter((record) => record.enteredPortal).length), 2),
  };
}

function buildCsv(rows) {
  const header = [
    "wallPeakMult",
    "pvpDeathMult",
    "day90EligiblePct",
    "day90EligiblePerSeed",
    "alive1500Pct",
    "cityLossPct",
    "avgCitiesLostTotal",
    "avgCitiesLostHorde",
    "avgCitiesLostPvp",
    "pvpDeathPct",
    "pvpDeathsPerSeed",
    "marchDeathPct",
    "marchDeathsPerSeed",
    "portalPct",
    "portalPerSeed",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.wallPeakMult,
        row.pvpDeathMult,
        row.day90EligiblePct,
        row.day90EligiblePerSeed,
        row.alive1500Pct,
        row.cityLossPct,
        row.avgCitiesLostTotal,
        row.avgCitiesLostHorde,
        row.avgCitiesLostPvp,
        row.pvpDeathPct,
        row.pvpDeathsPerSeed,
        row.marchDeathPct,
        row.marchDeathsPerSeed,
        row.portalPct,
        row.portalPerSeed,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function buildMarkdown(rows) {
  const baseline = rows.find((row) => row.wallPeakMult === 1 && row.pvpDeathMult === 1);
  const targetish = [...rows]
    .sort((a, b) => {
      const scoreA =
        Math.abs(a.day90EligiblePerSeed - 20) +
        Math.abs(a.portalPerSeed - 12.5) * 1.2 +
        Math.abs(a.pvpDeathsPerSeed - 7.5) * 1.1;
      const scoreB =
        Math.abs(b.day90EligiblePerSeed - 20) +
        Math.abs(b.portalPerSeed - 12.5) * 1.2 +
        Math.abs(b.pvpDeathsPerSeed - 7.5) * 1.1;
      return scoreA - scoreB;
    })[0];

  const lines = [];
  lines.push("# KingsWorld - Sensibilidade de Muralha x Mortes PvP");
  lines.push("");
  lines.push("## Grade testada");
  lines.push("");
  lines.push(`- Muralha 9/10 forte (WALL_PEAK_MULT): ${WALL_MULTS.join(", ")}`);
  lines.push(`- Letalidade PvP (PVP_DEATH_MULT): ${PVP_MULTS.join(", ")}`);
  lines.push("");
  lines.push("## Baseline (1.0 / 1.0)");
  lines.push("");
  lines.push(`- Elegiveis D90: ${baseline.day90EligiblePerSeed}/seed (${baseline.day90EligiblePct}%)`);
  lines.push(`- Vivos com 1500+ no D120: ${baseline.alive1500Pct}%`);
  lines.push(`- Perdem cidade: ${baseline.cityLossPct}%`);
  lines.push(`- Mortes PvP: ${baseline.pvpDeathsPerSeed}/seed (${baseline.pvpDeathPct}%)`);
  lines.push(`- Mortes na marcha: ${baseline.marchDeathsPerSeed}/seed (${baseline.marchDeathPct}%)`);
  lines.push(`- Entram no Portal: ${baseline.portalPerSeed}/seed (${baseline.portalPct}%)`);
  lines.push("");
  lines.push("## Melhor combinacao para a meta 20 / 10-15 / 5-10");
  lines.push("");
  lines.push(`- Pareto atual: Muralha x${targetish.wallPeakMult} com PvP x${targetish.pvpDeathMult}`);
  lines.push(`- D90 elegiveis: ${targetish.day90EligiblePerSeed}/seed`);
  lines.push(`- Portal: ${targetish.portalPerSeed}/seed`);
  lines.push(`- Mortes PvP: ${targetish.pvpDeathsPerSeed}/seed`);
  lines.push("");
  lines.push("## Tabela completa");
  lines.push("");
  lines.push("| Muralha x | PvP x | D90 1500+ / seed | D120 vivos 1500+ | Perdem cidade | Cidades perdidas total | Horda | PvP | Mortes PvP / seed | Mortes marcha / seed | Entram no Portal / seed |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows) {
    lines.push(
      `| ${row.wallPeakMult} | ${row.pvpDeathMult} | ${row.day90EligiblePerSeed} | ${row.alive1500Pct}% | ${row.cityLossPct}% | ${row.avgCitiesLostTotal} | ${row.avgCitiesLostHorde} | ${row.avgCitiesLostPvp} | ${row.pvpDeathsPerSeed} | ${row.marchDeathsPerSeed} | ${row.portalPerSeed} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows = [];

  for (const wall of WALL_MULTS) {
    for (const pvp of PVP_MULTS) {
      const row = runScenario(wall, pvp);
      rows.push(row);
      process.stdout.write(
        `wall=${wall.toFixed(2)} pvp=${pvp.toFixed(2)} -> d90=${row.day90EligiblePerSeed}/seed portal=${row.portalPerSeed}/seed pvp=${row.pvpDeathsPerSeed}/seed\n`,
      );
    }
  }

  fs.writeFileSync(REPORT_MD, buildMarkdown(rows));
  fs.writeFileSync(REPORT_CSV, buildCsv(rows));
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
}

main();
