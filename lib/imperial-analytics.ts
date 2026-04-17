import rawAnalytics from "@/simulations/output/season_v2_120d_results.json";

export type DailyAveragePoint = {
  day: number;
  avgScoreAlive: number;
  avgAliveTotal: number;
  avgHumansAlive: number;
  avgTotalVillages: number;
  avgTopScore: number;
};

export type BaselineSeedRow = {
  seed: number;
  kingDeathsPvp: number;
  kingDeathsPve: number;
  totalVillagesDay120: number;
  top1PowerScore: number;
  humansAlive: number;
  successions: number;
  portalEntrants: number;
};

export type LegacyLeader = {
  rank: number;
  label: string;
  scenario: string;
  seed: number;
  name: string;
  type: string;
  score: number;
  villages: number;
  tribe: string;
  alive: boolean;
};

type BaselineRowRaw = {
  seed: number;
  day90Eligible: number;
  portalSurvivors: number;
  aliveAtEnd: number;
  humansAliveAtEnd: number;
  maxInfluenceObserved: number;
};

type DailyRaw = {
  day: number;
  alivePlayers: number;
  villagesActive: number;
  avgInfluence: number;
  eligiblePlayers: number;
};

type CheckpointRaw = {
  villagesActive: number;
};

type ResultsRaw = {
  baseline: {
    table: BaselineRowRaw[];
    dailyAverages: DailyRaw[];
    checkpoints: Record<string, CheckpointRaw>;
    averages: {
      aliveAtEnd: number;
      humansAliveAtEnd: number;
      day90Eligible: number;
      portalSurvivors: number;
    };
    worldTotals: {
      regicides: number;
      portalBlocked: number;
      successions: number;
    };
  };
  allInDay109: {
    reachable: number;
    blocked: number;
    reachRatePct: number;
    avgEtaHours: number;
  };
};

const results = rawAnalytics as unknown as ResultsRaw;

const checkpoint120 = results.baseline.checkpoints["120"];
const table = results.baseline.table;

const averageTopInfluence = table.length
  ? table.reduce((acc, row) => acc + row.maxInfluenceObserved, 0) / table.length
  : 0;

const scoreEvolution: DailyAveragePoint[] = results.baseline.dailyAverages.map((point) => ({
  day: point.day,
  avgScoreAlive: point.avgInfluence,
  avgAliveTotal: point.alivePlayers,
  avgHumansAlive: 0,
  avgTotalVillages: point.villagesActive,
  avgTopScore: point.eligiblePlayers,
}));

const seedTable: BaselineSeedRow[] = table.map((row) => ({
  seed: row.seed,
  kingDeathsPvp: 0,
  kingDeathsPve: Math.max(0, 50 - row.portalSurvivors),
  totalVillagesDay120: Math.round(checkpoint120?.villagesActive ?? 0),
  top1PowerScore: row.maxInfluenceObserved,
  humansAlive: row.humansAliveAtEnd,
  successions: Math.round(results.baseline.worldTotals.successions ?? 0),
  portalEntrants: row.portalSurvivors,
}));

const legacyLeaders: LegacyLeader[] = [...table]
  .sort((a, b) => b.maxInfluenceObserved - a.maxInfluenceObserved)
  .slice(0, 5)
  .map((row, index) => ({
    rank: index + 1,
    label: `Seed ${row.seed}`,
    scenario: "baseline",
    seed: row.seed,
    name: `Comandante ${index + 1}`,
    type: "Simulado",
    score: row.maxInfluenceObserved,
    villages: Math.round(checkpoint120?.villagesActive ?? 0),
    tribe: "Coroa Imperial",
    alive: row.portalSurvivors > 0,
  }));

export const imperialAnalytics = {
  raw: results,
  overview: {
    survivalRateGlobal: (results.baseline.averages.aliveAtEnd / 50) * 100,
    humanSurvivalRate: (results.baseline.averages.humansAliveAtEnd / 8) * 100,
    averageVillagesDay120: checkpoint120?.villagesActive ?? 0,
    averageTop1Power: averageTopInfluence,
    averageAliveAtEnd: results.baseline.averages.aliveAtEnd,
    averageHumansAlive: results.baseline.averages.humansAliveAtEnd,
    averagePortalEntrants: results.baseline.averages.portalSurvivors,
  },
  kingDeathBreakdown: [
    {
      key: "pvp",
      label: "PvP",
      value: Math.round(results.baseline.worldTotals.regicides ?? 0),
      color: "#7aa6d9",
    },
    {
      key: "pve",
      label: "PvE / Horda",
      value: Math.round(results.baseline.worldTotals.portalBlocked ?? 0),
      color: "#cfe0f4",
    },
  ],
  scoreEvolution,
  seedTable,
  scenarioHighlights: [
    {
      key: "balance",
      title: "Balanceamento Atual",
      headline: `${formatDecimal(results.baseline.averages.day90Eligible, 1)} elegiveis no Dia 90`,
      detail: `Meta de 10-15 para corte de 1500 foi aplicada neste ciclo.`,
      metrics: [
        `Sobreviventes no portal: ${formatDecimal(results.baseline.averages.portalSurvivors, 1)}`,
        `Vivos no fim: ${formatDecimal(results.baseline.averages.aliveAtEnd, 1)}`,
        `Influ. topo medio: ${formatInteger(averageTopInfluence)}`,
      ],
    },
    {
      key: "all-in-109",
      title: "All-in Dia 109",
      headline: `${formatDecimal(results.allInDay109.reachRatePct, 1)}% de viabilidade fisica`,
      detail: `Cenario com mobilizacao x5 ate o Centro (0,0).`,
      metrics: [
        `Alcancam: ${results.allInDay109.reachable}`,
        `Bloqueados: ${results.allInDay109.blocked}`,
        `ETA medio: ${formatDecimal(results.allInDay109.avgEtaHours, 1)}h`,
      ],
    },
  ],
  legacyLeaders,
};

export function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${formatDecimal(value, digits)}%`;
}

export function formatSigned(value: number, digits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatDecimal(Math.abs(value), digits)}`;
}
